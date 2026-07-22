'use strict';

const {
  Mouvement,
  WhitelistObjet,
  EquipementService,
  AliasObjet,
  ObjetSensible,
} = require('./models');
const { clefComparaison } = require('../utils/texte');
const { correspond } = require('../utils/matcher');

/**
 * Helpers de requete centralises (evite de dupliquer la logique DB entre services).
 * Chaque entree de liste peut etre un texte exact OU un motif regex (champ est_regex).
 */

/** true si `candidat` correspond a au moins une entree de la liste (champ `champ`). */
async function correspondDansListe(Model, champ, candidat) {
  const entrees = await Model.find({}, `${champ} est_regex`).lean();
  return entrees.some((e) => correspond(e, e[champ], candidat));
}

/**
 * Charge de quoi normaliser un objet : une fonction `estConnu` et une fonction
 * `resoudreAlias`, toutes deux compatibles regex.
 *
 * estConnu(texte)      : true si texte match whitelist / equipement / alias / catalogue
 * resoudreAlias(texte) : objet_canonique cible si un alias match, sinon null
 */
async function chargerObjetsConnus() {
  const [whitelist, equipement, alias, catalogue] = await Promise.all([
    WhitelistObjet.find({}, 'objet_canonique est_regex').lean(),
    EquipementService.find({}, 'objet_canonique est_regex').lean(),
    AliasObjet.find({}, 'alias objet_canonique est_regex').lean(),
    Mouvement.distinct('objet_canonique'),
  ]);

  // Litteraux (comparaison normalisee) et motifs regex, tous confondus pour estConnu.
  const litteraux = new Set();
  const regexList = [];

  const ajouter = (valeur, estRegex) => {
    if (estRegex) {
      regexList.push({ est_regex: true, valeur });
    } else {
      litteraux.add(clefComparaison(valeur));
    }
  };

  for (const w of whitelist) ajouter(w.objet_canonique, w.est_regex);
  for (const e of equipement) ajouter(e.objet_canonique, e.est_regex);
  for (const a of alias) {
    ajouter(a.alias, a.est_regex);
    // la cible d'un alias est toujours un objet canonique connu (litteral)
    litteraux.add(clefComparaison(a.objet_canonique));
  }
  for (const c of catalogue) litteraux.add(clefComparaison(c));

  const estConnu = (texte) => {
    if (litteraux.has(clefComparaison(texte))) return true;
    return regexList.some((r) => correspond(r, r.valeur, texte));
  };

  const resoudreAlias = (texte) => {
    for (const a of alias) {
      if (correspond(a, a.alias, texte)) return a.objet_canonique;
    }
    return null;
  };

  return { estConnu, resoudreAlias };
}

/** true si l'objet est sur liste blanche (texte ou regex). */
function estWhitelist(objetCanonique) {
  return correspondDansListe(WhitelistObjet, 'objet_canonique', objetCanonique);
}

/** true si l'objet fait partie de l'equipement de service (texte ou regex). */
function estEquipementService(objetCanonique) {
  return correspondDansListe(EquipementService, 'objet_canonique', objetCanonique);
}

/** true si l'objet est marque comme sensible (texte ou regex). */
function estSensible(objetCanonique) {
  return correspondDansListe(ObjetSensible, 'objet_canonique', objetCanonique);
}

module.exports = {
  chargerObjetsConnus,
  correspondDansListe,
  estWhitelist,
  estEquipementService,
  estSensible,
};
