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

if (!API_KEY) {
  console.error('TRANSLATE_API_KEY manquant');
  process.exit(1);
}

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

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
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} — retry`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error('réponse vide');
      return text;
    } catch (err) {
      console.warn(`  ⚠ tentative ${attempt}/${retries} : ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
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

async function processPost(slug) {
  const dir = path.join(UPDATES, slug);
  const frPath = path.join(dir, SRC_FR);
  const enPath = path.join(dir, SRC_EN);

  let source = null;
  let sourceLang = null;

  if (await fs.stat(frPath).catch(() => null)) {
    source = await fs.readFile(frPath, 'utf8');
    sourceLang = 'fr';
  } else if (await fs.stat(enPath).catch(() => null)) {
    source = await fs.readFile(enPath, 'utf8');
    sourceLang = 'en';
  } else {
    return;
  }

  const srcHash = hash(source);
  let touched = false;

  for (const lang of LANGS) {
    // On ne traduit jamais vers la langue source : on copie simplement.
    if (lang === sourceLang) {
      const out = path.join(dir, `post.${lang}.md`);
      const prev = await fs.readFile(out, 'utf8').catch(() => null);
      if (prev !== source) {
        await fs.writeFile(out, source);
        touched = true;
      }
      continue;
    }

    const out = path.join(dir, `post.${lang}.md`);
    const marker = path.join(dir, `.i18n.${lang}.hash`);
    const prev = await fs.readFile(marker, 'utf8').catch(() => null);

    if (prev === srcHash && await fs.stat(out).catch(() => null)) {
      continue; // déjà à jour
    }

    console.log(`→ ${slug} : ${lang}`);
    try {
      const translated = await translate(source, lang);
      await fs.writeFile(out, translated.trimEnd() + '\n');
      await fs.writeFile(marker, srcHash);
      touched = true;
    } catch (err) {
      console.error(`  ✗ échec ${lang} : ${err.message}`);
      process.exitCode = 1;
    }
  }

  if (!touched) console.log(`= ${slug} : à jour`);
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
    if (await fs.stat(frPath).catch(() => null)) sourcePath = frPath;
    else if (await fs.stat(enPath).catch(() => null)) sourcePath = enPath;
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
      if (await fs.stat(p).catch(() => null)) availableLangs.push(lang);
    }

    index.push({
      slug,
      date: fm.date || '',
      title: fm.title || slug,
      author: fm.author || '',
      sourceLang: (await fs.stat(frPath).catch(() => null)) ? 'fr' : 'en',
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

const entries = await fs.readdir(UPDATES, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

for (const slug of dirs) {
  await processPost(slug);
}

// Génère/actualise l'index après toutes les traductions
await rebuildIndex();
