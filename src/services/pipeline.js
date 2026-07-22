'use strict';

const config = require('../config/config');
const { Alerte } = require('../db/models');
const { versMouvement } = require('../db/mappers');
const { construireContexte } = require('./contexteBuilder');
const { calculerScoreSuspicion } = require('./suspicionEngine');
const { construireEmbedAlerte, construireBoutonsAlerte } = require('../ui/alerteEmbed');
const { detecterReamenagement } = require('./reamenagementService');

/**
 * Pipeline d'analyse d'un mouvement DEJA stocke (doc Mongoose), commun aux logs
 * webhook et aux actions manuelles. Construit le contexte, calcule le score de
 * suspicion et, si le seuil est atteint, cree et poste une alerte.
 *
 * @returns {Promise<{calc, alerte}>}  calc = resultat du moteur ; alerte = doc ou null
 */
async function traiterMouvement(client, doc) {
  const contexte = await construireContexte(doc);
  const mouvement = versMouvement(doc);
  const calc = calculerScoreSuspicion(mouvement, contexte);

  let alerte = null;

  // Alerte de suspicion si le seuil est atteint (objet whitelist -> ignore).
  if (!calc.ignore && calc.estSuspect) {
    alerte = await creerEtPosterAlerte(client, doc, mouvement, calc);
  }

  // Detection de reamenagement : uniquement apres un DEPOT, et quel que soit le
  // resultat du moteur (la plupart des depots ne sont pas suspects). Peut corriger
  // retroactivement l'alerte d'un retrait precedent.
  if (doc.type === 'depot') {
    try {
      await detecterReamenagement(client, doc);
    } catch (err) {
      console.error('[Reamenagement] Erreur :', err.message);
    }
  }

  return { calc, alerte };
}

/** Cree l'alerte en base et poste son message (message_id/channel_id memorises). */
async function creerEtPosterAlerte(client, doc, mouvement, calc) {
  const alerte = await Alerte.create({
    mouvement_id: doc._id,
    score: calc.score,
    signaux_declenches: calc.signaux,
    statut: 'en_attente',
  });

  try {
    const salon = await client.channels.fetch(config.ALERTES_CHANNEL_ID);
    if (salon && salon.isTextBased()) {
      const message = await salon.send({
        embeds: [construireEmbedAlerte(mouvement, calc.signaux, calc.score)],
        components: [construireBoutonsAlerte(String(alerte._id))],
      });
      alerte.message_id = message.id;
      alerte.channel_id = salon.id;
      await alerte.save();
    }
  } catch (err) {
    console.error('[Suspicion] Impossible de poster l alerte :', err.message);
  }

  console.log(
    `[Suspicion] ALERTE score ${calc.score} — ${mouvement.type} ${mouvement.quantite}x ` +
      `"${mouvement.objetCanonique}" (${mouvement.rpName}) — signaux: ${calc.signaux
        .map((s) => s.cle)
        .join(', ')}`
  );

  return alerte;
}

module.exports = { traiterMouvement };
