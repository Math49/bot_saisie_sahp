'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const ids = require('../customIds');

/** Modale de recherche d'historique (objet, joueur ou matricule). */
function construireModalHistorique() {
  const modal = new ModalBuilder()
    .setCustomId(ids.MODAL_HISTORIQUE)
    .setTitle('Historique du coffre');

  const champRecherche = new TextInputBuilder()
    .setCustomId(ids.CHAMP_RECHERCHE)
    .setLabel('Objet, joueur (nom/ID) ou matricule')
    .setPlaceholder('ex: BeanBag  |  Benjamin McAlister  |  43')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(new ActionRowBuilder().addComponents(champRecherche));
  return modal;
}

module.exports = { construireModalHistorique };
