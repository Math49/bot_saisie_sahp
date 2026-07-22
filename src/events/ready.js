'use strict';

const cron = require('node-cron');
const config = require('../config/config');
const { rafraichirVueEnDirecte } = require('../services/vueEnDirecteService');

/**
 * Handler de l'evenement "clientReady" (discord.js v14).
 * - Restaure (ou poste) le message "Vue en direct".
 * - Programme le rafraichissement periodique par securite (le rafraichissement
 *   immediat apres chaque mouvement se fait, lui, dans le pipeline d'ingestion).
 */
module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`[Discord] Connecte en tant que ${client.user.tag} (${client.user.id}).`);

    // Post / restauration initiale de la vue en direct
    await rafraichirVueEnDirecte(client);

    // Rafraichissement periodique (filet de securite)
    if (cron.validate(config.CRON_RAFRAICHISSEMENT_VUE)) {
      cron.schedule(config.CRON_RAFRAICHISSEMENT_VUE, () => {
        rafraichirVueEnDirecte(client);
      });
      console.log(
        `[VueEnDirect] Rafraichissement periodique programme (${config.CRON_RAFRAICHISSEMENT_VUE}).`
      );
    } else {
      console.warn(
        `[VueEnDirect] Expression cron invalide : "${config.CRON_RAFRAICHISSEMENT_VUE}", rafraichissement periodique desactive.`
      );
    }
  },
};
