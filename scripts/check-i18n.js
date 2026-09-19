#!/usr/bin/env node
/* ── Vérification des traductions ──
   Outil de développement uniquement (le site n'en a pas besoin) :

       node scripts/check-i18n.js

   Deux contrôles :
     1. Toutes les langues de /locales ont exactement les mêmes clés
        (le fichier de référence est locales/en.json).
     2. Les clés utilisées dans le code (attributs data-i18n* du HTML et appels
        t('…') du JavaScript) existent bien dans locales/en.json.

   Sortie : liste des clés manquantes, code de sortie 1 si un problème est trouvé.
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const REFERENCE_LOCALE = 'en.json';

const SKIPPED_DIRS = new Set(['node_modules', '.git', 'netlify', 'files', 'updates', 'scripts']);

/* ── Utilitaires ── */

// Transforme { a: { b: 1 } } en clés plates : « a.b ». La clé du groupe (« a ») est
// aussi valide : t('a') renvoie l'objet (ex. gameInfo.locations).
function flattenKeys(value, prefix, out) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (prefix) out.add(prefix);
    Object.keys(value).forEach(function (key) {
      flattenKeys(value[key], prefix ? prefix + '.' + key : key, out);
    });
  } else if (prefix) {
    out.add(prefix);
  }
  return out;
}

function readLocaleKeys(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
  return flattenKeys(raw, '', new Set());
}

// Liste récursivement les fichiers .html et .js du site (hors dossiers ignorés).
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(full, out);
    } else if (/\.(html|js)$/.test(entry.name) && path.dirname(full) !== LOCALES_DIR) {
      out.push(full);
    }
  });
  return out;
}

/* ── Contrôle 1 : mêmes clés dans toutes les langues ── */

const localeFiles = fs.readdirSync(LOCALES_DIR).filter(function (f) { return f.endsWith('.json'); }).sort();
const referenceKeys = readLocaleKeys(REFERENCE_LOCALE);
const problems = [];

localeFiles.forEach(function (file) {
  if (file === REFERENCE_LOCALE) return;
  const keys = readLocaleKeys(file);
  const missing = Array.from(referenceKeys).filter(function (k) { return !keys.has(k); });
  const extra = Array.from(keys).filter(function (k) { return !referenceKeys.has(k); });
  missing.forEach(function (key) { problems.push('clé absente de ' + file + ' (présente en ' + REFERENCE_LOCALE + ') : ' + key); });
  extra.forEach(function (key) { problems.push('clé en trop dans ' + file + ' (absente de ' + REFERENCE_LOCALE + ') : ' + key); });
});

/* ── Contrôle 2 : clés utilisées dans le code ── */

const USED_IN_HTML = /data-i18n(?:-html|-placeholder|-title|-aria-label|-content)?="([^"]+)"/g;
const USED_IN_JS = /\bt\(\s*'([^']+)'/g;

walk(ROOT, []).forEach(function (file) {
  const rel = path.relative(ROOT, file);
  const source = fs.readFileSync(file, 'utf8');
  const regex = file.endsWith('.html') ? USED_IN_HTML : USED_IN_JS;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const key = match[1];
    if (!referenceKeys.has(key)) problems.push('clé utilisée mais introuvable dans ' + REFERENCE_LOCALE + ' : ' + key + ' (' + rel + ')');
  }
});

/* ── Rapport ── */

if (problems.length) {
  console.error('❌ ' + problems.length + ' problème(s) de traduction :\n');
  problems.forEach(function (problem) { console.error('  - ' + problem); });
  process.exit(1);
}

console.log('✅ Traductions cohérentes : ' + localeFiles.join(', ') + ' (' + referenceKeys.size + ' clés).');
