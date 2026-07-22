'use strict';

const { EmbedBuilder } = require('discord.js');

/**
 * Embed distinct des alertes de suspicion : signale qu'un nom d'objet inconnu
 * est apparu et merite une revue manuelle (a ajouter en whitelist / alias).
 * @param {object} doc  mouvement (doc Mongoose ou objet snake_case)
 */
function construireEmbedObjetNonCategorise(doc) {
  return new EmbedBuilder()
    .setColor(0xf1c40f) // jaune
    .setTitle('🟡 Objet non catégorisé')
    .setDescription(
      "Un nom d'objet inconnu est apparu dans les logs. Il a été enregistré tel quel " +
        "et n'est pas rattaché à un objet connu. Ajoute-le en whitelist ou crée un alias " +
        'via le panneau ⚙️ Configuration pour qu\'il soit correctement traité à l\'avenir.'
    )
    .addFields(
      { name: 'Objet (brut)', value: `\`${doc.objet_brut}\``, inline: true },
      { name: 'Quantité', value: String(doc.quantite), inline: true },
      { name: 'Type', value: doc.type === 'depot' ? 'Dépôt' : 'Retrait', inline: true },
      { name: 'Entreprise', value: doc.entreprise, inline: true },
      { name: 'Joueur', value: `${doc.rp_name} (${doc.discord_id})`, inline: true }
    )
    .setTimestamp(doc.timestamp || new Date());
}

module.exports = { construireEmbedObjetNonCategorise };
