'use strict';

const {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  WhitelistObjet,
  EquipementService,
  ObjetSensible,
  AliasObjet,
  Categorie,
  RegleCategorie,
} = require('../../db/models');
const { estEtatMajor } = require('../../utils/permissions');
const { regexValide } = require('../../utils/matcher');
const ids = require('../customIds');

/**
 * Panneau de configuration (etat-major uniquement).
 * Sections :
 *   - Listes directes : Whitelist / Equipement de service / Objets sensibles / Alias
 *     (chaque entree = texte exact ou motif regex)
 *   - Categories : regroupent des objets ; cases a cocher whitelist/equipement/sensible
 *   - Regles de categorie : rattachent un objet a une categorie (exact ou regex)
 * Tout passe par des selects / boutons / modales (aucune commande).
 */

const P = ids.CONFIG_PREFIX;

// Sections a listes directes (comportement generique)
const LISTES = {
  wl: { label: 'Whitelist', emoji: '✅', model: WhitelistObjet, champ: 'objet_canonique', alias: false },
  equip: { label: 'Equipement de service', emoji: '🎖️', model: EquipementService, champ: 'objet_canonique', alias: false },
  sensible: { label: 'Objets sensibles', emoji: '☣️', model: ObjetSensible, champ: 'objet_canonique', alias: false },
  alias: { label: 'Alias', emoji: '🔗', model: AliasObjet, champ: 'alias', alias: true },
};

// Cases a cocher d'une categorie : cle courte -> champ Mongo + libelle
const FLAGS = {
  wl: { champ: 'est_whitelist', label: 'Whitelist' },
  equip: { champ: 'est_equipement_service', label: 'Equipement' },
  sensible: { champ: 'est_sensible', label: 'Sensible' },
};

// --------------------------------------------------------------------------
// Points d'entree
// --------------------------------------------------------------------------

async function ouvrirConfig(interaction) {
  if (!estEtatMajor(interaction)) {
    return interaction.reply({
      content: "⛔ Seul l'etat-major peut acceder a la configuration.",
      flags: MessageFlags.Ephemeral,
    });
  }
  await interaction.reply({
    content: '⚙️ **Configuration** — choisis une section :',
    components: [selectSections()],
    flags: MessageFlags.Ephemeral,
  });
}

function estInteractionConfig(customId) {
  return customId.startsWith(`${P}:`);
}

/** Routeur central de toutes les interactions de config. */
async function gererInteractionConfig(client, interaction) {
  if (!estEtatMajor(interaction)) {
    return repondre(interaction, "⛔ Reserve a l'etat-major.");
  }

  const parts = interaction.customId.split(':'); // cfg:<action>:...
  const action = parts[1];

  if (interaction.isStringSelectMenu()) {
    if (action === 'cat') return afficherSection(interaction, interaction.values[0]);
    if (action === 'delsel') return supprimerEntree(interaction, parts[2], interaction.values[0]);
    if (action === 'catedit') return editerCategorie(interaction, interaction.values[0]);
    if (action === 'regcat') return afficherReglesCategorie(interaction, interaction.values[0]);
    if (action === 'regdelsel') return supprimerRegle(interaction, interaction.values[0]);
  }

  if (interaction.isButton()) {
    if (action === 'add') return ouvrirModalAjout(interaction, parts[2], parts[3]);
    if (action === 'del') return ouvrirSelectSuppression(interaction, parts[2]);
    if (action === 'catadd') return ouvrirModalCategorie(interaction);
    if (action === 'catflag') return basculerFlag(interaction, parts[2], parts[3]);
    if (action === 'catdel') return supprimerCategorie(interaction, parts[2]);
    if (action === 'regadd') return ouvrirModalRegle(interaction, parts[2], parts[3]);
    if (action === 'regdel') return ouvrirSelectSuppressionRegle(interaction, parts[2]);
  }

  if (interaction.isModalSubmit()) {
    if (action === 'addmodal') return traiterAjout(interaction, parts[2], parts[3]);
    if (action === 'cataddmodal') return traiterAjoutCategorie(interaction);
    if (action === 'regaddmodal') return traiterAjoutRegle(interaction, parts[2], parts[3]);
  }
}

// --------------------------------------------------------------------------
// Navigation
// --------------------------------------------------------------------------

function selectSections() {
  const options = [
    ...Object.entries(LISTES).map(([cle, c]) => ({ label: c.label, value: cle, emoji: c.emoji })),
    { label: 'Categories', value: 'categorie', emoji: '🏷️' },
    { label: 'Regles de categorie', value: 'reglecat', emoji: '🧭' },
  ];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${P}:cat`)
      .setPlaceholder('Section a gerer…')
      .addOptions(options)
  );
}

async function afficherSection(interaction, cle) {
  if (cle === 'categorie') return afficherGestionCategories(interaction);
  if (cle === 'reglecat') return afficherGestionRegles(interaction);
  return afficherListe(interaction, cle);
}

// --------------------------------------------------------------------------
// Sections a listes directes (generique)
// --------------------------------------------------------------------------

async function afficherListe(interaction, cle) {
  const cat = LISTES[cle];
  if (!cat) return;

  const entrees = await cat.model.find({}).sort({ date_ajout: -1 }).lean();
  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(formaterEntrees(cat, entrees))
    .setFooter({ text: `${entrees.length} entree(s) · exact ou regex` });

  const boutons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${P}:add:${cle}:exact`).setLabel('Ajouter (exact)').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${P}:add:${cle}:regex`).setLabel('Ajouter (regex)').setEmoji('🔣').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${P}:del:${cle}`).setLabel('Retirer').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(entrees.length === 0)
  );

  await interaction.update({ content: '⚙️ **Configuration**', embeds: [embed], components: [selectSections(), boutons] });
}

function formaterEntrees(cat, entrees) {
  if (entrees.length === 0) return '_Aucune entree._';
  return entrees
    .slice(0, 40)
    .map((e) => {
      const tag = e.est_regex ? '`regex`' : '`exact`';
      if (cat.alias) return `${tag} \`${e.alias}\` → **${e.objet_canonique}**`;
      return `${tag} **${e[cat.champ]}**`;
    })
    .join('\n')
    .slice(0, 4000);
}

async function ouvrirModalAjout(interaction, cle, mode) {
  const cat = LISTES[cle];
  if (!cat) return;
  const estRegex = mode === 'regex';

  const modal = new ModalBuilder()
    .setCustomId(`${P}:addmodal:${cle}:${mode}`)
    .setTitle(`${cat.label} — Ajouter (${estRegex ? 'regex' : 'exact'})`);

  const champValeur = new TextInputBuilder()
    .setCustomId(ids.CHAMP_VALEUR)
    .setLabel(cat.alias ? (estRegex ? 'Motif regex de l alias' : 'Alias (texte)') : estRegex ? 'Motif regex' : 'Objet (texte)')
    .setPlaceholder(estRegex ? 'ex: ^\\d+ ?PL$' : 'ex: BeanBag')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const rows = [new ActionRowBuilder().addComponents(champValeur)];
  if (cat.alias) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.CHAMP_CANONIQUE)
          .setLabel('Objet canonique cible')
          .setPlaceholder('ex: Plaque immatriculation')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200)
      )
    );
  }
  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function traiterAjout(interaction, cle, mode) {
  const cat = LISTES[cle];
  if (!cat) return;
  const estRegex = mode === 'regex';

  const valeur = interaction.fields.getTextInputValue(ids.CHAMP_VALEUR).trim();
  if (!valeur) return repondre(interaction, '❌ Valeur vide.');
  if (estRegex && !regexValide(valeur)) return repondre(interaction, `❌ Motif regex invalide : \`${valeur}\``);

  const doc = { est_regex: estRegex, ajoute_par: interaction.user.id, date_ajout: new Date() };
  doc[cat.champ] = valeur;
  if (cat.alias) {
    const canonique = interaction.fields.getTextInputValue(ids.CHAMP_CANONIQUE).trim();
    if (!canonique) return repondre(interaction, '❌ Objet canonique cible manquant.');
    doc.objet_canonique = canonique;
  }

  try {
    await cat.model.create(doc);
  } catch (err) {
    if (err.code === 11000) return repondre(interaction, `⚠️ \`${valeur}\` existe deja dans ${cat.label}.`);
    console.error('[Config] Ajout echoue :', err.message);
    return repondre(interaction, '❌ Ajout impossible.');
  }

  const detail = cat.alias ? `\`${valeur}\` → **${doc.objet_canonique}**` : `**${valeur}**`;
  return repondre(interaction, `✅ Ajoute a ${cat.label} (${estRegex ? 'regex' : 'exact'}) : ${detail}`);
}

async function ouvrirSelectSuppression(interaction, cle) {
  const cat = LISTES[cle];
  if (!cat) return;
  const entrees = await cat.model.find({}).sort({ date_ajout: -1 }).limit(25).lean();
  if (entrees.length === 0) return repondre(interaction, `Aucune entree a supprimer dans ${cat.label}.`);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${P}:delsel:${cle}`)
    .setPlaceholder('Entree a supprimer…')
    .addOptions(
      entrees.map((e) => {
        const valeur = cat.alias ? e.alias : e[cat.champ];
        const label = cat.alias ? `${valeur} → ${e.objet_canonique}` : valeur;
        return { label: label.slice(0, 100), value: String(e._id), description: e.est_regex ? 'regex' : 'exact' };
      })
    );

  await interaction.reply({
    content: `🗑️ ${cat.label} — choisis l'entree a supprimer :`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function supprimerEntree(interaction, cle, id) {
  const cat = LISTES[cle];
  if (!cat) return;
  const supprime = await cat.model.findByIdAndDelete(id).lean();
  if (!supprime) return interaction.update({ content: 'Entree introuvable (deja supprimee ?).', components: [] });
  const valeur = cat.alias ? supprime.alias : supprime[cat.champ];
  await interaction.update({ content: `✅ Supprime de ${cat.label} : \`${valeur}\``, components: [] });
}

// --------------------------------------------------------------------------
// Categories (cases a cocher)
// --------------------------------------------------------------------------

async function afficherGestionCategories(interaction) {
  const categories = await Categorie.find({}).sort({ nom: 1 }).lean();

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🏷️ Categories')
    .setDescription(formaterCategories(categories))
    .setFooter({ text: `${categories.length} categorie(s)` });

  const composants = [selectSections(),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${P}:catadd`).setLabel('Ajouter une categorie').setEmoji('➕').setStyle(ButtonStyle.Success)
    ),
  ];
  if (categories.length > 0) {
    composants.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${P}:catedit`)
          .setPlaceholder('Modifier une categorie…')
          .addOptions(categories.slice(0, 25).map((c) => ({ label: c.nom.slice(0, 100), value: String(c._id) })))
      )
    );
  }
  await interaction.update({ content: '⚙️ **Configuration**', embeds: [embed], components: composants });
}

function formaterCategories(categories) {
  if (categories.length === 0) return '_Aucune categorie. Cree-en une pour commencer._';
  return categories
    .slice(0, 40)
    .map((c) => {
      const f = (v) => (v ? '✅' : '❌');
      return `**${c.nom}** — WL ${f(c.est_whitelist)} · Equip ${f(c.est_equipement_service)} · Sensible ${f(c.est_sensible)}`;
    })
    .join('\n')
    .slice(0, 4000);
}

async function ouvrirModalCategorie(interaction) {
  const modal = new ModalBuilder().setCustomId(`${P}:cataddmodal`).setTitle('Nouvelle categorie');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(ids.CHAMP_NOM)
        .setLabel('Nom de la categorie')
        .setPlaceholder('ex: Drogue, Arme de service, Argent…')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
    )
  );
  await interaction.showModal(modal);
}

async function traiterAjoutCategorie(interaction) {
  const nom = interaction.fields.getTextInputValue(ids.CHAMP_NOM).trim();
  if (!nom) return repondre(interaction, '❌ Nom vide.');
  try {
    await Categorie.create({ nom, ajoute_par: interaction.user.id, date_ajout: new Date() });
  } catch (err) {
    if (err.code === 11000) return repondre(interaction, `⚠️ La categorie **${nom}** existe deja.`);
    console.error('[Config] Categorie echouee :', err.message);
    return repondre(interaction, '❌ Creation impossible.');
  }
  return repondre(interaction, `✅ Categorie creee : **${nom}**. Ouvre-la pour cocher ses options et lui ajouter des regles.`);
}

async function editerCategorie(interaction, id) {
  const c = await Categorie.findById(id).lean();
  if (!c) return interaction.update({ content: 'Categorie introuvable.', embeds: [], components: [selectSections()] });

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`🏷️ ${c.nom}`)
    .setDescription(
      'Active/desactive les options. Un objet de cette categorie herite du flag ' +
        'coche (en plus des listes directes).\n\n' +
        `Whitelist : ${c.est_whitelist ? '✅' : '❌'}\n` +
        `Equipement de service : ${c.est_equipement_service ? '✅' : '❌'}\n` +
        `Sensible : ${c.est_sensible ? '✅' : '❌'}`
    );

  const boutonFlag = (cle) => {
    const actif = c[FLAGS[cle].champ];
    return new ButtonBuilder()
      .setCustomId(`${P}:catflag:${cle}:${id}`)
      .setLabel(`${FLAGS[cle].label} : ${actif ? 'ON' : 'OFF'}`)
      .setStyle(actif ? ButtonStyle.Success : ButtonStyle.Secondary);
  };

  const composants = [
    selectSections(),
    new ActionRowBuilder().addComponents(boutonFlag('wl'), boutonFlag('equip'), boutonFlag('sensible')),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${P}:catdel:${id}`).setLabel('Supprimer la categorie').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    ),
  ];
  await interaction.update({ content: '⚙️ **Configuration**', embeds: [embed], components: composants });
}

async function basculerFlag(interaction, cleFlag, id) {
  const flag = FLAGS[cleFlag];
  if (!flag) return;
  const c = await Categorie.findById(id);
  if (!c) return interaction.update({ content: 'Categorie introuvable.', embeds: [], components: [selectSections()] });
  c[flag.champ] = !c[flag.champ];
  await c.save();
  return editerCategorie(interaction, id);
}

async function supprimerCategorie(interaction, id) {
  const c = await Categorie.findByIdAndDelete(id).lean();
  if (!c) return interaction.update({ content: 'Categorie deja supprimee.', embeds: [], components: [] });
  // Nettoie ses regles de classement
  await RegleCategorie.deleteMany({ categorie: c.nom });
  await interaction.update({
    content: `✅ Categorie supprimee : **${c.nom}** (et ses regles).`,
    embeds: [],
    components: [],
  });
}

// --------------------------------------------------------------------------
// Regles de categorie
// --------------------------------------------------------------------------

async function afficherGestionRegles(interaction) {
  const categories = await Categorie.find({}).sort({ nom: 1 }).lean();
  if (categories.length === 0) {
    return interaction.update({
      content: '🧭 **Regles de categorie** — cree d\'abord une categorie (section Categories).',
      embeds: [],
      components: [selectSections()],
    });
  }
  await interaction.update({
    content: '🧭 **Regles de categorie** — choisis la categorie a configurer :',
    embeds: [],
    components: [selectSections(), selectCategoriesPourRegles(categories)],
  });
}

function selectCategoriesPourRegles(categories) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${P}:regcat`)
      .setPlaceholder('Categorie…')
      .addOptions(categories.slice(0, 25).map((c) => ({ label: c.nom.slice(0, 100), value: String(c._id) })))
  );
}

async function afficherReglesCategorie(interaction, catId) {
  const c = await Categorie.findById(catId).lean();
  if (!c) return interaction.update({ content: 'Categorie introuvable.', embeds: [], components: [selectSections()] });

  const regles = await RegleCategorie.find({ categorie: c.nom }).sort({ date_ajout: -1 }).lean();
  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle(`🧭 Regles — ${c.nom}`)
    .setDescription(
      regles.length === 0
        ? '_Aucune regle. Ajoute un texte exact ou un motif regex qui rattache un objet a cette categorie._'
        : regles.map((r) => `${r.est_regex ? '`regex`' : '`exact`'} **${r.motif}**`).join('\n').slice(0, 4000)
    )
    .setFooter({ text: `${regles.length} regle(s)` });

  const categories = await Categorie.find({}).sort({ nom: 1 }).lean();
  const boutons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${P}:regadd:${catId}:exact`).setLabel('Ajouter (exact)').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${P}:regadd:${catId}:regex`).setLabel('Ajouter (regex)').setEmoji('🔣').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${P}:regdel:${catId}`).setLabel('Retirer').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(regles.length === 0)
  );

  await interaction.update({
    content: '⚙️ **Configuration**',
    embeds: [embed],
    components: [selectSections(), selectCategoriesPourRegles(categories), boutons],
  });
}

async function ouvrirModalRegle(interaction, catId, mode) {
  const c = await Categorie.findById(catId).lean();
  if (!c) return repondre(interaction, 'Categorie introuvable.');
  const estRegex = mode === 'regex';

  const modal = new ModalBuilder()
    .setCustomId(`${P}:regaddmodal:${catId}:${mode}`)
    .setTitle(`${c.nom} — Regle (${estRegex ? 'regex' : 'exact'})`.slice(0, 45));
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(ids.CHAMP_VALEUR)
        .setLabel(estRegex ? 'Motif regex' : 'Objet (texte)')
        .setPlaceholder(estRegex ? 'ex: (weed|cocaine|meth)' : 'ex: BeanBag')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200)
    )
  );
  await interaction.showModal(modal);
}

async function traiterAjoutRegle(interaction, catId, mode) {
  const c = await Categorie.findById(catId).lean();
  if (!c) return repondre(interaction, 'Categorie introuvable.');
  const estRegex = mode === 'regex';

  const motif = interaction.fields.getTextInputValue(ids.CHAMP_VALEUR).trim();
  if (!motif) return repondre(interaction, '❌ Motif vide.');
  if (estRegex && !regexValide(motif)) return repondre(interaction, `❌ Motif regex invalide : \`${motif}\``);

  await RegleCategorie.create({
    motif,
    est_regex: estRegex,
    categorie: c.nom,
    ajoute_par: interaction.user.id,
    date_ajout: new Date(),
  });
  return repondre(interaction, `✅ Regle ajoutee a **${c.nom}** (${estRegex ? 'regex' : 'exact'}) : \`${motif}\``);
}

async function ouvrirSelectSuppressionRegle(interaction, catId) {
  const c = await Categorie.findById(catId).lean();
  if (!c) return repondre(interaction, 'Categorie introuvable.');
  const regles = await RegleCategorie.find({ categorie: c.nom }).sort({ date_ajout: -1 }).limit(25).lean();
  if (regles.length === 0) return repondre(interaction, `Aucune regle a supprimer pour ${c.nom}.`);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${P}:regdelsel:${catId}`)
    .setPlaceholder('Regle a supprimer…')
    .addOptions(regles.map((r) => ({ label: r.motif.slice(0, 100), value: String(r._id), description: r.est_regex ? 'regex' : 'exact' })));

  await interaction.reply({
    content: `🗑️ ${c.nom} — choisis la regle a supprimer :`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function supprimerRegle(interaction, ruleId) {
  const r = await RegleCategorie.findByIdAndDelete(ruleId).lean();
  if (!r) return interaction.update({ content: 'Regle introuvable (deja supprimee ?).', components: [] });
  await interaction.update({ content: `✅ Regle supprimee de **${r.categorie}** : \`${r.motif}\``, components: [] });
}

// --------------------------------------------------------------------------
// Util
// --------------------------------------------------------------------------

async function repondre(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

module.exports = { ouvrirConfig, estInteractionConfig, gererInteractionConfig };
