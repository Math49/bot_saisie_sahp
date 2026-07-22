'use strict';

const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { estEtatMajor } = require('../../utils/permissions');
const { stockParEntrepriseComplet } = require('../../services/stockService');
const { purgerSaisie, purgerLignesAZero } = require('../../services/purgeService');
const { rafraichirVueEnDirecte } = require('../../services/vueEnDirecteService');
const ids = require('../customIds');

const SEPARATEUR = '␟'; // separateur entreprise/objet dans la value du select

/**
 * Bouton 🗑️ "Supprimer" de la vue : ouvre un panneau ephemere permettant de purger
 * une saisie precise (select) ou toutes les lignes a 0 (bouton). Etat-major seulement.
 * Une saisie purgee disparait du stock mais ses mouvements restent en base (audit).
 */
async function ouvrirSuppression(interaction) {
  if (!estEtatMajor(interaction)) {
    return interaction.reply({
      content: "⛔ Seul l'etat-major peut supprimer une saisie.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const lignes = await stockParEntrepriseComplet();

  const composants = [];
  if (lignes.length > 0) {
    const options = lignes.slice(0, 25).map((l) => ({
      label: `${l.objet}`.slice(0, 100),
      description: `${l.entreprise} · stock ${l.stock}`.slice(0, 100),
      value: `${l.entreprise}${SEPARATEUR}${l.objet}`.slice(0, 100),
    }));
    composants.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(ids.VUE_SUPPRIMER_SELECT)
          .setPlaceholder('Saisie a purger…')
          .addOptions(options)
      )
    );
  }

  composants.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.VUE_PURGE_ZEROS)
        .setLabel('Purger toutes les lignes a 0')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Danger)
    )
  );

  const note =
    lignes.length > 25 ? '\n_(25 premieres saisies affichees — utilise le bouton pour les 0.)_' : '';

  await interaction.reply({
    content:
      '🗑️ **Supprimer une saisie** — la ligne disparait du stock, ' +
      "l'historique est conserve." +
      note,
    components: composants,
    flags: MessageFlags.Ephemeral,
  });
}

/** Select : purge la saisie choisie. */
async function gererSelectSuppression(client, interaction) {
  if (!estEtatMajor(interaction)) {
    return interaction.reply({ content: '⛔ Reserve a l etat-major.', flags: MessageFlags.Ephemeral });
  }
  const [entreprise, objet] = interaction.values[0].split(SEPARATEUR);
  const n = await purgerSaisie(objet, entreprise);
  await rafraichirVueEnDirecte(client);
  await interaction.update({
    content: `✅ Saisie purgee : **${objet}** (${entreprise}) — ${n} mouvement(s) sortis du stock, historique conserve.`,
    components: [],
  });
}

/** Bouton : purge toutes les lignes a 0. */
async function gererPurgeZeros(client, interaction) {
  if (!estEtatMajor(interaction)) {
    return interaction.reply({ content: '⛔ Reserve a l etat-major.', flags: MessageFlags.Ephemeral });
  }
  const { lignes, mouvements } = await purgerLignesAZero();
  await rafraichirVueEnDirecte(client);
  await interaction.update({
    content:
      lignes === 0
        ? 'ℹ️ Aucune ligne a 0 a purger.'
        : `🧹 ${lignes} ligne(s) a 0 purgee(s) (${mouvements} mouvement(s)), historique conserve.`,
    components: [],
  });
}

module.exports = { ouvrirSuppression, gererSelectSuppression, gererPurgeZeros };
