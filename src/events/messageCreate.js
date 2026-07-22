'use strict';

const config = require('../config/config');
const { parserEmbedCoffre } = require('../services/parser');
const { normaliserObjet } = require('../services/normalisation');
const { Mouvement } = require('../db/models');
const { signalerObjetNonCategorise } = require('../services/nonCategoriseService');
const { rafraichirVueEnDirecte } = require('../services/vueEnDirecteService');
const { traiterMouvement } = require('../services/pipeline');

/**
 * Ecoute les messages du salon des logs et n'accepte que ceux postes par un
 * webhook. Chaque log valide est parse, normalise puis stocke.
 *
 * NB : les etapes "moteur de suspicion" et "reamenagement" et "vue en direct"
 * seront branchees ici aux jalons suivants (via une fonction traiterMouvement
 * commune webhook + actions manuelles).
 */
module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(client, message) {
    try {
      // 1. Filtre : bon salon + message issu d'un webhook + au moins un embed
      if (message.channelId !== config.LOGS_COFFRE_CHANNEL_ID) return;
      if (!message.webhookId) return;
      if (!message.embeds || message.embeds.length === 0) return;

      // 2. Parsing (robuste a l'ordre des champs)
      const parsed = parserEmbedCoffre(message.embeds[0]);
      if (!parsed) return;

      // 3. Normalisation : matricule agent + resolution d'alias
      const { matriculeAgent, objetCanonique, reconnu } = await normaliserObjet(parsed.objet_brut);

      // 4. Stockage du mouvement
      const doc = await Mouvement.create({
        timestamp: message.createdAt || new Date(),
        discord_id: parsed.discord_id,
        discord_name: parsed.discord_name,
        rp_name: parsed.rp_name,
        entreprise: parsed.entreprise,
        type: parsed.type,
        objet_brut: parsed.objet_brut,
        objet_canonique: objetCanonique,
        quantite: parsed.quantite,
        matricule_agent: matriculeAgent,
        origine: 'webhook',
      });

      console.log(
        `[Ingestion] ${parsed.type} ${parsed.quantite}x "${objetCanonique}"` +
          `${matriculeAgent ? ` (matricule ${matriculeAgent})` : ''}` +
          ` — ${parsed.rp_name} / ${parsed.entreprise}`
      );

      // 5. Objet inconnu -> flux "objet non categorise" (revue manuelle)
      if (!reconnu) {
        await signalerObjetNonCategorise(client, doc);
      }

      // 6. Moteur de suspicion (cree/poste une alerte si le seuil est atteint)
      await traiterMouvement(client, doc);

      // 7. Rafraichissement immediat de la vue en direct
      await rafraichirVueEnDirecte(client);
    } catch (err) {
      console.error('[Ingestion] Erreur de traitement du log :', err.message);
    }
  },
};
