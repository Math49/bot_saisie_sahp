'use strict';

const { Mouvement } = require('../db/models');
const { stockParEntrepriseComplet } = require('./stockService');

/**
 * "Purge" d'une saisie : les mouvements de l'objet sont marques exclu_du_stock
 * (ils restent en base pour l'historique/audit) et disparaissent du calcul du stock.
 */

/**
 * Purge un objet precis dans une entreprise.
 * @returns {Promise<number>} nombre de mouvements marques
 */
async function purgerSaisie(objetCanonique, entreprise) {
  const res = await Mouvement.updateMany(
    { objet_canonique: objetCanonique, entreprise, exclu_du_stock: { $ne: true } },
    { $set: { exclu_du_stock: true } }
  );
  return res.modifiedCount || 0;
}

/**
 * Purge toutes les lignes dont le stock actuel vaut exactement 0.
 * @returns {Promise<{lignes: number, mouvements: number}>}
 */
async function purgerLignesAZero() {
  const lignes = await stockParEntrepriseComplet();
  const zeros = lignes.filter((l) => l.stock === 0);

  let mouvements = 0;
  for (const l of zeros) {
    mouvements += await purgerSaisie(l.objet, l.entreprise);
  }
  return { lignes: zeros.length, mouvements };
}

module.exports = { purgerSaisie, purgerLignesAZero };
