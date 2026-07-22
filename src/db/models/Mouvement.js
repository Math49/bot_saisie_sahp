'use strict';

const { Schema, model, Types } = require('mongoose');

/**
 * Un mouvement de coffre (depot ou retrait), qu'il vienne du webhook StoryLife
 * ou d'une action manuelle via les boutons.
 */
const mouvementSchema = new Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    discord_id: { type: String, required: true },
    discord_name: { type: String, required: true },
    rp_name: { type: String, required: true },
    entreprise: { type: String, required: true },
    type: { type: String, required: true, enum: ['depot', 'retrait'] },
    objet_brut: { type: String, required: true },
    objet_canonique: { type: String, required: true },
    quantite: { type: Number, required: true, min: 1 },
    matricule_agent: { type: String, default: null },
    origine: { type: String, required: true, enum: ['webhook', 'manuel'], default: 'webhook' },
    // discord_id de la personne ayant fait un ajustement manuel (null si webhook)
    effectue_par: { type: String, default: null },
    // motif optionnel saisi lors d'un ajustement manuel
    motif: { type: String, default: null },
    // mouvement inverse lie (retrait <-> redepot) si reamenagement detecte
    mouvement_lie_id: { type: Types.ObjectId, ref: 'Mouvement', default: null },
    probable_reamenagement: { type: Boolean, default: false },
    // true si la saisie a ete "purgee" de la vue : le mouvement reste en base
    // (historique/audit conserves) mais n'entre plus dans le calcul du stock.
    exclu_du_stock: { type: Boolean, default: false },
  },
  { collection: 'mouvements' }
);

mouvementSchema.index({ objet_canonique: 1, entreprise: 1 });
mouvementSchema.index({ discord_id: 1, timestamp: 1 });
mouvementSchema.index({ matricule_agent: 1 });
mouvementSchema.index({ timestamp: 1 });

module.exports = model('Mouvement', mouvementSchema);
