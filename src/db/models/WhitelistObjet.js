'use strict';

const { Schema, model } = require('mongoose');

/**
 * Objets sur liste blanche : leurs mouvements sont ignores par le moteur de suspicion.
 */
const whitelistObjetSchema = new Schema(
  {
    objet_canonique: { type: String, required: true, unique: true },
    // Si true, objet_canonique est un motif regex (teste avec le drapeau 'i'),
    // sinon c'est un texte exact (comparaison insensible casse/accents).
    est_regex: { type: Boolean, default: false },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'whitelist_objets' }
);

module.exports = model('WhitelistObjet', whitelistObjetSchema);
