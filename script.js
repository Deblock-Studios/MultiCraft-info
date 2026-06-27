/* ═══════════════════════════════════════════
   MultiCraft Info — script principal
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Datacenters (modifiable) ── */
  const DATACENTERS = [
    {
      host: 'r1.multicraft.network',
      location: 'Falkenstein, Allemagne',
      provider: 'Hetzner'
    },
    {
      host: 'r3.multicraft.network',
      location: 'Falkenstein Allemagne',
      provider: 'Hetzner'
    },
    {
      host: 'r4.multicraft.network',
      location: 'Singapour',
      provider: 'Leaseweb'
    },
    {
      host: 'r6.multicraft.network',
      location: 'Hong Kong',
      provider: 'Hetzner'
    },
    {
      host: 'r7.multicraft.network',
      location: 'Naaldwijk, Pays-Bas',
      provider: 'WorldStream'
    },
    {
      host: 'r8.multicraft.network',
      location: 'Helsinki, Finlande',
      provider: 'Hetzner'
    },
    {
      host: 'r9.multicraft.network',
      location: 'Sydney, Autralie',
      provider: 'OVH'
    }
  ];

  /* ── Supabase (avis serveurs) ── */
  // 👉 Remplacez ces deux valeurs par celles de votre projet Supabase
  //    Supabase > Settings > API
  const SUPABASE_URL = 'https://qxzvnxekjggjldezprec.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4enZueGVramdnamxkZXpwcmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzE3NjMsImV4cCI6MjA5NzgwNzc2M30.Qa-lxT8mYy2kejt2kiydOvDqCYNeAD6q1d1Ce56A5Rc';

  const SUPABASE_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  /* ── Discord OAuth2 (Authorization Code via Worker proxy) ── */
  // 👉 Remplacez par le Client ID de votre application Discord
  //    discord.com/developers/applications → votre app → OAuth2
  const DISCORD_CLIENT_ID = '1520060964920103013';
  // ⚠️  Doit correspondre EXACTEMENT à ce qui est enregistré dans Discord Developer Portal
  //     Discord → OAuth2 → Redirects
  const DISCORD_REDIRECT_URI = 'https://multicraft-info.netlify.app/';
  const DISCORD_SCOPES = 'identify';

  /* ── État de l'utilisateur Discord ── */
  let discordUser = null; // { id, username, discriminator, avatar, global_name }

  function getDiscordAvatarUrl(user) {
    if (!user) return '';
    if (user.avatar) {
      return 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=64';
    }
    // Avatar par défaut Discord
    const index = Number(BigInt(user.id) >> 22n) % 6;
    return 'https://cdn.discordapp.com/embed/avatars/' + index + '.png';
  }

  function getDiscordDisplayName(user) {
    if (!user) return '';
    return user.global_name || user.username || ('Utilisateur#' + user.discriminator);
  }

  /* ── Discord OAuth2 (Authorization Code via Worker proxy) ── */
  // Le client_secret vit uniquement dans le Worker Cloudflare — jamais ici.
  const DISCORD_TOKEN_PROXY = 'https://discord-oauth-proxy.creatif-france.workers.dev/token';

  /* ── Lancer le flux OAuth2 Discord ── */
  async function startDiscordLogin() {
    const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))))
      .replace(/[^a-zA-Z0-9]/g, '');

    sessionStorage.setItem('discord_oauth_state', state);

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: DISCORD_SCOPES,
      state: state,
      prompt: 'none',
    });

    window.location.href = 'https://discord.com/api/oauth2/authorize?' + params.toString();
  }

  /* ── Échange du code via le Worker (client_secret côté Worker) ── */
  async function exchangeCodeForToken(code) {
    const res = await fetch(DISCORD_TOKEN_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
        client_id: DISCORD_CLIENT_ID,
      }),
    });
    if (!res.ok) throw new Error('Erreur échange token (' + res.status + ')');
    return res.json();
  }

  async function fetchDiscordUser(accessToken) {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!res.ok) throw new Error('Erreur profil Discord (' + res.status + ')');
    return res.json();
  }

  /* ── Persistance session ── */
  function saveDiscordSession(user, accessToken, expiresAt) {
    try {
      localStorage.setItem('discord_session', JSON.stringify({ user, accessToken, expiresAt }));
    } catch { /* ignore */ }
  }

  function loadDiscordSession() {
    try {
      const raw = localStorage.getItem('discord_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expiresAt && Date.now() > session.expiresAt) {
        localStorage.removeItem('discord_session');
        return null;
      }
      return session;
    } catch { return null; }
  }

  function clearDiscordSession() {
    localStorage.removeItem('discord_session');
  }

  /* ── Mise à jour de l'UI ── */
  function updateDiscordUI() {
    const loginBtn = document.getElementById('discord-login-btn');
    const userInfo = document.getElementById('discord-user-info');
    const avatarEl = document.getElementById('discord-avatar');
    const usernameEl = document.getElementById('discord-username');

    if (discordUser) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userInfo) {
        userInfo.removeAttribute('hidden');
        userInfo.style.display = 'flex';
      }
      if (avatarEl) {
        avatarEl.src = getDiscordAvatarUrl(discordUser);
        avatarEl.alt = getDiscordDisplayName(discordUser);
      }
      if (usernameEl) usernameEl.textContent = getDiscordDisplayName(discordUser);
    } else {
      if (loginBtn) loginBtn.style.display = '';
      if (userInfo) {
        userInfo.setAttribute('hidden', '');
        userInfo.style.display = 'none';
      }
    }
  }

  /* ── Gestion du callback OAuth2 (code dans l'URL) ── */
  async function handleDiscordCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.warn('Discord OAuth erreur :', error);
      // Nettoyer l'URL
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      history.replaceState(null, '', cleanUrl);
      return;
    }

    if (!code) return;

    const savedState = sessionStorage.getItem('discord_oauth_state');
    sessionStorage.removeItem('discord_oauth_state');

    if (!savedState || state !== savedState) {
      console.error('Discord OAuth : état invalide (CSRF)');
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      history.replaceState(null, '', cleanUrl);
      return;
    }

    try {
      const tokenData = await exchangeCodeForToken(code);
      const user = await fetchDiscordUser(tokenData.access_token);
      const expiresAt = Date.now() + (tokenData.expires_in || 604800) * 1000;

      discordUser = user;
      saveDiscordSession(user, tokenData.access_token, expiresAt);
      updateDiscordUI();
    } catch (err) {
      console.error('Discord auth erreur :', err);
    }

    // Nettoyer les paramètres OAuth de l'URL
    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    history.replaceState(null, '', cleanUrl);
  }

  /* ── Init auth ── */
  function initDiscordAuth() {
    const session = loadDiscordSession();
    if (session) {
      discordUser = session.user;
    }
    updateDiscordUI();

    // Délégation sur le document pour capturer les clics
    // même si les boutons sont cachés au moment de l'init
    document.addEventListener('click', function (e) {
      if (e.target.closest('#discord-login-btn')) {
        startDiscordLogin();
      }
      if (e.target.closest('#discord-logout-btn')) {
        discordUser = null;
        clearDiscordSession();
        updateDiscordUI();
      }
    });

    // Gérer le callback OAuth si on revient de Discord
    handleDiscordCallback();
  }

  /* ── Navigation SPA ── */
  const pages = {
    accueil: document.getElementById('page-accueil'),
    'mises-a-jour': document.getElementById('page-mises-a-jour'),
    serveurs: document.getElementById('page-serveurs'),
    'info-du-jeu': document.getElementById('page-info-du-jeu'),
    'info-du-site': document.getElementById('page-info-du-site'),
  };

  const navLinks = document.querySelectorAll('[data-nav]');
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  function navigateTo(pageId) {
    if (!pages[pageId]) return;

    Object.values(pages).forEach(function (p) {
      if (p) p.classList.remove('active');
    });
    if (pages[pageId]) pages[pageId].classList.add('active');

    document.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.dataset.nav === pageId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) {
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }

    if (pageId === 'mises-a-jour' && !updatesLoaded) loadUpdates();
    if (pageId === 'info-du-jeu' && !datacentersLoaded) renderDatacenters();
    if (pageId === 'serveurs' && !serversLoaded) loadServers();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRoute() {
    const hash = location.hash.slice(1) || 'accueil';
    if (pages[hash]) {
      navigateTo(hash);
    } else {
      navigateTo('accueil');
    }
  }

  navLinks.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      const page = el.dataset.nav;
      location.hash = page;
    });
  });

  window.addEventListener('hashchange', handleRoute);

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      const open = mainNav.classList.toggle('open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── Cursor halo ── */
  const halo = document.getElementById('cursor-halo');
  const size = 100 / 2;

  let haloX = 0;
  let haloY = 0;
  let targetX = 0;
  let targetY = 0;
  let rafId = null;

  function isDesktopPointer() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function animateHalo() {
    haloX += (targetX - haloX) * 0.08;
    haloY += (targetY - haloY) * 0.08;

    halo.style.transform =
      'translate(' + (haloX - size) + 'px, ' + (haloY - size) + 'px)';

    rafId = requestAnimationFrame(animateHalo);
  }

  function initCursorHalo() {
    if (!isDesktopPointer() || !halo) return;

    document.body.classList.add('cursor-active');

    if (!rafId) rafId = requestAnimationFrame(animateHalo);

    document.addEventListener('mousemove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    document.addEventListener('mouseleave', function () {
      document.body.classList.remove('cursor-active');
    });

    document.addEventListener('mouseenter', function () {
      if (isDesktopPointer()) document.body.classList.add('cursor-active');
    });
  }

  /* ── Markdown parser (minimal) ── */
  function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw.trim() };

    const meta = {};
    match[1].split('\n').forEach(function (line) {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val
          .slice(1, -1)
          .split(',')
          .map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); })
          .filter(Boolean);
      } else {
        val = val.replace(/^["']|["']$/g, '');
      }
      meta[key] = val;
    });

    return { meta: meta, body: match[2].trim() };
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\n');
    const html = [];
    let inCode = false;
    let codeBuffer = [];
    let listType = null;

    function closeList() {
      if (listType === 'ul') {
        html.push('</ul>');
        listType = null;
      } else if (listType === 'ol') {
        html.push('</ol>');
        listType = null;
      }
    }

    function inline(text) {
      if (!text) return '';
      return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        closeList();
        if (inCode) {
          html.push('<pre><code>' + escapeHtml(codeBuffer.join('\n')) + '</code></pre>');
          codeBuffer = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      if (/^---+\$/.test(line.trim())) {
        closeList();
        html.push('<hr>');
        continue;
      }

      const h3 = line.match(/^### (.+)/);
      if (h3) {
        closeList();
        html.push('<h3>' + inline(h3[1]) + '</h3>');
        continue;
      }

      const h2 = line.match(/^## (.+)/);
      if (h2) {
        closeList();
        html.push('<h2>' + inline(h2[1]) + '</h2>');
        continue;
      }

      const bq = line.match(/^> (.+)/);
      if (bq) {
        closeList();
        html.push('<blockquote>' + inline(bq[1]) + '</blockquote>');
        continue;
      }

      const ul = line.match(/^[-*] (.+)/);
      if (ul) {
        if (listType !== 'ul') {
          closeList();
          html.push('<ul>');
          listType = 'ul';
        }
        html.push('<li>' + inline(ul[1]) + '</li>');
        continue;
      }

      const ol = line.match(/^\d+\. (.+)/);
      if (ol) {
        if (listType !== 'ol') {
          closeList();
          html.push('<ol>');
          listType = 'ol';
        }
        html.push('<li>' + inline(ol[1]) + '</li>');
        continue;
      }

      if (line.trim() === '') {
        closeList();
        continue;
      }

      closeList();
      html.push('<p>' + inline(line) + '</p>');
    }

    closeList();
    if (inCode && codeBuffer.length) {
      html.push('<pre><code>' + escapeHtml(codeBuffer.join('\n')) + '</code></pre>');
    }

    return html.join('\n');
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  }

  /* ── Updates loader ── */
  let updatesLoaded = false;
  const updatesContainer = document.getElementById('updates-container');

  async function loadUpdates() {
    try {
      const manifestRes = await fetch('updates/manifest.json');
      if (!manifestRes.ok) throw new Error('Manifest introuvable');
      const folders = await manifestRes.json();

      const posts = await Promise.all(
        folders.map(async function (folder) {
          const res = await fetch('updates/' + folder + '/post.md');
          if (!res.ok) return null;
          const raw = await res.text();
          const parsed = parseFrontmatter(raw);
          return {
            folder: folder,
            date: parsed.meta.date || folder.split('-').slice(0, 3).join('-'),
            title: parsed.meta.title || folder,
            images: Array.isArray(parsed.meta.images) ? parsed.meta.images : parsed.meta.images ? [parsed.meta.images] : [],
            body: parsed.body,
          };
        })
      );

      const valid = posts.filter(function (p) { return p !== null; })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      if (valid.length === 0) {
        updatesContainer.innerHTML = '<div class="empty-state"><p>Aucune mise à jour pour le moment.</p></div>';
      } else {
        updatesContainer.innerHTML = valid.map(renderUpdatePost).join('');
        bindLightbox();
      }

      updatesLoaded = true;
    } catch (err) {
      console.error(err);
      updatesContainer.innerHTML = '<div class="error-state"><p>Impossible de charger les mises à jour.</p><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">Servez le site via un serveur local (ex. <code>python -m http.server</code>).</p></div>';
    }
  }

  function renderUpdatePost(post) {
    if (!post) return '';
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
      imagesHtml = '<div class="update-images">' + post.images.map(function (img) {
        return '<img src="updates/' + post.folder + '/images/' + img + '" alt="" loading="lazy">';
      }).join('') + '</div>';
    }

    return '<article class="update-post"><div class="update-header"><time class="update-date" datetime="' +
      escapeHtml(post.date) + '">' + formatDate(post.date) + '</time><h2 class="update-title">' +
      escapeHtml(post.title) + '</h2></div><div class="update-body">' + renderMarkdown(post.body) +
      '</div>' + imagesHtml + '</article>';
  }

  function bindLightbox() {
    if (!updatesContainer) return;
    updatesContainer.querySelectorAll('.update-images img').forEach(function (img) {
      img.addEventListener('click', function () {
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.innerHTML = '<img src="' + img.src + '" alt="' + (img.alt || '') + '">';
        lb.addEventListener('click', function () { lb.remove(); });
        document.body.appendChild(lb);
      });
    });
  }

  /* ── Datacenters ── */
  let datacentersLoaded = false;
  const dcContainer = document.getElementById('datacenters-container');

  function renderDatacenters() {
    if (!dcContainer) return;
    let html = '';
    for (let i = 0; i < DATACENTERS.length; i++) {
      const dc = DATACENTERS[i];
      html += '<article class="dc-card"><div class="dc-header"><span class="dc-name">' +
        escapeHtml(dc.host) + '</span></div><div class="dc-details"><div class="dc-row"><span class="dc-label">Localisation</span><span class="dc-value">' +
        escapeHtml(dc.location) + '</span></div><div class="dc-row"><span class="dc-label">Hébergeur</span><span class="dc-value">' +
        escapeHtml(dc.provider) + '</span></div></div></article>';
    }
    dcContainer.innerHTML = html;
    datacentersLoaded = true;
  }

  /* ── Serveurs (API live) ── */
  const SERVERS_API_URL = 'https://multicraft-servers.creatif-france.workers.dev';

  let serversLoaded = false;
  let allServers = [];
  let filteredServers = [];
  const serversContainer = document.getElementById('servers-container');
  const serverSearchInput = document.getElementById('server-search');
  const serversCountEl = document.getElementById('servers-count');
  const sortPlayersSelect = document.getElementById('sort-players');
  const filterCountrySelect = document.getElementById('filter-country');

  function getServerCountry(server) {
    const text = (server.description || '') + ' ' + (server.server_name || '');
    const lowerText = text.toLowerCase();

    const countryPatterns = {
      'France': ['france', 'fr ', 'paris', 'lyon', 'marseille', '🇫🇷'],
      'Allemagne': ['allemagne', 'germany', 'de ', 'berlin', 'frankfurt', '🇩🇪'],
      'États-Unis': ['usa', 'united states', 'amérique', 'new york', 'california', '🇺🇸', 'us '],
      'Royaume-Uni': ['uk', 'united kingdom', 'angleterre', 'londres', '🇬🇧'],
      'Canada': ['canada', 'quebec', 'toronto', '🇨🇦'],
      'Australie': ['australia', 'sydney', 'melbourne', '🇦🇺'],
      'Singapour': ['singapore', 'singapour', '🇸🇬'],
      'Hong Kong': ['hong kong', '🇭🇰'],
      'Finlande': ['finlande', 'finland', 'helsinki', '🇫🇮'],
      'Pays-Bas': ['pays-bas', 'netherlands', 'naaldwijk', '🇳🇱'],
      'Japon': ['japan', 'tokyo', 'japon', '🇯🇵'],
      'Corée du Sud': ['korea', 'south korea', 'seoul', '🇰🇷'],
      'Brésil': ['brazil', 'brésil', 'sao paulo', '🇧🇷'],
      'Pologne': ['poland', 'pologne', 'warsaw', '🇵🇱'],
      'Suède': ['sweden', 'suède', 'stockholm', '🇸🇪']
    };

    for (const [country, patterns] of Object.entries(countryPatterns)) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          return country;
        }
      }
    }

    return 'Autre';
  }

  function extractServerLocation(server) {
    const text = (server.description || '') + ' ' + (server.server_name || '');
    const lowerText = text.toLowerCase();

    const locationPatterns = {
      'Paris, France': ['paris', 'france'],
      'Frankfurt, Allemagne': ['frankfurt', 'allemagne'],
      'New York, USA': ['new york', 'usa'],
      'Londres, Royaume-Uni': ['londres', 'uk'],
      'Sydney, Australie': ['sydney', 'australie'],
      'Singapour': ['singapore', 'singapour'],
      'Hong Kong': ['hong kong'],
      'Helsinki, Finlande': ['helsinki', 'finlande'],
      'Naaldwijk, Pays-Bas': ['naaldwijk', 'pays-bas']
    };

    for (const [location, patterns] of Object.entries(locationPatterns)) {
      let match = true;
      for (const pattern of patterns) {
        if (!lowerText.includes(pattern)) {
          match = false;
          break;
        }
      }
      if (match) return location;
    }

    return null;
  }

  function updateCountryFilter() {
    if (!filterCountrySelect) return;

    const countries = new Set();
    allServers.forEach(function (server) {
      const country = getServerCountry(server);
      countries.add(country);
    });

    const sortedCountries = Array.from(countries).sort();

    filterCountrySelect.innerHTML = '<option value="all">🌍 Tous les pays</option>';
    sortedCountries.forEach(function (country) {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = country;
      filterCountrySelect.appendChild(option);
    });
  }

  function applyFiltersAndSort() {
    if (!allServers.length) return;

    const searchQuery = serverSearchInput ? serverSearchInput.value : '';
    const sortType = sortPlayersSelect ? sortPlayersSelect.value : 'desc';
    const countryFilter = filterCountrySelect ? filterCountrySelect.value : 'all';

    let filtered = filterServers(searchQuery);

    if (countryFilter !== 'all') {
      filtered = filtered.filter(function (server) {
        return getServerCountry(server) === countryFilter;
      });
    }

    filtered.sort(function (a, b) {
      const aPlayers = a.online ? (a.connected_players || 0) : -1;
      const bPlayers = b.online ? (b.connected_players || 0) : -1;

      if (sortType === 'desc') {
        return bPlayers - aPlayers;
      } else {
        return aPlayers - bPlayers;
      }
    });

    filteredServers = filtered;
    renderServers(filtered);
  }

  /* L'API renvoie un objet contenant plusieurs listes (favorites, nearby, ...).
     On parcourt récursivement la réponse pour récupérer tous les serveurs
     (identifiés par leur "server_id"), peu importe sous quelle clé ils se trouvent,
     et on retire les doublons. */
  function extractServers(data) {
    const found = new Map();

    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node.server_id) {
        if (!found.has(node.server_id)) found.set(node.server_id, node);
        return;
      }
      Object.keys(node).forEach(function (key) { walk(node[key]); });
    }

    walk(data);

    return Array.from(found.values());
  }

  function countLabel(n) {
    return n + (n === 1 ? ' serveur' : ' serveurs');
  }

  function renderServerCard(server) {
    const online = !!server.online;
    const players = (online ? (server.connected_players || 0) : 0) + ' / ' + (server.max_players != null ? server.max_players : '?');
    const description = server.description ? escapeHtml(server.description) : 'Aucune description disponible.';
    const name = escapeHtml(server.server_name || 'Serveur sans nom');
    const code = escapeHtml(server.server_id || '');
    const adminName = server.admin_name ? escapeHtml(server.admin_name) : '';
    const country = getServerCountry(server);
    const location = extractServerLocation(server) || country;

    const discordBtn = server.url
      ? '<a href="' + escapeHtml(server.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-discord">Discord</a>'
      : '';

    const adminHtml = adminName ? '<div class="server-admin">👑 ' + adminName + '</div>' : '';
    const serverDataAttr = escapeHtml(JSON.stringify(server));

    return (
      '<article class="server-card">' +
      '<div class="server-card-head">' +
      '<div class="server-name-wrapper">' +
      '<h2 class="server-name">' + name + '</h2>' +
      '<span class="server-location">📍 ' + escapeHtml(location) + '</span>' +
      '</div>' +
      '<span class="server-players' + (online ? '' : ' offline') + '"><span class="dot"></span>' + players + '</span>' +
      '</div>' +
      adminHtml +
      '<p class="server-desc">' + description.substring(0, 100) + (description.length > 100 ? '...' : '') + '</p>' +
      '<div class="server-actions">' +
      discordBtn +
      '<button type="button" class="btn btn-players" data-server="' + serverDataAttr + '">👥 Liste des joueurs</button>' +
      '<button type="button" class="btn btn-primary btn-details" data-server="' + serverDataAttr + '">Détails</button>' +
      '</div>' +
      '</article>'
    );
  }

  function bindServerCardActions() {
    if (!serversContainer) return;

    serversContainer.querySelectorAll('.btn-details').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try {
          const serverData = JSON.parse(btn.dataset.server);
          openServerDetailsModal(serverData);
        } catch (e) {
          console.error('Erreur lors du parsing des données du serveur', e);
        }
      });
    });

    serversContainer.querySelectorAll('.btn-players').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try {
          const serverData = JSON.parse(btn.dataset.server);
          openPlayersModal(serverData);
        } catch (e) {
          console.error('Erreur lors du parsing des données du serveur', e);
        }
      });
    });
  }

  function renderServers(list) {
    if (!serversContainer) return;

    if (!list.length) {
      serversContainer.innerHTML = '<div class="empty-state"><p>Aucun serveur ne correspond à votre recherche.</p></div>';
    } else {
      serversContainer.innerHTML = list.map(renderServerCard).join('');
      bindServerCardActions();
    }

    if (serversCountEl) serversCountEl.textContent = countLabel(list.length);
  }

  function filterServers(query) {
    const q = query.trim().toLowerCase();
    if (!q) return allServers.slice();
    return allServers.filter(function (s) {
      return (
        (s.server_name && s.server_name.toLowerCase().indexOf(q) !== -1) ||
        (s.description && s.description.toLowerCase().indexOf(q) !== -1) ||
        (s.admin_name && s.admin_name.toLowerCase().indexOf(q) !== -1)
      );
    });
  }

  async function loadServers() {
    try {
      const res = await fetch(SERVERS_API_URL);
      if (!res.ok) throw new Error('Réponse API invalide (' + res.status + ')');
      const data = await res.json();

      allServers = extractServers(data);
      serversLoaded = true;

      updateCountryFilter();
      applyFiltersAndSort();

      // Vérifier si un serveur est partagé dans l'URL APRÈS avoir chargé les serveurs
      handleServerShare();
    } catch (err) {
      console.error(err);
      if (serversContainer) {
        serversContainer.innerHTML =
          '<div class="error-state"><p>Impossible de charger la liste des serveurs.</p>' +
          '<p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">Vérifiez votre connexion et réessayez dans un instant.</p></div>';
      }
      if (serversCountEl) serversCountEl.textContent = '';
    }
  }

  if (serverSearchInput) {
    serverSearchInput.addEventListener('input', function () {
      if (!serversLoaded) return;
      applyFiltersAndSort();
    });
  }

  if (sortPlayersSelect) {
    sortPlayersSelect.addEventListener('change', function () {
      if (!serversLoaded) return;
      applyFiltersAndSort();
    });
  }

  if (filterCountrySelect) {
    filterCountrySelect.addEventListener('change', function () {
      if (!serversLoaded) return;
      applyFiltersAndSort();
    });
  }

  /* ══════════════════════════════════════════════════════
     Système d'avis — Supabase + Auth Discord
     ══════════════════════════════════════════════════════ */

  /* ── Anti doublon : utilise discord_user_id si connecté, sinon localStorage ── */
  function hasRecentlyReviewed(serverId) {
    if (discordUser) return false; // l'unicité est gérée côté Supabase (discord_user_id unique/serveur)
    try {
      const data = JSON.parse(localStorage.getItem('mc_reviewed') || '{}');
      const last = data[serverId];
      return last && (Date.now() - last) < 3_600_000; // 1 h
    } catch { return false; }
  }

  function markReviewed(serverId) {
    if (discordUser) return; // Supabase gère la déduplication
    try {
      const data = JSON.parse(localStorage.getItem('mc_reviewed') || '{}');
      data[serverId] = Date.now();
      localStorage.setItem('mc_reviewed', JSON.stringify(data));
    } catch { /* ignore */ }
  }

  /* ── Fetch des avis depuis Supabase ── */
  async function fetchReviews(serverId) {
    const url = SUPABASE_URL + '/rest/v1/reviews'
      + '?server_id=eq.' + encodeURIComponent(serverId)
      + '&order=created_at.desc&limit=50';

    const res = await fetch(url, { headers: SUPABASE_HEADERS });
    if (!res.ok) throw new Error('Erreur chargement avis (' + res.status + ')');
    return res.json(); // tableau d'avis
  }

  /* ── Envoi d'un avis vers Supabase ── */
  async function submitReview(serverId, pseudo, rating, text) {
    const payload = {
      server_id: serverId,
      pseudo: (pseudo || 'Anonyme').slice(0, 32).trim() || 'Anonyme',
      rating: rating,
      text: (text || '').slice(0, 280).trim(),
    };

    // Si l'utilisateur est connecté avec Discord, on enregistre son ID
    // et on utilise son nom comme pseudo par défaut
    if (discordUser) {
      payload.discord_user_id = discordUser.id;
      payload.pseudo = getDiscordDisplayName(discordUser).slice(0, 32);
    }

    const res = await fetch(SUPABASE_URL + '/rest/v1/reviews', {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Code 23505 = violation unicité (discord_user_id déjà présent pour ce serveur)
      if (err.code === '23505') throw new Error('already_reviewed');
      throw new Error(err.message || 'Erreur soumission');
    }
  }

  /* ── Helpers d'affichage ── */
  function buildStarsHtml(rating, total) {
    total = total || 5;
    let html = '';
    for (let i = 1; i <= total; i++) {
      html += '<span class="review-star' + (i <= rating ? ' filled' : '') + '">★</span>';
    }
    return html;
  }

  function buildAvgHtml(reviews) {
    if (!reviews.length) return '<span class="reviews-no-badge">Aucun avis</span>';
    const avg = (reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length).toFixed(1);
    return '<span class="reviews-avg-badge">★ ' + avg
      + ' <span class="reviews-count">(' + reviews.length + ' avis)</span></span>';
  }

  function buildReviewCardsHtml(reviews) {
    if (!reviews.length) {
      return '<p class="reviews-empty">Aucun avis pour l\'instant. Soyez le premier !</p>';
    }
    return reviews.map(function (r) {
      const discordBadge = r.discord_user_id
        ? '<span class="review-discord-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Discord</span>'
        : '';
      return '<div class="review-card">'
        + '<div class="review-header">'
        + '<span class="review-stars">' + buildStarsHtml(r.rating) + '</span>'
        + '<span class="review-pseudo">' + escapeHtml(r.pseudo || 'Anonyme') + '</span>'
        + discordBadge
        + '<span class="review-date">' + escapeHtml(r.date || new Date(r.created_at).toLocaleDateString('fr-FR')) + '</span>'
        + '</div>'
        + (r.text ? '<p class="review-text">' + escapeHtml(r.text) + '</p>' : '')
        + '</div>';
    }).join('');
  }

  /* ── Bind le sélecteur d'étoiles interactif ── */
  function bindStarPicker(picker) {
    if (!picker) return;
    const stars = picker.querySelectorAll('.star-pick');

    function refresh(selected, hovered) {
      stars.forEach(function (s) {
        const v = parseInt(s.dataset.val);
        s.classList.toggle('active', hovered ? v <= hovered : v <= selected);
      });
    }

    stars.forEach(function (star) {
      star.addEventListener('mouseenter', function () {
        refresh(parseInt(picker.dataset.selected || 0), parseInt(star.dataset.val));
      });
      star.addEventListener('mouseleave', function () {
        refresh(parseInt(picker.dataset.selected || 0), 0);
      });
      star.addEventListener('click', function () {
        picker.dataset.selected = star.dataset.val;
        refresh(parseInt(star.dataset.val), 0);
      });
    });
  }

  /* ── Rendu complet de la section avis ── */
  function renderReviewsSection(serverId) {
    const section = document.getElementById('modal-reviews-section');
    if (!section) return;

    const alreadyReviewed = hasRecentlyReviewed(serverId);

    // Formulaire ou invite selon l'état de connexion
    let formHtml;
    if (!discordUser) {
      // Non connecté : afficher une invite à se connecter
      formHtml = '<div class="review-discord-prompt">'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>'
        + '<span>Connectez-vous pour laisser un avis vérifié.</span>'
        + '<button type="button" class="btn-discord-inline" id="review-discord-login-btn">Se connecter</button>'
        + '</div>';
    } else if (alreadyReviewed) {
      formHtml = '<p class="review-already-done">✓ Vous avez déjà soumis un avis pour ce serveur récemment.</p>';
    } else {
      formHtml = '<div class="review-form" id="review-form-wrap">'
        + '<p class="review-form-title">Laisser un avis en tant que <strong style="color:var(--green-muted)">' + escapeHtml(getDiscordDisplayName(discordUser)) + '</strong></p>'
        + '<div class="review-form-fields">'
        + '<div class="review-form-row">'
        + '<div class="review-star-picker" data-selected="0">'
        + '<span class="review-star-picker-label">Note :</span>'
        + '<span class="star-pick" data-val="1">★</span>'
        + '<span class="star-pick" data-val="2">★</span>'
        + '<span class="star-pick" data-val="3">★</span>'
        + '<span class="star-pick" data-val="4">★</span>'
        + '<span class="star-pick" data-val="5">★</span>'
        + '</div>'
        + '</div>'
        + '<textarea class="review-input review-text-input" placeholder="Votre commentaire (optionnel)" maxlength="280" rows="2"></textarea>'
        + '<div class="review-form-footer">'
        + '<span class="review-char-count" id="review-char-count">0 / 280</span>'
        + '<button type="button" class="btn btn-primary review-submit-btn">Publier</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    // Structure initiale avec spinner dans la liste
    section.innerHTML =
      '<div class="reviews-divider"></div>'
      + '<div class="reviews-header">'
      + '<h3 class="reviews-title">⭐ Avis de la communauté</h3>'
      + '<div class="reviews-header-right">'
      + '<span class="reviews-avg-wrap"><span class="reviews-no-badge">Chargement…</span></span>'
      + '<select class="reviews-sort-select" id="reviews-sort-select" aria-label="Trier les avis">'
      + '<option value="recent">Plus récents</option>'
      + '<option value="desc">Note ↓</option>'
      + '<option value="asc">Note ↑</option>'
      + '</select>'
      + '</div>'
      + '</div>'
      + '<div class="reviews-list" id="reviews-list-inner">'
      + '<div class="reviews-spinner"><div class="spinner"></div></div>'
      + '</div>'
      + formHtml;

    // Bind bouton connexion dans la section avis
    const reviewLoginBtn = section.querySelector('#review-discord-login-btn');
    if (reviewLoginBtn) {
      reviewLoginBtn.addEventListener('click', startDiscordLogin);
    }

    // Bind picker étoiles
    bindStarPicker(section.querySelector('.review-star-picker'));

    // Compteur de caractères
    const textarea = section.querySelector('.review-text-input');
    const charCount = section.querySelector('#review-char-count');
    if (textarea && charCount) {
      textarea.addEventListener('input', function () {
        charCount.textContent = textarea.value.length + ' / 280';
      });
    }

    // Bind soumission
    const submitBtn = section.querySelector('.review-submit-btn');
    const picker = section.querySelector('.review-star-picker');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        const rating = picker ? parseInt(picker.dataset.selected || 0) : 0;
        if (!rating) {
          if (picker) {
            picker.classList.add('shake');
            setTimeout(function () { picker.classList.remove('shake'); }, 450);
          }
          return;
        }

        const pseudo = discordUser ? getDiscordDisplayName(discordUser) : '';
        const text = textarea ? textarea.value.trim() : '';

        submitBtn.disabled = true;
        submitBtn.textContent = '…';

        submitReview(serverId, pseudo, rating, text)
          .then(function () {
            markReviewed(serverId);
            // Remplacer le form par un message de confirmation
            const form = document.getElementById('review-form-wrap');
            if (form) {
              form.innerHTML = '<p class="review-success-msg">✓ Avis publié — merci !</p>';
            }
            // Recharger la liste des avis
            return fetchReviews(serverId);
          })
          .then(function (reviews) {
            refreshReviewsList(reviews, section);
          })
          .catch(function (err) {
            console.error(err);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publier';
            const msg = err.message === 'already_reviewed'
              ? 'Vous avez déjà laissé un avis pour ce serveur.'
              : 'Erreur : ' + escapeHtml(err.message);
            submitBtn.insertAdjacentHTML('afterend',
              '<p class="review-error-msg">' + msg + '</p>');
          });
      });
    }

    // Charger les avis
    fetchReviews(serverId)
      .then(function (reviews) {
        refreshReviewsList(reviews, section);

        // Bind le sélecteur de tri
        const sortSelect = section.querySelector('#reviews-sort-select');
        if (sortSelect) {
          sortSelect.addEventListener('change', function () {
            refreshReviewsList(reviews, section);
          });
        }
      })
      .catch(function () {
        const list = document.getElementById('reviews-list-inner');
        if (list) list.innerHTML = '<p class="reviews-empty">Impossible de charger les avis.</p>';
      });
  }

  function sortReviews(reviews, mode) {
    const sorted = reviews.slice();
    if (mode === 'desc') {
      sorted.sort(function (a, b) { return b.rating - a.rating; });
    } else if (mode === 'asc') {
      sorted.sort(function (a, b) { return a.rating - b.rating; });
    }
    // 'recent' → ordre Supabase (created_at desc), déjà trié
    return sorted;
  }

  function refreshReviewsList(reviews, section) {
    const sortSelect = section.querySelector('#reviews-sort-select');
    const mode = sortSelect ? sortSelect.value : 'recent';
    const sorted = sortReviews(reviews, mode);

    const list = document.getElementById('reviews-list-inner');
    if (list) list.innerHTML = buildReviewCardsHtml(sorted);
    const avgWrap = section.querySelector('.reviews-avg-wrap');
    if (avgWrap) avgWrap.innerHTML = buildAvgHtml(reviews); // avg toujours sur tous les avis
  }

  /* ── Pop-up "Rejoindre" ── */
  const serverModal = document.getElementById('server-modal');
  const modalServerName = document.getElementById('modal-server-name');
  const modalCode = document.getElementById('modal-code');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCloseBtn2 = document.getElementById('modal-close-btn-2');
  let modalCopyResetTimer = null;

  // Centralise l'ajout/retrait de la classe modal-open : plusieurs pop-up
  // peuvent exister (détails serveur, liste des joueurs), on ne retire la
  // classe que si aucune n'est ouverte.
  function syncModalOpenState() {
    const serverModalOpen = !!(serverModal && !serverModal.hidden);
    const playersModalOpen = !!(playersModal && !playersModal.hidden);
    document.body.classList.toggle('modal-open', serverModalOpen || playersModalOpen);
  }

  // Fonction pour ouvrir le modal détaillé du serveur
  function openServerDetailsModal(server) {
    if (!serverModal) return;

    const name = server.server_name || 'Serveur sans nom';
    const description = server.description || 'Aucune description disponible.';
    const code = server.server_id || '';
    const players = server.online ? (server.connected_players || 0) : 0;
    const maxPlayers = server.max_players != null ? server.max_players : '?';
    const onlineStatus = server.online ? '🟢 En ligne' : '🔴 Hors ligne';
    const version = server.version || 'Inconnue';
    const ip = server.ip || 'Non disponible';
    const port = server.port || 'Non disponible';
    const url = server.url || null;
    const adminName = server.admin_name || 'Non spécifié';
    const country = getServerCountry(server);
    const location = extractServerLocation(server) || country;

    if (modalServerName) modalServerName.textContent = name;
    if (modalCode) modalCode.textContent = code;

    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="modal-details">
            <div class="modal-status ${server.online ? 'online' : 'offline'}">
                <span class="status-dot"></span>
                ${onlineStatus}
            </div>
            <div class="modal-description">
                <h3>Description</h3>
                <p>${escapeHtml(description)}</p>
            </div>
            <div class="modal-info-grid">
                <div class="modal-info-item">
                    <span class="modal-info-label">👥 Joueurs</span>
                    <span class="modal-info-value">${players} / ${maxPlayers}</span>
                </div>
                <div class="modal-info-item">
                    <span class="modal-info-label">👑 Administrateur</span>
                    <span class="modal-info-value">${escapeHtml(adminName)}</span>
                </div>
                <div class="modal-info-item">
                    <span class="modal-info-label">📍 Localisation</span>
                    <span class="modal-info-value">${escapeHtml(location)}</span>
                </div>
            </div>
            ${url ? `<div class="modal-discord-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-discord">Rejoindre Discord</a></div>` : ''}
        </div>
      `;
    }

    serverModal.hidden = false;
    syncModalOpenState();

    // Charger les avis pour ce serveur
    renderReviewsSection(code);

    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
      shareBtn.onclick = function () {
        // Le lien pointe vers la page serveurs avec le paramètre server
        const shareUrl = window.location.origin + window.location.pathname + '#serveurs?server=' + encodeURIComponent(code);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            shareBtn.textContent = '✅ Lien copié !';
            setTimeout(function () { shareBtn.textContent = '🔗 Partager'; }, 2000);
          }).catch(function () {
            fallbackCopyText(shareUrl);
            shareBtn.textContent = '✅ Lien copié !';
            setTimeout(function () { shareBtn.textContent = '🔗 Partager'; }, 2000);
          });
        } else {
          fallbackCopyText(shareUrl);
          shareBtn.textContent = '✅ Lien copié !';
          setTimeout(function () { shareBtn.textContent = '🔗 Partager'; }, 2000);
        }
      };
    }

    const modalEyebrow = document.querySelector('.modal-eyebrow');
    if (modalEyebrow) modalEyebrow.textContent = 'Informations du serveur';
  }

  // Gestion du paramètre ?server= dans l'URL
  function handleServerShare() {
    // Récupérer le paramètre server depuis l'URL complète (hash ou search)
    let serverId = null;

    // Vérifier d'abord dans le hash (ex: #serveurs?server=xxx)
    const hash = window.location.hash;
    if (hash && hash.includes('?server=')) {
      const hashParts = hash.split('?');
      if (hashParts.length > 1) {
        const params = new URLSearchParams(hashParts[1]);
        serverId = params.get('server');
      }
    }

    // Si pas trouvé dans le hash, vérifier dans le search
    if (!serverId) {
      const params = new URLSearchParams(window.location.search);
      serverId = params.get('server');
    }

    if (serverId && allServers.length > 0) {
      const server = allServers.find(function (s) {
        return s.server_id === serverId;
      });
      if (server) {
        // S'assurer qu'on est sur la page serveurs
        if (!document.getElementById('page-serveurs').classList.contains('active')) {
          navigateTo('serveurs');
        }
        setTimeout(function () {
          openServerDetailsModal(server);
        }, 300);
      }
    }
  }

  function openServerModal(name, code) {
    if (!serverModal) return;
    if (modalServerName) modalServerName.textContent = name || 'Serveur';
    if (modalCode) modalCode.textContent = code || '—';
    if (modalCopyBtn) modalCopyBtn.textContent = 'Copier';
    serverModal.hidden = false;
    syncModalOpenState();
  }

  function closeServerModal() {
    if (!serverModal) return;
    serverModal.hidden = true;
    syncModalOpenState();
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', function () {
      const code = modalCode ? modalCode.textContent : '';
      if (!code) return;

      function showCopied() {
        modalCopyBtn.textContent = 'Copié ✓';
        clearTimeout(modalCopyResetTimer);
        modalCopyResetTimer = setTimeout(function () { modalCopyBtn.textContent = 'Copier'; }, 1600);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(showCopied).catch(function () {
          fallbackCopyText(code);
          showCopied();
        });
      } else {
        fallbackCopyText(code);
        showCopied();
      }
    });
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeServerModal);
  if (modalCloseBtn2) modalCloseBtn2.addEventListener('click', closeServerModal);
  if (serverModal) {
    serverModal.addEventListener('click', function (e) {
      if (e.target === serverModal) closeServerModal();
    });
  }

  /* ── Pop-up "Liste des joueurs" ── */
  const PLAYERS_API_URL = 'goozkziidiwjjabnzbej.creatif-france.workers.dev';

  const playersModal = document.getElementById('players-modal');
  const playersModalTitle = document.getElementById('players-modal-title');
  const playersModalCount = document.getElementById('players-modal-count');
  const playersListContainer = document.getElementById('players-list-container');
  const playersSearchInput = document.getElementById('players-search-input');
  const playersModalCloseBtn = document.getElementById('players-modal-close-btn');
  const playersModalCloseBtn2 = document.getElementById('players-modal-close-btn-2');

  let currentPlayersList = [];
  let playersFetchAbortController = null;

  function genderIcon(gender) {
    switch (gender) {
      case 'staff': return '🛡️';
      case 'admin': return '👑';
      case 'female': return '♀️';
      case 'male': return '♂️';
      default: return '👤';
    }
  }

  /* Le jeu MultiCraft encode les couleurs/badges des pseudos avec des
     séquences d'échappement façon "code couleur Minecraft" :
       \u001b(c@COULEUR)   -> change la couleur du texte qui suit (nom CSS ou hex)
       \u001b(T@NOM)       -> ouvre un badge spécial (ex: badge "[S]" staff)
       \u001bE             -> ferme le badge spécial ouvert juste avant
     Tout le reste (emoji, espaces, texte brut) est affiché tel quel.
     Cette fonction reconstruit le pseudo en HTML, en échappant chaque
     fragment de texte individuellement (jamais de HTML brut injecté). */
  function renderPlayerTagHtml(tag, fallbackName) {
    if (!tag) {
      return '<span class="player-name">' + escapeHtml(fallbackName || '') + '</span>';
    }

    const ESC = '\u001b';
    let out = '';
    let currentColor = null;
    let inBadge = false;
    let buffer = '';
    let badgeBuffer = '';
    let i = 0;

    function colorSpan(text) {
      if (!text) return '';
      const style = currentColor ? ' style="color:' + escapeHtml(currentColor) + '"' : '';
      return '<span' + style + '>' + escapeHtml(text) + '</span>';
    }

    function flushBuffer() {
      if (buffer) {
        out += colorSpan(buffer);
        buffer = '';
      }
    }

    while (i < tag.length) {
      const ch = tag[i];

      if (ch === ESC) {
        const next = tag[i + 1];

        if (next === '(') {
          const closeIdx = tag.indexOf(')', i + 2);
          if (closeIdx === -1) { i += 1; continue; }
          const code = tag.slice(i + 2, closeIdx);
          const atIdx = code.indexOf('@');
          const key = atIdx === -1 ? code : code.slice(0, atIdx);
          const value = atIdx === -1 ? '' : code.slice(atIdx + 1);

          if (key === 'c') {
            flushBuffer();
            currentColor = value || null;
          } else if (key === 'T') {
            flushBuffer();
            inBadge = true;
            badgeBuffer = '';
          }
          // Autres clés inconnues : ignorées silencieusement

          i = closeIdx + 1;
          continue;
        }

        if (next === 'E') {
          if (inBadge) {
            const style = currentColor
              ? ' style="border-color:' + escapeHtml(currentColor) + ';color:' + escapeHtml(currentColor) + '"'
              : '';
            out += '<span class="player-badge"' + style + '>' + escapeHtml(badgeBuffer) + '</span>';
            inBadge = false;
            badgeBuffer = '';
          }
          i += 2;
          continue;
        }

        // Code inconnu : on ignore simplement le caractère d'échappement
        i += 1;
        continue;
      }

      if (inBadge) {
        badgeBuffer += ch;
      } else {
        buffer += ch;
      }
      i += 1;
    }

    flushBuffer();
    if (inBadge && badgeBuffer) out += colorSpan(badgeBuffer);

    return '<span class="player-name">' + out + '</span>';
  }

  function renderPlayersList(players, query) {
    if (!playersListContainer) return;

    if (!players.length) {
      playersListContainer.innerHTML = '<div class="empty-state"><p>Aucun joueur en ligne pour le moment.</p></div>';
      return;
    }

    const q = (query || '').trim().toLowerCase();
    const list = q
      ? players.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1; })
      : players;

    if (!list.length) {
      playersListContainer.innerHTML = '<div class="empty-state"><p>Aucun joueur ne correspond à votre recherche.</p></div>';
      return;
    }

    playersListContainer.innerHTML = list.map(function (p) {
      const icon = genderIcon(p.gender);
      const nameHtml = renderPlayerTagHtml(p.tag, p.name);
      return '<div class="player-row"><span class="player-icon" aria-hidden="true">' + icon + '</span>' + nameHtml + '</div>';
    }).join('');
  }

  function openPlayersModal(server) {
    if (!playersModal) return;

    const name = server.server_name || 'Serveur';
    const serverId = server.server_id || '';

    if (playersModalTitle) playersModalTitle.textContent = name;
    if (playersSearchInput) playersSearchInput.value = '';
    currentPlayersList = [];

    if (playersModalCount) playersModalCount.textContent = '';
    if (playersListContainer) {
      playersListContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Chargement des joueurs…</p></div>';
    }

    playersModal.hidden = false;
    syncModalOpenState();

    if (!serverId) {
      playersListContainer.innerHTML = '<div class="error-state"><p>Code d\'invitation introuvable pour ce serveur.</p></div>';
      return;
    }

    if (playersFetchAbortController) playersFetchAbortController.abort();
    playersFetchAbortController = new AbortController();

    fetch(PLAYERS_API_URL + '?server_id=' + encodeURIComponent(serverId), { signal: playersFetchAbortController.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('Réponse API invalide (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        const players = Array.isArray(data.players) ? data.players : [];
        const max = data.max_players != null
          ? data.max_players
          : (server.max_players != null ? server.max_players : '?');

        currentPlayersList = players;

        if (playersModalCount) {
          playersModalCount.textContent = players.length + ' / ' + max + ' joueur' + (max === 1 ? '' : 's') + ' en ligne';
        }

        renderPlayersList(players, playersSearchInput ? playersSearchInput.value : '');
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        console.error(err);
        if (playersListContainer) {
          playersListContainer.innerHTML =
            '<div class="error-state"><p>Impossible de charger la liste des joueurs.</p>' +
            '<p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">Vérifiez votre connexion et réessayez dans un instant.</p></div>';
        }
      });
  }

  function closePlayersModal() {
    if (!playersModal) return;
    playersModal.hidden = true;
    syncModalOpenState();
    if (playersFetchAbortController) playersFetchAbortController.abort();
  }

  if (playersSearchInput) {
    playersSearchInput.addEventListener('input', function () {
      renderPlayersList(currentPlayersList, playersSearchInput.value);
    });
  }

  if (playersModalCloseBtn) playersModalCloseBtn.addEventListener('click', closePlayersModal);
  if (playersModalCloseBtn2) playersModalCloseBtn2.addEventListener('click', closePlayersModal);
  if (playersModal) {
    playersModal.addEventListener('click', function (e) {
      if (e.target === playersModal) closePlayersModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (playersModal && !playersModal.hidden) { closePlayersModal(); return; }
    if (serverModal && !serverModal.hidden) closeServerModal();
  });

  /* ── Init ── */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
  initCursorHalo();
  initDiscordAuth();
  handleRoute();

  if (location.hash === '#mises-a-jour') loadUpdates();
  if (location.hash === '#info-du-jeu') renderDatacenters();
  if (location.hash === '#serveurs') loadServers();

  // Vérifier aussi si on arrive avec un paramètre server dans l'URL
  // (même si on est sur une autre page, on va charger les serveurs et ouvrir le modal)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (urlParams.get('server') || hashParams.get('server')) {
    if (!document.getElementById('page-serveurs').classList.contains('active')) {
      // On charge les serveurs et on gère le partage
      if (!serversLoaded) {
        loadServers();
      } else {
        handleServerShare();
      }
    }
  }
})();
