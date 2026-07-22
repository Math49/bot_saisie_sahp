'use strict';

const { Schema, model } = require('mongoose');

/**
 * Objets sensibles (armes, munitions, stupefiants...).
 * Gere dynamiquement en BDD via le panneau Configuration : pas besoin de
 * redeployer le bot pour en ajouter/retirer. Alimente le signal "objetSensible"
 * du moteur de suspicion (contexte.estSensible).
 */
const objetSensibleSchema = new Schema(
  {
    objet_canonique: { type: String, required: true, unique: true },
    // Si true, objet_canonique est un motif regex (teste avec le drapeau 'i').
    est_regex: { type: Boolean, default: false },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'objets_sensibles' }
);

module.exports = model('ObjetSensible', objetSensibleSchema);
