'use strict';

const { MessageFlags } = require('discord.js');
const { Alerte, Mouvement } = require('../../db/models');
const { versMouvement } = require('../../db/mappers');
const { estEtatMajor } = require('../../utils/permissions');
const {
  construireEmbedAlerte,
  construireBoutonsAlerte,
} = require('../alerteEmbed');
const ids = require('../customIds');

/**
 * Traite un clic sur un bouton d'alerte : "Confirmer" ou "Faux positif".
 * customId attendu : "alerte:confirmer:<alerteId>" ou "alerte:fauxpositif:<alerteId>".
 * Reserve au role etat-major.
 */
async function gererBoutonAlerte(interaction) {
  // Reservation etat-major
  if (!estEtatMajor(interaction)) {
    return interaction.reply({
      content: '⛔ Seul l etat-major peut traiter les alertes.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const parts = interaction.customId.split(':'); // [alerte, confirmer|fauxpositif, id]
  const action = parts[1];
  const alerteId = parts[2];
  const statut = action === 'confirmer' ? 'confirmee' : 'faux_positif';

  const alerte = await Alerte.findById(alerteId);
  if (!alerte) {
    return interaction.reply({
      content: '❓ Alerte introuvable (peut-etre supprimee).',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Ne pas ecraser une decision deja prise
  if (alerte.statut !== 'en_attente') {
    return interaction.reply({
      content: `ℹ️ Cette alerte a deja ete traitee (${alerte.statut}).`,
      flags: MessageFlags.Ephemeral,
    });
  }

  alerte.statut = statut;
  alerte.traite_par = interaction.user.id;
  await alerte.save();

  // Reconstruit l'embed (grise + mention du traitement) et desactive les boutons
  const doc = await Mouvement.findById(alerte.mouvement_id).lean();
  const mouvement = versMouvement(doc);
  const embed = construireEmbedAlerte(mouvement, alerte.signaux_declenches, alerte.score, {
    statut,
    traitePar: interaction.user.id,
  });

  await interaction.update({
    embeds: [embed],
    components: [construireBoutonsAlerte(String(alerte._id), true)],
  });
}

/** true si le customId concerne un bouton d'alerte. */
function estBoutonAlerte(customId) {
  return (
    customId.startsWith(`${ids.ALERTE_CONFIRMER}:`) ||
    customId.startsWith(`${ids.ALERTE_FAUX_POSITIF}:`)
  );
}

module.exports = { gererBoutonAlerte, estBoutonAlerte };
