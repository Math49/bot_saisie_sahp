'use strict';

const { Mouvement, Alerte } = require('../db/models');
const { versMouvement } = require('../db/mappers');
const { CONFIG } = require('./suspicionEngine');
const { estWhitelist, estEquipementService, estSensible } = require('../db/queries');
const { chargerCategories } = require('./categorieService');

// Fenetre (jours) pour la recherche d'identites liees (comptes/personnages croises).
const FENETRE_IDENTITES_JOURS = 30;

/**
 * Construit le "contexte" attendu par calculerScoreSuspicion() a partir de la BDD,
 * pour un mouvement DEJA stocke (doc Mongoose).
 *
 * Tous les tableaux de mouvements sont convertis en objets camelCase (versMouvement)
 * car le moteur lit m.timestamp (Date), m.type, m.quantite, etc.
 */
async function construireContexte(doc) {
  const mouvement = versMouvement(doc);
  const { objetCanonique, entreprise, discordId, rpName, matriculeAgent, timestamp } = mouvement;

  const ts = timestamp.getTime();
  const limiteRafale = new Date(ts - CONFIG.fenetreRafaleMin * 60000);
  const limiteAllerRetour = new Date(ts - CONFIG.fenetreAllerRetourMin * 60000);
  const limiteAgent = new Date(ts - CONFIG.fenetreAgentJours * 24 * 60 * 60 * 1000);
  const limiteIdentites = new Date(ts - FENETRE_IDENTITES_JOURS * 24 * 60 * 60 * 1000);

  const [
    stockAvantRes,
    historiqueObjetDocs,
    mouvementsRecentsDocs,
    depotsRecentsDocs,
    whitelist,
    equipement,
    sensible,
    cats,
    identitesDocs,
    historiqueAgent,
  ] = await Promise.all([
    // stockAvant : somme depots - retraits pour cet objet+entreprise, hors ce mouvement
    // (les saisies purgees sont exclues, comme dans le stock affiche)
    Mouvement.aggregate([
      {
        $match: {
          objet_canonique: objetCanonique,
          entreprise,
          _id: { $ne: doc._id },
          timestamp: { $lte: doc.timestamp },
          exclu_du_stock: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          depots: { $sum: { $cond: [{ $eq: ['$type', 'depot'] }, '$quantite', 0] } },
          retraits: { $sum: { $cond: [{ $eq: ['$type', 'retrait'] }, '$quantite', 0] } },
        },
      },
    ]),

    // historiqueObjet : mouvements passes sur cet objet+entreprise (z-score volume)
    Mouvement.find({
      objet_canonique: objetCanonique,
      entreprise,
      _id: { $ne: doc._id },
      timestamp: { $lt: doc.timestamp },
    }).lean(),

    // mouvementsRecents : meme discordId dans la fenetre de rafale (inclut le mouvement courant)
    Mouvement.find({
      discord_id: discordId,
      timestamp: { $gte: limiteRafale, $lte: doc.timestamp },
    }).lean(),

    // depotsRecents : depots du meme objet+entreprise dans la fenetre aller-retour
    Mouvement.find({
      objet_canonique: objetCanonique,
      entreprise,
      type: 'depot',
      _id: { $ne: doc._id },
      timestamp: { $gte: limiteAllerRetour, $lte: doc.timestamp },
    }).lean(),

    estWhitelist(objetCanonique),
    estEquipementService(objetCanonique),
    estSensible(objetCanonique),
    chargerCategories(),

    // identitesLiees : autres mouvements partageant le rpName OU le discordId
    Mouvement.find({
      _id: { $ne: doc._id },
      timestamp: { $gte: limiteIdentites },
      $or: [{ rp_name: rpName }, { discord_id: discordId }],
    })
      .select('discord_id rp_name')
      .lean(),

    // historiqueAgent : mouvements traites par le meme matricule (avec estSuspect)
    matriculeAgent
      ? construireHistoriqueAgent(matriculeAgent, limiteAgent, doc._id)
      : Promise.resolve([]),
  ]);

  const stockAvant =
    stockAvantRes.length > 0 ? stockAvantRes[0].depots - stockAvantRes[0].retraits : 0;

  // Identites liees : couples distincts (discordId, rpName)
  const identitesLiees = [];
  const vues = new Set();
  for (const d of identitesDocs) {
    const cle = `${d.discord_id}|${d.rp_name}`;
    if (!vues.has(cle)) {
      vues.add(cle);
      identitesLiees.push({ discordId: d.discord_id, rpName: d.rp_name });
    }
  }

  // Flags de la categorie de l'objet (whitelist / equipement / sensible).
  const flagsCat = cats.flagsPourObjet(objetCanonique);

  return {
    stockAvant,
    historiqueObjet: historiqueObjetDocs.map(versMouvement),
    mouvementsRecents: mouvementsRecentsDocs.map(versMouvement),
    depotsRecents: depotsRecentsDocs.map(versMouvement),
    // Un objet herite du flag s'il est liste directement OU si sa categorie l'est.
    estWhitelist: whitelist || flagsCat.est_whitelist,
    estEquipementService: equipement || flagsCat.est_equipement_service,
    estSensible: sensible || flagsCat.est_sensible,
    identitesLiees,
    historiqueAgent,
  };
}

/**
 * Historique d'un agent : ses mouvements recents, chacun marque estSuspect si une
 * alerte non "faux_positif" y est rattachee.
 */
async function construireHistoriqueAgent(matriculeAgent, limite, idCourant) {
  const docs = await Mouvement.find({
    matricule_agent: matriculeAgent,
    _id: { $ne: idCourant },
    timestamp: { $gte: limite },
  })
    .select('_id timestamp')
    .lean();

  if (docs.length === 0) return [];

  const ids = docs.map((d) => d._id);
  const alertesSuspectes = await Alerte.find({
    mouvement_id: { $in: ids },
    statut: { $in: ['en_attente', 'confirmee'] },
  })
    .select('mouvement_id')
    .lean();

  const idsSuspects = new Set(alertesSuspectes.map((a) => String(a.mouvement_id)));

  return docs.map((d) => ({
    timestamp: d.timestamp,
    estSuspect: idsSuspects.has(String(d._id)),
  }));
}

module.exports = { construireContexte };
