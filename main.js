/**
 * main.js — Point d'entrée et orchestrateur du Petit 4
 *
 * Ce fichier est le chef d'orchestre : il importe les trois modules
 * et les fait communiquer entre eux via des callbacks.
 *
 *   game.js    → logique pure (plateau, règles, victoire)
 *   ui.js      → rendu DOM et interactions visuelles
 *   network.js → PeerJS, protocole P2P
 *
 * Flux de données :
 *
 *   Action utilisateur (clic colonne)
 *     → ui.js détecte le clic, appelle cb.onColumnClick
 *     → main.js reçoit l'événement, appelle game.applyMove()
 *     → main.js appelle ui.renderCell() pour afficher le résultat
 *     → main.js appelle network.send() pour notifier l'adversaire
 *
 *   Message réseau reçu (coup adverse)
 *     → network.js reçoit le message, appelle cb.onMove
 *     → main.js reçoit l'événement, appelle game.applyMove()
 *     → main.js appelle ui.renderCell() pour afficher le résultat
 */

import Peer from 'https://esm.sh/peerjs@1.5.4';

import { createGame, applyMove, COLORS }       from './game.js';
import * as UI                                  from './ui.js';
import * as Net                                 from './network.js';

// ─────────────────────────────────────────────────────────────
//  État de session (au-dessus du jeu)
// ─────────────────────────────────────────────────────────────

/**
 * Couleur du joueur local : 'red' (hôte) ou 'blue' (invité).
 * Assignée au moment du choix hôte/invité.
 */
let myColor = '';

/**
 * Nom/ID de l'adversaire — affiché dans les cartes joueurs.
 */
let opponentName = '—';

/**
 * Indicateur de revanche en attente.
 * true = nous avons demandé une revanche et attendons la réponse.
 */
let rematchPending = false;

/**
 * Scores cumulés sur toute la session (persistants entre revanches).
 */
const scores = { red: 0, blue: 0 };

/**
 * État courant de la partie (créé par game.createGame()).
 * Réinitialisé à chaque nouvelle partie / revanche.
 */
let game = createGame();

// ─────────────────────────────────────────────────────────────
//  Initialisation
// ─────────────────────────────────────────────────────────────

/**
 * Point d'entrée — appelé une seule fois au chargement de la page.
 * Branche tous les callbacks entre ui.js, network.js et la logique locale.
 */
function init() {
    // ── Callbacks UI → main ──────────────────────────────────
    UI.onHostGame(handleHostGame);
    UI.onJoinGame(handleJoinGame);
    UI.onColumnClick(handleColumnClick);
    UI.onRematchRequest(handleRematchRequest);
    UI.onRematchAccept(handleRematchAccept);
    UI.onRematchDecline(handleRematchDecline);
    UI.onQuit(handleQuit);
    UI.onCopyId(handleCopyId);

    // ── Callbacks réseau → main ──────────────────────────────
    Net.onReady(handleNetReady);
    Net.onError(handleNetError);
    Net.onStart(handleNetStart);
    Net.onMove(handleNetMove);
    Net.onRematch(handleNetRematch);
    Net.onDecline(handleNetDecline);
    Net.onDisconnect(handleNetDisconnect);
    Net.onBye(handleNetBye);

    // Fournir à ui.js l'état de connexion pour le label P2P
    UI.setConnInfoProvider(() => ({
        connected:    Net.isConnected(),
        opponentName: opponentName,
    }));

    // Démarrer PeerJS
    Net.initPeer(Peer);
}

// ─────────────────────────────────────────────────────────────
//  Handlers UI
// ─────────────────────────────────────────────────────────────

/** L'utilisateur clique "Créer une partie" → mode hôte, rouge */
function handleHostGame() {
    myColor = COLORS.RED;
    UI.setHostButtonEnabled(false);
    UI.setConnectStatus('En attente d\'un joueur…');
    Net.waitForGuest();
}

/** L'utilisateur clique "JOIN" → mode invité, bleu */
function handleJoinGame() {
    const hostId = UI.getHostIdInput();

    if (!hostId || hostId.length < 4) {
        UI.setConnectStatus('ID invalide', true);
        return;
    }
    if (hostId === Net.getMyId()) {
        UI.setConnectStatus('Impossible de se connecter à soi-même', true);
        return;
    }

    myColor = COLORS.BLUE;
    UI.setConnectStatus(`Connexion à ${hostId}…`);
    Net.connectToHost(hostId);
}

/**
 * L'utilisateur clique sur une colonne de la grille.
 * Vérifie que c'est bien son tour, applique le coup localement,
 * met à jour l'UI et envoie le coup à l'adversaire.
 *
 * @param {number} col — colonne cliquée (0–6)
 */
function handleColumnClick(col) {
    if (game.gameOver || game.currentTurn !== myColor) return;

    const result = applyMove(game, col, myColor);
    if (!result.ok) return; // colonne pleine

    // Afficher le jeton avec animation (coup local)
    UI.renderCell(result.row, col, myColor, true);

    // Envoyer le coup à l'adversaire
    Net.send({ type: 'move', col, color: myColor });

    _afterMove(result);
}

/** L'utilisateur clique "REVANCHE" */
function handleRematchRequest() {
    Net.send({ type: 'rematch' });

    if (rematchPending) {
        // L'adversaire avait déjà demandé → on confirme → lancer
        _startNewRound();
    } else {
        rematchPending = true;
        UI.setRematchBtn('waiting');
        UI.p2pLog('sys', 'peer', 'Revanche demandée, en attente de confirmation');
    }
}

/** L'utilisateur accepte la revanche depuis la popup */
function handleRematchAccept() {
    UI.hideRematchPopup();
    rematchPending = true;
    Net.send({ type: 'rematch' });
    _startNewRound();
    UI.p2pLog('sys', 'peer', 'Revanche acceptée');
}

/** L'utilisateur refuse la revanche → tout le monde retourne à l'accueil */
function handleRematchDecline() {
    UI.hideRematchPopup();
    Net.disconnect({ type: 'decline' }); // notifier l'adversaire avant de fermer
    UI.p2pLog('sys', 'peer', 'Revanche refusée');
    _returnToLobby('Partie terminée');
}

/** L'utilisateur clique "✕ Quitter" */
function handleQuit() {
    Net.disconnect({ type: 'bye' });
    UI.p2pLog('sys', 'peer', 'Session terminée');
    _returnToLobby('Partie quittée');
}

/** L'utilisateur clique "copier" pour copier son ID */
function handleCopyId() {
    navigator.clipboard?.writeText(Net.getMyId());
    const btn = document.getElementById('btn-copy');
    if (btn) {
        btn.textContent = 'copié !';
        setTimeout(() => { btn.textContent = 'copier'; }, 1500);
    }
}

// ─────────────────────────────────────────────────────────────
//  Handlers réseau
// ─────────────────────────────────────────────────────────────

/** Peer PeerJS prêt → afficher l'ID, activer les boutons */
function handleNetReady(id) {
    UI.setMyId(id);
    UI.setHostButtonEnabled(true);
    UI.setConnectStatus('Prêt — partagez votre ID ou entrez celui de l\'hôte');
}

/** Erreur PeerJS */
function handleNetError(err) {
    UI.setConnectStatus(`Erreur : ${err.message}`, true);
}

/**
 * Message 'start' reçu → les deux joueurs démarrent la partie.
 * L'hôte envoie ce message dès que la connexion est ouverte.
 *
 * @param {string} hostId
 * @param {string} guestId
 */
function handleNetStart(hostId, guestId) {
    // Chaque joueur détermine le nom de l'adversaire selon son rôle
    opponentName = myColor === COLORS.RED ? guestId : hostId;

    const nameRed  = myColor === COLORS.RED  ? `${Net.getMyId()} (vous)` : opponentName;
    const nameBlue = myColor === COLORS.BLUE ? `${Net.getMyId()} (vous)` : opponentName;

    UI.showScreen('game');
    UI.setPlayerNames(nameRed, nameBlue);
    UI.setGameStatus('');
    _startNewRound();
}

/**
 * Coup reçu de l'adversaire → appliquer sans animation de clic
 * (l'animation de chute est quand même jouée car animate=false
 *  ici : on passe false, le jeton apparaît directement — c'est
 *  intentionnel pour différencier visuellement son coup du nôtre).
 *
 * @param {number} col
 * @param {string} color
 */
function handleNetMove(col, color) {
    if (game.gameOver || color === myColor) return;

    const result = applyMove(game, col, color);
    if (!result.ok) return;

    UI.renderCell(result.row, col, color, false);
    _afterMove(result);
}

/**
 * Message 'rematch' reçu.
 * Si on attendait (rematchPending = true) → lancer directement.
 * Sinon → afficher la popup de proposition.
 */
function handleNetRematch() {
    if (rematchPending) {
        _startNewRound();
    } else {
        UI.showRematchPopup();
    }
}

/** Refus de revanche reçu → retourner à l'accueil */
function handleNetDecline() {
    UI.p2pLog('sys', 'peer', 'Revanche refusée par l\'adversaire');
    _returnToLobby('L\'adversaire a refusé la revanche');
}

/** Connexion fermée inopinément (coupure réseau, onglet fermé…) */
function handleNetDisconnect() {
    UI.setGameStatus('Adversaire déconnecté');
    game.gameOver = true;
}

/** L'adversaire a quitté proprement */
function handleNetBye() {
    UI.setGameStatus('L\'adversaire a quitté la partie');
    game.gameOver = true;
}

// ─────────────────────────────────────────────────────────────
//  Logique de session
// ─────────────────────────────────────────────────────────────

/**
 * Lance ou relance une manche (partie / revanche).
 * Réinitialise l'état de jeu et l'interface.
 */
function _startNewRound() {
    game          = createGame();   // nouvel état de jeu vierge
    rematchPending = false;

    UI.renderBoard(myColor, game.currentTurn);
    UI.updateTurnUI(game.currentTurn, myColor);
    UI.resetBanner();
    UI.updateScores(scores);
    UI.setGameStatus('');
}

/**
 * Appelée après chaque coup (local ou distant).
 * Gère l'affichage post-coup : victoire, match nul, ou passage au tour suivant.
 *
 * @param {{ winCells: Array|null, draw: boolean }} result — résultat de applyMove
 */
function _afterMove(result) {
    if (result.winCells) {
        // ── Victoire ─────────────────────────────────────────────
        scores[game.winner]++;
        UI.highlightWinCells(result.winCells);
        UI.showResult(game.winner, myColor);
        UI.updateScores(scores);

    } else if (result.draw) {
        // ── Match nul ────────────────────────────────────────────
        UI.showResult(null, myColor);

    } else {
        // ── Partie continue : uniquement mettre à jour le bandeau ─
        // On NE reconstruit PAS la grille (renderBoard détruirait les jetons).
        // On met à jour l'indicateur de tour et le ghost.
        UI.updateTurnUI(game.currentTurn, myColor);
        UI.refreshGhost(myColor, game.currentTurn);
    }
}

/**
 * Retourne à l'écran de connexion et réinitialise l'état de session.
 * @param {string} statusMsg — message à afficher dans le statut de connexion
 */
function _returnToLobby(statusMsg) {
    UI.showScreen('connect');
    UI.setHostButtonEnabled(true);
    UI.setConnectStatus(statusMsg);
    rematchPending = false;
    opponentName   = '—';
}

// ─────────────────────────────────────────────────────────────
//  Démarrage
// ─────────────────────────────────────────────────────────────
init();