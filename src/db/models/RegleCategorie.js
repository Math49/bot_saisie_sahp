'use strict';

const { Schema, model } = require('mongoose');

/**
 * Regle de classement : rattache un objet canonique a une categorie.
 * `motif` est un texte exact (insensible casse/accents) ou un motif regex
 * (si est_regex). `categorie` reference Categorie.nom.
 */
const regleCategorieSchema = new Schema(
  {
    motif: { type: String, required: true },
    est_regex: { type: Boolean, default: false },
    categorie: { type: String, required: true },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'categorie_regles' }
);

regleCategorieSchema.index({ categorie: 1 });

module.exports = model('RegleCategorie', regleCategorieSchema);
