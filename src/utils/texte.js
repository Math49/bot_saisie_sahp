'use strict';

/**
 * Utilitaires texte partages.
 */

/** Supprime les accents/diacritiques. "Depot" -> "Depot". */
function sansAccents(texte) {
  return String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Clef de comparaison normalisee : sans accents, minuscules, espaces reduits.
 * Sert a comparer noms d'objets / labels de facon robuste.
 */
function clefComparaison(texte) {
  return sansAccents(texte).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Retire les marqueurs de formatage markdown (gras **, souligne __, barre ~~,
 * code `) et les espaces superflus. Utile car le webhook met certains labels
 * en gras/souligne (ex: "__Entreprise (Coffre) — SAHP__").
 */
function nettoyerMarkdown(texte) {
  return String(texte)
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/~~/g, '')
    .replace(/`/g, '')
    .trim();
}

module.exports = { sansAccents, clefComparaison, nettoyerMarkdown };
