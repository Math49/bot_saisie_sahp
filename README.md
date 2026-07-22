# Bot Discord — Surveillance du coffre des saisies (SAHP)

Bot destiné à l'état-major de la SAHP (RP StoryLife). Il lit en continu les logs
du coffre postés par un webhook dans `#logs-coffre`, les stocke (MongoDB), affiche
l'état du stock **en direct**, détecte automatiquement les **sorties suspectes**,
reconnaît les **réaménagements internes** (retrait puis redépôt rapide), et se
pilote **uniquement par boutons / menus / modales** — aucune slash command.

## Prérequis

- Node.js ≥ 18.17
- Une base MongoDB (locale ou Atlas)
- Une application/bot Discord (Portail développeur)

## Installation

```bash
npm install
```

Copie `.env.example` en `.env` et renseigne :

```
DISCORD_TOKEN=...        # Portail développeur > Bot > Token
MONGODB_URI=...          # ex: mongodb://127.0.0.1:27017/coffre_sahp
```

⚠️ **Intent obligatoire** : dans le Portail développeur Discord → *Bot* →
*Privileged Gateway Intents*, active **MESSAGE CONTENT INTENT**. Sans lui, le bot
ne peut pas lire les embeds du webhook.

Renseigne ensuite les IDs dans `src/config/config.js` :

| Clé | Rôle |
|---|---|
| `GUILD_ID` | serveur |
| `LOGS_COFFRE_CHANNEL_ID` | salon des logs webhook (`#logs-coffre`) |
| `ALERTES_CHANNEL_ID` | salon des alertes de suspicion |
| `VUE_DIRECTE_CHANNEL_ID` | salon du message « Vue en direct » |
| `CHANNEL_OBJETS_NON_CATEGORISES` | salon des objets inconnus (défaut = alertes) |
| `ROLE_ETAT_MAJOR_ID` | rôle requis pour la config et le traitement des alertes |
| `ROLE_AGENT_SAHP_ID` | rôle requis pour Ajouter/Retirer (`null` = tout le monde) |
| `ENTREPRISE_PAR_DEFAUT` | entreprise ciblée par les ajustements manuels |

## Lancement

```bash
npm start
```

Au démarrage : connexion MongoDB, connexion Discord, post/restauration du message
« Vue en direct » (réédité en place après un redémarrage).

## Utilisation (tout en composants)

**Sous la vue en direct :**
- 📜 **Historique** — recherche par objet, joueur ou matricule (réponse éphémère)
- ➕ **Ajouter** / ➖ **Retirer** — ajustement manuel du coffre (passe par le même
  pipeline d'analyse que les logs)
- ⚙️ **Configuration** *(état-major)* — gère :
  - **Whitelist** (objets ignorés par le moteur)
  - **Équipement de service** (score atténué)
  - **Objets sensibles** (signal dédié)
  - **Alias** (nom brut → objet canonique)
  - **Catégories** : regroupent des objets et portent des **cases à cocher**
    whitelist / équipement de service / sensible.
  - **Règles de catégorie** : rattachent un objet à une catégorie.
  - Les listes directes et les règles acceptent un **texte exact** ou un **motif regex**.

Un objet hérite d'un flag (whitelist / équipement / sensible) s'il est listé
**directement** OU si **sa catégorie** est cochée. La vue en direct est groupée
par catégorie (détail des objets + total par catégorie ; non classés → « Non
catégorisé »).

**Sur une alerte** *(état-major)* : ✅ **Confirmer** / ❌ **Faux positif**.

## Détection de suspicion

Score de risque cumulant plusieurs signaux (solde négatif, volume anormal,
rafale, aller-retour rapide, objet sensible, comptes liés, agent récidiviste).
Au-delà du seuil (50), une alerte est postée. Paramétrage dans
`src/services/suspicionEngine.js` (`CONFIG`).

## Réaménagement interne

Après chaque **dépôt**, le bot cherche rétroactivement un retrait récent identique
(même objet/quantité/personne, < 15 min). S'il en trouve un, il lie les deux
mouvements et, si une alerte du retrait est encore *en attente*, atténue son score,
l'annote (« Mise à jour ») et la passe en orange si elle repasse sous le seuil —
sans jamais écraser une décision humaine déjà prise.

## Architecture

```
src/
  index.js                 point d'entrée (Mongo + Discord)
  config/config.js         IDs, rôles, entreprise par défaut
  db/
    connexion.js           connexion Mongoose
    models/                schémas (Mouvement, listes, Alerte, EtatBot…)
    mappers.js             document -> mouvement (camelCase) pour le moteur
    queries.js             helpers de requête (matching exact/regex)
  services/
    parser.js              extraction des champs de l'embed webhook
    normalisation.js       matricule agent + résolution d'alias
    suspicionEngine.js     moteur de score (référence)
    contexteBuilder.js     contexte du moteur depuis la DB
    stockService.js        calcul du stock
    pipeline.js            traiterMouvement : suspicion + réaménagement
    reamenagementService.js détection retrait -> redépôt
    nonCategoriseService.js signalement des objets inconnus
    vueEnDirecteService.js  post/édition de la vue en direct
  ui/                      embeds, boutons, modales, panneau de config
  events/                  ready, messageCreate, interactionCreate
  utils/                   texte, matcher (regex), permissions
```
