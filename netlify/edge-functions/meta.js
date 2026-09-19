// ── MultiCraft Info — server-side meta injection ──
// Discord, Twitter/X, Facebook, etc. read the raw HTML and do NOT run
// JavaScript. Since the site is a SPA served by the same index.html for every
// path, we rewrite the <title> and Open Graph / Twitter meta tags here, based
// on the requested path (and its optional language prefix, e.g. /en/ or /ja/), so each page
// preview matches its real URL.

const SITE_URL = 'https://multicraft-info.netlify.app';
const OG_IMAGE = SITE_URL + '/og-image.png';

// Normalized pathname → { title, desc } per language.
const META = {
  fr: {
    '/':             { title: 'MultiCraft Info', desc: 'Actualités, mises à jour et informations sur les serveurs MultiCraft.' },
    '/accueil':      { title: 'MultiCraft Info', desc: 'Actualités, mises à jour et informations sur les serveurs MultiCraft.' },
    '/mises-a-jour': { title: 'MultiCraft Info - Mises à jour', desc: 'Toutes les nouveautés et mises à jour du jeu, classées de la plus récente à la plus ancienne.' },
    '/serveurs':     { title: 'MultiCraft Info - Serveurs', desc: 'La plus grosse base de données de serveurs MultiCraft.' },
    '/le-jeu':       { title: 'MultiCraft Info - Le jeu', desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.' },
    '/profil':       { title: 'MultiCraft Info - Profil', desc: 'Gérez votre profil et vos informations personnelles.' },
    '/info-du-jeu':  { title: 'MultiCraft Info - Le jeu', desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.' },
    '/telecharger':  { title: 'MultiCraft Info - Le jeu', desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.' },
  },
  en: {
    '/':             { title: 'MultiCraft Info', desc: 'News, updates and information about MultiCraft servers.' },
    '/accueil':      { title: 'MultiCraft Info', desc: 'News, updates and information about MultiCraft servers.' },
    '/mises-a-jour': { title: 'MultiCraft Info - Updates', desc: 'All the latest game news and updates, from most recent to oldest.' },
    '/serveurs':     { title: 'MultiCraft Info - Servers', desc: 'The largest MultiCraft server database.' },
    '/le-jeu':       { title: 'MultiCraft Info - The Game', desc: 'Download MultiCraft for Android and discover the game\'s physical servers.' },
    '/profil':       { title: 'MultiCraft Info - Profile', desc: 'Manage your profile and personal information.' },
    '/info-du-jeu':  { title: 'MultiCraft Info - The Game', desc: 'Download MultiCraft for Android and discover the game\'s physical servers.' },
    '/telecharger':  { title: 'MultiCraft Info - The Game', desc: 'Download MultiCraft for Android and discover the game\'s physical servers.' },
  },
};

// Langues dont le préfixe d'URL est reconnu (miroir de LANGUAGES dans i18n.js).
// Ajouter une langue ici active son préfixe et son <html lang> ; sans entrée
// META dédiée ci-dessus, l'aperçu retombe sur l'anglais (langue de référence).
const LANG_CODES = [
  'fr', 'br', 'nrm', 'en', 'es', 'es-mx', 'de', 'pt', 'pt-br', 'nl', 'ru', 'uk',
  'tr', 'zh', 'ja', 'ko', 'hi', 'bn', 'ar', 'id',
];
const DEFAULT_LANG = 'fr';

// « /ja/serveurs » → { lang: 'ja', routePath: '/serveurs' } ; null si pas de préfixe.
function parseLangPrefix(pathname) {
  const match = pathname.match(/^\/([a-z]{2,3}(?:-[a-z]{2})?)(\/.*)?$/i);
  if (!match) return null;
  const code = match[1].toLowerCase();
  if (!LANG_CODES.includes(code)) return null;
  return { lang: code, routePath: match[2] || '/' };
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Replace the content="" of a <meta> tag identified by its property/name.
function setMetaContent(html, attribute, value) {
  const re = new RegExp(
    '(<meta\\s+[^>]*?(?:property|name)="' + attribute + '"[^>]*?content=")[^"]*(")',
    'i'
  );
  return html.replace(re, '$1' + escapeAttr(value) + '$2');
}

function injectMeta(html, meta, canonicalUrl, lang) {
  let out = html;

  out = out.replace(/<html lang="[^"]*"/, '<html lang="' + lang + '"');
  out = out.replace(/<title>[\s\S]*?<\/title>/, '<title>' + escapeAttr(meta.title) + '</title>');

  out = setMetaContent(out, 'description', meta.desc);
  out = setMetaContent(out, 'og:title', meta.title);
  out = setMetaContent(out, 'og:description', meta.desc);
  out = setMetaContent(out, 'og:url', canonicalUrl);
  out = setMetaContent(out, 'og:image', OG_IMAGE);
  out = setMetaContent(out, 'twitter:title', meta.title);
  out = setMetaContent(out, 'twitter:description', meta.desc);
  out = setMetaContent(out, 'twitter:image', OG_IMAGE);

  return out;
}

export default async function handler(request, context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return context.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Parse an optional language prefix (/en/, /ja/, /pt-br/, …).
  const parsed = parseLangPrefix(pathname);
  const lang = parsed ? parsed.lang : DEFAULT_LANG;
  const routePath = parsed ? parsed.routePath : pathname;

  const normalized = (routePath === '/' ? '/' : routePath.replace(/\/+$/, '')).toLowerCase();
  // Pas d'entrée META pour cette langue : aperçu en anglais (langue de référence).
  const meta = (META[lang] || META.en)[normalized];
  if (!meta) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const canonicalUrl = lang === DEFAULT_LANG
    ? SITE_URL + normalized
    : SITE_URL + '/' + lang + (normalized === '/' ? '' : normalized);

  const html = injectMeta(await response.text(), meta, canonicalUrl, lang);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'text/html; charset=utf-8');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
