'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const ids = require('../customIds');

/**
 * Modale d'ajout / retrait manuel du coffre.
 * @param {'depot'|'retrait'} type
 */
function construireModalMouvement(type) {
  const estDepot = type === 'depot';
  const modal = new ModalBuilder()
    .setCustomId(`${ids.MODAL_MOUVEMENT}:${type}`)
    .setTitle(estDepot ? 'Ajouter au coffre' : 'Retirer du coffre');

  const champObjet = new TextInputBuilder()
    .setCustomId(ids.CHAMP_OBJET)
    .setLabel('Objet')
    .setPlaceholder('ex: BeanBag, .45 ACP, N°620805 PL')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const champQuantite = new TextInputBuilder()
    .setCustomId(ids.CHAMP_QUANTITE)
    .setLabel('Quantite')
    .setPlaceholder('ex: 5')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(9);

  const champMotif = new TextInputBuilder()
    .setCustomId(ids.CHAMP_MOTIF)
    .setLabel('Motif (optionnel)')
    .setPlaceholder('ex: correction inventaire')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(champObjet),
    new ActionRowBuilder().addComponents(champQuantite),
    new ActionRowBuilder().addComponents(champMotif)
  );

  return modal;
}

module.exports = { construireModalMouvement };
