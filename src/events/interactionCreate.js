'use strict';

const { MessageFlags } = require('discord.js');
const ids = require('../ui/customIds');
const { gererBoutonAlerte, estBoutonAlerte } = require('../ui/buttons/alerteBoutons');
const { construireModalMouvement } = require('../ui/modals/mouvementModal');
const { construireModalHistorique } = require('../ui/modals/historiqueModal');
const { gererModalMouvement, gererModalHistorique } = require('../ui/modals/modalHandlers');
const {
  ouvrirConfig,
  estInteractionConfig,
  gererInteractionConfig,
} = require('../ui/config/configPanel');
const {
  ouvrirSuppression,
  gererSelectSuppression,
  gererPurgeZeros,
} = require('../ui/buttons/suppressionSaisie');
const { basculerAffichageZeros, changerPage } = require('../services/vueEnDirecteService');

/**
 * Dispatcher central des interactions (boutons, select menus, modales).
 * Route par prefixe du customId ("domaine:action").
 */
module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(client, interaction) {
    try {
      // Seules les interactions a composant (bouton/select/modale) portent un customId.
      if (!interaction.customId) return;

      // "await" indispensable : sans lui, un rejet d'un handler s'echapperait du
      // try/catch et remonterait en "Erreur client" non geree.

      // Tout ce qui concerne le panneau de config (boutons/selects/modales cfg:*)
      if (estInteractionConfig(interaction.customId)) {
        return await gererInteractionConfig(client, interaction);
      }

      if (interaction.isButton()) return await routerBouton(client, interaction);
      if (interaction.isStringSelectMenu()) return await routerSelect(client, interaction);
      if (interaction.isModalSubmit()) return await routerModal(client, interaction);
    } catch (err) {
      console.error('[Interaction] Erreur :', err.message);
      await repondreErreur(interaction);
    }
  },
};

async function routerBouton(client, interaction) {
  const { customId } = interaction;

  // Boutons d'alerte : alerte:confirmer:<id> / alerte:fauxpositif:<id>
  if (estBoutonAlerte(customId)) {
    return gererBoutonAlerte(interaction);
  }

  // Boutons de la vue en direct
  switch (customId) {
    case ids.VUE_HISTORIQUE:
      return interaction.showModal(construireModalHistorique());
    case ids.VUE_AJOUTER:
      return interaction.showModal(construireModalMouvement('depot'));
    case ids.VUE_RETIRER:
      return interaction.showModal(construireModalMouvement('retrait'));
    case ids.VUE_SUPPRIMER:
      return ouvrirSuppression(interaction);
    case ids.VUE_PURGE_ZEROS:
      return gererPurgeZeros(client, interaction);
    case ids.VUE_TOGGLE_ZEROS:
      return basculerAffichageZeros(client, interaction);
    case ids.VUE_PAGE_PREV:
      return changerPage(client, interaction, -1);
    case ids.VUE_PAGE_NEXT:
      return changerPage(client, interaction, +1);
    case ids.VUE_CONFIG:
      return ouvrirConfig(interaction);
    default:
      return;
  }
}

async function routerSelect(client, interaction) {
  if (interaction.customId === ids.VUE_SUPPRIMER_SELECT) {
    return gererSelectSuppression(client, interaction);
  }
}

async function routerModal(client, interaction) {
  const { customId } = interaction;

  if (customId.startsWith(`${ids.MODAL_MOUVEMENT}:`)) {
    return gererModalMouvement(client, interaction);
  }
  if (customId === ids.MODAL_HISTORIQUE) {
    return gererModalHistorique(client, interaction);
  }
}

async function repondreErreur(interaction) {
  const contenu = '❌ Une erreur est survenue.';
  try {
    if (!interaction.isRepliable()) return;
    if (interaction.deferred) {
      await interaction.editReply({ content: contenu });
    } else if (!interaction.replied) {
      await interaction.reply({ content: contenu, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.followUp({ content: contenu, flags: MessageFlags.Ephemeral });
    }
  } catch {
    /* interaction perdue (10062) : rien a faire */
  }
}
