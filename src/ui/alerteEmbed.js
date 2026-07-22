'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const ids = require('./customIds');

const COULEUR_ROUGE = 0xe02424;
const COULEUR_ORANGE = 0xe8a33d; // reamenagement probable (jalon 5)
const COULEUR_TRAITE = 0x57606a; // gris une fois traite

const LABELS_SIGNAUX = {
  soldeNegatif: '🟥 Solde negatif',
  volumeAnormal: '📈 Volume anormal',
  rafale: '⚡ Rafale de retraits',
  allerRetourRapide: '🔁 Aller-retour rapide',
  objetSensible: '☣️ Objet sensible',
  comptesLies: '🕵️ Comptes lies',
  agentRecidiviste: '👮 Agent recidiviste',
};

/**
 * Construit l'embed d'une alerte de suspicion.
 *
 * @param {object} mouvement  mouvement camelCase (versMouvement)
 * @param {Array}  signaux    signaux declenches [{cle, poids, detail}]
 * @param {number} score
 * @param {object} [options]
 *   - couleur    : override de couleur (defaut rouge, ou gris si statut traite)
 *   - statut     : 'en_attente' | 'confirmee' | 'faux_positif'
 *   - traitePar  : discordId de la personne ayant traite
 *   - miseAJour  : texte d'un champ "Mise a jour" (reamenagement)
 */
function construireEmbedAlerte(mouvement, signaux, score, options = {}) {
  const statut = options.statut || 'en_attente';
  const traite = statut === 'confirmee' || statut === 'faux_positif';

  let couleur = options.couleur || COULEUR_ROUGE;
  if (traite) couleur = COULEUR_TRAITE;

  const embed = new EmbedBuilder()
    .setColor(couleur)
    .setTitle('🚨 Alerte — retrait suspect')
    .setTimestamp(mouvement.timestamp)
    .addFields(
      { name: 'Objet', value: `\`${mouvement.objetCanonique}\``, inline: true },
      { name: 'Quantite', value: String(mouvement.quantite), inline: true },
      { name: 'Type', value: mouvement.type === 'depot' ? 'Depot' : 'Retrait', inline: true },
      { name: 'Entreprise', value: mouvement.entreprise, inline: true },
      {
        name: 'Joueur',
        value: `${mouvement.rpName}\n<@${mouvement.discordId}> (${mouvement.discordId})`,
        inline: true,
      },
      {
        name: 'Matricule agent',
        value: mouvement.matriculeAgent ? `\`${mouvement.matriculeAgent}\`` : '—',
        inline: true,
      },
      { name: 'Score de risque', value: `**${score}** / seuil 50`, inline: false }
    );

  if (signaux && signaux.length > 0) {
    const texte = signaux
      .map((s) => {
        const label = LABELS_SIGNAUX[s.cle] || s.cle;
        return `**${label}** (+${s.poids})\n${s.detail}`;
      })
      .join('\n\n');
    embed.addFields({ name: 'Signaux declenches', value: texte.slice(0, 1024) });
  }

  if (options.miseAJour) {
    embed.addFields({ name: '📝 Mise a jour', value: options.miseAJour.slice(0, 1024) });
  }

  if (traite && options.traitePar) {
    const mention = statut === 'confirmee' ? '✅ Confirmee' : '❌ Faux positif';
    embed.addFields({ name: 'Traitement', value: `${mention} par <@${options.traitePar}>` });
  }

  return embed;
}

/**
 * Rangee de boutons Confirmer / Faux positif.
 * @param {string}  alerteId
 * @param {boolean} [desactives=false]  true une fois l'alerte traitee
 */
function construireBoutonsAlerte(alerteId, desactives = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ids.ALERTE_CONFIRMER}:${alerteId}`)
      .setLabel('Confirmer')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desactives),
    new ButtonBuilder()
      .setCustomId(`${ids.ALERTE_FAUX_POSITIF}:${alerteId}`)
      .setLabel('Faux positif')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(desactives)
  );
}

module.exports = {
  construireEmbedAlerte,
  construireBoutonsAlerte,
  COULEUR_ROUGE,
  COULEUR_ORANGE,
  COULEUR_TRAITE,
};
