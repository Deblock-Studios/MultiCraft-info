/**
 * Traduit les articles de updates/ dans toutes les langues de LANGS.
 *
 *   node scripts/translate-updates.mjs           # traduit ce qui manque
 *   node scripts/translate-updates.mjs --check   # vérifie les modèles
 *
 * Un seul fournisseur : VyceAI (TRANSLATE_API_KEY / TRANSLATE_ENDPOINT).
 * Modèles essayés dans l'ordre : TRANSLATE_MODEL, puis TRANSLATE_MODEL_FALLBACKS
 * (par défaut glm-5.3-flash, nemotron-3.5-super-vl, gpt-oss-120b, wave).
 * Le premier dont la requête témoin aboutit est utilisé seul pour toutes les
 * traductions (« sticky model ») ; les suivants prennent le relais s'il tombe
 * en cours de route ou s'il échoue sur plus de TRANSLATE_MAX_FAILURES
 * traductions (5 par défaut). Le modèle retenu est mémorisé dans
 * updates/.translate-model et essayé en premier au run suivant.
 * --check n'écrit aucune traduction et dépose le verdict de chaque modèle
 * dans updates/.translation-health.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Langues cibles (breton et normand retirés, alignés sur locales/)
const LANGS = ['ar','bn','de','en','es','fr','hi','id','ja','ko','nl','pt','ru','tr','uk','zh'];

const LANG_NAMES = {
  ar:'Arabic', bn:'Bengali', de:'German', en:'English', es:'Spanish',
  fr:'French', hi:'Hindi', id:'Indonesian', ja:'Japanese', ko:'Korean',
  nl:'Dutch', pt:'Portuguese', ru:'Russian', tr:'Turkish', uk:'Ukrainian', zh:'Chinese'
};

const UPDATES = 'updates';
const SRC_FR  = 'post.md';
const SRC_EN  = 'post-en.md';
const STICKY_FILE = path.join(UPDATES, '.translate-model');

// --- VyceAI : un seul fournisseur, plusieurs modèles ------------------------

const ENDPOINT = (process.env.TRANSLATE_ENDPOINT || 'https://vyceai.com/v1').replace(/\/+$/, '');
const API_KEY  = process.env.TRANSLATE_API_KEY;

const DEFAULT_MODELS = ['glm-5.3-flash', 'nemotron-3.5-super-vl', 'gpt-oss-120b', 'wave'];

// Ordre de préférence : TRANSLATE_MODEL, puis les secours (séparés par des
// virgules et/ou des espaces), sans doublon. À défaut, la liste par défaut.
const configured = [
  process.env.TRANSLATE_MODEL,
  ...(process.env.TRANSLATE_MODEL_FALLBACKS || '').split(/[\s,]+/),
].map(s => (s || '').trim()).filter(Boolean);

let MODELS = [...new Set(configured.length ? configured : DEFAULT_MODELS)];

// Modèle qui avait fonctionné au run précédent : essayé en premier.
const lastGood = (await fs.readFile(STICKY_FILE, 'utf8').catch(() => '')).trim();
if (lastGood && MODELS.includes(lastGood)) {
  MODELS = [lastGood, ...MODELS.filter(m => m !== lastGood)];
}

// Chaque modèle est traité comme un « candidat » : même endpoint, même clé.
const PROVIDERS = API_KEY
  ? MODELS.map(model => ({ name: model, endpoint: ENDPOINT, key: API_KEY, model }))
  : [];

let active = null;         // modèle en cours d'utilisation
let activeIndex = -1;      // sa position dans PROVIDERS
const rejected = new Map(); // nom → raison du rejet

// Une requête bloquée ne doit pas geler le job : sans timeout, node attend
// indéfiniment et le runner finit par tuer le job en perdant tout le travail.
const REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 120_000);
// Appels simultanés. 50 articles x 15 langues = ~750 appels : en séquentiel
// cela prend plus de deux heures, ce qui laisse peu de marge avant le timeout
// du job (et le moindre aléa fait tout perdre).
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY || 4));
// Pause avant la seconde chance accordée quand tous les modèles ont refusé
// les requêtes : une indisponibilité de quelques dizaines de secondes ne doit
// pas faire perdre le run entier.
const OUTAGE_WAIT_MS = Math.max(0, Number(process.env.TRANSLATE_OUTAGE_WAIT_MS ?? 60_000));
// Échecs tolérés avec un même modèle avant de confier le lot restant au
// suivant. Quelques refus isolés sont normaux ; une série signifie que le
// modèle déraille (retiré, quota, surcharge) et insister coûte des minutes
// pour rien.
const MAX_FAILURES = Math.max(0, Number(process.env.TRANSLATE_MAX_FAILURES ?? 5));

if (!PROVIDERS.length) {
  console.error('Aucune clé de traduction : définir TRANSLATE_API_KEY (VyceAI).');
  process.exit(1);
}

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Message d'erreur lisible : le corps de la réponse contient la vraie cause
// (« modèle inconnu », « crédits épuisés », « clé invalide »…) ; sans lui le
// log du workflow ne montre qu'un code HTTP.
async function httpError(res, label) {
  let body = '';
  try { body = (await res.text()).replace(/\s+/g, ' ').slice(0, 300); } catch {}
  return new Error(`${label} HTTP ${res.status}${body ? ` — ${body}` : ''}`);
}

// Requête témoin : quelques caractères suffisent à savoir si un modèle
// accepte ne serait-ce qu'une conversation. Une clé valide mais à sec échoue
// ici : c'est la seule preuve qu'une traduction peut aboutir.
async function probe(p) {
  try {
    const res = await fetch(`${p.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.key}`,
      },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.2,
        messages: [{ role: 'user', content: 'Bonjour.' }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      // Une réponse 200 mais vide ne compte pas : le modèle ne répond pas vraiment.
      try {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content ?? '';
        if (!String(text).trim()) return { ok: false, reason: 'requête témoin : réponse vide' };
      } catch {
        return { ok: false, reason: 'requête témoin : réponse illisible' };
      }
      return { ok: true };
    }
    return { ok: false, reason: (await httpError(res, 'requête témoin refusée')).message };
  } catch (err) {
    return { ok: false, reason: `requête témoin impossible : ${err.message}` };
  }
}

// Un modèle est retenu si sa clé est acceptée et si la requête témoin
// aboutit. Un modèle absent de /models n'est qu'un avertissement : seul
// l'appel réel décide.
async function checkProvider(p) {
  try {
    const res = await fetch(`${p.endpoint}/models`, {
      headers: { 'Authorization': `Bearer ${p.key}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: (await httpError(res, 'authentification refusée')).message };
    }
    if (res.ok) {
      try {
        const data = await res.json();
        const ids = (data?.data || data?.models || []).map(m => m.id || m.name).filter(Boolean);
        if (ids.length && !ids.includes(p.model)) {
          console.warn(`  ⚠ modèle « ${p.model} » absent de ${p.endpoint}/models (ex. : ${ids.slice(0, 6).join(', ')}…)`);
        }
      } catch {}
    }
  } catch {
    // Endpoint sans /models : la requête témoin tranchera.
  }
  return probe(p);
}

// Un « invalid_request » peut venir du contenu d'un article… ou d'une clé
// épuisée, d'un modèle retiré, d'une panne. Dans ce second cas les 15 langues
// d'un même article rejettent en quelques secondes, soit 45 requêtes inutiles.
// Une requête témoin de quelques caractères tranche : si elle est refusée
// elle aussi, le problème n'est pas dans les articles.
let activeProbe = null;
let bulkRejection = null;
// Échecs encaissés avec le modèle actif, et raison de son abandon en cours de
// lot (trop d'échecs) le cas échéant.
let providerFailures = 0;
let exhaustedReason = null;

// Pendant le run, la requête témoin n'est faite qu'une fois par modèle :
// toutes les tâches qui échouent en même temps partagent le même verdict.
function probeActive() {
  activeProbe ??= probe(active);
  return activeProbe;
}

async function callModel(system, user, retries = 3) {
  const url = `${active.endpoint}/chat/completions`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${active.key}`,
        },
        body: JSON.stringify({
          model: active.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: user   },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // 429/5xx : temporaire. 400/408/409/422 : le fournisseur renvoie parfois
      // un « invalid_request » passager — observé sur des couples source/langue
      // tirés au hasard, alors que les mêmes fichiers passaient dans les autres
      // langues. Réessayer coûte quelques secondes ; abandonner laisse une
      // cellule définitivement en anglais.
      const retryable = res.status === 400 || res.status === 408 ||
        res.status === 409 || res.status === 422 || res.status === 429 || res.status >= 500;
      if (retryable) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const err = await httpError(res, 'temporaire — retry');
        if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfter = retryAfter;
        // Refus « invalid_request » : seul cas où le contenu de l'article
        // pourrait être en cause, donc seul cas où la requête témoin sert.
        if (res.status === 400 || res.status === 422) err.invalidRequest = true;
        throw err;
      }
      if (!res.ok) {
        // 401/404… : inutile de réessayer, et on veut le message complet.
        const err = await httpError(res, 'échec');
        err.fatal = true;
        throw err;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error('réponse vide');
      return text;
    } catch (err) {
      console.warn(`  ⚠ tentative ${attempt}/${retries} (${active.model}) : ${err.message}`);
      if (!err.fatal && err.invalidRequest && !bulkRejection) {
        const verdict = await probeActive();
        if (!verdict.ok) {
          bulkRejection = `${active.name} rejette tout (${verdict.reason})`;
          const fatal = new Error(
            `${err.message}\n     requête témoin « Bonjour. » refusée elle aussi : ${verdict.reason}\n` +
            `     → ${active.name} rejette tout, le contenu des articles n'est pas en cause.`
          );
          fatal.fatal = true;
          throw fatal;
        }
      }
      if (err.fatal || attempt === retries) throw err;
      // Respecte Retry-After quand le serveur en fournit un, sinon
      // backoff exponentiel plafonné.
      const waitMs = err.retryAfter
        ? Math.min(err.retryAfter * 1000, 60_000)
        : Math.min(2000 * 2 ** (attempt - 1), 30_000);
      await sleep(waitMs);
    }
  }
}

async function translate(markdown, target) {
  const system =
`You are a professional translator for the MultiCraft gaming website (Deblock Studios).

Translate the user's Markdown from French to ${LANG_NAMES[target]}.

STRICT RULES:
- Preserve all Markdown syntax exactly: headings (#), lists, links,
  images, blockquotes, code fences, inline code, emphasis, tables.
- Do NOT translate: URLs, file paths, code, HTML tags/attributes,
  brand names (MultiCraft, Deblock Studios, MultiCraft Studio OÜ),
  player nicknames, server IPs, version numbers, dates in ISO format.
- If the file starts with YAML front-matter (--- ... ---):
  keep the keys unchanged; translate only the values,
  except for keys named: slug, date, author, lang, layout, permalink.
- Natural, fluent ${LANG_NAMES[target]}; keep the author's tone.
- Output ONLY the translated Markdown. No preamble, no commentary,
  no surrounding code fence.`;

  return callModel(system, markdown);
}

async function exists(p) {
  return !!(await fs.stat(p).catch(() => null));
}

// Prépare le travail d'un article : les copies (langue source) sont faites
// tout de suite, les traductions manquantes sont renvoyées comme tâches.
async function planPost(slug) {
  const dir = path.join(UPDATES, slug);
  const frPath = path.join(dir, SRC_FR);
  const enPath = path.join(dir, SRC_EN);

  let source = null;
  let sourceLang = null;

  if (await exists(frPath)) {
    source = await fs.readFile(frPath, 'utf8');
