'use strict';

const { Mouvement } = require('../db/models');

/**
 * Calcul du stock a partir des mouvements : stock = somme(depots) - somme(retraits).
 * Les mouvements marques `exclu_du_stock` (saisies purgees) sont ignores partout
 * — ils restent en base pour l'historique/audit mais ne comptent plus.
 *
 * Note : un reamenagement (retrait puis redepot identique) s'annule naturellement
 * dans ce calcul, le stock reste donc correct sans traitement particulier.
 */

const MATCH_ACTIF = { exclu_du_stock: { $ne: true } };

/** Stock actuel d'un objet dans une entreprise donnee. */
async function stockActuel(objetCanonique, entreprise) {
  const res = await Mouvement.aggregate([
    { $match: { objet_canonique: objetCanonique, entreprise, ...MATCH_ACTIF } },
    {
      $group: {
        _id: null,
        depots: { $sum: { $cond: [{ $eq: ['$type', 'depot'] }, '$quantite', 0] } },
        retraits: { $sum: { $cond: [{ $eq: ['$type', 'retrait'] }, '$quantite', 0] } },
      },
    },
  ]);
  if (res.length === 0) return 0;
  return res[0].depots - res[0].retraits;
}

/**
 * Stock groupe par entreprise puis par objet.
 * @param {object} [opts]
 * @param {boolean} [opts.inclureZeros=false]  inclure les lignes dont le stock = 0
 * @returns {Promise<Array<{ entreprise, objet, stock }>>}
 */
async function calculerStock({ inclureZeros = false } = {}) {
  const pipeline = [
    { $match: MATCH_ACTIF },
    {
      $group: {
        _id: { entreprise: '$entreprise', objet: '$objet_canonique' },
        depots: { $sum: { $cond: [{ $eq: ['$type', 'depot'] }, '$quantite', 0] } },
        retraits: { $sum: { $cond: [{ $eq: ['$type', 'retrait'] }, '$quantite', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        entreprise: '$_id.entreprise',
        objet: '$_id.objet',
        stock: { $subtract: ['$depots', '$retraits'] },
      },
    },
  ];

  // Auto-masquage des lignes a exactement 0 (les negatifs restent visibles).
  if (!inclureZeros) pipeline.push({ $match: { stock: { $ne: 0 } } });

  pipeline.push({ $sort: { entreprise: 1, objet: 1 } });
  return Mouvement.aggregate(pipeline);
}

/** Stock pour la vue en direct (lignes a 0 auto-masquees). */
function stockParEntreprise() {
  return calculerStock({ inclureZeros: false });
}

/** Stock complet, zeros inclus (pour le menu de suppression d'une saisie). */
function stockParEntrepriseComplet() {
  return calculerStock({ inclureZeros: true });
}

module.exports = { stockActuel, stockParEntreprise, stockParEntrepriseComplet };
