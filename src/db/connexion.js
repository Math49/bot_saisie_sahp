'use strict';

const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/config');

/**
 * Ouvre la connexion MongoDB via Mongoose.
 * A appeler une seule fois au demarrage, avant le login Discord.
 */
async function connecterMongo() {
  mongoose.connection.on('connected', () => {
    console.log('[Mongo] Connecte a la base de donnees.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[Mongo] Erreur de connexion :', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[Mongo] Deconnecte.');
  });

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

module.exports = { connecterMongo, mongoose };
