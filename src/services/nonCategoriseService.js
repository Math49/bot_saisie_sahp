'use strict';

const config = require('../config/config');
const { construireEmbedObjetNonCategorise } = require('../ui/objetNonCategoriseEmbed');

/**
 * Poste un embed "objet non categorise" dans le salon dedie.
 * Partage entre l'ingestion webhook et les ajustements manuels.
 * @param {Client} client
 * @param {object} doc  mouvement stocke (snake_case)
 */
async function signalerObjetNonCategorise(client, doc) {
  try {
    const salon = await client.channels.fetch(config.CHANNEL_OBJETS_NON_CATEGORISES);
    if (!salon || !salon.isTextBased()) return;
    await salon.send({ embeds: [construireEmbedObjetNonCategorise(doc)] });
  } catch (err) {
    console.error('[NonCategorise] Impossible de signaler l objet :', err.message);
  }
}

module.exports = { signalerObjetNonCategorise };
