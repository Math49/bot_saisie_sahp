'use strict';

/**
 * Convertit un document Mongoose "Mouvement" (snake_case) en objet mouvement
 * camelCase attendu par le moteur de suspicion et le contexteBuilder.
 *
 * Le moteur fait `mouvement.timestamp.getTime()` et compare `m.timestamp >= limite`
 * : `timestamp` doit donc rester un objet Date (c'est deja le cas avec Mongo).
 */
function versMouvement(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: o._id ? String(o._id) : null,
    timestamp: o.timestamp instanceof Date ? o.timestamp : new Date(o.timestamp),
    discordId: o.discord_id,
    discordName: o.discord_name,
    rpName: o.rp_name,
    entreprise: o.entreprise,
    type: o.type,
    objetBrut: o.objet_brut,
    objetCanonique: o.objet_canonique,
    quantite: o.quantite,
    matriculeAgent: o.matricule_agent || null,
    origine: o.origine,
    effectuePar: o.effectue_par || null,
    motif: o.motif || null,
    mouvementLieId: o.mouvement_lie_id ? String(o.mouvement_lie_id) : null,
    probableReamenagement: Boolean(o.probable_reamenagement),
  };
}

module.exports = { versMouvement };
