/**
 * ui.js — Rendu et interactions DOM du Petit 4
 *
 * Ce module gère tout ce qui est visible :
 *   - Affichage de la grille (jetons, ghost, animations)
 *   - Bandeaux de tour et de résultat
 *   - Cartes joueurs et scores
 *   - Popups (revanche, P2P log)
 *   - Transitions entre les écrans (connexion ↔ jeu)
 *
 * Il ne contient aucune règle de jeu ni logique réseau.
 * Il communique avec main.js via des callbacks enregistrés
 * avec les fonctions `on*`.
 */

import { ROWS, COLS, COLORS } from './game.js';

// ─────────────────────────────────────────────────────────────
//  Callbacks — enregistrés par main.js
// ─────────────────────────────────────────────────────────────

/**
 * Dictionnaire des callbacks UI → logique.
 * main.js les remplace au démarrage via les fonctions `on*`.
 */
const cb = {
    onColumnClick: (_col) => {},   // un joueur clique sur une colonne
    onRematchRequest: () => {},    // clic bouton "REVANCHE"
    onRematchAccept:  () => {},    // clic "Accepter" dans la popup
    onRematchDecline: () => {},    // clic "Quitter" dans la popup
    onQuit:           () => {},    // clic "✕ Quitter"
    onHostGame:       () => {},    // clic "Créer une partie"
    onJoinGame:       () => {},    // clic "JOIN"
    onCopyId:         () => {},    // clic "copier"
};

/** @param {function(number):void} fn */
export function onColumnClick(fn)   { cb.onColumnClick   = fn; }

/** @param {function():void} fn */
export function onRematchRequest(fn){ cb.onRematchRequest = fn; }

/** @param {function():void} fn */
export function onRematchAccept(fn) { cb.onRematchAccept  = fn; }

/** @param {function():void} fn */
export function onRematchDecline(fn){ cb.onRematchDecline = fn; }

/** @param {function():void} fn */
export function onQuit(fn)          { cb.onQuit           = fn; }

/** @param {function():void} fn */
export function onHostGame(fn)      { cb.onHostGame       = fn; }

/** @param {function():void} fn */
export function onJoinGame(fn)      { cb.onJoinGame       = fn; }

/** @param {function():void} fn */
export function onCopyId(fn)        { cb.onCopyId         = fn; }

// Exposer les callbacks au HTML (onclick="...") via window
window.uiHostGame       = () => cb.onHostGame();
window.uiJoinGame       = () => cb.onJoinGame();
window.uiQuitGame       = () => cb.onQuit();
window.uiCopyId         = () => cb.onCopyId();
window.uiRequestRematch = () => cb.onRematchRequest();
window.uiAcceptRematch  = () => cb.onRematchAccept();
window.uiDeclineRematch = () => cb.onRematchDecline();

// ─────────────────────────────────────────────────────────────
//  Écrans — connexion / jeu
// ─────────────────────────────────────────────────────────────

/**
 * Affiche l'écran "connexion" ou "jeu", masque l'autre.
 * @param {'connect'|'game'} name
 */
export function showScreen(name) {
    document.getElementById('screen-connect').classList.toggle('hidden', name !== 'connect');
    document.getElementById('screen-game').classList.toggle('hidden',    name !== 'game');
}

/**
 * Met à jour le texte de statut de l'écran de connexion.
 * @param {string}  msg
 * @param {boolean} isError  — true pour afficher en rouge
 */
export function setConnectStatus(msg, isError = false) {
    const el     = document.getElementById('connect-status');
    el.textContent = msg;
    el.className   = isError
        ? 'text-p4-red text-xs text-center min-h-4 font-mono'
        : 'text-p4-muted text-xs text-center min-h-4 font-mono';
}

/**
 * Affiche le message de statut sous la grille (tour, erreur réseau…).
 * @param {string} msg
 */
export function setGameStatus(msg) {
    document.getElementById('game-status').textContent = msg;
}

/**
 * Affiche l'ID local dans l'écran de connexion.
 * @param {string} id
 */
export function setMyId(id) {
    document.getElementById('my-id').textContent = id;
}

/**
 * Active ou désactive le bouton "Créer une partie".
 * @param {boolean} enabled
 */
export function setHostButtonEnabled(enabled) {
    document.getElementById('btn-host').disabled = !enabled;
}

/**
 * Lit l'ID saisi dans le champ "Rejoindre".
 * @returns {string}
 */
export function getHostIdInput() {
    return document.getElementById('host-id-input').value.trim().toUpperCase();
}

// ─────────────────────────────────────────────────────────────
//  Cartes joueurs et scores
// ─────────────────────────────────────────────────────────────

/**
 * Initialise les noms affichés dans les cartes joueurs.
 * @param {string} nameRed   — nom / ID du joueur rouge
 * @param {string} nameBlue  — nom / ID du joueur bleu
 */
export function setPlayerNames(nameRed, nameBlue) {
    document.getElementById('name-red').textContent  = nameRed;
    document.getElementById('name-blue').textContent = nameBlue;
}

/**
 * Met à jour les compteurs de score.
 * @param {{ red: number, blue: number }} scores
 */
export function updateScores(scores) {
    document.getElementById('score-red').textContent  = scores.red;
    document.getElementById('score-blue').textContent = scores.blue;
}

// ─────────────────────────────────────────────────────────────
//  Bandeau de tour
// ─────────────────────────────────────────────────────────────

// Couleurs de référence (identiques à celles du CSS)
const COLOR_RED    = '#dc2626';
const COLOR_BLUE   = '#2563eb';
const COLOR_INACT  = '#e2e0dc';

/**
 * Met à jour le bandeau au-dessus du plateau selon le tour actuel.
 *
 * - Votre tour   → fond légèrement teinté, texte coloré, bordure colorée
 * - Adversaire   → fond blanc, texte gris, bordure neutre
 *
 * @param {string}  currentTurn  — 'red' | 'blue'
 * @param {string}  myColor      — couleur du joueur local
 */
export function updateTurnUI(currentTurn, myColor) {
    const indicator  = document.getElementById('turn-indicator');
    const label      = document.getElementById('turn-label');
    const gameBanner = document.getElementById('game-banner');
    const isMyTurn   = currentTurn === myColor;
    const color      = currentTurn === COLORS.RED ? COLOR_RED : COLOR_BLUE;

    // Petit rond coloré dans le bandeau
    indicator.style.background  = color;
    indicator.style.borderColor = color;

    if (isMyTurn) {
        label.textContent            = 'Votre tour';
        label.style.color            = color;
        gameBanner.style.borderColor = color;
        gameBanner.style.background  = currentTurn === COLORS.RED
            ? 'rgba(220,38,38,0.05)'
            : 'rgba(37,99,235,0.05)';
    } else {
        label.textContent            = "Tour de l'adversaire";
        label.style.color            = '#a8a29e';
        gameBanner.style.borderColor = COLOR_INACT;
        gameBanner.style.background  = '#ffffff';
    }

    // Mettre en évidence la carte du joueur dont c'est le tour
    document.getElementById('player-red-card').style.borderColor  =
        currentTurn === COLORS.RED  ? COLOR_RED  : COLOR_INACT;
    document.getElementById('player-blue-card').style.borderColor =
        currentTurn === COLORS.BLUE ? COLOR_BLUE : COLOR_INACT;
}

// ─────────────────────────────────────────────────────────────
//  Bandeau de résultat (victoire / défaite / match nul)
// ─────────────────────────────────────────────────────────────

/**
 * Remplace le bandeau de tour par le bandeau de résultat.
 *
 * Styles :
 *   Victoire  → fond doré dégradé, texte ambre foncé
 *   Défaite   → fond violet sombre dégradé, texte violet clair
 *   Match nul → fond blanc, texte gris
 *
 * @param {string|null} winner   — 'red' | 'blue' | null (match nul)
 * @param {string}      myColor  — couleur du joueur local
 */
export function showResult(winner, myColor) {
    // Switcher les vues dans le bandeau unique
    document.getElementById('banner-turn').classList.add('hidden');
    document.getElementById('banner-result').classList.remove('hidden');

    // Initialiser le bouton revanche (idle = cliquable avec hover)
    setRematchBtn('idle');

    const gameBanner = document.getElementById('game-banner');
    const text       = document.getElementById('result-text');

    if (!winner) {
        // ── Match nul ────────────────────────────────────────────
        text.textContent             = 'MATCH NUL';
        text.className               = 'font-display text-2xl font-extrabold text-p4-muted';
        text.style.color             = '';
        gameBanner.style.borderColor = COLOR_INACT;
        gameBanner.style.background  = '#ffffff';

    } else if (winner === myColor) {
        // ── Victoire — encadré doré ───────────────────────────────
        text.textContent             = '🏆 VICTOIRE !';
        text.className               = 'font-display text-2xl font-extrabold';
        text.style.color             = '#92400e'; // ambre-800 : lisible sur fond doré
        gameBanner.style.borderColor = '#d97706';
        gameBanner.style.background  = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';

    } else {
        // ── Défaite — encadré violet sombre ───────────────────────
        text.textContent             = '💀 DÉFAITE';
        text.className               = 'font-display text-2xl font-extrabold';
        text.style.color             = '#e9d5ff'; // violet-200 : lisible sur fond sombre
        gameBanner.style.borderColor = '#4c1d95';
        gameBanner.style.background  = 'linear-gradient(135deg, #1e1b2e 0%, #2d1b69 100%)';
    }
}

/**
 * Remet le bandeau dans son état "tour en cours" (appelé à chaque revanche).
 */
export function resetBanner() {
    document.getElementById('banner-turn').classList.remove('hidden');
    document.getElementById('banner-result').classList.add('hidden');
    document.getElementById('result-text').style.color = '';
    const gb = document.getElementById('game-banner');
    gb.style.borderColor = COLOR_INACT;
    gb.style.background  = '#ffffff';
}

// ─────────────────────────────────────────────────────────────
//  Bouton "REVANCHE" — états visuels
// ─────────────────────────────────────────────────────────────

/**
 * Couleurs du bouton selon l'état.
 * On gère le hover en JS car Tailwind CDN ne génère pas les classes
 * ajoutées dynamiquement (elles ne sont pas dans le HTML statique).
 */
const BTN_IDLE  = { bg: '#f5f5f4', border: '#e2e0dc', color: '#57534e' };
const BTN_HOVER = { bg: '#ebe9e7', border: '#c8c5bf', color: '#1c1917' };

function applyBtnStyle(btn, styles) {
    btn.style.background  = styles.bg;
    btn.style.borderColor = styles.border;
    btn.style.color       = styles.color;
}

/**
 * Bascule l'état du bouton "REVANCHE".
 *
 * 'idle'    → bouton cliquable, style normal, hover activé
 * 'waiting' → bouton désactivé, texte "En attente…", opacité réduite
 *
 * @param {'idle'|'waiting'} state
 */
export function setRematchBtn(state) {
    const btn = document.getElementById('btn-rematch');
    if (!btn) return;

    // Retirer les anciens listeners pour éviter les doublons
    btn.onmouseenter = null;
    btn.onmouseleave = null;

    if (state === 'waiting') {
        btn.disabled      = true;
        btn.textContent   = 'En attente…';
        btn.style.opacity = '0.45';
        btn.style.cursor  = 'not-allowed';
        applyBtnStyle(btn, BTN_IDLE);

    } else {
        // idle : bouton actif avec hover géré manuellement
        btn.disabled      = false;
        btn.textContent   = 'REVANCHE';
        btn.style.opacity = '';
        btn.style.cursor  = '';
        applyBtnStyle(btn, BTN_IDLE);

        btn.onmouseenter = () => applyBtnStyle(btn, BTN_HOVER);
        btn.onmouseleave = () => applyBtnStyle(btn, BTN_IDLE);
    }
}

// ─────────────────────────────────────────────────────────────
//  Grille de jeu
// ─────────────────────────────────────────────────────────────

// Variables de module pour le ghost — mises à jour par renderBoard et refreshGhost
let _myColor     = '';
let _currentTurn = '';

/**
 * (Re)construit entièrement la grille HTML.
 * Crée COLS colonnes, chacune contenant :
 *   - un ghost (prévisualisation du jeton au survol)
 *   - ROWS cellules vides
 *
 * Les événements click / mouseenter / mouseleave sont attachés ici.
 * Le callback `cb.onColumnClick` est appelé avec l'indice de colonne.
 *
 * @param {string} myColor     — couleur du joueur local (pour le ghost)
 * @param {string} currentTurn — tour actuel (pour ne pas afficher ghost si pas notre tour)
 */
export function renderBoard(myColor, currentTurn) {
    const container = document.getElementById('board');
    container.innerHTML = '';

    // Initialiser les variables de module pour le ghost
    _myColor     = myColor;
    _currentTurn = currentTurn;

    for (let c = 0; c < COLS; c++) {
        const col = document.createElement('div');
        col.className    = 'col-hover flex flex-col gap-2 relative';
        col.dataset.col  = c;

        // Ghost : aperçu du jeton avant de cliquer
        const ghost = document.createElement('div');
        ghost.className = 'cell-ghost';
        ghost.id        = `ghost-${c}`;
        col.appendChild(ghost);

        // Cellules de jeu
        for (let r = 0; r < ROWS; r++) {
            const cell = document.createElement('div');
            cell.className = 'token empty';
            cell.id        = `cell-${r}-${c}`;
            col.appendChild(cell);
        }

        // Les listeners lisent _myColor et _currentTurn depuis le module
        // — pas besoin de les recréer à chaque coup
        col.addEventListener('click',      () => cb.onColumnClick(c));
        col.addEventListener('mouseenter', () => _updateGhost(c, _myColor, _currentTurn));
        col.addEventListener('mouseleave', () => _clearGhosts());
        container.appendChild(col);
    }
}

/**
 * Affiche le ghost (jeton fantôme) dans la colonne survolée,
 * uniquement si c'est le tour du joueur local.
 *
 * @param {number} col
 * @param {string} myColor
 * @param {string} currentTurn
 */
function _updateGhost(col, myColor, currentTurn) {
    _clearGhosts();
    if (currentTurn !== myColor) return; // pas notre tour, pas de ghost
    const g = document.getElementById(`ghost-${col}`);
    if (g) g.classList.add('token', myColor);
}

/** Efface tous les ghosts de la grille. */
function _clearGhosts() {
    for (let c = 0; c < COLS; c++) {
        const g = document.getElementById(`ghost-${c}`);
        if (g) g.className = 'cell-ghost';
    }
}

/**
 * Met à jour le ghost après un coup sans reconstruire la grille.
 * Les listeners mouseenter/mouseleave lisent _myColor et _currentTurn
 * depuis les variables de module — il suffit de les mettre à jour.
 *
 * @param {string} myColor
 * @param {string} currentTurn
 */
export function refreshGhost(myColor, currentTurn) {
    _myColor      = myColor;
    _currentTurn  = currentTurn;
    _clearGhosts(); // effacer le ghost éventuel du coup précédent
}

/**
 * Met à jour une cellule de la grille avec la couleur donnée.
 * Déclenche l'animation de chute si `animate` est true.
 *
 * @param {number}  row
 * @param {number}  col
 * @param {string}  color    — 'red' | 'blue'
 * @param {boolean} animate  — true pour l'animation de chute (coup local)
 */
export function renderCell(row, col, color, animate = false) {
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;

    cell.className = `token ${color}`;

    if (animate) {
        cell.classList.add('dropping');
        cell.addEventListener(
            'animationend',
            () => cell.classList.remove('dropping'),
            { once: true }
        );
    }
}

/**
 * Met en évidence les jetons gagnants avec l'animation pulse.
 * @param {Array} winCells — tableau de [row, col]
 */
export function highlightWinCells(winCells) {
    winCells.forEach(([r, c]) => {
        document.getElementById(`cell-${r}-${c}`)?.classList.add('win');
    });
}

// ─────────────────────────────────────────────────────────────
//  Popup revanche
// ─────────────────────────────────────────────────────────────

/** Affiche la popup de proposition de revanche. */
export function showRematchPopup() {
    document.getElementById('rematch-overlay').classList.add('active');
}

/** Cache la popup de revanche. */
export function hideRematchPopup() {
    document.getElementById('rematch-overlay').classList.remove('active');
}

// ─────────────────────────────────────────────────────────────
//  Log P2P — popup de trafic réseau
// ─────────────────────────────────────────────────────────────

/**
 * Stock des entrées de log.
 * Chaque entrée : { direction, type, payload, ts }
 *   direction — 'sent' | 'recv' | 'sys'
 *   type      — type du message PeerJS ('move', 'start', …) ou 'peer'/'error'
 *   payload   — chaîne JSON du message complet
 *   ts        — horodatage lisible
 */
let _logEntries = [];
let _logUnread  = 0;
let _logOpen    = false;

/**
 * Ajoute une entrée dans le log P2P et met à jour l'affichage.
 *
 * @param {'sent'|'recv'|'sys'} direction
 * @param {string}              type      — type du message
 * @param {string}              payload   — contenu JSON brut
 */
export function p2pLog(direction, type, payload) {
    const ts = new Date().toLocaleTimeString('fr', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    _logEntries.push({ direction, type, payload, ts });

    if (!_logOpen) {
        _logUnread++;
        const badge       = document.getElementById('p2p-badge');
        badge.textContent = _logUnread > 9 ? '9+' : _logUnread;
        badge.classList.remove('hidden');
    }

    _renderLog();
    _updateConnLabel();
}

/**
 * Met à jour le label de connexion dans la popup P2P
 * (affiche l'ID de l'adversaire si connecté).
 *
 * @param {boolean} connected
 * @param {string}  opponentName
 */
export function updateP2pConnLabel(connected, opponentName) {
    const label = document.getElementById('p2p-conn-label');
    if (!label) return;

    if (connected) {
        label.textContent = `↔ ${opponentName || 'connecté'}`;
        label.className   = 'text-xs font-mono text-green-600';
    } else {
        label.textContent = 'non connecté';
        label.className   = 'text-xs font-mono text-p4-muted';
    }
}

// Fonction interne — lit le label depuis le DOM (utilisé dans _updateConnLabel)
let _getConnInfo = () => ({ connected: false, opponentName: '' });

/** Enregistre la fonction qui fournit l'état de connexion pour le label. */
export function setConnInfoProvider(fn) { _getConnInfo = fn; }

function _updateConnLabel() {
    const { connected, opponentName } = _getConnInfo();
    updateP2pConnLabel(connected, opponentName);
}

/** Reconstruit l'affichage du log (du plus récent au plus ancien). */
function _renderLog() {
    const container = document.getElementById('p2p-log');
    if (!container) return;

    if (_logEntries.length === 0) {
        container.innerHTML = '<p class="text-xs text-p4-muted py-2 text-center">Aucun message pour l\'instant</p>';
        return;
    }

    // flex-col-reverse → dernier élément en haut visuellement
    container.innerHTML = _logEntries.slice().reverse().map(e => {
        const dirLabel   = e.direction === 'sent' ? '↑ SENT'
            : e.direction === 'recv' ? '↓ RECV'
                : '· SYS';
        const badgeClass = ['start', 'move', 'rematch', 'bye'].includes(e.type) ? e.type : 'other';

        // Formater le payload : supprimer la clé "type" (déjà dans le badge)
        // et afficher les autres clés sous forme "clé: valeur"
        let display = e.payload;
        try {
            const obj = JSON.parse(e.payload);
            display = Object.entries(obj)
                .filter(([k]) => k !== 'type')
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(' · ') || '—';
        } catch (_) { /* payload non-JSON : afficher brut */ }

        return `<div class="p2p-entry ${e.direction}">
      <span class="dir">${dirLabel}</span>
      <span class="body">
        <span class="mbadge ${badgeClass}">${e.type.toUpperCase()}</span>
        ${display}
      </span>
      <span class="ts">${e.ts}</span>
    </div>`;
    }).join('');
}

// Exposer les actions de la popup P2P au HTML
window.openP2pLog = function () {
    _logOpen   = true;
    _logUnread = 0;
    document.getElementById('p2p-badge').classList.add('hidden');
    document.getElementById('p2p-overlay').classList.add('active');
    document.getElementById('p2p-overlay').classList.remove('closing');
    _updateConnLabel();
    _renderLog();
};

window.closeP2pLog = function () {
    const overlay = document.getElementById('p2p-overlay');
    overlay.classList.add('closing');
    setTimeout(() => {
        overlay.classList.remove('active', 'closing');
        _logOpen = false;
    }, 200);
};

window.clearP2pLog = function () {
    _logEntries = [];
    _renderLog();
};