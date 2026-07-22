'use strict';

const { clefComparaison, nettoyerMarkdown } = require('../utils/texte');

/**
 * Parsing d'un embed de log de coffre StoryLife.
 *
 * Le webhook poste un embed dont les champs portent des labels du type :
 *   "Nom Discord : <pseudo>"           -> discord_name
 *   "ID Discord : <id>"                -> discord_id
 *   "Nom et Prenom IG : <nom RP>"      -> rp_name
 *   "Entreprise (Coffre) — <societe>"  -> entreprise
 *   "Depot (coffre societe) — <NxObj>" -> type=depot,   objet + quantite
 *   "Retrait (coffre societe) — <NxO>" -> type=retrait, objet + quantite
 *
 * Le parsing matche par MOT-CLE dans le label (insensible a la casse/accents),
 * jamais par position : l'ordre des champs n'a pas d'importance.
 *
 * Renvoie null si l'embed n'est pas un log de coffre exploitable.
 */

// "1x BeanBag", "8x BeanBag", "4x .45 ACP"
const REGEX_QUANTITE_OBJET = /^\s*(\d+)\s*x\s*(.+)$/i;

/**
 * Construit une liste de paires {label, valeur} a partir de l'embed, en gerant :
 *  - les champs classiques (field.name / field.value)
 *  - le cas ou label et valeur sont colles dans le name via un separateur (— : -)
 *  - un repli sur la description ligne par ligne
 */
function extrairePaires(embed) {
  const paires = [];

  const pousser = (label, valeur) => {
    const l = nettoyerMarkdown(label || '');
    let v = nettoyerMarkdown(valeur || '');
    // Si la valeur est vide mais le label contient un separateur, on scinde.
    if (!v && l) {
      const m = l.match(/^(.*?)\s*[—:–-]\s*(.+)$/);
      if (m) {
        paires.push({ label: m[1].trim(), valeur: m[2].trim() });
        return;
      }
    }
    paires.push({ label: l.replace(/\s*[—:–-]\s*$/, '').trim(), valeur: v });
  };

  for (const f of embed.fields || []) {
    pousser(f.name, f.value);
  }

  // Repli : certaines integrations mettent tout dans la description.
  if (embed.description) {
    for (const ligne of String(embed.description).split('\n')) {
      const m = ligne.match(/^(.*?)\s*[—:–-]\s*(.+)$/);
      if (m) pousser(m[1], m[2]);
    }
  }
  // Le titre peut aussi porter l'entreprise ou le type dans certaines variantes.
  if (embed.title) {
    const m = String(embed.title).match(/^(.*?)\s*[—:–-]\s*(.+)$/);
    if (m) pousser(m[1], m[2]);
  }

  return paires;
}

/** Renvoie la valeur de la premiere paire dont le label contient l'un des mots-cles. */
function trouverValeur(paires, motsCles) {
  for (const { label, valeur } of paires) {
    const l = clefComparaison(label);
    if (motsCles.some((mc) => l.includes(mc))) return valeur;
  }
  return null;
}

/** Trouve la paire de mouvement (depot/retrait) et renvoie {type, valeur}. */
function trouverMouvement(paires) {
  for (const { label, valeur } of paires) {
    const l = clefComparaison(label);
    if (l.includes('depot')) return { type: 'depot', valeur };
    if (l.includes('retrait')) return { type: 'retrait', valeur };
  }
  return null;
}

function parserEmbedCoffre(embed) {
  if (!embed) return null;
  const paires = extrairePaires(embed);
  if (paires.length === 0) return null;

  const mouvement = trouverMouvement(paires);
  if (!mouvement || !mouvement.valeur) return null;

  const mQte = mouvement.valeur.match(REGEX_QUANTITE_OBJET);
  if (!mQte) return null;
  const quantite = parseInt(mQte[1], 10);
  const objetBrut = mQte[2].trim();
  if (!Number.isFinite(quantite) || quantite <= 0 || !objetBrut) return null;

  const discordId = trouverValeur(paires, ['id discord']);
  // Un log de coffre doit au minimum identifier l'auteur ET le mouvement.
  if (!discordId) return null;

  const discordName = trouverValeur(paires, ['nom discord']) || '(inconnu)';
  const rpName = trouverValeur(paires, ['nom et prenom', 'prenom', 'nom et prenom ig']) || '(inconnu)';
  const entreprise = trouverValeur(paires, ['entreprise']) || '(inconnue)';

  return {
    type: mouvement.type,
    quantite,
    objet_brut: objetBrut,
    discord_id: discordId.trim(),
    discord_name: discordName.trim(),
    rp_name: rpName.trim(),
    entreprise: entreprise.trim(),
  };
}

module.exports = { parserEmbedCoffre, REGEX_QUANTITE_OBJET };
