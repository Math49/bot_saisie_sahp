'use strict';

// suspicionEngine.js — code de reference repris tel quel (voir specification).

const CONFIG = {
  seuilAlerte: 50,
  fenetreRafaleMin: 10,
  seuilRafale: 3,
  fenetreAllerRetourMin: 15,
  zScoreVolumeSeuil: 2,
  minPointsPourStats: 5,
  fenetreAgentJours: 14,
  seuilAgentRecidivisteNombre: 3,
  seuilAgentRecidivisteRatio: 0.4,
  minPointsPourStatsAgent: 5,
  multiplicateurEquipementService: 0.3, // reduction de poids (pas suppression) pour la liste de service
  fenetreReamenagementMin: 15, // fenetre de detection retrait -> redepot rapide
  multiplicateurReamenagement: 0.3, // meme principe que l'equipement de service

  poids: {
    soldeNegatif: 100,
    volumeAnormal: 40,
    rafale: 25,
    allerRetourRapide: 35,
    objetSensible: 20,
    comptesLies: 30,
    agentRecidiviste: 25,
  },
};

function detecterSoldeNegatif(mouvement, contexte) {
  if (mouvement.type !== 'retrait') return null;
  const soldeApres = contexte.stockAvant - mouvement.quantite;
  if (soldeApres >= 0) return null;
  return {
    cle: 'soldeNegatif',
    poids: CONFIG.poids.soldeNegatif,
    detail: `Retrait de ${mouvement.quantite} alors que le stock disponible était de ${contexte.stockAvant} (déficit de ${Math.abs(soldeApres)}).`,
  };
}

function detecterVolumeAnormal(mouvement, contexte) {
  if (mouvement.type !== 'retrait') return null;
  const retraitsPasses = contexte.historiqueObjet.filter((m) => m.type === 'retrait').map((m) => m.quantite);
  if (retraitsPasses.length < CONFIG.minPointsPourStats) return null;
  const moyenne = retraitsPasses.reduce((a, b) => a + b, 0) / retraitsPasses.length;
  const variance = retraitsPasses.reduce((a, b) => a + (b - moyenne) ** 2, 0) / retraitsPasses.length;
  const ecartType = Math.sqrt(variance);
  if (ecartType === 0) return null;
  const zScore = (mouvement.quantite - moyenne) / ecartType;
  if (zScore < CONFIG.zScoreVolumeSeuil) return null;
  return {
    cle: 'volumeAnormal',
    poids: Math.round(CONFIG.poids.volumeAnormal * Math.min(zScore / CONFIG.zScoreVolumeSeuil, 2)),
    detail: `Retrait de ${mouvement.quantite}, largement au-dessus de la moyenne habituelle (${moyenne.toFixed(1)}).`,
  };
}

function detecterRafale(mouvement, contexte) {
  if (mouvement.type !== 'retrait') return null;
  const limite = new Date(mouvement.timestamp.getTime() - CONFIG.fenetreRafaleMin * 60000);
  const recents = contexte.mouvementsRecents.filter((m) => m.type === 'retrait' && m.timestamp >= limite);
  if (recents.length < CONFIG.seuilRafale) return null;
  return {
    cle: 'rafale',
    poids: CONFIG.poids.rafale,
    detail: `${recents.length} retraits effectués par la même personne en moins de ${CONFIG.fenetreRafaleMin} minutes.`,
  };
}

function detecterAllerRetourRapide(mouvement, contexte) {
  if (mouvement.type !== 'retrait') return null;
  const limite = new Date(mouvement.timestamp.getTime() - CONFIG.fenetreAllerRetourMin * 60000);
  const depotCorrespondant = contexte.depotsRecents.find((m) => m.timestamp >= limite && m.quantite >= mouvement.quantite);
  if (!depotCorrespondant) return null;
  const minutesEcoulees = Math.round((mouvement.timestamp - depotCorrespondant.timestamp) / 60000);
  return {
    cle: 'allerRetourRapide',
    poids: CONFIG.poids.allerRetourRapide,
    detail: `Un dépôt de ${depotCorrespondant.quantite} du même objet a eu lieu ${minutesEcoulees} min avant ce retrait.`,
  };
}

function detecterObjetSensible(mouvement, contexte) {
  if (mouvement.type !== 'retrait' || !contexte.estSensible) return null;
  return {
    cle: 'objetSensible',
    poids: CONFIG.poids.objetSensible,
    detail: `${mouvement.objetCanonique} fait partie des objets sensibles (arme, munition, stupéfiant...).`,
  };
}

function detecterComptesLies(mouvement, contexte) {
  if (!contexte.identitesLiees || contexte.identitesLiees.length === 0) return null;
  const autres = contexte.identitesLiees.filter((id) => id.discordId !== mouvement.discordId || id.rpName !== mouvement.rpName);
  if (autres.length === 0) return null;
  return {
    cle: 'comptesLies',
    poids: CONFIG.poids.comptesLies,
    detail: `Le personnage ${mouvement.rpName} est aussi associé à ${autres.length} autre(s) compte(s) Discord récemment.`,
  };
}

function detecterAgentRecidiviste(mouvement, contexte) {
  if (!mouvement.matriculeAgent) return null;
  if (!contexte.historiqueAgent || contexte.historiqueAgent.length === 0) return null;
  const limite = new Date(mouvement.timestamp.getTime() - CONFIG.fenetreAgentJours * 24 * 60 * 60 * 1000);
  const traitesRecents = contexte.historiqueAgent.filter((m) => m.timestamp >= limite);
  if (traitesRecents.length === 0) return null;
  const suspectsRecents = traitesRecents.filter((m) => m.estSuspect);
  const ratio = suspectsRecents.length / traitesRecents.length;
  const declencheParNombre = suspectsRecents.length >= CONFIG.seuilAgentRecidivisteNombre;
  const declencheParRatio = traitesRecents.length >= CONFIG.minPointsPourStatsAgent && ratio >= CONFIG.seuilAgentRecidivisteRatio;
  if (!declencheParNombre && !declencheParRatio) return null;
  return {
    cle: 'agentRecidiviste',
    poids: CONFIG.poids.agentRecidiviste,
    detail: `Le matricule ${mouvement.matriculeAgent} a déjà traité ${suspectsRecents.length} retrait(s) suspect(s) sur ${traitesRecents.length} au cours des ${CONFIG.fenetreAgentJours} derniers jours.`,
  };
}

const SIGNAUX = [
  detecterSoldeNegatif,
  detecterVolumeAnormal,
  detecterRafale,
  detecterAllerRetourRapide,
  detecterObjetSensible,
  detecterComptesLies,
  detecterAgentRecidiviste,
];

// Reduction generique de poids (utilisee pour l'equipement de service ET pour le
// recalcul retroactif de reamenagement, voir reamenagementService.js) : le solde
// negatif reste un fait objectif, tous les autres signaux sont attenues.
function reduireSignauxSaufSoldeNegatif(signaux, multiplicateur) {
  return signaux.map((s) =>
    s.cle === 'soldeNegatif' ? s : { ...s, poids: Math.round(s.poids * multiplicateur) }
  );
}

function calculerScoreSuspicion(mouvement, contexte) {
  if (contexte.estWhitelist) {
    return { score: 0, estSuspect: false, signaux: [], ignore: true };
  }

  let signauxDeclenches = SIGNAUX.map((detecter) => detecter(mouvement, contexte)).filter(Boolean);

  if (contexte.estEquipementService) {
    signauxDeclenches = reduireSignauxSaufSoldeNegatif(signauxDeclenches, CONFIG.multiplicateurEquipementService);
  }

  const score = signauxDeclenches.reduce((total, s) => total + s.poids, 0);

  return {
    score,
    estSuspect: score >= CONFIG.seuilAlerte,
    signaux: signauxDeclenches,
    ignore: false,
  };
}

module.exports = { CONFIG, calculerScoreSuspicion, reduireSignauxSaufSoldeNegatif };
