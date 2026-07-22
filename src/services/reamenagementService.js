'use strict';

const { Mouvement, Alerte } = require('../db/models');
const { versMouvement } = require('../db/mappers');
const { CONFIG, reduireSignauxSaufSoldeNegatif } = require('./suspicionEngine');
const {
  construireEmbedAlerte,
  construireBoutonsAlerte,
  COULEUR_ORANGE,
} = require('../ui/alerteEmbed');

const TEXTE_MISE_A_JOUR =
  'Un depot du meme objet et de la meme quantite a eu lieu peu apres par la meme ' +
  'personne — probable reamenagement plutot qu une sortie suspecte.';

/**
 * Detection de reamenagement interne, declenchee APRES le stockage et l'analyse
 * d'un nouveau DEPOT. Cherche un retrait recent identique (meme objet, quantite,
 * personne) non encore lie, et si trouve : lie les deux mouvements et corrige
 * eventuellement l'alerte du retrait.
 *
 * @param {Client} client
 * @param {Document} depotDoc  doc Mongoose du depot venant d'etre stocke
 * @returns {Promise<{retrait, alerte}|null>}
 */
async function detecterReamenagement(client, depotDoc) {
  if (depotDoc.type !== 'depot') return null;

  const limite = new Date(
    depotDoc.timestamp.getTime() - CONFIG.fenetreReamenagementMin * 60000
  );

  // Reservation atomique d'un retrait correspondant non encore lie.
  const retrait = await Mouvement.findOneAndUpdate(
    {
      type: 'retrait',
      objet_canonique: depotDoc.objet_canonique,
      quantite: depotDoc.quantite,
      discord_id: depotDoc.discord_id,
      mouvement_lie_id: null,
      _id: { $ne: depotDoc._id },
      timestamp: { $gte: limite, $lte: depotDoc.timestamp },
    },
    { $set: { mouvement_lie_id: depotDoc._id, probable_reamenagement: true } },
    { sort: { timestamp: -1 }, new: true }
  );

  if (!retrait) return null;

  // Liaison reciproque cote depot.
  depotDoc.mouvement_lie_id = retrait._id;
  depotDoc.probable_reamenagement = true;
  await depotDoc.save();

  console.log(
    `[Reamenagement] Retrait ${retrait._id} lie au depot ${depotDoc._id} ` +
      `(${depotDoc.quantite}x "${depotDoc.objet_canonique}").`
  );

  // Correction eventuelle de l'alerte en attente rattachee au retrait.
  const alerte = await Alerte.findOne({
    mouvement_id: retrait._id,
    statut: 'en_attente',
  });

  if (alerte) {
    await corrigerAlerte(client, alerte, retrait);
  }

  return { retrait, alerte };
}

/**
 * Recalcule le score d'une alerte en attente en attenuant tous les signaux sauf
 * le solde negatif, edite le message (champ "Mise a jour", couleur orange si le
 * nouveau score repasse sous le seuil), boutons laisses actifs.
 */
async function corrigerAlerte(client, alerte, retraitDoc) {
  const signauxReduits = reduireSignauxSaufSoldeNegatif(
    alerte.signaux_declenches,
    CONFIG.multiplicateurReamenagement
  );
  const nouveauScore = signauxReduits.reduce((total, s) => total + s.poids, 0);

  alerte.signaux_declenches = signauxReduits;
  alerte.score = nouveauScore;
  await alerte.save();

  if (!alerte.message_id || !alerte.channel_id) return;

  try {
    const salon = await client.channels.fetch(alerte.channel_id);
    const message = await salon.messages.fetch(alerte.message_id);

    const mouvement = versMouvement(retraitDoc);
    const sousLeSeuil = nouveauScore < CONFIG.seuilAlerte;

    const embed = construireEmbedAlerte(mouvement, signauxReduits, nouveauScore, {
      statut: 'en_attente', // decision humaine toujours ouverte
      miseAJour: TEXTE_MISE_A_JOUR,
      couleur: sousLeSeuil ? COULEUR_ORANGE : undefined,
    });

    await message.edit({
      embeds: [embed],
      components: [construireBoutonsAlerte(String(alerte._id), false)], // boutons actifs
    });

    console.log(
      `[Reamenagement] Alerte ${alerte._id} corrigee (score ${nouveauScore}` +
        `${sousLeSeuil ? ', passee orange' : ''}).`
    );
  } catch (err) {
    console.error('[Reamenagement] Impossible d editer l alerte :', err.message);
  }
}

module.exports = { detecterReamenagement, TEXTE_MISE_A_JOUR };
