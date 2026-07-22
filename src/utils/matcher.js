'use strict';

const { clefComparaison } = require('./texte');

/**
 * Une entree de liste peut etre un TEXTE EXACT (comparaison insensible casse/accents)
 * ou un MOTIF REGEX (teste avec le drapeau 'i'). Ces helpers factorisent le matching
 * pour whitelist / equipement de service / objets sensibles / alias.
 */

/** Compile un motif regex de facon sure. Renvoie null si invalide. */
function compilerRegex(motif) {
  try {
    return new RegExp(motif, 'i');
  } catch {
    return null;
  }
}

/** Valide qu'un motif regex compile. */
function regexValide(motif) {
  return compilerRegex(motif) !== null;
}

/**
 * true si `candidat` correspond a l'entree.
 * @param {{est_regex?: boolean}} entree
 * @param {string} valeur  la chaine/motif de l'entree
 * @param {string} candidat
 */
function correspond(entree, valeur, candidat) {
  if (entree && entree.est_regex) {
    const re = compilerRegex(valeur);
    return re ? re.test(candidat) : false;
  }
  return clefComparaison(valeur) === clefComparaison(candidat);
}

module.exports = { compilerRegex, regexValide, correspond };
