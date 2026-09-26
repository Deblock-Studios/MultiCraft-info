/* ── MultiCraft Info — moteur i18n ──
   Les traductions ne sont PAS dans ce fichier : elles sont dans /locales/<code>.json
   (une entrée par clé ; les valeurs peuvent être des objets, ex. « gameInfo.locations »).

   HTML (appliqué automatiquement au chargement et à chaque changement de langue) :
     <h1 data-i18n="home.title">…</h1>                     → texte
     <h1 data-i18n-html="home.title">…</h1>                → texte contenant du HTML
     <input data-i18n-placeholder="servers.searchPlaceholder">
     <button data-i18n-title="ui.example">                 → attribut title
     <button data-i18n-aria-label="modal.close">           → attribut aria-label
     <meta data-i18n-content="meta.description">           → attribut content

   JavaScript :
     t('servers.count1')                          → « serveur »
     t('modal.playerOnlineN', { count: 12 })      → remplace {count} dans la traduction
     i18n.loc('Singapour')                 → traduit un lieu (gameInfo.locations)
     i18n.ready.then(…)                    → traductions de la langue courante chargées
     i18n.apply()                          → ré-applique les traductions au DOM

   Comportement si une clé n'existe pas : console.warn + la clé est renvoyée telle
   quelle (l'élément HTML concerné garde son contenu d'origine). Le script
   `node scripts/check-i18n.js` détecte les clés manquantes avant la mise en ligne.*/
(function () {
  'use strict';

  /* ── Langues disponibles ─────────────────────────────────────────────────────
     C'est la SEULE liste à modifier pour ajouter une langue :
       1. créer locales/<code>.json (copier en.json et traduire les valeurs)
       2. ajouter une ligne ici.

     code    : code ISO à deux ou trois lettres (aussi utilisé comme préfixe
               d'URL, ex. /ja/serveurs, /br/, /nrm/).
     flag    : emoji de secours, affiché seulement si le drapeau SVG ne charge pas.
     flagImg : chemin du drapeau, à préciser uniquement si le fichier ne s'appelle
               pas comme le code. Par défaut le moteur charge /flags/<code>.svg
               (voir FLAGS_PATH) : aucune langue actuelle n'a besoin de l'écrire.
     name    : nom affiché dans le menu (dans la langue concernée).
     file    : uniquement pour une variante régionale qui réutilise un fichier
               existant (es-MX et pt-BR partagent es.json et pt.json).
     La langue « fr » n'a pas de préfixe d'URL (c'est la langue par défaut du site).
  ──────────────────────────────────────────────────────────────────────────── */
  const LANGUAGES = [
    { code: 'fr', flag: '🇫🇷', name: 'Français' },
    { code: 'br', flag: '🏴', name: 'Brezhoneg' },
    { code: 'nrm', flag: '🏴', name: 'Cauchois' },
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'es-MX', flag: '🇲🇽', name: 'Español (México)', file: 'es' },
    { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
    { code: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil)', file: 'pt' },
    { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' },
    { code: 'uk', flag: '🇺🇦', name: 'Українська' },
    { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
    { code: 'zh', flag: '🇨🇳', name: '中文' },
    { code: 'ja', flag: '🇯🇵', name: '日本語' },
    { code: 'ko', flag: '🇰🇷', name: '한국어' },
    { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
    { code: 'bn', flag: '🇧🇩', name: 'বাংলা' },
    { code: 'ar', flag: '🇸🇦', name: 'العربية' },
    { code: 'id', flag: '🇮🇩', name: 'Bahasa Indonesia' },
  ];

  // Index par code en minuscules (la comparaison d'URL ignore la casse).
  const LANGUAGE_BY_CODE = {};
  LANGUAGES.forEach(function (lang) { LANGUAGE_BY_CODE[lang.code.toLowerCase()] = lang; });

  // Langue de référence : sert de secours si une clé manque dans la langue courante.
  const REFERENCE_LANGUAGE = 'en';
  const DEFAULT_LANGUAGE = 'fr'; // langue utilisée si le navigateur ne correspond à rien
  const LOCALES_PATH = '/locales/';
  const FLAGS_PATH = '/flags/'; // un drapeau par code : /flags/br.svg, /flags/ja.svg…
  const STORAGE_KEY = 'mc_lang';

  /* ── Langue : détection et persistance ── */

  // Renvoie le code canonique (« es-mx » → « es-MX »), ou null si non supporté.
  function canonical(code) {
    if (typeof code !== 'string') return null;
    const lang = LANGUAGE_BY_CODE[code.toLowerCase()];
    return lang ? lang.code : null;
  }

  function isSupported(code) {
    return canonical(code) !== null;
  }

  // Navigateur : essaie chaque langue déclarée, région exacte puis langue de base
  // (« pt-BR » → pt-BR, « es-AR » → es, « en-US » → en…).
  function matchBrowserLang(raw) {
    if (!raw) return null;
    const lower = String(raw).toLowerCase();
    if (LANGUAGE_BY_CODE[lower]) return LANGUAGE_BY_CODE[lower].code;
    const base = lower.split('-')[0];
    if (LANGUAGE_BY_CODE[base]) return LANGUAGE_BY_CODE[base].code;
    return null;
  }

  function detectBrowserLang() {
    const candidates = [];
    if (Array.isArray(navigator.languages)) candidates.push.apply(candidates, navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
    if (navigator.userLanguage) candidates.push(navigator.userLanguage);
    for (let i = 0; i < candidates.length; i++) {
      const match = matchBrowserLang(candidates[i]);
      if (match) return match;
    }
    return null;
  }

  function detectLang() {
    // 1. Préfixe d'URL (/ja/…, /pt-BR/…, /es-MX/…) : choix explicite du lien partagé.
    const prefix = (window.location.pathname || '').match(/^\/([a-z]{2,3}(?:-[a-z]{2})?)(\/|$)/i);
    if (prefix) {
      const fromUrl = canonical(prefix[1]);
      if (fromUrl) return fromUrl;
    }

    // 2. Choix mémorisé de l'utilisateur.
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* stockage indisponible */ }
    if (isSupported(stored)) return canonical(stored);

    // 3. Langue du navigateur, sinon langue par défaut du site.
    return detectBrowserLang() || DEFAULT_LANGUAGE;
  }

  let currentLang = detectLang();
  const dictionaries = {}; // cache mémoire : { 'en': {…}, 'es': {…} }
  const fileRequests = {}; // cache des requêtes réseau, partagé entre variantes
  // Langues dont le dictionnaire a réellement été chargé AVEC du contenu : un
  // fichier vide ou une réponse parasite ne doit pas être pris pour une
  // traduction (sinon toutes les clés s'afficheraient en clair).
  const usable = {};

  /* ── Chargement des fichiers de traduction ── */

  function localeFile(code) {
    const lang = LANGUAGE_BY_CODE[code.toLowerCase()];
    return (lang && lang.file) || (lang && lang.code) || code;
  }

  // Une requête de fichier de langue : erreur sur réponse non-2xx, refus de tout
  // ce qui n'est pas un objet JSON (une page HTML servie à la place, par exemple).
  function fetchLocale(url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data !== 'object') throw new Error('format de fichier invalide');
        return data;
      });
  }

  function loadDictionary(code) {
    if (dictionaries[code]) return Promise.resolve(dictionaries[code]);
    const file = localeFile(code);
    if (!fileRequests[file]) {
      // Chemin absolu d'abord ; si le site est servi dans un sous-dossier (racine
      // « / » non disponible), on retente en relatif au document.
      fileRequests[file] = fetchLocale(LOCALES_PATH + file + '.json')
        .catch(function () { return fetchLocale('locales/' + file + '.json'); })
        .catch(function (err) {
          console.error('[i18n] chargement impossible : ' + LOCALES_PATH + file + '.json', err);
          // On ne mémorise PAS l'échec : sinon la langue resterait cassée pour
          // toute la session (toutes les clés affichées, impossible de réessayer).
          fileRequests[file] = null;
          return null;
        });
    }
    return fileRequests[file].then(function (data) {
      if (!data) return dictionaries[code] || {};
      dictionaries[code] = data;
      usable[code] = Object.keys(data).length > 0;
      return data;
    });
  }

  /* ── Accès aux traductions ── */

  const warned = {}; // évite de répéter indéfiniment le même avertissement

  function warnOnce(message) {
    if (warned[message]) return;
    warned[message] = true;
    console.warn('[i18n] ' + message);
  }

  function rawValue(key, lang) {
    const dict = dictionaries[lang];
    if (!dict) return undefined;
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
  }

  // Remplace les jetons {nom} par les valeurs de vars (utilisé seulement si fourni).
  function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, function (token, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : token;
    });
  }

  function t(key, vars) {
    // Aucun dictionnaire utilisable (fichier pas encore arrivé, ou chargement
    // impossible) : on renvoie la clé sans avertir — les contenus seront traduits
    // à l'événement « langchange ». On se rabat sur la langue de référence si elle
    // est disponible, pour ne jamais afficher de clé brute.
    let lang = currentLang;
    if (!usable[lang]) {
      if (!usable[REFERENCE_LANGUAGE]) return key;
      lang = REFERENCE_LANGUAGE;
    }

    let value = rawValue(key, lang);
    if (value === undefined && lang !== REFERENCE_LANGUAGE) {
      value = rawValue(key, REFERENCE_LANGUAGE);
      if (value !== undefined) warnOnce('clé « ' + key + ' » absente en « ' + currentLang + ' »');
    }
    if (value === undefined) {
      warnOnce('clé inconnue : « ' + key + ' »');
      return key;
    }
    if (typeof value !== 'string') return value; // objets (gameInfo.locations…)
    return interpolate(value, vars);
  }

  // Traduit un nom de lieu via la mappe « gameInfo.locations ».
  function loc(locationStr) {
    const map = t('gameInfo.locations');
    return (map && map[locationStr]) || locationStr;
  }

  /* ── Application au DOM ── */

  // [attribut porté par l'élément, façon d'appliquer la traduction]
  const DOM_BINDINGS = [
    ['data-i18n', function (el, value) { el.textContent = value; }],
    ['data-i18n-html', function (el, value) { el.innerHTML = value; }],
    ['data-i18n-placeholder', function (el, value) { el.placeholder = value; }],
    ['data-i18n-title', function (el, value) { el.title = value; }],
    ['data-i18n-aria-label', function (el, value) { el.setAttribute('aria-label', value); }],
    ['data-i18n-content', function (el, value) { el.setAttribute('content', value); }],
  ];

  function applyTranslations() {
    document.documentElement.lang = currentLang;

    DOM_BINDINGS.forEach(function (binding) {
      const attr = binding[0];
      const apply = binding[1];
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        const key = el.getAttribute(attr);
        const value = t(key);
        // Clé absente (ou fichier non chargé) : on laisse le contenu d'origine.
        if (value !== key) apply(el, value);
      });
    });

    renderLangSwitcher();
  }

  /* ── Sélecteur de langue : un bouton (drapeau courant) + menu déroulant ──
     Tout est généré depuis LANGUAGES : ajouter une langue ne touche pas au HTML. */

  function currentLanguage() {
    return LANGUAGE_BY_CODE[currentLang.toLowerCase()] || LANGUAGE_BY_CODE[DEFAULT_LANGUAGE];
  }

  // L'en-tête rogne son contenu (overflow: hidden) : on le libère pendant l'ouverture
  // sinon le menu déroulant est coupé par la barre de navigation.
  function setHeaderOverflow(container, open) {
    const header = container.closest ? container.closest('.site-header') : null;
    if (header) header.classList.toggle('lang-menu-open', open);
  }

  function setMenuOpen(open) {
    const container = document.getElementById('lang-switcher');
    if (!container) return;
    container.classList.toggle('open', open);
    const toggle = container.querySelector('.lang-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    setHeaderOverflow(container, open);
  }

  // Drapeau affiché dans le bouton et le menu : une image SVG par langue
  // (/flags/<code>.svg), y compris pour la Bretagne et la Normandie qui n'ont pas
  // d'emoji. L'emoji défini dans LANGUAGES sert de repli si l'image est absente.
  function buildFlag(lang) {
    const img = document.createElement('img');
    img.className = 'lang-flag-img';
    img.src = lang.flagImg || FLAGS_PATH + lang.code + '.svg';
    img.alt = ''; // décoratif : le nom de la langue est juste à côté
    img.loading = 'lazy';
    img.decoding = 'async';
    if (lang.flag) {
      img.addEventListener('error', function () {
        const span = document.createElement('span');
        span.className = 'lang-flag';
        span.textContent = lang.flag;
        img.replaceWith(span);
      }, { once: true });
    }
    return img;
  }

  function buildLanguageItem(lang) {
    const active = lang.code.toLowerCase() === currentLang.toLowerCase();
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'lang-item' + (active ? ' active' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', active ? 'true' : 'false');
    item.dataset.lang = lang.code;

    const flag = buildFlag(lang);
    const name = document.createElement('span');
    name.className = 'lang-name';
    name.textContent = lang.name;

    item.appendChild(flag);
    item.appendChild(name);
    item.addEventListener('click', function () {
      setMenuOpen(false);
      setLang(lang.code);
    });
    return item;
  }

  function renderLangSwitcher() {
    const container = document.getElementById('lang-switcher');
    if (!container) return;
    container.innerHTML = '';
    container.classList.remove('open');
    setHeaderOverflow(container, false);

    const current = currentLanguage();

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'lang-toggle';
    toggle.className = 'lang-toggle';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Language / Langue');
    toggle.innerHTML =
      '<span class="lang-flag"></span>' +
      '<span class="lang-code"></span>' +
      '<svg class="lang-caret" width="10" height="7" viewBox="0 0 10 7" aria-hidden="true">' +
      '<path d="M1 1.5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    toggle.querySelector('.lang-flag').appendChild(buildFlag(current));
    toggle.querySelector('.lang-code').textContent = current.code.toUpperCase();
    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setMenuOpen(!container.classList.contains('open'));
    });
    container.appendChild(toggle);

    const menu = document.createElement('ul');
    menu.className = 'lang-menu';
    menu.id = 'lang-menu';
    menu.setAttribute('role', 'listbox');
    LANGUAGES.forEach(function (lang) {
      const li = document.createElement('li');
      li.appendChild(buildLanguageItem(lang));
      menu.appendChild(li);
    });
    container.appendChild(menu);
  }

  // Fermeture du menu : clic à l'extérieur ou touche Échap (une seule fois).
  document.addEventListener('click', function (event) {
    const container = document.getElementById('lang-switcher');
    if (container && !container.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  /* ── Changement de langue ── */

  // Numéro de la dernière demande de changement de langue : si l'utilisateur
  // clique plusieurs langues à la suite, une réponse lente plus ancienne ne doit
  // pas écraser la sélection la plus récente.
  let langRequestId = 0;

  function setLang(lang) {
    const target = canonical(lang);
    if (!target || target === currentLang) return Promise.resolve();
    try { localStorage.setItem(STORAGE_KEY, target); } catch (e) { /* stockage indisponible */ }
    const requestId = ++langRequestId;
    return loadDictionary(target).then(function (dict) {
      if (requestId !== langRequestId) return; // une sélection plus récente est en cours
      // Le dictionnaire n'a pas pu être chargé : on garde la langue précédente
      // (sinon toutes les clés s'afficheraient en clair).
      if (!dict || Object.keys(dict).length === 0) return;
      currentLang = target;
      window.i18n.lang = currentLang;
      applyTranslations();
      // script.js, banner.js… re-traduisent ici leurs contenus générés en JS.
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
    });
  }

  /* ── API publique ── */

  window.i18n = {
    lang: currentLang,
    t: t,
    loc: loc,
    apply: applyTranslations,
    ready: null, // promesse : traductions de la langue courante chargées
    isLang: isSupported, // pour script.js : « ce préfixe d'URL est-il une langue ? »
    languages: LANGUAGES,
    defaultLang: DEFAULT_LANGUAGE,
  };

  window.setLang = setLang;

  /* ── Init ── */

  window.i18n.ready = loadDictionary(currentLang)
    .then(function () {
      // Langue courante indisponible (fichier absent ou vide) : on charge la
      // langue de référence, qui sert alors de secours à t().
      if (usable[currentLang]) return;
      return loadDictionary(REFERENCE_LANGUAGE);
    })
    .then(function () {
      if (!usable[currentLang] && !usable[REFERENCE_LANGUAGE]) {
        console.error('[i18n] aucune traduction chargée : le contenu HTML d\'origine est conservé.');
      }
      applyTranslations();
      // Première traduction des contenus générés en JavaScript : les autres
      // scripts (script.js, banner.js…) écoutent déjà « langchange ».
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
    });
})();
