'use strict';

const { MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const { Mouvement } = require('../../db/models');
const { normaliserObjet } = require('../../services/normalisation');
const { traiterMouvement } = require('../../services/pipeline');
const { rafraichirVueEnDirecte } = require('../../services/vueEnDirecteService');
const { signalerObjetNonCategorise } = require('../../services/nonCategoriseService');
const { estAgent } = require('../../utils/permissions');
const ids = require('../customIds');

const MAX_RESULTATS_HISTORIQUE = 15;

/**
 * Soumission de la modale d'ajout / retrait manuel.
 * customId : modal:mouvement:depot | modal:mouvement:retrait
 */
async function gererModalMouvement(client, interaction) {
  // Defere immediatement (fenetre de 3 s) : toute la suite passe par editReply.
  if (!(await defererSur(interaction))) return;

  if (!estAgent(interaction)) {
    return interaction.editReply({ content: "⛔ Tu n'as pas la permission d'ajuster le coffre." });
  }

  const type = interaction.customId.split(':')[2]; // depot | retrait
  const objetSaisi = interaction.fields.getTextInputValue(ids.CHAMP_OBJET).trim();
  const quantiteSaisie = interaction.fields.getTextInputValue(ids.CHAMP_QUANTITE).trim();
  const motif = (interaction.fields.getTextInputValue(ids.CHAMP_MOTIF) || '').trim() || null;

  const quantite = Number.parseInt(quantiteSaisie, 10);
  if (!Number.isInteger(quantite) || quantite <= 0) {
    return interaction.editReply({
      content: `❌ Quantite invalide : \`${quantiteSaisie}\`. Entre un entier positif.`,
    });
  }

  try {
    const { matriculeAgent, objetCanonique, reconnu } = await normaliserObjet(objetSaisi);

    const membre = interaction.member;
    const doc = await Mouvement.create({
      timestamp: new Date(),
      discord_id: interaction.user.id,
      discord_name: interaction.user.tag,
      rp_name: (membre && membre.displayName) || interaction.user.username,
      entreprise: config.ENTREPRISE_PAR_DEFAUT,
      type,
      objet_brut: objetSaisi,
      objet_canonique: objetCanonique,
      quantite,
      matricule_agent: matriculeAgent,
      origine: 'manuel',
      effectue_par: interaction.user.id,
      motif,
    });

    if (!reconnu) await signalerObjetNonCategorise(client, doc);

    const { alerte } = await traiterMouvement(client, doc);
    await rafraichirVueEnDirecte(client);

    const verbe = type === 'depot' ? 'Ajout' : 'Retrait';
    let message =
      `✅ ${verbe} enregistre : **${quantite}× ${objetCanonique}** ` +
      `(entreprise ${config.ENTREPRISE_PAR_DEFAUT}).`;
    if (motif) message += `\nMotif : ${motif}`;
    if (!reconnu) message += `\n🟡 Objet non reconnu — signale pour categorisation.`;
    if (alerte) message += `\n🚨 Ce mouvement a declenche une alerte de suspicion.`;

    await interaction.editReply({ content: message });
  } catch (err) {
    console.error('[ActionManuelle] Erreur :', err.message);
    await editReplySur(interaction, '❌ Une erreur est survenue lors de l enregistrement.');
  }
}

/**
 * Soumission de la modale d'historique.
 * customId : modal:historique
 */
async function gererModalHistorique(client, interaction) {
  if (!(await defererSur(interaction))) return;
  const recherche = interaction.fields.getTextInputValue(ids.CHAMP_RECHERCHE).trim();

  try {
    const regex = new RegExp(echapperRegex(recherche), 'i');
    const filtre = {
      $or: [
        { objet_canonique: regex },
        { objet_brut: regex },
        { rp_name: regex },
        { discord_id: recherche },
        { discord_name: regex },
        { matricule_agent: recherche },
      ],
    };

    const mouvements = await Mouvement.find(filtre)
      .sort({ timestamp: -1 })
      .limit(MAX_RESULTATS_HISTORIQUE)
      .lean();

    if (mouvements.length === 0) {
      return interaction.editReply({
        content: `Aucun mouvement trouve pour \`${recherche}\`.`,
      });
    }

    const lignes = mouvements.map((m) => {
      const date = new Date(m.timestamp);
      const quand = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
      const signe = m.type === 'depot' ? '➕' : '➖';
      const rea = m.probable_reamenagement ? ' 🔁 _reamenagement_' : '';
      const horsStock = m.exclu_du_stock ? ' 🗑️ _hors stock_' : '';
      const mat = m.matricule_agent ? ` · mat. ${m.matricule_agent}` : '';
      const origine = m.origine === 'manuel' ? ' · _manuel_' : '';
      return `${signe} **${m.quantite}× ${m.objet_canonique}** — ${m.rp_name}${mat}${origine} · ${quand}${rea}${horsStock}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x2b6cb0)
      .setTitle(`📜 Historique — "${recherche}"`)
      .setDescription(lignes.join('\n').slice(0, 4000))
      .setFooter({ text: `${mouvements.length} dernier(s) mouvement(s)` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Historique] Erreur :', err.message);
    await interaction.editReply({ content: '❌ Une erreur est survenue lors de la recherche.' });
  }
}

/** Echappe les caracteres speciaux regex d'une saisie utilisateur. */
function echapperRegex(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Defere une reponse ephemere de facon sure. Renvoie false si l'interaction est
 * deja expiree/inconnue (10062) — l'appelant doit alors abandonner proprement.
 */
async function defererSur(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (err) {
    console.warn('[Modal] Interaction expiree, reponse impossible :', err.message);
    return false;
  }
}

/** editReply/reply robuste (ne jette jamais). */
async function editReplySur(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
    /* interaction perdue : rien a faire */
  }
}

module.exports = { gererModalMouvement, gererModalHistorique };
