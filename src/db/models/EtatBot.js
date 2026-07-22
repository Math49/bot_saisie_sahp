'use strict';

const { Schema, model } = require('mongoose');

/**
 * Stockage cle/valeur pour l'etat persistant du bot.
 * Sert notamment a memoriser l'id + le channel du message "Vue en direct"
 * afin de le rEEditer apres un redemarrage plutot que d'en reposter un nouveau.
 */
const etatBotSchema = new Schema(
  {
    cle: { type: String, required: true, unique: true },
    valeur: { type: Schema.Types.Mixed, default: null },
  },
  { collection: 'etat_bot' }
);

module.exports = model('EtatBot', etatBotSchema);
