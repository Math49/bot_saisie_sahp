'use strict';

const config = require('../config/config');

/**
 * true si l'auteur de l'interaction possede le role etat-major.
 * Robuste si le membre / les roles ne sont pas resolus.
 */
function estEtatMajor(interaction) {
  const roles = interaction.member && interaction.member.roles;
  if (!roles || !roles.cache) return false;
  return roles.cache.has(config.ROLE_ETAT_MAJOR_ID);
}

/**
 * true si l'auteur peut agir sur le coffre (ajouter/retirer).
 * Si ROLE_AGENT_SAHP_ID n'est pas configure, tout membre est autorise.
 */
function estAgent(interaction) {
  if (!config.ROLE_AGENT_SAHP_ID) return true;
  const roles = interaction.member && interaction.member.roles;
  if (!roles || !roles.cache) return false;
  return roles.cache.has(config.ROLE_AGENT_SAHP_ID) || estEtatMajor(interaction);
}

module.exports = { estEtatMajor, estAgent };
