// ── MultiCraft Info — proxy API signé (Netlify Edge Function) ──
//
// Le navigateur n'appelle plus directement le Worker Cloudflare : il appelle
// `/api/...` sur le domaine Netlify. Cette fonction serveur :
//
//   1. reçoit la requête (même origine → aucun CORS, aucune URL de Worker
//      exposée dans le JS public) ;
//   2. signe l'appel avec un HMAC-SHA256 calculé à partir d'un secret qui
//      n'existe QUE dans les variables d'environnement Netlify (jamais envoyé
//      au navigateur) ;
//   3. transmet l'IP réelle du visiteur, elle aussi couverte par la signature,
//      pour que le Worker et le backend Python rate-limitent la bonne IP ;
//   4. relaie la réponse telle quelle.
//
// Sans ce secret, impossible de fabriquer une requête acceptée par le Worker :
// scraper *.workers.dev directement renvoie 403, même avec un Origin falsifié.
//
// Variables d'environnement Netlify (Site configuration → Environment
// variables, portée « Functions ») :
//
//   WORKER_ORIGIN         URL du Worker (ex. https://multicraft-servers.creatif-france.workers.dev)
//   WORKER_SHARED_SECRET  MÊME valeur que WORKER_SHARED_SECRET côté Cloudflare
//   SITE_ORIGIN           (optionnel) origine envoyée au Worker, par défaut
//                         https://multicraft-info.netlify.app

const WORKER_ORIGIN = (Deno.env.get('WORKER_ORIGIN') || 'https://multicraft-servers.creatif-france.workers.dev')
  .trim()
  .replace(/\/+$/, '');
// `.trim()` : les champs de valeur d'un dashboard acceptent les retours à la
// ligne. Un "\n" invisible en fin de valeur suffit à invalider TOUTES les
// signatures (403 « signature-invalide ») alors que les deux secrets semblent
// identiques. Le Worker applique le même nettoyage.
const SHARED_SECRET = (Deno.env.get('WORKER_SHARED_SECRET') || '').trim();
const SITE_ORIGIN = (Deno.env.get('SITE_ORIGIN') || 'https://multicraft-info.netlify.app').trim();

/** En-têtes envoyés au navigateur (JSON, jamais mis en cache). */
function jsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders(extra) });
}

/** HMAC-SHA256 → base64 (même algorithme que worker.js). */
async function hmacBase64(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export default async function handler(request, context) {
  const url = new URL(request.url);

  // /api/db/french?p=50,1  →  /db/french?p=50,1 (chemin relayé au Worker).
  const backendPath = url.pathname.replace(/^\/api/, '') + url.search;
  if (!backendPath || backendPath === '/') {
    return json(404, { error: 'not found' });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json(405, { error: 'method not allowed' }, { Allow: 'GET, HEAD' });
  }

  // Sans secret, aucun appel ne peut être signé : on échoue explicitement
  // plutôt que de laisser passer des requêtes non signées.
  if (!SHARED_SECRET) {
    console.error('[api-proxy] WORKER_SHARED_SECRET manquant dans les variables Netlify');
    return json(503, { error: 'proxy misconfigured' });
  }

  // IP réelle du visiteur : fournie par Netlify (context.ip), couverte par la
  // signature pour que le Worker ne puisse pas la recevoir falsifiée.
  const clientIp = context.ip
    || request.headers.get('x-nf-client-connection-ip')
    || '0.0.0.0';

  const timestamp = Date.now().toString();
  // Message signé — DOIT rester identique dans worker.js (verifySignature).
  const payload = `${timestamp}\n${request.method}\n${backendPath}\n${clientIp}`;
  const signature = await hmacBase64(SHARED_SECRET, payload);

  const upstreamHeaders = {
    'X-MCS-Timestamp': timestamp,
    'X-MCS-Signature': signature,
    'X-MCS-Client-IP': clientIp,
    Origin: SITE_ORIGIN,
    Accept: 'application/json',
    'User-Agent': request.headers.get('user-agent') || 'MultiCraft-Info',
  };
  // La condition If-None-Match n'est pas relayée : le Worker renvoie du JSON
  // volatile, et cela évite de propager des 304 incohérents au navigateur.

  let upstream;
  try {
    upstream = await fetch(WORKER_ORIGIN + backendPath, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow',
    });
  } catch (error) {
    console.error('[api-proxy] Worker injoignable :', error.message);
    return json(502, { error: 'upstream unavailable' });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Utile au client pour respecter le rate limiting du Worker/backend.
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) headers.set('Retry-After', retryAfter);
  const requestId = upstream.headers.get('x-request-id');
  if (requestId) headers.set('X-Request-Id', requestId);

  return new Response(upstream.body, { status: upstream.status, headers });
}
