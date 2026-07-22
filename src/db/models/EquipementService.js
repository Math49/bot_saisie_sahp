'use strict';

const { Schema, model } = require('mongoose');

/**
 * Equipement de service : ses mouvements voient leur score de suspicion attenue
 * (multiplicateur), mais ne sont pas ignores (le solde negatif reste un fait).
 */
const equipementServiceSchema = new Schema(
  {
    objet_canonique: { type: String, required: true, unique: true },
    // Si true, objet_canonique est un motif regex (teste avec le drapeau 'i').
    est_regex: { type: Boolean, default: false },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'equipement_service' }
);

module.exports = model('EquipementService', equipementServiceSchema);
