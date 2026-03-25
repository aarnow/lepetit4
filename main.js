import Peer from 'https://esm.sh/peerjs@1.5.4';

// ─────────────────────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────────────────────
const ROWS       = 6;
const COLS       = 7;
const WIN_LENGTH = 4;

// ─────────────────────────────────────────────────────────────
//  État global
// ─────────────────────────────────────────────────────────────
let peer, conn;
let myId, myColor;
let board          = [];
let currentTurn    = 'red';
let gameOver       = false;
let isHost         = false;
let rematchPending = false;
let opponentName   = '—';
const scores       = { red: 0, blue: 0 };

// ─────────────────────────────────────────────────────────────
//  Init PeerJS
// ─────────────────────────────────────────────────────────────
const myId8 = Math.random().toString(36).slice(2, 6).toUpperCase()
    + Math.random().toString(36).slice(2, 6).toUpperCase();

peer = new Peer(myId8);
myId = myId8;

peer.on('open', () => {
    document.getElementById('my-id').textContent = myId;
    document.getElementById('btn-host').disabled = false;
    setConnectStatus('Prêt — partagez votre ID ou entrez celui de l\'hôte');
    p2pLog('sys', 'peer', `Connecté au serveur PeerJS — ID : ${myId}`);
});

peer.on('error', (err) => {
    setConnectStatus(`Erreur PeerJS : ${err.message}`, true);
    p2pLog('sys', 'error', err.message);
});

// ─────────────────────────────────────────────────────────────
//  Hôte
// ─────────────────────────────────────────────────────────────
window.hostGame = function () {
    isHost  = true;
    myColor = 'red';
    document.getElementById('btn-host').disabled = true;
    setConnectStatus('En attente d\'un joueur…');
    p2pLog('sys', 'peer', 'Mode hôte — écoute des connexions entrantes');

    peer.on('connection', (c) => {
        if (conn) { c.close(); return; }
        conn = c;
        setupConn();
        conn.on('open', () => {
            opponentName = conn.peer;
            const msg = { type: 'start', hostId: myId, guestId: conn.peer };
            send(msg);
            startGame();
        });
    });
};

// ─────────────────────────────────────────────────────────────
//  Invité
// ─────────────────────────────────────────────────────────────
window.joinGame = function () {
    const hostId = document.getElementById('host-id-input').value.trim().toUpperCase();
    if (!hostId || hostId.length < 4) { setConnectStatus('ID invalide', true); return; }
    if (hostId === myId) { setConnectStatus('Impossible de se connecter à soi-même', true); return; }

    isHost  = false;
    myColor = 'blue';
    setConnectStatus(`Connexion à ${hostId}…`);
    p2pLog('sys', 'peer', `Tentative de connexion vers ${hostId}`);

    conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
    setupConn();

    conn.on('open', () => {
        opponentName = hostId;
        p2pLog('sys', 'peer', `DataConnection établie avec ${hostId}`);
        setConnectStatus(`Connecté à ${hostId}`);
    });
};

// ─────────────────────────────────────────────────────────────
//  DataConnection
// ─────────────────────────────────────────────────────────────
function setupConn() {
    conn.on('data',  handleMessage);
    conn.on('close', onDisconnect);
    conn.on('error', (e) => {
        setGameStatus(`Erreur connexion : ${e.message}`);
        p2pLog('sys', 'error', e.message);
    });
}

function send(msg) {
    if (conn && conn.open) {
        conn.send(msg);
        p2pLog('sent', msg.type, JSON.stringify(msg));
    }
}

function onDisconnect() {
    setGameStatus('Adversaire déconnecté');
    p2pLog('sys', 'peer', 'Connexion fermée');
    gameOver = true;
}

// ─────────────────────────────────────────────────────────────
//  Protocole de messages
//    { type: 'start',   hostId, guestId }
//    { type: 'move',    col, color }
//    { type: 'rematch' }
//    { type: 'decline' }  → refus de revanche → l'adversaire doit aussi quitter
//    { type: 'bye' }
// ─────────────────────────────────────────────────────────────
function handleMessage(msg) {
    p2pLog('recv', msg.type, JSON.stringify(msg));

    switch (msg.type) {
        case 'start':
            opponentName = isHost ? msg.guestId : msg.hostId;
            startGame();
            break;

        case 'move':
            if (!gameOver && msg.color !== myColor) {
                applyMove(msg.col, msg.color, false);
            }
            break;

        case 'rematch':
            if (rematchPending) {
                // Les deux ont confirmé (l'adversaire a accepté notre demande)
                resetBoard();
            } else {
                // L'adversaire propose une revanche → afficher la popup
                showRematchPopup();
            }
            break;

        case 'decline':
            // L'adversaire a refusé la revanche → on retourne à l'accueil
            p2pLog('sys', 'peer', 'Revanche refusée par l\'adversaire');
            conn?.close();
            conn = null;
            showScreen('connect');
            document.getElementById('btn-host').disabled = false;
            setConnectStatus('L\'adversaire a refusé la revanche');
            break;

        case 'bye':
            onDisconnect();
            break;
    }
}

// ─────────────────────────────────────────────────────────────
//  Démarrer / réinitialiser
// ─────────────────────────────────────────────────────────────
function startGame() {
    showScreen('game');
    resetBoard();
    document.getElementById('name-red').textContent    = isHost ? `${myId} (vous)` : opponentName;
    document.getElementById('name-blue').textContent   = isHost ? opponentName : `${myId} (vous)`;
    setGameStatus('');
}

function resetBoard() {
    gameOver       = false;
    rematchPending = false;
    currentTurn    = 'red';
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    renderBoard();
    updateTurnUI();
    document.getElementById('banner-turn').classList.remove('hidden');
    document.getElementById('banner-result').classList.add('hidden');
    const gb = document.getElementById('game-banner');
    gb.style.borderColor = '#e2e0dc';
    gb.style.background  = '#ffffff';
    // Reset le style inline du texte résultat (couleur victoire/défaite)
    const rt = document.getElementById('result-text');
    rt.style.color = '';
    // Réinitialiser le bouton revanche
    setRematchBtn('idle');
    setGameStatus('');
}

// ─────────────────────────────────────────────────────────────
//  Rendu de la grille
// ─────────────────────────────────────────────────────────────
function renderBoard() {
    const container = document.getElementById('board');
    container.innerHTML = '';

    for (let c = 0; c < COLS; c++) {
        const col = document.createElement('div');
        col.className   = 'col-hover flex flex-col gap-2 relative';
        col.dataset.col = c;

        const ghost = document.createElement('div');
        ghost.className = 'cell-ghost';
        ghost.id = `ghost-${c}`;
        col.appendChild(ghost);

        for (let r = 0; r < ROWS; r++) {
            const cell = document.createElement('div');
            cell.className = 'token empty';
            cell.id = `cell-${r}-${c}`;
            col.appendChild(cell);
        }

        col.addEventListener('click',      () => onColumnClick(c));
        col.addEventListener('mouseenter', () => updateGhost(c));
        col.addEventListener('mouseleave', () => clearGhosts());
        container.appendChild(col);
    }
}

function updateGhost(col) {
    clearGhosts();
    if (gameOver || currentTurn !== myColor) return;
    if (getAvailableRow(col) === -1) return;
    const g = document.getElementById(`ghost-${col}`);
    if (g) g.classList.add('token', currentTurn);
}

function clearGhosts() {
    for (let c = 0; c < COLS; c++) {
        const g = document.getElementById(`ghost-${c}`);
        if (g) g.className = 'cell-ghost';
    }
}

function renderCell(row, col, color, animate = false) {
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;
    cell.className = `token ${color}`;
    if (animate) {
        cell.classList.add('dropping');
        cell.addEventListener('animationend', () => cell.classList.remove('dropping'), { once: true });
    }
}

// ─────────────────────────────────────────────────────────────
//  Logique de jeu
// ─────────────────────────────────────────────────────────────
function onColumnClick(col) {
    if (gameOver || currentTurn !== myColor) return;
    if (getAvailableRow(col) === -1) return;
    applyMove(col, myColor, true);
    send({ type: 'move', col, color: myColor });
}

function applyMove(col, color, animate) {
    const row = getAvailableRow(col);
    if (row === -1) return;

    board[row][col] = color;
    renderCell(row, col, color, animate);

    const winCells = checkWin(row, col, color);
    if (winCells) {
        gameOver = true;
        scores[color]++;
        highlightWin(winCells);
        showResult(color);
        updateScores();
        return;
    }

    if (isDraw()) {
        gameOver = true;
        showResult(null);
        return;
    }

    currentTurn = color === 'red' ? 'blue' : 'red';
    updateTurnUI();
}

function getAvailableRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) return r;
    }
    return -1;
}

function checkWin(row, col, color) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
        const cells = [[row, col]];
        for (const sign of [-1, 1]) {
            let r = row + dr * sign, c = col + dc * sign;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
                cells.push([r, c]);
                r += dr * sign; c += dc * sign;
            }
        }
        if (cells.length >= WIN_LENGTH) return cells;
    }
    return null;
}

function isDraw() {
    return board[0].every(cell => cell !== null);
}

function highlightWin(cells) {
    cells.forEach(([r, c]) => {
        document.getElementById(`cell-${r}-${c}`)?.classList.add('win');
    });
}

// ─────────────────────────────────────────────────────────────
//  UI
// ─────────────────────────────────────────────────────────────
function updateTurnUI() {
    const indicator = document.getElementById('turn-indicator');
    const label     = document.getElementById('turn-label');
    const gameBanner = document.getElementById('game-banner');
    const isMyTurn  = currentTurn === myColor;

    const COLOR_RED  = '#dc2626';
    const COLOR_BLUE = '#2563eb';
    const INACTIVE   = '#e2e0dc';
    const color      = currentTurn === 'red' ? COLOR_RED : COLOR_BLUE;

    // Indicateur rond
    indicator.style.background  = color;
    indicator.style.borderColor = color;

    // Bandeau texte au-dessus du plateau
    if (isMyTurn) {
        label.textContent = 'Votre tour';
        label.style.color = color;
        gameBanner.style.borderColor = color;
        gameBanner.style.background  = currentTurn === 'red'
            ? 'rgba(220,38,38,0.05)'
            : 'rgba(37,99,235,0.05)';
    } else {
        label.textContent = `Tour de l'adversaire`;
        label.style.color = '#a8a29e';
        gameBanner.style.borderColor = INACTIVE;
        gameBanner.style.background  = '#ffffff';
    }

    // Highlight carte joueur actif
    document.getElementById('player-red-card').style.borderColor  =
        currentTurn === 'red'  ? COLOR_RED  : INACTIVE;
    document.getElementById('player-blue-card').style.borderColor =
        currentTurn === 'blue' ? COLOR_BLUE : INACTIVE;
}

function updateScores() {
    document.getElementById('score-red').textContent    = scores.red;
    document.getElementById('score-blue').textContent   = scores.blue;
}

function showResult(winner) {
    // Cacher la vue "tour" et afficher la vue "résultat" dans le même bandeau
    document.getElementById('banner-turn').classList.add('hidden');
    document.getElementById('banner-result').classList.remove('hidden');
    setRematchBtn('idle'); // initialise le style + hover du bouton

    const gameBanner = document.getElementById('game-banner');
    const text       = document.getElementById('result-text');

    if (!winner) {
        text.textContent           = 'MATCH NUL';
        text.className             = 'font-display text-2xl font-extrabold text-p4-muted';
        gameBanner.style.borderColor = '#e2e0dc';
        gameBanner.style.background  = '#ffffff';
    } else {
        const isMe = winner === myColor;

        if (isMe) {
            // Victoire — encadré doré
            text.textContent             = '🏆 VICTOIRE !';
            text.className               = 'font-display text-2xl font-extrabold';
            text.style.color             = '#92400e'; // ambre foncé lisible sur fond doré
            gameBanner.style.borderColor = '#d97706';
            gameBanner.style.background  = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
        } else {
            // Défaite — encadré noir/violet sombre
            text.textContent             = '💀 DÉFAITE';
            text.className               = 'font-display text-2xl font-extrabold';
            text.style.color             = '#e9d5ff'; // violet clair lisible sur fond sombre
            gameBanner.style.borderColor = '#4c1d95';
            gameBanner.style.background  = 'linear-gradient(135deg, #1e1b2e 0%, #2d1b69 100%)';
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Actions publiques
// ─────────────────────────────────────────────────────────────
window.requestRematch = function () {
    send({ type: 'rematch' });
    if (rematchPending) {
        resetBoard();
    } else {
        rematchPending = true;
        setRematchBtn('waiting');
        p2pLog('sys', 'peer', 'Revanche demandée, en attente de confirmation');
    }
};

window.quitGame = function () {
    send({ type: 'bye' });
    conn?.close();
    conn = null;
    showScreen('connect');
    document.getElementById('btn-host').disabled = false;
    setConnectStatus('Partie quittée');
    p2pLog('sys', 'peer', 'Session terminée');
};

window.copyId = function () {
    navigator.clipboard?.writeText(myId);
    const btn = document.getElementById('btn-copy');
    btn.textContent = 'copié !';
    setTimeout(() => { btn.textContent = 'copier'; }, 1500);
};

// ─────────────────────────────────────────────────────────────
//  Log P2P — popup
// ─────────────────────────────────────────────────────────────
let p2pLogEntries  = [];
let p2pUnread      = 0;
let p2pOpen        = false;

function p2pLog(direction, type, payload) {
    const ts = new Date().toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    p2pLogEntries.push({ direction, type, payload, ts });

    if (!p2pOpen) {
        p2pUnread++;
        const badge = document.getElementById('p2p-badge');
        badge.textContent = p2pUnread > 9 ? '9+' : p2pUnread;
        badge.classList.remove('hidden');
    }

    renderP2pLog();
    updateP2pConnLabel();
}

function renderP2pLog() {
    const container = document.getElementById('p2p-log');
    if (!container) return;

    if (p2pLogEntries.length === 0) {
        container.innerHTML = '<p class="text-xs text-p4-muted py-2 text-center">Aucun message pour l\'instant</p>';
        return;
    }

    // Afficher du plus récent au plus ancien (flex-col-reverse)
    container.innerHTML = p2pLogEntries.slice().reverse().map(e => {
        const dirLabel  = e.direction === 'sent' ? '↑ SENT'
            : e.direction === 'recv' ? '↓ RECV'
                : '· SYS';
        const badgeClass = ['start','move','rematch','bye'].includes(e.type) ? e.type : 'other';

        // Formater le payload JSON de façon lisible
        let display = e.payload;
        try {
            const obj = JSON.parse(e.payload);
            display = Object.entries(obj)
                .filter(([k]) => k !== 'type')
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(' · ') || '—';
        } catch (_) { /* payload non-JSON, afficher brut */ }

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

function updateP2pConnLabel() {
    const label = document.getElementById('p2p-conn-label');
    if (!label) return;
    if (conn && conn.open) {
        label.textContent = `↔ ${opponentName !== '—' ? opponentName : 'connecté'}`;
        label.className = 'text-xs font-mono text-green-600';
    } else {
        label.textContent = 'non connecté';
        label.className = 'text-xs font-mono text-p4-muted';
    }
}

window.openP2pLog = function () {
    p2pOpen = true;
    p2pUnread = 0;
    document.getElementById('p2p-badge').classList.add('hidden');
    document.getElementById('p2p-overlay').classList.add('active');
    document.getElementById('p2p-overlay').classList.remove('closing');
    updateP2pConnLabel();
    renderP2pLog();
};

window.closeP2pLog = function () {
    const overlay = document.getElementById('p2p-overlay');
    overlay.classList.add('closing');
    setTimeout(() => {
        overlay.classList.remove('active', 'closing');
        p2pOpen = false;
    }, 200);
};

window.clearP2pLog = function () {
    p2pLogEntries = [];
    renderP2pLog();
};

// ─────────────────────────────────────────────────────────────
//  Popup revanche
// ─────────────────────────────────────────────────────────────
//  Bouton revanche — états
// ─────────────────────────────────────────────────────────────
// Couleurs du bouton revanche (référence)
const BTN_IDLE  = { bg: '#f5f5f4',  border: '#e2e0dc', color: '#57534e' };
const BTN_HOVER = { bg: '#f5f5f4',      border: '#c8c5bf', color: '#1c1917' };

function applyBtnStyle(btn, styles) {
    btn.style.background  = styles.bg;
    btn.style.borderColor = styles.border;
    btn.style.color       = styles.color;
}

function setRematchBtn(state) {
    const btn = document.getElementById('btn-rematch');
    if (!btn) return;

    // Nettoyer les anciens listeners hover pour éviter les doublons
    btn.onmouseenter = null;
    btn.onmouseleave = null;

    if (state === 'waiting') {
        btn.disabled      = true;
        btn.textContent   = "En attente…";
        btn.style.opacity = '0.45';
        btn.style.cursor  = 'not-allowed';
        applyBtnStyle(btn, BTN_IDLE);
    } else {
        // idle : bouton actif avec hover géré en JS
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
function showRematchPopup() {
    const overlay = document.getElementById('rematch-overlay');
    overlay.classList.add('active');
}

function hideRematchPopup() {
    const overlay = document.getElementById('rematch-overlay');
    overlay.classList.remove('active');
}

window.acceptRematch = function () {
    hideRematchPopup();
    rematchPending = true;
    send({ type: 'rematch' });
    resetBoard();
    p2pLog('sys', 'peer', 'Revanche acceptée');
};

window.declineRematch = function () {
    hideRematchPopup();
    // Notifier l'adversaire du refus avec 'decline' (pas 'bye')
    // pour qu'il soit aussi renvoyé à l'accueil proprement
    send({ type: 'decline' });
    conn?.close();
    conn = null;
    p2pLog('sys', 'peer', 'Revanche refusée');
    showScreen('connect');
    document.getElementById('btn-host').disabled = false;
    setConnectStatus('Partie terminée');
};

// ─────────────────────────────────────────────────────────────
//  Utilitaires
// ─────────────────────────────────────────────────────────────
function showScreen(name) {
    document.getElementById('screen-connect').classList.toggle('hidden', name !== 'connect');
    document.getElementById('screen-game').classList.toggle('hidden',   name !== 'game');
}

function setConnectStatus(msg, isError = false) {
    const el = document.getElementById('connect-status');
    el.textContent = msg;
    el.className   = isError
        ? 'text-p4-red text-xs text-center min-h-4 font-mono'
        : 'text-p4-muted text-xs text-center min-h-4 font-mono';
}

function setGameStatus(msg) {
    document.getElementById('game-status').textContent = msg;
}