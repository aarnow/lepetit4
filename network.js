/**
 * network.js — Connexion PeerJS et protocole P2P du Petit 4
 *
 * Ce module gère tout ce qui est réseau :
 *   - Création et initialisation du peer PeerJS
 *   - Connexions DataChannel entrantes et sortantes
 *   - Envoi et réception des messages du protocole
 *   - Notification des événements réseau à main.js via des callbacks
 *
 * Il ne contient aucune règle de jeu ni manipulation du DOM.
 *
 * ─── Protocole de messages ──────────────────────────────────
 *
 *  { type: 'start',   hostId, guestId }
 *      → Envoyé par l'hôte à l'invité dès que la connexion est établie.
 *        Déclenche le démarrage de la partie des deux côtés.
 *
 *  { type: 'move',    col, color }
 *      → Coup joué par un joueur. col = indice de colonne (0–6).
 *        Reçu par l'adversaire qui applique le coup localement.
 *
 *  { type: 'rematch' }
 *      → Demande ou confirmation de revanche.
 *        Premier envoi = demande ; si l'autre a déjà demandé = confirmation.
 *
 *  { type: 'decline' }
 *      → Refus de revanche. Les deux joueurs retournent à l'accueil.
 *
 *  { type: 'bye' }
 *      → Déconnexion volontaire (quitter la partie).
 */

import { p2pLog } from './ui.js';

// ─────────────────────────────────────────────────────────────
//  État réseau
// ─────────────────────────────────────────────────────────────

/** Instance PeerJS locale */
let _peer = null;

/** DataConnection active avec l'adversaire (null si déconnecté) */
let _conn = null;

/** ID local généré à l'initialisation */
let _myId = '';

// ─────────────────────────────────────────────────────────────
//  Callbacks — enregistrés par main.js
// ─────────────────────────────────────────────────────────────

/**
 * Dictionnaire des callbacks réseau → logique.
 * Chaque clé correspond à un événement réseau.
 * main.js les remplace au démarrage via les fonctions `on*`.
 */
const cb = {
    onReady:      (_myId) => {},             // peer prêt, ID connu
    onError:      (_err)  => {},             // erreur PeerJS
    onStart:      (_hostId, _guestId) => {}, // partie démarrée (msg 'start' reçu)
    onMove:       (_col, _color) => {},      // coup reçu de l'adversaire
    onRematch:    () => {},                  // demande/confirmation de revanche reçue
    onDecline:    () => {},                  // refus de revanche reçu
    onDisconnect: () => {},                  // connexion fermée inopinément
    onBye:        () => {},                  // adversaire a quitté proprement
};

/** @param {function(string):void} fn */
export function onReady(fn)      { cb.onReady      = fn; }

/** @param {function(Error):void} fn */
export function onError(fn)      { cb.onError       = fn; }

/** @param {function(string,string):void} fn */
export function onStart(fn)      { cb.onStart       = fn; }

/** @param {function(number,string):void} fn */
export function onMove(fn)       { cb.onMove        = fn; }

/** @param {function():void} fn */
export function onRematch(fn)    { cb.onRematch      = fn; }

/** @param {function():void} fn */
export function onDecline(fn)    { cb.onDecline      = fn; }

/** @param {function():void} fn */
export function onDisconnect(fn) { cb.onDisconnect   = fn; }

/** @param {function():void} fn */
export function onBye(fn)        { cb.onBye          = fn; }

// ─────────────────────────────────────────────────────────────
//  Initialisation
// ─────────────────────────────────────────────────────────────

/**
 * Crée le Peer PeerJS avec un ID aléatoire de 8 caractères.
 * L'ID est long pour minimiser les collisions sur le serveur public.
 * Enregistre les handlers globaux (open, error, connection).
 *
 * @param {typeof import('peerjs').Peer} PeerClass — la classe Peer importée
 */
export function initPeer(PeerClass) {
    // Générer un ID de 8 caractères alphanumériques majuscules
    _myId = Math.random().toString(36).slice(2, 6).toUpperCase()
        + Math.random().toString(36).slice(2, 6).toUpperCase();

    _peer = new PeerClass(_myId);

    // ── Peer prêt : serveur de signaling joignable ────────────
    _peer.on('open', () => {
        p2pLog('sys', 'peer', `Connecté au serveur PeerJS — ID : ${_myId}`);
        cb.onReady(_myId);
    });

    // ── Erreur PeerJS (ID non disponible, réseau, etc.) ───────
    _peer.on('error', (err) => {
        p2pLog('sys', 'error', err.message);
        cb.onError(err);
    });

    // ── Connexion DataChannel entrante (mode invité → hôte) ───
    _peer.on('connection', (conn) => {
        // Une seule connexion active à la fois
        if (_conn) { conn.close(); return; }
        _conn = conn;
        _setupDataConn();

        _conn.on('open', () => {
            const guestId = _conn.peer;
            p2pLog('sys', 'peer', `Connexion entrante de ${guestId}`);

            // Envoyer 'start' à l'invité pour qu'il démarre sa partie
            send({ type: 'start', hostId: _myId, guestId });

            // L'hôte doit aussi démarrer sa propre partie —
            // il n'enverra pas 'start' à lui-même, donc on appelle
            // directement le callback comme si on l'avait reçu.
            cb.onStart(_myId, guestId);
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  Connexion
// ─────────────────────────────────────────────────────────────

/**
 * (Mode hôte) Met le peer en écoute.
 * La connexion entrante est gérée dans `initPeer` via `peer.on('connection')`.
 * Cette fonction est un no-op ici mais documente l'intention.
 */
export function waitForGuest() {
    p2pLog('sys', 'peer', 'Mode hôte — en attente d\'un invité');
    // La connexion sera reçue dans le handler 'connection' de initPeer
}

/**
 * (Mode invité) Ouvre une DataConnection vers l'hôte.
 * @param {string} hostId — ID de l'hôte
 */
export function connectToHost(hostId) {
    p2pLog('sys', 'peer', `Connexion vers ${hostId}…`);
    _conn = _peer.connect(hostId, { reliable: true, serialization: 'json' });
    _setupDataConn();

    _conn.on('open', () => {
        p2pLog('sys', 'peer', `DataConnection établie avec ${hostId}`);
    });
}

/**
 * Attache les handlers de données et de fermeture sur `_conn`.
 * Appelé aussi bien côté hôte (connexion entrante) que côté invité.
 */
function _setupDataConn() {
    _conn.on('data',  _handleMessage);

    _conn.on('close', () => {
        p2pLog('sys', 'peer', 'Connexion fermée');
        _conn = null;
        cb.onDisconnect();
    });

    _conn.on('error', (err) => {
        p2pLog('sys', 'error', `DataConnection : ${err.message}`);
    });
}

// ─────────────────────────────────────────────────────────────
//  Envoi de messages
// ─────────────────────────────────────────────────────────────

/**
 * Envoie un message à l'adversaire via la DataConnection.
 * Logge le message dans le panneau P2P.
 *
 * @param {object} msg — objet avec au moins { type: string }
 */
export function send(msg) {
    if (_conn && _conn.open) {
        _conn.send(msg);
        p2pLog('sent', msg.type, JSON.stringify(msg));
    }
}

// ─────────────────────────────────────────────────────────────
//  Réception et dispatch des messages
// ─────────────────────────────────────────────────────────────

/**
 * Dispatch les messages entrants vers les callbacks appropriés.
 * Chaque `case` correspond à un type de message du protocole.
 *
 * @param {object} msg
 */
function _handleMessage(msg) {
    p2pLog('recv', msg.type, JSON.stringify(msg));

    switch (msg.type) {

        /**
         * 'start' — Reçu par l'invité quand l'hôte a établi la connexion.
         * Fournit les IDs des deux joueurs pour afficher les noms.
         */
        case 'start':
            cb.onStart(msg.hostId, msg.guestId);
            break;

        /**
         * 'move' — Coup joué par l'adversaire.
         * On transmet la colonne et la couleur à la logique de jeu.
         */
        case 'move':
            cb.onMove(msg.col, msg.color);
            break;

        /**
         * 'rematch' — Demande ou confirmation de revanche.
         * main.js gère la distinction (en attente ou non).
         */
        case 'rematch':
            cb.onRematch();
            break;

        /**
         * 'decline' — Refus de revanche.
         * Les deux joueurs doivent retourner à l'accueil.
         */
        case 'decline':
            cb.onDecline();
            break;

        /**
         * 'bye' — L'adversaire a quitté la partie volontairement.
         */
        case 'bye':
            cb.onBye();
            break;
    }
}

// ─────────────────────────────────────────────────────────────
//  Déconnexion
// ─────────────────────────────────────────────────────────────

/**
 * Ferme proprement la connexion avec l'adversaire.
 * Envoie optionnellement un message avant de fermer.
 *
 * @param {{ type: string }|null} farewell — message à envoyer avant fermeture
 */
export function disconnect(farewell = null) {
    if (farewell) send(farewell);
    _conn?.close();
    _conn = null;
}

// ─────────────────────────────────────────────────────────────
//  Accesseurs (lecture seule)
// ─────────────────────────────────────────────────────────────

/** @returns {string} ID local */
export function getMyId() { return _myId; }

/** @returns {boolean} true si une connexion DataChannel est ouverte */
export function isConnected() { return !!(_conn && _conn.open); }

/** @returns {string} ID de l'adversaire, ou '' si non connecté */
export function getPeerId() { return _conn?.peer ?? ''; }