'use strict';

require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;


const config = {
  // Serveur (guild) sur lequel tourne le bot
  GUILD_ID: '1529491655072157706',

  // Salon ou le webhook StoryLife poste les logs du coffre (#logs-coffre)
  LOGS_COFFRE_CHANNEL_ID: '1529494187488317577',

  // Salon ou le bot poste les alertes de suspicion (#alertes-suspectes)
  ALERTES_CHANNEL_ID: '1529496376076013688',

  // Salon ou le bot poste/edite le message "Vue en direct" du stock
  VUE_DIRECTE_CHANNEL_ID: '1529496548466098236',

  // Salon ou signaler les objets au nom inconnu ("objet non categorise").
  // Laisser null pour reutiliser le salon des alertes.
  CHANNEL_OBJETS_NON_CATEGORISES: '1529499630587351200',

  // Role de l'etat-major : requis pour la Configuration et le traitement des alertes
  ROLE_ETAT_MAJOR_ID: '1529493270550417548',

  // Role "Agent SAHP" : restreint les boutons Ajouter/Retirer.
  // Laisser null pour autoriser tout membre ayant acces au salon.
  ROLE_AGENT_SAHP_ID: '1529493270550417548',

  // Frequence de rafraichissement de la vue en direct (cron). Defaut : chaque minute.
  CRON_RAFRAICHISSEMENT_VUE: '* * * * *',

  // Entreprise ciblee par defaut lors d'un ajustement manuel (bouton Ajouter/Retirer).
  ENTREPRISE_PAR_DEFAUT: 'SAHP',
};

// Le salon des objets non categorises retombe sur celui des alertes si non defini.
config.CHANNEL_OBJETS_NON_CATEGORISES =
  config.CHANNEL_OBJETS_NON_CATEGORISES || config.ALERTES_CHANNEL_ID;

// ---------------------------------------------------------------------------
function verifierConfig() {
  const manquants = [];
  if (!DISCORD_TOKEN) manquants.push('DISCORD_TOKEN (.env)');
  if (!MONGODB_URI) manquants.push('MONGODB_URI (.env)');
  if (manquants.length > 0) {
    throw new Error(
      `Configuration incomplete — variables manquantes : ${manquants.join(', ')}. ` +
        'Copie .env.example en .env et renseigne les valeurs.'
    );
  }
}

module.exports = {
  ...config,
  DISCORD_TOKEN,
  MONGODB_URI,
  verifierConfig,
};
