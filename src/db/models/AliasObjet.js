'use strict';

const { Schema, model } = require('mongoose');

/**
 * Alias d'objet : un nom "brut" different qui pointe vers un objet_canonique.
 * Permet de regrouper les variantes d'ecriture d'un meme objet.
 */
const aliasObjetSchema = new Schema(
  {
    alias: { type: String, required: true, unique: true },
    objet_canonique: { type: String, required: true },
    // Si true, "alias" est un motif regex (teste avec le drapeau 'i') : tout objet
    // brut correspondant est resolu vers objet_canonique.
    est_regex: { type: Boolean, default: false },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'alias_objets' }
);

aliasObjetSchema.index({ objet_canonique: 1 });

module.exports = model('AliasObjet', aliasObjetSchema);
