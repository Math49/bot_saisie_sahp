'use strict';

const { chargerObjetsConnus } = require('../db/queries');

// ---------------------------------------------------------------------------
// Extraction du matricule agent — code de reference repris tel quel.
//
// Certains noms d'objets sont prefixes du matricule de l'agent : "XX - nom" ou
// "XX nom" (matricule = 1 a 4 chiffres, toujours en premier). Le prefixe n'est
// retire QUE si le reste correspond a un objet deja connu, sinon on garde le
// texte complet (pas de decoupe a l'aveugle : "9mm" ne devient jamais "9" + "mm",
// la regex exige d'ailleurs un separateur apres les chiffres).
// ---------------------------------------------------------------------------
const REGEX_MATRICULE = /^(\d{1,4})(?:\s*-\s*|\s+)(.+)$/;

function extraireMatricule(objetBrut, estObjetConnu) {
  const texte = objetBrut.trim();
  const correspondance = texte.match(REGEX_MATRICULE);
  if (!correspondance) return { matriculeAgent: null, objetSansMatricule: texte };
  const [, matricule, reste] = correspondance;
  const resteNettoye = reste.trim();
  if (!estObjetConnu(resteNettoye)) return { matriculeAgent: null, objetSansMatricule: texte };
  return { matriculeAgent: matricule, objetSansMatricule: resteNettoye };
}

// ---------------------------------------------------------------------------
// Normalisation complete : matricule + resolution d'alias -> objet canonique.
// ---------------------------------------------------------------------------

/**
 * Normalise un objet brut issu d'un log (ou d'une saisie manuelle).
 *
 * @param {string} objetBrut  ex "12 - BeanBag", "8x" deja retire en amont
 * @returns {Promise<{matriculeAgent, objetCanonique, objetSansMatricule, reconnu}>}
 *   - matriculeAgent : matricule extrait ou null
 *   - objetCanonique : objet apres resolution d'alias (ou texte complet si inconnu)
 *   - reconnu        : true si l'objet est connu (whitelist / service / alias / catalogue)
 */
async function normaliserObjet(objetBrut) {
  const { estConnu, resoudreAlias } = await chargerObjetsConnus();

  const { matriculeAgent, objetSansMatricule } = extraireMatricule(objetBrut, estConnu);

  const reconnu = estConnu(objetSansMatricule);
  const objetCanonique = resoudreAlias(objetSansMatricule) || objetSansMatricule;

  return { matriculeAgent, objetCanonique, objetSansMatricule, reconnu };
}

module.exports = {
  extraireMatricule,
  normaliserObjet,
  REGEX_MATRICULE,
};
