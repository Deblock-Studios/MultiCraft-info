/* ── MultiCraft Info — i18n (FR / EN) ── */
(function () {
  'use strict';

  /* ────────────────────────────────────────
     Translations
  ──────────────────────────────────────── */
  const TRANSLATIONS = {
    fr: {
      /* Navigation */
      'nav.home':     'Accueil',
      'nav.updates':  'Mises à jour',
      'nav.servers':  'Serveurs',
      'nav.gameInfo': 'Serveurs physiques',
      'nav.siteInfo': 'Info du site',
      'nav.download': 'Télécharger',
      'nav.theGame':  'Le jeu',

      /* Home */
      'home.title':    'Bienvenue sur <span class="gradient-text">MultiCraft Info</span>',
      'home.subtitle': 'Retrouvez ici la liste des mises à jour du jeu ainsi que tous leurs serveurs.',
      'home.btnServers': 'Liste des serveurs',
      'home.btnUpdates': 'Voir les mises à jour',
      'home.card1Title': 'Mises à jour',
      'home.card1Desc':  'Consultez l\'historique des ajouts et corrections.',
      'home.card1Link':  'Consulter →',
      'home.card2Title': 'Serveurs',
      'home.card2Desc':  'Liste des différents serveurs de MultiCraft.',
      'home.card2Link':  'Explorer →',

      /* Updates page */
      'updates.subtitle': 'Les dernières nouveautés du jeu, classées de la plus récente à la plus ancienne.',
      'updates.loading':  'Chargement des mises à jour…',
      'updates.empty':    'Aucune mise à jour pour le moment.',
      'updates.error':    'Impossible de charger les mises à jour.',
      'updates.errorHint':'Servez le site via un serveur local (ex. <code>python -m http.server</code>).',

      /* Servers page */
      'servers.subtitle':       'Liste des serveurs en direct. Trouvez un serveur et rejoignez-le en un clic.',
      'servers.loading':        'Chargement des serveurs…',
      'servers.searchPlaceholder': 'Rechercher un serveur…',
      'servers.allCountries':   '🌍 Tous les pays',
      'servers.sortPlayersDesc':'Joueurs (décroissant)',
      'servers.sortPlayersAsc': 'Joueurs (croissant)',
      'servers.sortRatingDesc': 'Note (décroissant)',
      'servers.sortRatingAsc':  'Note (croissant)',
      'servers.empty':          'Aucun serveur ne correspond à votre recherche.',
      'servers.errorLoad':      'Impossible de charger la liste des serveurs.',
      'servers.noDesc':         'Aucune description disponible.',
      'servers.noName':         'Serveur sans nom',
      'servers.noRating':       'Aucun avis',
      'servers.count1':         'serveur',
      'servers.countN':         'serveurs',
      'servers.playersList':    '👥 Liste des joueurs',

      /* Game Info page */
      'gameInfo.subtitle': 'Liste des serveurs physiques de MultiCraft.',
      'gameInfo.locations': {
        'Falkenstein, Allemagne': 'Falkenstein, Allemagne',
        'Falkenstein Allemagne':  'Falkenstein Allemagne',
        'Singapour':              'Singapour',
        'Hong Kong':              'Hong Kong',
        'Naaldwijk, Pays-Bas':   'Naaldwijk, Pays-Bas',
        'Helsinki, Finlande':     'Helsinki, Finlande',
        'Sydney, Autralie':       'Sydney, Australie',
      },

      /* Site Info page */
      'siteInfo.createdBy':    'Ce site web a été créé par <a href="https://github.com/NattMath22">Aurelmattnath</a> et <a href="https://github.com/lulu76450">Lucas76</a>.',
      'siteInfo.source':       'Le code source du site est disponible <a href="https://github.com/Deblock-Studios/MultiCraft-Info">ici</a>.',
      'siteInfo.notAffiliated':'Nous ne sommes pas affiliés à MultiCraft',

      /* Download page */
      'download.subtitle':     'Téléchargez MultiCraft pour Android et choisissez la version de votre choix.',
      'download.androidTitle': 'Android',
      'download.androidDesc':  'Fichier APK à installer sur votre appareil Android.',
      'download.windowsTitle': 'Windows',
      'download.windowsDesc':  'Installateur à exécuter sur votre PC Windows.',
      'download.chooseVersion':'Choisir la version',
      'download.btnAndroid':   'Télécharger pour Android',
      'download.btnWindows':   'Télécharger pour Windows',
      'download.latest':       '(dernière version)',
      'download.error':        'Impossible de charger les versions disponibles.',

      /* Footer */
      'footer.legal': 'Légal',

      /* Modal – server */
      'modal.serverInfo':     'Informations du serveur',
      'modal.server':         'Serveur',
      'modal.inviteCode':     'Code d\'invitation',
      'modal.copy':           'Copier',
      'modal.copied':         'Copié !',
      'modal.share':          '🔗 Partager',
      'modal.close':          'Fermer',

      /* Modal – players */
      'modal.connectedPlayers': 'Joueurs connectés',
      'modal.searchPlayer':     'Rechercher un joueur…',
      'modal.noPlayers':        'Aucun joueur en ligne pour le moment.',
      'modal.noPlayerMatch':    'Aucun joueur ne correspond à votre recherche.',
      'modal.loadingPlayers':   'Chargement des joueurs…',
      'modal.errorPlayers':     'Impossible de charger la liste des joueurs.',
      'modal.errorPlayersHint': 'Vérifiez votre connexion et réessayez dans un instant.',
      'modal.noInviteCode':     'Code d\'invitation introuvable pour ce serveur.',
      'modal.playerOnline1':    'joueur en ligne',
      'modal.playerOnlineN':    'joueurs en ligne',

      /* Reviews */
      'reviews.title':       '⭐ Avis de la communauté',
      'reviews.loading':     'Chargement…',
      'reviews.sortRecent':  'Plus récents',
      'reviews.sortDesc':    'Note ↓',
      'reviews.sortAsc':     'Note ↑',
      'reviews.noReviews':   'Aucun avis pour l\'instant. Soyez le premier !',
      'reviews.noReviewsBadge': 'Aucun avis',
      'reviews.alreadyDone': '✓ Vous avez déjà soumis un avis pour ce serveur récemment.',
      'reviews.success':     '✓ Avis publié — merci !',
      'reviews.alreadyLeft': 'Vous avez déjà laissé un avis pour ce serveur.',
      'reviews.error':       'Erreur : ',
      'reviews.ratingLabel': 'Note :',
      'reviews.placeholder': 'Votre commentaire (optionnel)',
      'reviews.submit':      'Envoyer',
      'reviews.loginPrompt': 'Connectez-vous avec Deblock pour laisser un avis.',
      'reviews.loginBtn':    'Se connecter',

      /* Deblock Auth */
      'deblock.login':       'Connexion',
      'deblock.loginTitle':  'Connexion Deblock',
      'deblock.loginBtn':    'Se connecter',
      'deblock.createAccount': 'Créer un compte',
      'deblock.noAccount':   'Pas encore de compte ?',
      'deblock.hasAccount':  'Déjà un compte ?',
      'deblock.signUpBtn':   'Créer mon compte',
      'deblock.pseudo':      'Pseudo',
      'deblock.pseudoPlaceholder': 'Choisissez un pseudo',
      'deblock.forgotPassword': 'Mot de passe oublié ?',
      'deblock.sendReset':   'Envoyer le lien de réinitialisation',
      'deblock.backToLogin': '← Retour à la connexion',
      'deblock.loading':     'Chargement…',
      'deblock.user':        'Compte',
      'deblock.logout':      'Déconnexion',

      /* Profile page */
      'nav.profile':        'Profil',
      'profile.title':      'Mon Profil',
      'profile.subtitle':   'Gérez vos informations personnelles',
      'profile.pseudo':     'Pseudo',
      'profile.pseudoPlaceholder': 'Votre pseudo',
      'profile.email':      'Email',
      'profile.password':   'Mot de passe',
      'profile.newPassword': 'Nouveau mot de passe',
      'profile.confirmPassword': 'Confirmer le mot de passe',
      'profile.save':       'Enregistrer',
      'profile.saved':      '✓ Enregistré !',
      'profile.error':      'Erreur : ',
      'profile.deleteAccount': 'Supprimer mon compte',
      'profile.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      'profile.deleteCancel': 'Annuler',
      'profile.deleteConfirmBtn': 'Oui, supprimer',
      'profile.deleted':    '✓ Compte supprimé.',
      'profile.passwordChanged': '✓ Mot de passe changé !',
      'profile.emailChanged': '✓ Un email de confirmation a été envoyé à votre nouvelle adresse.',
      'profile.pseudoChanged': '✓ Pseudo mis à jour !',
      'profile.reauthNeeded': 'Veuillez vous reconnecter pour continuer.',

      /* Chat */
      'chat.title': 'Chat Global',
      'chat.placeholder': 'Écrire un message...',
      'chat.loginPrompt': 'Connectez-vous avec Deblock pour discuter.',
      'chat.send': 'Envoyer',

      /* Meta */
      'meta.description': 'MultiCraft Info — Actualités, mises à jour et informations sur les serveurs MultiCraft.',
    },

    en: {
      /* Navigation */
      'nav.home':     'Home',
      'nav.updates':  'Updates',
      'nav.servers':  'Servers',
      'nav.gameInfo': 'Physical servers',
      'nav.siteInfo': 'Site Info',
      'nav.download': 'Download',
      'nav.theGame':  'The Game',

      /* Home */
      'home.title':    'Welcome to <span class="gradient-text">MultiCraft Info</span>',
      'home.subtitle': 'Find the list of game updates and all their servers right here.',
      'home.btnServers': 'Server List',
      'home.btnUpdates': 'View Updates',
      'home.card1Title': 'Updates',
      'home.card1Desc':  'Browse the history of additions and fixes.',
      'home.card1Link':  'Browse →',
      'home.card2Title': 'Servers',
      'home.card2Desc':  'List of MultiCraft servers.',
      'home.card2Link':  'Explore →',

      /* Updates page */
      'updates.subtitle': 'Latest game news, sorted from most recent to oldest.',
      'updates.loading':  'Loading updates…',
      'updates.empty':    'No updates yet.',
      'updates.error':    'Could not load updates.',
      'updates.errorHint':'Serve the site via a local server (e.g. <code>python -m http.server</code>).',

      /* Servers page */
      'servers.subtitle':       'Live server list. Find a server and join in one click.',
      'servers.loading':        'Loading servers…',
      'servers.searchPlaceholder': 'Search for a server…',
      'servers.allCountries':   '🌍 All countries',
      'servers.sortPlayersDesc':'Players (descending)',
      'servers.sortPlayersAsc': 'Players (ascending)',
      'servers.sortRatingDesc': 'Rating (descending)',
      'servers.sortRatingAsc':  'Rating (ascending)',
      'servers.empty':          'No server matches your search.',
      'servers.errorLoad':      'Could not load the server list.',
      'servers.noDesc':         'No description available.',
      'servers.noName':         'Unnamed server',
      'servers.noRating':       'No reviews',
      'servers.count1':         'server',
      'servers.countN':         'servers',
      'servers.playersList':    '👥 Player list',

      /* Game Info page */
      'gameInfo.subtitle': 'List of MultiCraft physical servers.',
      'gameInfo.locations': {
        'Falkenstein, Allemagne': 'Falkenstein, Germany',
        'Falkenstein Allemagne':  'Falkenstein Germany',
        'Singapour':              'Singapore',
        'Hong Kong':              'Hong Kong',
        'Naaldwijk, Pays-Bas':   'Naaldwijk, Netherlands',
        'Helsinki, Finlande':     'Helsinki, Finland',
        'Sydney, Autralie':       'Sydney, Australia',
      },

      /* Site Info page */
      'siteInfo.createdBy':    'This website was created by <a href="https://github.com/NattMath22">Aurelmattnath</a> and <a href="https://github.com/lulu76450">Lucas76</a>.',
      'siteInfo.source':       'The site\'s source code is available <a href="https://github.com/Deblock-Studios/MultiCraft-Info">here</a>.',
      'siteInfo.notAffiliated':'We are not affiliated with MultiCraft',

      /* Download page */
      'download.subtitle':     'Download MultiCraft for Android and pick the version you want.',
      'download.androidTitle': 'Android',
      'download.androidDesc':  'APK file to install on your Android device.',
      'download.windowsTitle': 'Windows',
      'download.windowsDesc':  'Installer to run on your Windows PC.',
      'download.chooseVersion':'Choose version',
      'download.btnAndroid':   'Download for Android',
      'download.btnWindows':   'Download for Windows',
      'download.latest':       '(latest version)',
      'download.error':        'Could not load the available versions.',

      /* Footer */
      'footer.legal': 'Legal',

      /* Modal – server */
      'modal.serverInfo':     'Server Information',
      'modal.server':         'Server',
      'modal.inviteCode':     'Invite Code',
      'modal.copy':           'Copy',
      'modal.copied':         'Copied!',
      'modal.share':          '🔗 Share',
      'modal.close':          'Close',

      /* Modal – players */
      'modal.connectedPlayers': 'Online Players',
      'modal.searchPlayer':     'Search for a player…',
      'modal.noPlayers':        'No players online right now.',
      'modal.noPlayerMatch':    'No player matches your search.',
      'modal.loadingPlayers':   'Loading players…',
      'modal.errorPlayers':     'Could not load the player list.',
      'modal.errorPlayersHint': 'Check your connection and try again in a moment.',
      'modal.noInviteCode':     'No invite code found for this server.',
      'modal.playerOnline1':    'player online',
      'modal.playerOnlineN':    'players online',

      /* Reviews */
      'reviews.title':       '⭐ Community Reviews',
      'reviews.loading':     'Loading…',
      'reviews.sortRecent':  'Most recent',
      'reviews.sortDesc':    'Rating ↓',
      'reviews.sortAsc':     'Rating ↑',
      'reviews.noReviews':   'No reviews yet. Be the first!',
      'reviews.noReviewsBadge': 'No reviews',
      'reviews.alreadyDone': '✓ You have already submitted a review for this server recently.',
      'reviews.success':     '✓ Review submitted — thank you!',
      'reviews.alreadyLeft': 'You have already left a review for this server.',
      'reviews.error':       'Error: ',
      'reviews.ratingLabel': 'Rating:',
      'reviews.placeholder': 'Your comment (optional)',
      'reviews.submit':      'Submit',
      'reviews.loginPrompt': 'Log in with Deblock to leave a review.',
      'reviews.loginBtn':    'Log in',

      /* Deblock Auth */
      'deblock.login':       'Log in',
      'deblock.loginTitle':  'Deblock Login',
      'deblock.loginBtn':    'Log in',
      'deblock.createAccount': 'Create an account',
      'deblock.noAccount':   'No account yet?',
      'deblock.hasAccount':  'Already have an account?',
      'deblock.signUpBtn':   'Create my account',
      'deblock.pseudo':      'Username',
      'deblock.pseudoPlaceholder': 'Choose a username',
      'deblock.forgotPassword': 'Forgot password?',
      'deblock.sendReset':   'Send reset link',
      'deblock.backToLogin': '← Back to login',
      'deblock.loading':     'Loading…',
      'deblock.user':        'Account',
      'deblock.logout':      'Log out',

      /* Profile page */
      'nav.profile':        'Profile',
      'profile.title':      'My Profile',
      'profile.subtitle':   'Manage your personal information',
      'profile.pseudo':     'Username',
      'profile.pseudoPlaceholder': 'Your username',
      'profile.email':      'Email',
      'profile.password':   'Password',
      'profile.newPassword': 'New password',
      'profile.confirmPassword': 'Confirm password',
      'profile.save':       'Save',
      'profile.saved':      '✓ Saved!',
      'profile.error':      'Error: ',
      'profile.deleteAccount': 'Delete my account',
      'profile.deleteConfirm': 'Are you sure you want to delete your account? This action is irreversible.',
      'profile.deleteCancel': 'Cancel',
      'profile.deleteConfirmBtn': 'Yes, delete',
      'profile.deleted':    '✓ Account deleted.',
      'profile.passwordChanged': '✓ Password changed!',
      'profile.emailChanged': '✓ A confirmation email has been sent to your new address.',
      'profile.pseudoChanged': '✓ Username updated!',
      'profile.reauthNeeded': 'Please log in again to continue.',

      /* Chat */
      'chat.title': 'Global Chat',
      'chat.placeholder': 'Type a message...',
      'chat.loginPrompt': 'Log in with Deblock to chat.',
      'chat.send': 'Send',

      /* Meta */
      'meta.description': 'MultiCraft Info — News, updates and information about MultiCraft servers.',
    }
  };

  /* ────────────────────────────────────────
     Language detection & persistence
  ──────────────────────────────────────── */
  function detectLang() {
    // 1. Check localStorage preference
    const stored = localStorage.getItem('mc_lang');
    if (stored === 'fr' || stored === 'en') return stored;

    // 2. Auto-detect from browser
    const browserLang = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    return browserLang.startsWith('fr') ? 'fr' : 'en';
  }

  /* ────────────────────────────────────────
     Public API
  ──────────────────────────────────────── */
  window.i18n = {
    lang: detectLang(),

    t: function (key) {
      const dict = TRANSLATIONS[window.i18n.lang] || TRANSLATIONS['fr'];
      return dict[key] !== undefined ? dict[key] : (TRANSLATIONS['fr'][key] || key);
    },

    /* Translate a location name (used by script.js) */
    loc: function (locationStr) {
      const dict = TRANSLATIONS[window.i18n.lang] || TRANSLATIONS['fr'];
      const map = dict['gameInfo.locations'] || {};
      return map[locationStr] || locationStr;
    }
  };

  /* ────────────────────────────────────────
     Apply translations to the DOM
  ──────────────────────────────────────── */
  function applyTranslations() {
    const lang = window.i18n.lang;
    document.documentElement.lang = lang;

    // Update meta description
    const metaDesc = document.getElementById('meta-description');
    if (metaDesc) metaDesc.setAttribute('content', window.i18n.t('meta.description'));

    // Update nav toggle aria-label
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) navToggle.setAttribute('aria-label', lang === 'fr' ? 'Ouvrir le menu' : 'Open menu');

    // Update deblock logout aria-label
    const logoutBtn = document.getElementById('deblock-logout-btn');
    if (logoutBtn) logoutBtn.setAttribute('aria-label', lang === 'fr' ? 'Se déconnecter' : 'Log out');

    // Update modal close aria-label
    document.querySelectorAll('.modal-close').forEach(function (btn) {
      btn.setAttribute('aria-label', lang === 'fr' ? 'Fermer' : 'Close');
    });

    // data-i18n elements (innerHTML for those containing HTML tags)
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const val = window.i18n.t(key);
      if (val && val !== key) {
        // Use innerHTML for elements that may contain HTML (links, spans…)
        el.innerHTML = val;
      }
    });

    // data-i18n-placeholder elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = window.i18n.t(key);
      if (val && val !== key) el.placeholder = val;
    });

    // Select options with data-i18n
    document.querySelectorAll('option[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const val = window.i18n.t(key);
      if (val && val !== key) el.textContent = val;
    });

    // Update language switcher buttons
    document.getElementById('lang-fr').classList.toggle('active', lang === 'fr');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  }

  /* ────────────────────────────────────────
     Public setLang — called by the buttons
  ──────────────────────────────────────── */
  window.setLang = function (lang) {
    if (lang !== 'fr' && lang !== 'en') return;
    window.i18n.lang = lang;
    localStorage.setItem('mc_lang', lang);
    applyTranslations();

    // Notify script.js to re-render dynamic content
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  };

  /* ────────────────────────────────────────
     Init on DOM ready
  ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
})();
