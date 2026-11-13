# Chess Opening Trainer

Application web moderne d'entraînement aux ouvertures d'échecs avec **approche inversée**, intégration temps réel de **Lichess Explorer** et support **Docker** pour l'auto-hébergement.

## Concept (Entraînement inversé)

Contrairement aux outils classiques où vous répétez passivement vos propres coups, **Chess Opening Trainer** vous permet de choisir **votre camp** (`Blancs` ou `Noirs`) et **l'ouverture que l'adversaire va jouer contre vous** :

- Vous jouez les **Noirs** et sélectionnez l'*Ouverture Italienne* $\rightarrow$ l'ordinateur joue les coups blancs de l'Italienne en réponse à vos coups.
- Si vous déviez de la ligne théorique cible, un badge **Hors ligne cible** apparaît et l'adversaire continue la partie de manière réaliste grâce aux coups les plus joués issus de l'API **Lichess Explorer**.

## Fonctionnalités

- **Catalogue de 69 ouvertures et variantes (ECO A00 à E97)** filtrable par code ECO, nom, coups initiaux ou catégorie.
- **Échiquier interactif** (clic-clic et drag-and-drop) avec surbrillance des coups légaux, du dernier coup et des échecs.
- **Calque SVG d'analyse** :
  - Flèches **vertes / ambre** : coup théorique attendu par l'ouverture cible.
  - Flèches **bleues** : coups les plus populaires sur Lichess avec fréquence (%).
- **Mode Aveugle / Test** pour masquer toutes les flèches et aides visuelles.
- **Base Lichess Explorer** (`explorer.lichess.ovh`) avec choix **Maîtres (FIDE)** vs **Joueurs 1000–1400 Elo** et cache mémoire par FEN.
- **Navigation temporelle** : cliquez sur n'importe quel coup de l'historique pour revenir en arrière et tester une autre variante.

## Stack technique

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS
- **Échecs** : `chess.js`
- **État global** : `zustand`
- **Icônes** : `lucide-react`
- **Déploiement** : Docker multi-stage (`node:20-alpine` $\rightarrow$ `nginx:alpine`)

---

## Démarrage rapide

### 1. En local (développement)

Prérequis : **Node.js 20+** et **npm**.

```bash
# Cloner le dépôt
git clone https://github.com/Nauthizful/chess-trainer.git
cd chess-trainer

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`.

Pour générer le build de production :

```bash
npm run build
```

### 2. Via Docker (auto-hébergement)

Prérequis : **Docker** et **Docker Compose**.

```bash
docker compose up -d --build
```

L'application est ensuite servie par Nginx sur **[http://localhost:8080](http://localhost:8080)**.

Pour arrêter le conteneur :

```bash
docker compose down
```
