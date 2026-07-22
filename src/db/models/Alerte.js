'use strict';

const { Schema, model, Types } = require('mongoose');

/**
 * Une alerte de suspicion generee pour un mouvement.
 * message_id / channel_id permettent d'editer le message Discord plus tard
 * (correction retroactive lors d'un reamenagement).
 */
const alerteSchema = new Schema(
  {
    mouvement_id: { type: Types.ObjectId, ref: 'Mouvement', required: true },
    score: { type: Number, required: true },
    // Liste des signaux declenches : [{ cle, poids, detail }]
    signaux_declenches: { type: [Schema.Types.Mixed], required: true, default: [] },
    statut: {
      type: String,
      required: true,
      enum: ['en_attente', 'confirmee', 'faux_positif'],
      default: 'en_attente',
    },
    traite_par: { type: String, default: null },
    message_id: { type: String, default: null },
    channel_id: { type: String, default: null },
    date_creation: { type: Date, required: true, default: Date.now },
  },
  { collection: 'alertes' }
);

alerteSchema.index({ mouvement_id: 1 });
alerteSchema.index({ statut: 1 });

module.exports = model('Alerte', alerteSchema);
