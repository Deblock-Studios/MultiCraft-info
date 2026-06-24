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

    Object.values(pages).forEach(function(p) {
      if (p) p.classList.remove('active');
    });
    if (pages[pageId]) pages[pageId].classList.add('active');

    document.querySelectorAll('.nav-link').forEach(function(link) {
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

  navLinks.forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      const page = el.dataset.nav;
      location.hash = page;
    });
  });

  window.addEventListener('hashchange', handleRoute);

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function() {
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
    match[1].split('\n').forEach(function(line) {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val
          .slice(1, -1)
          .split(',')
          .map(function(s) { return s.trim().replace(/^["']|["']$/g, ''); })
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
        folders.map(async function(folder) {
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

      const valid = posts.filter(function(p) { return p !== null; })
        .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

      if (valid.length === 0) {
        updatesContainer.innerHTML = '<div class="empty-state"><p>Aucune mise à jour pour le moment.</p></div>';
      } else {
        updatesContainer.innerHTML = valid.map(renderUpdatePost).join('');
        bindLightbox();
      }

      updatesLoaded = true;
    } catch (err) {
      console.error(err);
      updatesContainer.innerHTML = '<div class="error-state"><p>Impossible de charger les mises à jour.</p><p style="margin-top:0.5rem;font-size:0.85rem;color\:var(--text-dim)">Servez le site via un serveur local (ex. <code>python -m http.server</code>).</p></div>';
    }
  }

  function renderUpdatePost(post) {
    if (!post) return '';
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
      imagesHtml = '<div class="update-images">' + post.images.map(function(img) {
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
    updatesContainer.querySelectorAll('.update-images img').forEach(function(img) {
      img.addEventListener('click', function() {
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.innerHTML = '<img src="' + img.src + '" alt="' + (img.alt || '') + '">';
        lb.addEventListener('click', function() { lb.remove(); });
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
  const SERVERS_API_URL = 'https://multicraft-api.creatif-france.workers.dev';

  let serversLoaded = false;
  let allServers = [];
  const serversContainer = document.getElementById('servers-container');
  const serverSearchInput = document.getElementById('server-search');
  const serversCountEl = document.getElementById('servers-count');

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
      Object.keys(node).forEach(function(key) { walk(node[key]); });
    }

    walk(data);

    return Array.from(found.values()).sort(function(a, b) {
      const aOnline = a.online ? 1 : 0;
      const bOnline = b.online ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return (b.connected_players || 0) - (a.connected_players || 0);
    });
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

    const discordBtn = server.url
      ? '<a href="' + escapeHtml(server.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-discord">Discord</a>'
      : '';

    return (
      '<article class="server-card">' +
        '<div class="server-card-head">' +
          '<h2 class="server-name">' + name + '</h2>' +
          '<span class="server-players' + (online ? '' : ' offline') + '"><span class="dot"></span>' + players + '</span>' +
        '</div>' +
        '<p class="server-desc">' + description + '</p>' +
        '<div class="server-actions">' +
          discordBtn +
          '<button type="button" class="btn btn-primary btn-join" data-name="' + name + '" data-code="' + code + '">Rejoindre</button>' +
        '</div>' +
      '</article>'
    );
  }

  function bindServerCardActions() {
    if (!serversContainer) return;
    serversContainer.querySelectorAll('.btn-join').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openServerModal(btn.dataset.name, btn.dataset.code);
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
    if (!q) return allServers;
    return allServers.filter(function(s) {
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
      renderServers(filterServers(serverSearchInput ? serverSearchInput.value : ''));
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
    serverSearchInput.addEventListener('input', function() {
      if (!serversLoaded) return;
      renderServers(filterServers(serverSearchInput.value));
    });
  }

  /* ── Pop-up "Rejoindre" ── */
  const serverModal = document.getElementById('server-modal');
  const modalServerName = document.getElementById('modal-server-name');
  const modalCode = document.getElementById('modal-code');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCloseBtn2 = document.getElementById('modal-close-btn-2');
  let modalCopyResetTimer = null;

  function openServerModal(name, code) {
    if (!serverModal) return;
    if (modalServerName) modalServerName.textContent = name || 'Serveur';
    if (modalCode) modalCode.textContent = code || '—';
    if (modalCopyBtn) modalCopyBtn.textContent = 'Copier';
    serverModal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeServerModal() {
    if (!serverModal) return;
    serverModal.hidden = true;
    document.body.classList.remove('modal-open');
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
    modalCopyBtn.addEventListener('click', function() {
      const code = modalCode ? modalCode.textContent : '';
      if (!code) return;

      function showCopied() {
        modalCopyBtn.textContent = 'Copié ✓';
        clearTimeout(modalCopyResetTimer);
        modalCopyResetTimer = setTimeout(function() { modalCopyBtn.textContent = 'Copier'; }, 1600);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(showCopied).catch(function() {
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
    serverModal.addEventListener('click', function(e) {
      if (e.target === serverModal) closeServerModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && serverModal && !serverModal.hidden) closeServerModal();
  });

  /* ── Init ── */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
  initCursorHalo();
  handleRoute();

  if (location.hash === '#mises-a-jour') loadUpdates();
  if (location.hash === '#info-du-jeu') renderDatacenters();
  if (location.hash === '#serveurs') loadServers();
})();
