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

let active = null;          // modèle en cours d'utilisation
let activeIndex = -1;       // sa position dans PROVIDERS
const rejected = new Map(); // nom → raison du rejet

// Une requête bloquée ne doit pas geler le job.
const REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 120_000);
// Appels simultanés.
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY || 4));
// Pause avant la seconde chance quand tous les modèles ont refusé.
const OUTAGE_WAIT_MS = Math.max(0, Number(process.env.TRANSLATE_OUTAGE_WAIT_MS ?? 60_000));
// Échecs tolérés avec un même modèle avant de passer au suivant.
const MAX_FAILURES = Math.max(0, Number(process.env.TRANSLATE_MAX_FAILURES ?? 5));

if (!PROVIDERS.length) {
  console.error('Aucune clé de traduction : définir TRANSLATE_API_KEY (VyceAI).');
  process.exit(1);
}

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Message d'erreur lisible : le corps de la réponse contient la vraie cause.
async function httpError(res, label) {
  let body = '';
  try { body = (await res.text()).replace(/\s+/g, ' ').slice(0, 300); } catch {}
  return new Error(`${label} HTTP ${res.status}${body ? ` — ${body}` : ''}`);
}

// Requête témoin : prouve qu'un modèle répond vraiment.
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
      // Une réponse 200 mais vide ne compte pas.
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

// Un modèle est retenu si la clé est acceptée et si la requête témoin aboutit.
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

let activeProbe = null;
let bulkRejection = null;
let providerFailures = 0;
let exhaustedReason = null;

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

      const retryable = res.status === 400 || res.status === 408 ||
        res.status === 409 || res.status === 422 || res.status === 429 || res.status >= 500;
      if (retryable) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const err = await httpError(res, 'temporaire — retry');
        if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfter = retryAfter;
        if (res.status === 400 || res.status === 422) err.invalidRequest = true;
        throw err;
      }
      if (!res.ok) {
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

// Prépare le travail d'un article.
async function planPost(slug) {
  const dir = path.join(UPDATES, slug);
  const frPath = path.join(dir, SRC_FR);
  const enPath = path.join(dir, SRC_EN);

  let source = null;
  let sourceLang = null;

  if (await exists(frPath)) {
    source = await fs.readFile(frPath, 'utf8');
    sourceLang = 'fr';
  } else if (await exists(enPath)) {
    source = await fs.readFile(enPath, 'utf8');
    sourceLang = 'en';
  } else {
    return { slug, jobs: [] };
  }

  const srcHash = hash(source);
  const jobs = [];
  let touched = false;

  for (const lang of LANGS) {
    const out = path.join(dir, `post.${lang}.md`);

    // On ne traduit jamais vers la langue source : on copie simplement.
    if (lang === sourceLang) {
      const prev = await fs.readFile(out, 'utf8').catch(() => null);
      if (prev !== source) {
        await fs.writeFile(out, source);
        touched = true;
      }
      continue;
    }

    const marker = path.join(dir, `.i18n.${lang}.hash`);
    const prev = await fs.readFile(marker, 'utf8').catch(() => null);

    if (prev === srcHash && await exists(out)) continue; // déjà à jour

    jobs.push({ slug, lang, source, srcHash, out, marker });
  }

  return { slug, jobs, touched };
}

async function runJob(job) {
  console.log(`→ ${job.slug} : ${job.lang}`);
  const translated = await translate(job.source, job.lang);
  await fs.writeFile(job.out, translated.trimEnd() + '\n');
  await fs.writeFile(job.marker, job.srcHash);
}

// Exécute les tâches par petits groupes.
async function runPool(jobs) {
  const failures = [];
  let index = 0;
  let skipped = 0;

  async function worker() {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (bulkRejection || exhaustedReason) {
        skipped++;
        failures.push({ ...job, error: bulkRejection || exhaustedReason, skipped: true });
        continue;
      }
      try {
        await runJob(job);
      } catch (err) {
        console.error(`  ✗ échec ${job.slug}/${job.lang} : ${err.message}`);
        failures.push({ ...job, error: err.message });
        providerFailures++;
        if (!exhaustedReason && providerFailures > MAX_FAILURES && activeIndex < PROVIDERS.length - 1) {
          exhaustedReason = `${active.name} : ${providerFailures} traductions en échec (limite ${MAX_FAILURES})`;
          console.error(`  ↻ ${exhaustedReason} — bascule sur le modèle suivant`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  if (skipped) console.error(`  ✗ ${skipped} traduction(s) non tentée(s) : ${bulkRejection || exhaustedReason}`);
  return failures;
}

async function rebuildIndex() {
  const entries = await fs.readdir(UPDATES, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

  const index = [];

  for (const slug of dirs) {
    const dir = path.join(UPDATES, slug);
    const frPath = path.join(dir, SRC_FR);
    const enPath = path.join(dir, SRC_EN);

    // Source de référence (FR prioritaire)
    let sourcePath = null;
    if (await exists(frPath)) sourcePath = frPath;
    else if (await exists(enPath)) sourcePath = enPath;
    else continue;

    // Front-matter
    const raw = await fs.readFile(sourcePath, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }

    // Langues réellement présentes sur le disque
    const availableLangs = [];
    for (const lang of LANGS) {
      const p = path.join(dir, `post.${lang}.md`);
      if (await exists(p)) availableLangs.push(lang);
    }

    index.push({
      slug,
      date: fm.date || '',
      title: fm.title || slug,
      author: fm.author || '',
      sourceLang: (await exists(frPath)) ? 'fr' : 'en',
      availableLangs: availableLangs.sort(),
      ...Object.fromEntries(
        Object.entries(fm).filter(([k]) =>
          !['date','title','author','slug','lang'].includes(k)
        )
      ),
    });
  }

  await fs.writeFile(
    path.join(UPDATES, 'index.json'),
    JSON.stringify(index, null, 2) + '\n'
  );
  console.log(`✓ updates/index.json régénéré (${index.length} entrées)`);
}

// Diagnostic (`--check` ou TRANSLATE_CHECK=1)
if (process.argv.includes('--check') || process.env.TRANSLATE_CHECK) {
  const report = [];
  for (const p of PROVIDERS) {
    console.log(`— ${p.name} : ${p.endpoint}, modèle ${p.model}`);
    const verdict = await checkProvider(p);
    console.log(verdict.ok ? '  ✓ opérationnel' : `  ✗ ${verdict.reason}`);
    report.push({
      provider: 'vyceai',
      endpoint: p.endpoint,
      model: p.model,
      ok: verdict.ok,
      reason: verdict.ok ? null : verdict.reason,
    });
  }
  const usable = report.filter(r => r.ok).length;
  await fs.writeFile('updates/.translation-health.json',
    JSON.stringify({ providers: report, usableProviders: usable, totalProviders: report.length }, null, 2) + '\n');
  console.log(`${usable} modèle(s) sur ${report.length} opérationnel(s) — rapport dans updates/.translation-health.json`);
  process.exit(usable ? 0 : 1);
}

const entries = await fs.readdir(UPDATES, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

const jobs = [];
for (const slug of dirs) {
  const { jobs: postJobs, touched } = await planPost(slug);
  jobs.push(...postJobs);
  if (!postJobs.length && !touched) console.log(`= ${slug} : à jour`);
}

console.log(`${jobs.length} traduction(s) à produire (concurrence ${CONCURRENCY})`);

let failures = [];

if (jobs.length) {
  console.log(`modèles VyceAI, dans l'ordre : ${PROVIDERS.map(p => p.name).join(' → ')} (bascule après ${MAX_FAILURES} échecs)`);

  // Passe au modèle suivant et vérifie qu'il répond vraiment. Dès qu'un
  // modèle répond, il devient « sticky » : il sert pour toutes les
  // traductions et il est mémorisé pour les runs suivants.
  async function selectProvider() {
    while (activeIndex + 1 < PROVIDERS.length) {
      activeIndex++;
      const p = PROVIDERS[activeIndex];
      if (activeIndex > 0) console.log(`↻ bascule sur ${p.name}`);
      const verdict = await checkProvider(p);
      if (verdict.ok) {
        active = p;
        activeProbe = null;
        bulkRejection = null;
        providerFailures = 0;
        exhaustedReason = null;
        console.log(`✓ modèle retenu : ${p.model} — ${p.endpoint}`);
        await fs.writeFile(STICKY_FILE, p.model + '\n').catch(() => {});
        return true;
      }
      console.error(`✗ ${p.name} indisponible : ${verdict.reason}`);
      rejected.set(p.name, verdict.reason);
    }
    active = null;
    return false;
  }

  let pending = jobs;
  for (let pass = 1; pass <= 2 && pending.length; pass++) {
    while (pending.length && await selectProvider()) {
      const result = await runPool(pending);
      const stopReason = bulkRejection || exhaustedReason;
      if (!stopReason) {
        pending = [];
        failures = result;
        break;
      }
      console.error(`→ ${stopReason} ; ${result.length} tâche(s) reprise(s) avec le modèle suivant.`);
      pending = result;
      active = null;
      activeProbe = null;
      bulkRejection = null;
      providerFailures = 0;
      exhaustedReason = null;
    }
    if (!pending.length) break;
    failures = pending;
    if (pass === 2 || !OUTAGE_WAIT_MS) break;
    const wait = OUTAGE_WAIT_MS / 1000;
    console.error(`↻ aucun modèle disponible ; nouvelle tentative dans ${wait < 10 ? wait.toFixed(1) : Math.round(wait)} s`);
    await sleep(OUTAGE_WAIT_MS);
    activeIndex = -1;
    active = null;
    activeProbe = null;
    bulkRejection = null;
    providerFailures = 0;
    exhaustedReason = null;
    rejected.clear();
  }
}

// Génère/actualise l'index après toutes les traductions
await rebuildIndex();

if (failures.length) {
  console.error('');
  console.error(`✗ ${failures.length} traduction(s) en échec :`);
  for (const f of failures.filter(f => !f.skipped)) console.error(`  - ${f.slug}/${f.lang} : ${f.error}`);
  if (rejected.size) {
    console.error('');
    console.error('Modèles injoignables :');
    for (const [name, reason] of rejected) console.error(`  - ${name} : ${reason}`);
    console.error('');
    console.error("Quand la requête témoin « Bonjour. » est refusée elle aussi, le contenu des articles");
    console.error("n'est pas en cause : vérifier la clé (crédits épuisés, clé expirée) et les modèles.");
    console.error('  TRANSLATE_API_KEY / TRANSLATE_ENDPOINT / TRANSLATE_MODEL / TRANSLATE_MODEL_FALLBACKS');
  }
  console.error('Les traductions réussies sont conservées ; relancer le workflow reprendra les manquantes.');
  process.exitCode = 1;
} else {
  console.log(`✓ ${jobs.length} traduction(s) terminée(s)`);
}
