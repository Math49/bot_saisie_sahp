'use strict';

const { Categorie, RegleCategorie } = require('../db/models');
const { correspond } = require('../utils/matcher');

const CATEGORIE_NON_CLASSEE = 'Non catégorisé';

/**
 * Charge les categories (avec leurs flags) et les regles de classement, et
 * expose des fonctions pratiques :
 *   - classer(objetCanonique)  -> nom de categorie ou null
 *   - flags(nomCategorie)      -> { est_whitelist, est_equipement_service, est_sensible } ou null
 *   - flagsPourObjet(objet)    -> flags de la categorie de l'objet (ou tout false)
 */
async function chargerCategories() {
  const [categories, regles] = await Promise.all([
    Categorie.find({}).lean(),
    RegleCategorie.find({}).lean(),
  ]);

  const parNom = new Map(categories.map((c) => [c.nom, c]));

  const classer = (objetCanonique) => {
    for (const r of regles) {
      if (correspond(r, r.motif, objetCanonique)) return r.categorie;
    }
    return null;
  };

  const flags = (nomCategorie) => parNom.get(nomCategorie) || null;

  const flagsPourObjet = (objetCanonique) => {
    const cat = classer(objetCanonique);
    const f = cat ? parNom.get(cat) : null;
    return {
      categorie: cat,
      est_whitelist: Boolean(f && f.est_whitelist),
      est_equipement_service: Boolean(f && f.est_equipement_service),
      est_sensible: Boolean(f && f.est_sensible),
    };
  };

  return { categories, regles, classer, flags, flagsPourObjet };
}

module.exports = { chargerCategories, CATEGORIE_NON_CLASSEE };
