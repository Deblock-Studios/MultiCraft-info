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

const API_KEY  = process.env.TRANSLATE_API_KEY;
const ENDPOINT = (process.env.TRANSLATE_ENDPOINT || 'https://vyceai.com/v1').replace(/\/+$/, '');
const MODEL    = process.env.TRANSLATE_MODEL || 'deepseek-v4.1';

// Une requête bloquée ne doit pas geler le job : sans timeout, node attend
// indéfiniment et le runner finit par tuer le job en perdant tout le travail.
const REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 120_000);
// Appels simultanés. 50 articles x 15 langues = ~750 appels : en séquentiel
// cela prend plus de deux heures, ce qui laisse peu de marge avant le timeout
// du job (et le moindre aléa fait tout perdre).
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY || 4));
// Pause avant la seconde chance accordée quand le fournisseur a refusé toutes
// les requêtes : une indisponibilité de quelques dizaines de secondes ne doit
// pas faire perdre le run entier.
const OUTAGE_WAIT_MS = Math.max(0, Number(process.env.TRANSLATE_OUTAGE_WAIT_MS ?? 60_000));

if (!API_KEY) {
  console.error('TRANSLATE_API_KEY manquant');
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

// Vérifie la clé avant de lancer 750 appels : une clé ou un endpoint invalide
// faisait tourner le job pendant des heures pour rien.
async function preflight() {
  let res;
  try {
    res = await fetch(`${ENDPOINT}/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    // Endpoint qui n'expose pas /models : on laisse les appels décider.
    console.warn(`⚠ pré-vérification ignorée (${err.message})`);
    return;
  }
  if (res.status === 401 || res.status === 403) {
    throw await httpError(res, 'authentification refusée');
  }
  if (!res.ok) {
    console.warn(`⚠ pré-vérification ignorée (HTTP ${res.status})`);
    return;
  }
  try {
    const data = await res.json();
    const ids = (data?.data || data?.models || []).map(m => m.id || m.name).filter(Boolean);
    if (ids.length && !ids.includes(MODEL)) {
      console.warn(`⚠ modèle « ${MODEL} » absent de ${ENDPOINT}/models (disponibles : ${ids.slice(0, 8).join(', ')}…)`);
    } else {
      console.log(`✓ API joignable (${ENDPOINT}), modèle ${MODEL}`);
    }
  } catch {}
}

// Un « invalid_request » peut venir du contenu d'un article… ou d'une clé
// épuisée, d'un modèle retiré, d'une panne du fournisseur. Dans ce second cas
// les 15 langues d'un même article rejettent en quelques secondes, soit 45
// requêtes inutiles. Une requête témoin de quelques caractères tranche : si
// elle est refusée elle aussi, le problème n'est pas dans les articles.
let probePromise = null;
let bulkRejection = null;

function probeProvider() {
  probePromise ??= (async () => {
    try {
      const res = await fetch(`${ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          messages: [{ role: 'user', content: 'Bonjour.' }],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return null;
      return (await httpError(res, 'requête témoin refusée')).message;
    } catch (err) {
      return `requête témoin impossible : ${err.message}`;
    }
  })();
  return probePromise;
}

async function callModel(system, user, retries = 3) {
  const url = `${ENDPOINT}/chat/completions`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
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
        // 400/401/404… : inutile de réessayer, et on veut le message complet.
        const err = await httpError(res, 'échec');
        err.fatal = true;
        throw err;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error('réponse vide');
      return text;
    } catch (err) {
      console.warn(`  ⚠ tentative ${attempt}/${retries} : ${err.message}`);
      if (!err.fatal && err.invalidRequest && !bulkRejection) {
        const refusal = await probeProvider();
        if (refusal) {
          bulkRejection = `fournisseur en échec (${refusal})`;
          const fatal = new Error(
            `${err.message}\n     requête témoin « Bonjour. » refusée elle aussi : ${refusal}\n` +
            `     → le fournisseur rejette tout, le contenu des articles n'est pas en cause.`
          );
          fatal.fatal = true;
          throw fatal;
        }
      }
      if (err.fatal || attempt === retries) throw err;
      // Respecte Retry-After quand le fournisseur en fournit un, sinon
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

// Exécute les tâches par petits groupes : plus rapide qu'en séquentiel sans
// bombarder le fournisseur (et sans se faire rate-limiter).
async function runPool(jobs) {
  const failures = [];
  let index = 0;
  let skipped = 0;

  async function worker() {
    while (index < jobs.length) {
      const job = jobs[index++];
      // Fournisseur manifestement hors service : inutile d'envoyer les 40
      // requêtes restantes pour récolter le même refus.
      if (bulkRejection) {
        skipped++;
        failures.push({ ...job, error: bulkRejection, skipped: true });
        continue;
      }
      try {
        await runJob(job);
      } catch (err) {
        console.error(`  ✗ échec ${job.slug}/${job.lang} : ${err.message}`);
        failures.push({ ...job, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  if (skipped) console.error(`  ✗ ${skipped} traduction(s) non tentée(s) : ${bulkRejection}`);
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

    // Détermine la source de référence (FR prioritaire)
    let sourcePath = null;
    if (await exists(frPath)) sourcePath = frPath;
    else if (await exists(enPath)) sourcePath = enPath;
    else continue;

    // Lit le front-matter pour récupérer les métadonnées existantes
    const raw = await fs.readFile(sourcePath, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }

    // Détecte les langues réellement présentes sur le disque
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
      // Conserve les autres champs du front-matter s'ils existent
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

try {
  await preflight();
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error('Vérifier le secret TRANSLATE_API_KEY (et TRANSLATE_ENDPOINT / TRANSLATE_MODEL) du dépôt.');
  process.exit(1);
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
let failures = await runPool(jobs);

// Fournisseur momentanément hors service : le premier passage s'est arrêté dès
// la requête témoin refusée. Une seconde chance après une pause évite de
// perdre un run entier pour quelques secondes d'indisponibilité.
if (bulkRejection && jobs.length) {
  const wait = OUTAGE_WAIT_MS / 1000;
  console.error(`\n↻ nouvelle tentative dans ${wait < 10 ? wait.toFixed(1) : Math.round(wait)} s : ${bulkRejection}`);
  await sleep(OUTAGE_WAIT_MS);
  bulkRejection = null;
  probePromise = null;
  failures = await runPool(failures);
}

// Génère/actualise l'index après toutes les traductions
await rebuildIndex();

if (failures.length) {
  console.error(`\n✗ ${failures.length} traduction(s) en échec :`);
  for (const f of failures.filter(f => !f.skipped)) console.error(`  - ${f.slug}/${f.lang} : ${f.error}`);
  if (bulkRejection) {
    console.error(`\n${bulkRejection} : toutes les langues restantes ont été laissées de côté.`);
    console.error("Le contenu des articles n'est pas en cause : vérifier le secret TRANSLATE_API_KEY");
    console.error('(clé expirée, crédits épuisés) et la variable TRANSLATE_MODEL (modèle retiré).');
  }
  console.error('Les traductions réussies sont conservées ; relancer le workflow reprendra les manquantes.');
  process.exitCode = 1;
} else {
  console.log(`✓ ${jobs.length} traduction(s) terminée(s)`);
}
