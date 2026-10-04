/* ── MultiCraft Info — apparence et thème ───────────────────────────────────
   Trois réglages, tous mémorisés sur l'appareil (localStorage) :

     mc_theme     normal | material   habillage général du site
     mc_scheme    auto | light | dark | amoled   fond du thème Material
     mc_accent    couleur d'accent (une des ACCENTS ci-dessous)

   Le fond « auto » suit la préférence système (prefers-color-scheme).
   La couleur d'accent n'est pas une teinte appliquée à la main : elle est
   transformée en véritable palette tonale Material 3 par
   @material/material-color-utilities — la librairie officielle utilisée par
   Material Web — puis injectée sous forme de variables CSS `--md-sys-color-*`
   que material.css consomme. C'est ce qui manquait pour que le thème rende
   vraiment « Material ».

   Le résultat est mis en cache (mc_theme_tokens) et réinjecté par le script
   inline de <head> : aucun flash de palette au chargement suivant.

   Repli si le module n'arrive pas à charger (CDN bloqué, hors ligne) :
   material.css contient une palette Material statique par fond, le site
   reste utilisable.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const THEME_STORAGE_KEY = 'mc_theme';
  const SCHEME_STORAGE_KEY = 'mc_scheme';
  const ACCENT_STORAGE_KEY = 'mc_accent';
  const TOKENS_STORAGE_KEY = 'mc_theme_tokens';

  const THEME_CLASS = 'theme-material';
  const THEMES = ['normal', 'material'];
  const SCHEMES = ['auto', 'light', 'dark', 'amoled'];

  // Couleurs d'accent : la graine envoyée à la librairie Material.
  const ACCENTS = [
    { id: 'green',  hex: '#22c55e' },
    { id: 'teal',   hex: '#14b8a6' },
    { id: 'blue',   hex: '#3b82f6' },
    { id: 'violet', hex: '#8b5cf6' },
    { id: 'pink',   hex: '#ec4899' },
    { id: 'red',    hex: '#ef4444' },
    { id: 'orange', hex: '#f97316' },
    { id: 'amber',  hex: '#eab308' }
  ];

  // Rôles Material copiés dans --md-sys-color-*. Les tonalités (tones) sont
  // imposées par la librairie : ne pas les fixer ici.
  const COLOR_ROLES = [
    'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
    'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
    'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
    'error', 'onError', 'errorContainer', 'onErrorContainer',
    'background', 'onBackground',
    'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
    'surfaceDim', 'surfaceBright',
    'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
    'surfaceContainerHigh', 'surfaceContainerHighest',
    'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface',
    'scrim', 'shadow', 'surfaceTint'
  ];

  // Sur fond AMOLED, les surfaces passent en noir pur : la palette d'accent,
  // elle, reste celle calculée par la librairie.
  const AMOLED_SURFACES = {
    background: '#000000',
    surface: '#000000',
    surfaceDim: '#000000',
    surfaceContainerLowest: '#000000',
    surfaceContainerLow: '#070707',
    surfaceContainer: '#0d0d0d',
    surfaceContainerHigh: '#141414',
    surfaceContainerHighest: '#1c1c1c',
    surfaceBright: '#1c1c1c',
    onBackground: '#e6e6e6',
    onSurface: '#e6e6e6',
    onSurfaceVariant: '#a3a3a3',
    surfaceVariant: '#1c1c1c',
    outline: '#7a7a7a',
    outlineVariant: '#2c2c2c'
  };

  const COLOR_LIB_BASE = 'https://esm.run/@material/material-color-utilities@0.4.0/';

  const doc = document;
  const root = doc.documentElement;

  /* ── Lecture / écriture des réglages ────────────────────────────────────── */

  function read(key, allowed, fallback) {
    try {
      const value = localStorage.getItem(key);
      return allowed.indexOf(value) !== -1 ? value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Stockage indisponible (navigation privée) : le réglage s'applique
      // pour la session en cours uniquement.
    }
  }

  function getAccent(id) {
    for (let i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].id === id) return ACCENTS[i];
    }
    return ACCENTS[0];
  }

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // 'auto' est résolu ici : la palette doit savoir s'il faut les tons clairs
  // (0-40) ou sombres (80-90) de Material.
  function resolveScheme(scheme) {
    if (scheme !== 'auto') return scheme;
    return prefersDark() ? 'dark' : 'light';
  }

  /* ── Palette Material 3 calculée par la librairie ───────────────────────── */

  let colorLibPromise = null;

  function loadColorLib() {
    if (!colorLibPromise) {
      colorLibPromise = Promise.all([
        import(COLOR_LIB_BASE + 'hct/hct.js'),
        import(COLOR_LIB_BASE + 'scheme/scheme_tonal_spot.js')
      ]).then(function (modules) {
        return { Hct: modules[0].Hct, SchemeTonalSpot: modules[1].SchemeTonalSpot };
      });
    }
    return colorLibPromise;
  }

  function argbToHex(argb) {
    return '#' + ('000000' + (argb >>> 0 & 0xffffff).toString(16)).slice(-6);
  }

  function hexToArgb(hex) {
    return parseInt(hex.replace('#', ''), 16) | 0xff000000;
  }

  function buildPalette(accentHex, scheme) {
    return loadColorLib().then(function (lib) {
      const isDark = scheme !== 'light';
      const seed = lib.Hct.fromInt(hexToArgb(accentHex));
      const m3 = new lib.SchemeTonalSpot(seed, isDark, 0);
      const palette = {};

      COLOR_ROLES.forEach(function (role) {
        let value;
        try {
          value = m3[role];
        } catch (e) {
          // Rôle absent de cette version de la spec : on l'ignore, le repli
          // correspondant de material.css prend le relais.
          return;
        }
        if (typeof value === 'number') palette[role] = argbToHex(value);
      });

      if (scheme === 'amoled') {
        Object.keys(AMOLED_SURFACES).forEach(function (role) {
          palette[role] = AMOLED_SURFACES[role];
        });
      }
      return palette;
    });
  }

  // 'primaryContainer' → '--md-sys-color-primary-container'
  function toCssVar(role) {
    return '--md-sys-color-' + role.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
  }

  /* La palette est posée en styles inline sur <html> : ces déclarations
     l'emportent sur n'importe quelle règle de feuille de style (les replis
     statiques de material.css), quel que soit l'ordre de chargement. */
  function applyPalette(colors) {
    Object.keys(colors).forEach(function (role) {
      root.style.setProperty(toCssVar(role), colors[role]);
    });
  }

  // Retire les tokens posés en inline (retour au thème « Normal »).
  function clearPalette() {
    COLOR_ROLES.forEach(function (role) { root.style.removeProperty(toCssVar(role)); });
  }

  // Applique la palette correspondant à l'accent et au fond choisis.
  function refreshPalette() {
    const scheme = resolveScheme(read(SCHEME_STORAGE_KEY, SCHEMES, 'auto'));
    const accent = getAccent(read(ACCENT_STORAGE_KEY, ACCENTS.map(function (a) { return a.id; }), 'green'));
    const cacheKey = accent.id + '|' + scheme;
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(TOKENS_STORAGE_KEY) || 'null');
    } catch (e) { cached = null; }

    if (cached && cached.key === cacheKey && cached.colors) {
      applyPalette(cached.colors);
      return Promise.resolve();
    }

    return buildPalette(accent.hex, scheme).then(function (palette) {
      applyPalette(palette);
      write(TOKENS_STORAGE_KEY, JSON.stringify({ key: cacheKey, colors: palette }));
    }).catch(function () {
      // CDN injoignable : material.css garde la palette Material statique.
    });
  }

  /* ── Application des réglages ───────────────────────────────────────────── */

  function applyTheme(theme) {
    root.classList.toggle(THEME_CLASS, theme === 'material');
    syncChoices();
    if (theme === 'material') refreshPalette();
    else clearPalette();
  }

  function setTheme(theme) {
    write(THEME_STORAGE_KEY, THEMES.indexOf(theme) !== -1 ? theme : 'normal');
    applyTheme(theme);
  }

  function setScheme(scheme) {
    write(SCHEME_STORAGE_KEY, SCHEMES.indexOf(scheme) !== -1 ? scheme : 'auto');
    root.setAttribute('data-scheme', read(SCHEME_STORAGE_KEY, SCHEMES, 'auto'));
    syncChoices();
    if (root.classList.contains(THEME_CLASS)) refreshPalette();
  }

  function setAccent(id) {
    const accent = getAccent(id);
    write(ACCENT_STORAGE_KEY, accent.id);
    syncChoices();
    if (root.classList.contains(THEME_CLASS)) refreshPalette();
  }

  // Coche les options correspondant aux réglages enregistrés.
  function syncChoices() {
    const theme = read(THEME_STORAGE_KEY, THEMES, 'normal');
    const scheme = read(SCHEME_STORAGE_KEY, SCHEMES, 'auto');
    const accent = read(ACCENT_STORAGE_KEY, ACCENTS.map(function (a) { return a.id; }), 'green');
    Array.prototype.forEach.call(doc.querySelectorAll('[data-theme-choice]'), function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-theme-choice') === theme ? 'true' : 'false');
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-scheme-choice]'), function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-scheme-choice') === scheme ? 'true' : 'false');
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-accent-choice]'), function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-accent-choice') === accent ? 'true' : 'false');
    });
  }

  /* ── Menu Paramètres ────────────────────────────────────────────────────── */

  const switcher = doc.getElementById('settings-switcher');
  const toggleBtn = doc.getElementById('settings-toggle');

  function setMenuOpen(open) {
    if (!switcher) return;
    switcher.classList.toggle('open', open);
    const header = doc.querySelector('.site-header');
    if (header) header.classList.toggle('settings-menu-open', open);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      setMenuOpen(!switcher.classList.contains('open'));
    });
  }

  doc.addEventListener('click', function (event) {
    if (!switcher) return;
    if (!switcher.contains(event.target)) setMenuOpen(false);

    // Les trois réglages sont portée par des attributs data-* : le clic est
    // délégué sur ces attributs (les pastilles de couleur et les chips de fond
    // ne partagent pas la classe .settings-item).
    const target = event.target;
    if (!target.closest) return;
    if (target.closest('[data-theme-choice]')) {
      setTheme(target.closest('[data-theme-choice]').getAttribute('data-theme-choice'));
    } else if (target.closest('[data-scheme-choice]')) {
      setScheme(target.closest('[data-scheme-choice]').getAttribute('data-scheme-choice'));
    } else if (target.closest('[data-accent-choice]')) {
      setAccent(target.closest('[data-accent-choice]').getAttribute('data-accent-choice'));
    }
  });

  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && switcher && switcher.classList.contains('open')) {
      setMenuOpen(false);
      if (toggleBtn) toggleBtn.focus();
    }
  });

  /* ── Onde Material (ripple) ────────────────────────────────────────────── */

  const RIPPLE_SELECTOR = [
    '.btn', '.nav-link', '.home-card', '.server-card', '.update-post',
    '.download-card', '.info-card', '.settings-item', '.lang-item',
    '.chat-bubble', '.scroll-top-btn'
  ].join(',');
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function spawnRipple(host, x, y) {
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const wave = doc.createElement('span');
    wave.className = 'm3-ripple-wave';
    wave.style.left = (x - rect.left) + 'px';
    wave.style.top = (y - rect.top) + 'px';
    wave.style.width = size + 'px';
    wave.style.height = size + 'px';
    wave.style.marginLeft = (-size / 2) + 'px';
    wave.style.marginTop = (-size / 2) + 'px';
    host.appendChild(wave);
    window.setTimeout(function () { wave.remove(); }, 600);
  }

  doc.addEventListener('pointerdown', function (event) {
    if (!root.classList.contains(THEME_CLASS)) return;
    if (reduceMotion && reduceMotion.matches) return;
    const host = event.target.closest && event.target.closest(RIPPLE_SELECTOR);
    if (!host) return;
    // Pas d'onde sur les liens de navigation : ils ne déclenchent pas d'action.
    if (host.tagName === 'A' && !host.classList.contains('home-card')) return;
    spawnRipple(host, event.clientX, event.clientY);
  }, { passive: true });

  /* ── Démarrage ─────────────────────────────────────────────────────────── */

  root.setAttribute('data-scheme', read(SCHEME_STORAGE_KEY, SCHEMES, 'auto'));
  applyTheme(read(THEME_STORAGE_KEY, THEMES, 'normal'));

  // Le fond « auto » suit le système tant que la page est ouverte.
  if (window.matchMedia) {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = function () {
      if (read(SCHEME_STORAGE_KEY, SCHEMES, 'auto') !== 'auto') return;
      if (!root.classList.contains(THEME_CLASS)) return;
      refreshPalette();
    };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemChange);
  }

  // API pour le reste du site (ou la console) :
  //   Theme.set('material'), Theme.setScheme('amoled'), Theme.setAccent('violet')
  window.Theme = {
    get: function () { return read(THEME_STORAGE_KEY, THEMES, 'normal'); },
    set: setTheme,
    getScheme: function () { return read(SCHEME_STORAGE_KEY, SCHEMES, 'auto'); },
    setScheme: setScheme,
    getAccent: function () { return read(ACCENT_STORAGE_KEY, ACCENTS.map(function (a) { return a.id; }), 'green'); },
    setAccent: setAccent,
    THEMES: THEMES.slice(),
    SCHEMES: SCHEMES.slice(),
    ACCENTS: ACCENTS.slice()
  };
})();