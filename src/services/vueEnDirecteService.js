'use strict';

const { MessageFlags } = require('discord.js');
const config = require('../config/config');
const { EtatBot } = require('../db/models');
const { stockParEntreprise, stockParEntrepriseComplet } = require('./stockService');
const { chargerCategories, CATEGORIE_NON_CLASSEE } = require('./categorieService');
const { estEtatMajor } = require('../utils/permissions');
const {
  construireEmbedVueEnDirecte,
  construireBoutonsVue,
} = require('../ui/vueEnDirecteEmbed');

const CLE_ETAT = 'vue_en_direct';
const CLE_AFFICHER_ZEROS = 'afficher_zeros';
const CLE_PAGE = 'vue_page';
const LIGNES_PAR_PAGE = 30;

// Serialise les rafraichissements : si une demande arrive pendant qu'un
// rafraichissement tourne, on ne l'abandonne pas — on la coalesce (une relance
// est effectuee a la fin) pour que la vue reflete toujours le dernier etat.
let rafraichissementEnCours = false;
let rafraichissementEnAttente = false;

/** Recupere {channelId, messageId} memorise, ou null. */
async function lireEtat() {
  const doc = await EtatBot.findOne({ cle: CLE_ETAT }).lean();
  return doc && doc.valeur ? doc.valeur : null;
}

/** Memorise {channelId, messageId} du message de vue en direct. */
async function enregistrerEtat(channelId, messageId) {
  await EtatBot.findOneAndUpdate(
    { cle: CLE_ETAT },
    { cle: CLE_ETAT, valeur: { channelId, messageId } },
    { upsert: true }
  );
}

/** Lit le reglage "afficher les lignes a 0" (defaut : false). */
async function lireAfficherZeros() {
  const doc = await EtatBot.findOne({ cle: CLE_AFFICHER_ZEROS }).lean();
  return Boolean(doc && doc.valeur);
}

/** Enregistre le reglage "afficher les lignes a 0". */
async function definirAfficherZeros(valeur) {
  await EtatBot.findOneAndUpdate(
    { cle: CLE_AFFICHER_ZEROS },
    { cle: CLE_AFFICHER_ZEROS, valeur: Boolean(valeur) },
    { upsert: true }
  );
}

/** Lit la page courante de la vue (defaut : 0). */
async function lirePage() {
  const doc = await EtatBot.findOne({ cle: CLE_PAGE }).lean();
  const n = doc && Number.isInteger(doc.valeur) ? doc.valeur : 0;
  return n < 0 ? 0 : n;
}

/** Enregistre la page courante de la vue. */
async function definirPage(valeur) {
  await EtatBot.findOneAndUpdate(
    { cle: CLE_PAGE },
    { cle: CLE_PAGE, valeur: Math.max(0, valeur | 0) },
    { upsert: true }
  );
}

/** Tri stable : entreprise, puis categorie (Non categorise en dernier), puis objet. */
function trierLignes(lignes) {
  const comparerCat = (a, b) => {
    if (a === CATEGORIE_NON_CLASSEE) return 1;
    if (b === CATEGORIE_NON_CLASSEE) return -1;
    return a.localeCompare(b);
  };
  return lignes.sort(
    (x, y) =>
      x.entreprise.localeCompare(y.entreprise) ||
      comparerCat(x.categorie, y.categorie) ||
      x.objet.localeCompare(y.objet)
  );
}

/**
 * Construit le contenu (embed + boutons) a jour, selon le reglage d'affichage
 * des lignes a 0.
 */
async function construireContenu() {
  const afficherZeros = await lireAfficherZeros();
  const [lignesBrutes, cats] = await Promise.all([
    afficherZeros ? stockParEntrepriseComplet() : stockParEntreprise(),
    chargerCategories(),
  ]);

  // Rattache chaque ligne a sa categorie, puis trie de facon stable.
  const lignes = trierLignes(
    lignesBrutes.map((l) => ({ ...l, categorie: cats.classer(l.objet) || CATEGORIE_NON_CLASSEE }))
  );

  // Totaux par categorie (toutes pages confondues).
  const totaux = new Map();
  for (const l of lignes) {
    const cle = `${l.entreprise}|${l.categorie}`;
    totaux.set(cle, (totaux.get(cle) || 0) + l.stock);
  }

  // Pagination : 30 lignes d'objets max par page.
  const totalLignes = lignes.length;
  const totalPages = Math.max(1, Math.ceil(totalLignes / LIGNES_PAR_PAGE));
  let page = await lirePage();
  if (page >= totalPages) page = totalPages - 1;
  if (page < 0) page = 0;
  await definirPage(page); // reconforme la page stockee si les donnees ont change

  const pageLignes = lignes.slice(page * LIGNES_PAR_PAGE, (page + 1) * LIGNES_PAR_PAGE);

  return {
    embeds: [construireEmbedVueEnDirecte(pageLignes, { page, totalPages, totalLignes, totaux })],
    components: construireBoutonsVue(afficherZeros, { page, totalPages }),
  };
}

/**
 * Poste le message de vue en direct s'il n'existe pas encore, sinon l'edite.
 * Robuste : si le message memorise a ete supprime, on en reposte un nouveau.
 * Les demandes concurrentes sont coalescees (aucune n'est perdue).
 */
async function rafraichirVueEnDirecte(client) {
  if (rafraichissementEnCours) {
    rafraichissementEnAttente = true; // une demande est arrivee : on relancera
    return;
  }
  rafraichissementEnCours = true;
  try {
    do {
      rafraichissementEnAttente = false;
      await appliquerContenu(client);
    } while (rafraichissementEnAttente); // rejoue si une demande est arrivee entre-temps
  } finally {
    rafraichissementEnCours = false;
  }
}

/** Construit le contenu a jour et l'ecrit dans le message de vue (edit ou post). */
async function appliquerContenu(client) {
  try {
    const contenu = await construireContenu();
    const etat = await lireEtat();

    // 1. Tentative d'edition du message existant
    if (etat && etat.channelId && etat.messageId) {
      try {
        const salon = await client.channels.fetch(etat.channelId);
        const message = await salon.messages.fetch(etat.messageId);
        await message.edit(contenu);
        return;
      } catch (err) {
        console.warn('[VueEnDirect] Message memorise introuvable, re-creation :', err.message);
      }
    }

    // 2. Sinon : post initial dans le salon configure
    const salonCible = await client.channels.fetch(config.VUE_DIRECTE_CHANNEL_ID);
    if (!salonCible || !salonCible.isTextBased()) {
      throw new Error('VUE_DIRECTE_CHANNEL_ID invalide ou non textuel.');
    }
    const message = await salonCible.send(contenu);
    await enregistrerEtat(salonCible.id, message.id);
    console.log(`[VueEnDirect] Message poste (${message.id}).`);
  } catch (err) {
    console.error('[VueEnDirect] Echec du rafraichissement :', err.message);
  }
}

/**
 * Bascule l'affichage des lignes a 0 (etat-major) et met a jour la vue en place.
 * Le reglage est persistant : il survit aux rafraichissements et redemarrages.
 */
async function basculerAffichageZeros(client, interaction) {
  if (!estEtatMajor(interaction)) {
    return interaction.reply({
      content: "⛔ Seul l'etat-major peut changer l'affichage.",
      flags: MessageFlags.Ephemeral,
    });
  }
  const actuel = await lireAfficherZeros();
  await definirAfficherZeros(!actuel);
  // Le bouton se trouve sur le message de la vue : on l'edite directement.
  const contenu = await construireContenu();
  await interaction.update(contenu);
}

/**
 * Change de page (delta = -1 ou +1) et met a jour la vue en place.
 * Navigation ouverte a tous : c'est de la simple consultation.
 */
async function changerPage(client, interaction, delta) {
  const page = await lirePage();
  await definirPage(page + delta); // sera reconforme dans construireContenu
  const contenu = await construireContenu();
  await interaction.update(contenu);
}

module.exports = { rafraichirVueEnDirecte, basculerAffichageZeros, changerPage };
