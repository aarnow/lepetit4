/**
 * game.js — Logique pure du Puissance 4 (Petit 4)
 *
 * Ce module est totalement indépendant du DOM et du réseau.
 * Il expose un objet `Game` qui représente l'état d'une partie
 * et les fonctions qui opèrent dessus.
 *
 * Principe : ce fichier ne contient QUE des règles métier.
 * Il ne sait pas qu'il tourne dans un navigateur.
 */

// ─────────────────────────────────────────────────────────────
//  Constantes du jeu
// ─────────────────────────────────────────────────────────────

/** Nombre de lignes de la grille */
export const ROWS = 6;

/** Nombre de colonnes de la grille */
export const COLS = 7;

/** Nombre de jetons alignés pour gagner */
export const WIN_LENGTH = 4;

/** Couleurs des joueurs */
export const COLORS = /** @type {const} */ ({ RED: 'red', BLUE: 'blue' });

// ─────────────────────────────────────────────────────────────
//  État d'une partie
// ─────────────────────────────────────────────────────────────

/**
 * Crée et retourne un nouvel état de partie vierge.
 *
 * Structure retournée :
 *   board       — grille 6×7, chaque case = null | 'red' | 'blue'
 *   currentTurn — couleur du joueur dont c'est le tour ('red' commence)
 *   gameOver    — true dès qu'une victoire ou un match nul est détecté
 *   winner      — null | 'red' | 'blue' | 'draw'
 *   winCells    — tableau de [row, col] des jetons gagnants (vide si pas de victoire)
 *
 * @returns {GameState}
 */
export function createGame() {
    return {
        board:       Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
        currentTurn: COLORS.RED,   // rouge commence toujours
        gameOver:    false,
        winner:      null,
        winCells:    [],
    };
}

// ─────────────────────────────────────────────────────────────
//  Actions sur le plateau
// ─────────────────────────────────────────────────────────────

/**
 * Trouve la première ligne libre (en partant du bas) dans une colonne.
 *
 * @param {GameState} game
 * @param {number}    col  — indice de colonne (0 à COLS-1)
 * @returns {number}  Indice de ligne disponible, ou -1 si la colonne est pleine
 */
export function getAvailableRow(game, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!game.board[r][col]) return r;
    }
    return -1; // colonne pleine
}

/**
 * Applique un coup dans la colonne donnée pour la couleur donnée.
 * Mute l'état de jeu et renvoie le résultat du coup.
 *
 * @param {GameState} game
 * @param {number}    col    — colonne choisie
 * @param {string}    color  — 'red' | 'blue'
 * @returns {{ ok: boolean, row: number, winCells: Array|null, draw: boolean }}
 *   ok        — false si colonne pleine (coup invalide)
 *   row       — ligne où le jeton a atterri
 *   winCells  — tableau [[r,c], …] des 4 jetons gagnants, ou null
 *   draw      — true si match nul après ce coup
 */
export function applyMove(game, col, color) {
    const row = getAvailableRow(game, col);

    // Coup invalide : colonne pleine
    if (row === -1) return { ok: false, row: -1, winCells: null, draw: false };

    // Placer le jeton
    game.board[row][col] = color;

    // Vérifier victoire
    const winCells = checkWin(game.board, row, col, color);
    if (winCells) {
        game.gameOver    = true;
        game.winner      = color;
        game.winCells    = winCells;
        return { ok: true, row, winCells, draw: false };
    }

    // Vérifier match nul (première ligne pleine = grille pleine)
    if (game.board[0].every(cell => cell !== null)) {
        game.gameOver = true;
        game.winner   = 'draw';
        return { ok: true, row, winCells: null, draw: true };
    }

    // Passer au tour suivant
    game.currentTurn = color === COLORS.RED ? COLORS.BLUE : COLORS.RED;
    return { ok: true, row, winCells: null, draw: false };
}

// ─────────────────────────────────────────────────────────────
//  Détection de victoire
// ─────────────────────────────────────────────────────────────

/**
 * Vérifie si la couleur `color` a aligné WIN_LENGTH jetons
 * en partant de la case (row, col) dans les 4 directions possibles.
 *
 * Directions explorées :
 *   [0, 1]  → horizontal
 *   [1, 0]  → vertical
 *   [1, 1]  → diagonale ↘
 *   [1,-1]  → diagonale ↙
 *
 * Pour chaque direction, on explore dans les deux sens (sign = -1 et +1)
 * et on accumule les coordonnées des jetons de même couleur.
 *
 * @param {Array}  board — grille 6×7
 * @param {number} row
 * @param {number} col
 * @param {string} color
 * @returns {Array|null} Tableau de [r, c] des jetons alignés, ou null
 */
export function checkWin(board, row, col, color) {
    // Les 4 axes de direction (on explore dans les deux sens pour chacun)
    const directions = [
        [0,  1],  // ← → horizontal
        [1,  0],  // ↑ ↓ vertical
        [1,  1],  // ↗ ↙ diagonale principale
        [1, -1],  // ↖ ↘ diagonale secondaire
    ];

    for (const [dr, dc] of directions) {
        // On part toujours de la case qui vient d'être jouée
        const cells = [[row, col]];

        // Explorer dans les deux sens de l'axe
        for (const sign of [-1, 1]) {
            let r = row + dr * sign;
            let c = col + dc * sign;

            while (
                r >= 0 && r < ROWS &&
                c >= 0 && c < COLS &&
                board[r][c] === color
                ) {
                cells.push([r, c]);
                r += dr * sign;
                c += dc * sign;
            }
        }

        if (cells.length >= WIN_LENGTH) return cells;
    }

    return null; // aucun alignement trouvé
}