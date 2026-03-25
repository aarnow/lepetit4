# 🔴 Petit 4 — Puissance 4 Peer-to-Peer

> Projet éducatif · Propulsé par [Claude Code](https://claude.ai/code)

Un Puissance 4 jouable en ligne entre deux joueurs, **sans serveur**, grâce au protocole **WebRTC** via la bibliothèque **PeerJS**.

---

## 📖 À propos du projet

**Petit 4** est avant tout un projet à **but éducatif**. L'objectif n'est pas seulement de jouer, mais de comprendre comment deux navigateurs peuvent communiquer directement l'un avec l'autre, sans passer par un serveur central.

Le code est **abondamment commenté** : chaque fichier, chaque fonction, chaque choix d'architecture est expliqué pour permettre à n'importe qui de lire le projet comme on lirait un tutoriel. Les commentaires expliquent le *pourquoi*, pas seulement le *comment*.

---

## 🌐 Le Peer-to-Peer expliqué

### Qu'est-ce que le P2P ?

Dans une architecture classique **client-serveur**, toutes les communications transitent par un serveur central :

```
Joueur A  ──►  Serveur  ──►  Joueur B
Joueur A  ◄──  Serveur  ◄──  Joueur B
```

Dans une architecture **Peer-to-Peer (P2P)**, les clients communiquent **directement** entre eux une fois la connexion établie :

```
Joueur A  ◄────────────────►  Joueur B
```

### WebRTC — la technologie derrière le P2P dans le navigateur

**WebRTC** (Web Real-Time Communication) est une API standard des navigateurs modernes qui permet :
- L'échange de flux audio/vidéo (visioconférence)
- L'échange de données arbitraires (messages, état de jeu…)

Le tout **directement entre navigateurs**, chiffré, sans plugin.

### Le problème du "premier contact" — STUN et TURN

Pour établir une connexion P2P, les deux pairs doivent d'abord se trouver. C'est le rôle du **signaling** :

1. **STUN** *(Session Traversal Utilities for NAT)* — permet à chaque pair de connaître son adresse IP publique et de négocier la traversée des pare-feux et routeurs NAT.
2. **TURN** *(Traversal Using Relays around NAT)* — serveur de relais de secours si la connexion directe est impossible (réseaux très restrictifs).
3. **Signaling server** — serveur léger dont le seul rôle est d'échanger les métadonnées de connexion (ICE candidates, SDP) entre les deux pairs. Une fois la connexion P2P établie, il n'intervient plus.

```
Phase 1 — Signaling (via serveur léger)
  Joueur A ──► [Serveur PeerJS] ◄── Joueur B
              échange d'IDs et
              de métadonnées ICE

Phase 2 — Connexion directe (P2P)
  Joueur A ◄────── WebRTC DataChannel ──────► Joueur B
              plus de serveur impliqué !
```

### PeerJS — simplifier WebRTC

WebRTC brut est complexe à mettre en œuvre. **[PeerJS](https://peerjs.com/)** est une bibliothèque qui abstrait toute cette complexité et expose une API simple :

```javascript
// Créer un peer et se connecter à un autre
const peer = new Peer('mon-id');
const conn = peer.connect('id-adversaire');
conn.on('data', (data) => console.log('Reçu :', data));
conn.send({ type: 'move', col: 3 });
```

---

## 🎮 Comment jouer

1. Ouvrez `puissance4.html` dans votre navigateur (ou servez le dossier via un serveur local)
2. **Joueur A** clique sur **"Créer une partie"** et partage son ID à l'adversaire
3. **Joueur B** saisit l'ID du joueur A dans le champ et clique **"JOIN"**
4. La partie démarre automatiquement dès que la connexion est établie
5. Le joueur **Rouge** commence toujours

### Prérequis
- Navigateur moderne (Chrome, Firefox, Edge, Safari)
- Connexion internet (uniquement pour l'étape de signaling PeerJS)
- Les deux joueurs peuvent être sur le même réseau local ou sur internet

---

## 🗂️ Architecture du code

Le projet est découpé en **4 fichiers JavaScript** distincts, chacun avec une responsabilité unique :

```
puissance4.html      ← Structure HTML pure (aucune logique)
tailwind.config.js   ← Configuration du thème visuel
style.css            ← Styles des jetons et animations
│
├── game.js          ← 🎲 Logique pure du jeu (règles, plateau, victoire)
├── network.js       ← 🌐 Connexion PeerJS et protocole P2P
├── ui.js            ← 🖥️  Rendu DOM et interactions visuelles
└── main.js          ← 🔧 Orchestrateur — relie les trois modules
```

### `game.js` — Logique métier
Contient **uniquement** les règles du jeu. Pas de DOM, pas de réseau.
Peut être importé dans Node.js et testé unitairement de façon autonome.

Fonctions clés :
- `createGame()` — crée un état de partie vierge
- `applyMove(game, col, color)` — applique un coup, détecte victoire/match nul
- `checkWin(board, row, col, color)` — vérifie l'alignement dans les 4 directions

### `network.js` — Couche réseau
Gère tout ce qui touche PeerJS : création du peer, connexions entrantes/sortantes, envoi et réception des messages. Communique avec `main.js` via des **callbacks**.

**Protocole de messages** :

| Type | Direction | Contenu | Rôle |
|------|-----------|---------|------|
| `start` | hôte → invité | `{ hostId, guestId }` | Déclenche le démarrage |
| `move` | les deux | `{ col, color }` | Coup joué |
| `rematch` | les deux | — | Demande/confirmation de revanche |
| `decline` | les deux | — | Refus de revanche |
| `bye` | les deux | — | Déconnexion volontaire |

### `ui.js` — Interface utilisateur
Gère tout le DOM : rendu de la grille, bandeaux de tour/résultat, scores, popups. Expose des fonctions nommées (`renderCell`, `showResult`, `updateTurnUI`…) et des **callbacks** que `main.js` branche sur la logique.

### `main.js` — Orchestrateur
Relie les trois modules. Chaque `handle*` est une fonction courte qui répond à un événement (clic, message réseau…), appelle `game.js` pour la logique, `ui.js` pour l'affichage, `network.js` pour le réseau.

---

## 🔍 Le log P2P

Le bouton **"P2P LOG"** (visible pendant une partie) ouvre un panneau qui affiche en temps réel tous les messages échangés entre les deux pairs :

- **↑ SENT** — messages envoyés par vous
- **↓ RECV** — messages reçus de l'adversaire
- **· SYS** — événements système (connexion, déconnexion…)

C'est l'outil idéal pour comprendre concrètement ce qui circule sur le DataChannel WebRTC.

---

## 🛠️ Technologies utilisées

| Technologie | Rôle |
|-------------|------|
| [PeerJS 1.5](https://peerjs.com/) | Abstraction WebRTC, signaling |
| [Tailwind CSS](https://tailwindcss.com/) | Styles utilitaires (CDN) |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Police monospace |
| [Syne](https://fonts.google.com/specimen/Syne) | Police display |
| JavaScript ES Modules | Architecture modulaire |

---

## 🚀 Lancer le projet

Le projet fonctionne avec n'importe quel serveur HTTP local (nécessaire pour les modules ES) :

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code
# Utiliser l'extension Live Server
```

Puis ouvrir `http://localhost:8080/puissance4.html`.

> ⚠️ L'ouverture directe du fichier HTML (`file://`) ne fonctionne pas avec les modules ES JavaScript.

---

## 💡 Idées d'extension

Ce projet étant éducatif, voici quelques pistes pour aller plus loin :

- **Multijoueur à 3 ou 4** — étendre le mesh P2P (voir le projet de visioconférence associé)
- **Reconnexion automatique** — gérer la perte de connexion et la reprise de partie
- **IA locale** — ajouter un mode solo avec un algorithme minimax
- **Animations avancées** — transition du jeton qui tombe avec physique réelle
- **Historique des coups** — rejouer une partie coup par coup

---

## ⚡ Propulsé par Claude Code

> *"Le meilleur code est celui qu'on comprend."*