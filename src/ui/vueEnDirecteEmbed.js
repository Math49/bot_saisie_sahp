'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const ids = require('./customIds');

const MAX_VALEUR_CHAMP = 1024; // limite Discord par valeur de champ
const MAX_CHAMPS = 25; // limite Discord de champs par embed

/**
 * Decoupe une liste de lignes en blocs dont la longueur ne depasse pas la limite
 * d'un champ d'embed.
 */
function decouperEnBlocs(lignes, limite) {
  const blocs = [];
  let courant = '';
  for (const ligne of lignes) {
    // +1 pour le saut de ligne
    if (courant.length + ligne.length + 1 > limite) {
      if (courant) blocs.push(courant);
      courant = ligne;
    } else {
      courant = courant ? `${courant}\n${ligne}` : ligne;
    }
  }
  if (courant) blocs.push(courant);
  return blocs;
}

const CATEGORIE_NON_CLASSEE = 'Non catégorisé';

/**
 * Construit l'embed d'UNE PAGE de la vue. Les lignes recues sont deja triees et
 * decoupees pour la page courante ; les totaux par categorie sont ceux de la
 * categorie ENTIERE (toutes pages confondues).
 *
 * @param {Array<{entreprise, categorie, objet, stock}>} pageLignes
 * @param {object} [opts]
 *   - page, totalPages, totalLignes
 *   - totaux : Map cle `${entreprise}|${categorie}` -> total complet
 */
function construireEmbedVueEnDirecte(pageLignes, opts = {}) {
  const { page = 0, totalPages = 1, totalLignes = 0, totaux = new Map() } = opts;

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle('📦 Coffre des saisies — Vue en direct')
    .setTimestamp(new Date())
    .setFooter({
      text: `Page ${page + 1}/${totalPages} · ${totalLignes} objet(s) · Mise a jour automatique`,
    });

  if (!pageLignes || pageLignes.length === 0) {
    embed.setDescription('_Aucun mouvement enregistre pour le moment._');
    return embed;
  }

  // Regroupement des lignes de la page par (entreprise, categorie), ordre preserve.
  const groupes = new Map(); // cle -> { entreprise, cat, objets: [] }
  for (const { entreprise, categorie, objet, stock } of pageLignes) {
    const cat = categorie || CATEGORIE_NON_CLASSEE;
    const cle = `${entreprise}|${cat}`;
    if (!groupes.has(cle)) groupes.set(cle, { entreprise, cat, objets: [] });
    groupes.get(cle).objets.push({ objet, stock });
  }

  const champs = [];
  for (const { entreprise, cat, objets } of groupes.values()) {
    const total = totaux.get(`${entreprise}|${cat}`);
    const lignesObjets = objets.map(({ objet, stock }) => {
      const alerte = stock < 0 ? ' ⚠️' : '';
      return `• ${objet} : \`${stock}\`${alerte}`;
    });

    const blocs = decouperEnBlocs(lignesObjets, MAX_VALEUR_CHAMP);
    blocs.forEach((bloc, i) => {
      const suite = i === 0 ? '' : ' (suite)';
      const totalTxt = total === undefined ? '' : ` — total ${total}`;
      champs.push({
        name: `🏢 ${entreprise} · 📁 ${cat}${totalTxt}${suite}`.slice(0, 256),
        value: bloc,
      });
    });
  }

  if (champs.length > MAX_CHAMPS) {
    champs.length = MAX_CHAMPS - 1;
    champs.push({ name: '…', value: '_Trop de categories sur cette page._' });
  }

  embed.addFields(champs);
  return embed;
}

/**
 * Rangees de boutons sous la vue en direct.
 * @param {boolean} afficherZeros  etat courant de l'affichage des lignes a 0
 * @param {object} [pagination]    { page, totalPages } — rangee de navigation si > 1 page
 * @returns {ActionRowBuilder[]}
 */
function construireBoutonsVue(afficherZeros = false, pagination = { page: 0, totalPages: 1 }) {
  const rangeeActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.VUE_HISTORIQUE)
      .setLabel('Historique')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ids.VUE_AJOUTER)
      .setLabel('Ajouter')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(ids.VUE_RETIRER)
      .setLabel('Retirer')
      .setEmoji('➖')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(ids.VUE_SUPPRIMER)
      .setLabel('Supprimer')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ids.VUE_CONFIG)
      .setLabel('Configuration')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Primary)
  );

  const rangeeAffichage = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.VUE_TOGGLE_ZEROS)
      .setLabel(afficherZeros ? 'Masquer les lignes a 0' : 'Afficher les lignes a 0')
      .setEmoji(afficherZeros ? '🙈' : '👁️')
      .setStyle(ButtonStyle.Secondary)
  );

  const rangees = [rangeeActions, rangeeAffichage];

  // Rangee de pagination uniquement s'il y a plus d'une page.
  const { page = 0, totalPages = 1 } = pagination || {};
  if (totalPages > 1) {
    rangees.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.VUE_PAGE_PREV)
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 0),
        new ButtonBuilder()
          .setCustomId(ids.VUE_PAGE_INDIC)
          .setLabel(`Page ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(ids.VUE_PAGE_NEXT)
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      )
    );
  }

  return rangees;
}

module.exports = { construireEmbedVueEnDirecte, construireBoutonsVue };
