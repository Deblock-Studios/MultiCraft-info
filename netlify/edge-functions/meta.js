// ── MultiCraft Info — server-side meta injection ──
// Discord, Twitter/X, Facebook, etc. read the raw HTML and do NOT run
// JavaScript. Since the site is a SPA served by the same index.html for every
// path, we rewrite the <title> and Open Graph / Twitter meta tags here, based
// on the requested path, so each page preview matches its real URL.

const SITE_URL = 'https://multicraft-info.netlify.app';
const OG_IMAGE = SITE_URL + '/og-image.png';

const HOME_TITLE = 'MultiCraft Info';
const HOME_DESC = 'Actualités, mises à jour et informations sur les serveurs MultiCraft.';

// Normalized pathname → metadata.
const META = {
  '/':             { title: HOME_TITLE, desc: HOME_DESC },
  '/accueil':      { title: HOME_TITLE, desc: HOME_DESC },
  '/mises-a-jour': {
    title: 'MultiCraft Info - Mises à jour',
    desc: 'Toutes les nouveautés et mises à jour du jeu, classées de la plus récente à la plus ancienne.',
  },
  '/serveurs': {
    title: 'MultiCraft Info - Serveurs',
    desc: 'La plus grosse base de données de serveurs MultiCraft.',
  },
  '/le-jeu': {
    title: 'MultiCraft Info - Le jeu',
    desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.',
  },
  '/profil': {
    title: 'MultiCraft Info - Profil',
    desc: 'Gérez votre profil et vos informations personnelles.',
  },
  // Legacy aliases
  '/info-du-jeu': {
    title: 'MultiCraft Info - Le jeu',
    desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.',
  },
  '/telecharger': {
    title: 'MultiCraft Info - Le jeu',
    desc: 'Téléchargez MultiCraft pour Android et découvrez les serveurs physiques du jeu.',
  },
};

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

function injectMeta(html, meta, canonicalUrl) {
  let out = html;

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
  const pathname = url.pathname;
  const normalized = (pathname === '/' ? '/' : pathname.replace(/\/+$/, '')).toLowerCase();

  const meta = META[normalized];
  if (!meta) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const canonicalUrl = SITE_URL + normalized;
  const html = injectMeta(await response.text(), meta, canonicalUrl);

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
