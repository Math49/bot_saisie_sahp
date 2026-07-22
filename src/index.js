'use strict';

const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/config');
const { connecterMongo } = require('./db/connexion');

// Handlers d'evenements
const readyEvent = require('./events/ready');
const messageCreateEvent = require('./events/messageCreate');
const interactionCreateEvent = require('./events/interactionCreate');

async function demarrer() {
  // 1. Verifie que les secrets sont presents avant toute connexion
  config.verifierConfig();

  // 2. Connexion a MongoDB (avant Discord pour que la DB soit prete a l'ingestion)
  await connecterMongo();

  // 3. Client Discord. MessageContent est OBLIGATOIRE pour lire les embeds du
  //    webhook (messages qui ne proviennent pas de ce bot). L'intent doit aussi
  //    etre active dans le portail developpeur Discord.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Enregistrement des evenements
  client.once(readyEvent.name, (...args) => readyEvent.execute(client, ...args));
  client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(client, ...args));
  client.on(interactionCreateEvent.name, (...args) =>
    interactionCreateEvent.execute(client, ...args)
  );

  // Erreurs non fatales du client
  client.on('error', (err) => console.error('[Discord] Erreur client :', err));

  // 4. Login
  await client.login(config.DISCORD_TOKEN);

  return client;
}

demarrer().catch((err) => {
  console.error('[Fatal] Impossible de demarrer le bot :', err.message);
  process.exit(1);
});

// Arret propre
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[Arret] Signal ${signal} recu, fermeture...`);
    process.exit(0);
  });
}
