'use strict';

const { Schema, model } = require('mongoose');

/**
 * Une categorie regroupe plusieurs objets canoniques (via des regles de classement,
 * voir RegleCategorie) et porte des cases a cocher reutilisees par le moteur :
 * un objet dont la categorie est cochee herite du flag correspondant, EN PLUS des
 * listes directes existantes (whitelist_objets / equipement_service / objets_sensibles).
 */
const categorieSchema = new Schema(
  {
    nom: { type: String, required: true, unique: true },
    est_whitelist: { type: Boolean, default: false },
    est_equipement_service: { type: Boolean, default: false },
    est_sensible: { type: Boolean, default: false },
    ajoute_par: { type: String, required: true },
    date_ajout: { type: Date, required: true, default: Date.now },
  },
  { collection: 'categories' }
);

module.exports = model('Categorie', categorieSchema);
