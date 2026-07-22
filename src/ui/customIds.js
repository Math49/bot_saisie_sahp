'use strict';

/**
 * Identifiants (customId) des composants Discord, centralises pour eviter les
 * chaines magiques dispersees. interactionCreate route par prefixe "domaine:action".
 */
module.exports = {
  // Boutons sous la vue en direct
  VUE_HISTORIQUE: 'vue:historique',
  VUE_AJOUTER: 'vue:ajouter',
  VUE_RETIRER: 'vue:retirer',
  VUE_SUPPRIMER: 'vue:supprimer',
  VUE_CONFIG: 'vue:config',

  // Suppression / purge d'une saisie (etat-major)
  VUE_SUPPRIMER_SELECT: 'vue:supprimersel', // select, value = entreprise|objet
  VUE_PURGE_ZEROS: 'vue:purgezeros',

  // Bascule d'affichage des lignes a 0 dans la vue
  VUE_TOGGLE_ZEROS: 'vue:togglezeros',

  // Pagination de la vue
  VUE_PAGE_PREV: 'vue:pageprev',
  VUE_PAGE_NEXT: 'vue:pagenext',
  VUE_PAGE_INDIC: 'vue:pageindic',

  // Boutons des alertes de suspicion (suffixes par l'id de l'alerte)
  ALERTE_CONFIRMER: 'alerte:confirmer', // => alerte:confirmer:<alerteId>
  ALERTE_FAUX_POSITIF: 'alerte:fauxpositif', // => alerte:fauxpositif:<alerteId>

  // Modales d'action manuelle
  MODAL_MOUVEMENT: 'modal:mouvement', // => modal:mouvement:depot | modal:mouvement:retrait
  MODAL_HISTORIQUE: 'modal:historique',

  // Champs de modale
  CHAMP_OBJET: 'champ:objet',
  CHAMP_QUANTITE: 'champ:quantite',
  CHAMP_MOTIF: 'champ:motif',
  CHAMP_RECHERCHE: 'champ:recherche',
  CHAMP_VALEUR: 'champ:valeur',
  CHAMP_CANONIQUE: 'champ:canonique',
  CHAMP_NOM: 'champ:nom',

  // Panneau de configuration (tout prefixe par "cfg:")
  //   cfg:cat            (select des categories)
  //   cfg:add:<cat>:<mode>   (bouton, mode = exact|regex)
  //   cfg:del:<cat>          (bouton -> affiche le select de suppression)
  //   cfg:delsel:<cat>       (select, value = _id de l'entree)
  //   cfg:addmodal:<cat>:<mode> (modale d'ajout)
  CONFIG_PREFIX: 'cfg',
};
