(function () {
  'use strict';

  /* ── Datacenters ── */
  const DATACENTERS = [
    { host: 'r1.multicraft.network', location: 'Falkenstein, Allemagne', provider: 'Hetzner' },
    { host: 'r3.multicraft.network', location: 'Falkenstein Allemagne', provider: 'Hetzner' },
 /* { host: 'r4.multicraft.network', location: 'Singapour', provider: 'Leaseweb' }, this url do not respond */
    { host: 'r6.multicraft.network', location: 'Hong Kong', provider: 'Hetzner' },
    { host: 'r7.multicraft.network', location: 'Naaldwijk, Pays-Bas', provider: 'WorldStream' },
    { host: 'r8.multicraft.network', location: 'Helsinki, Finlande', provider: 'Hetzner' },
    { host: 'r9.multicraft.network', location: 'Sydney, Autralie', provider: 'OVH' }
  ];

  /* ── Supabase ── */
  const SUPABASE_URL = 'https://rdtvftclctwfqtpkbzlf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdHZmdGNsY3R3ZnF0cGtiemxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTc0MjksImV4cCI6MjEwMDI5MzQyOX0.DIsdZkJaoziW2OI2hbDalDl0IQCGPF3QRcBhKT7GW7o';

  /* ── State ── */
  let chatMessages = [];

  /* ── Gestion des rôles ── */
  let userRoles = [];
  let rolesCache = null;
  let rolesCacheTime = 0;
  const ROLES_CACHE_DURATION = 60000;

  /* ── Variables globales pour le chat ── */
  let currentChatTab = 'global';
  let currentPrivatePartner = null;
  let chatMessagesEl = null;
  let chatInput = null;
  let chatSendBtn = null;
  let chatOpen = false;
  let chatPollingInterval = null;
  let isPolling = false;

  /* ── Suivi des messages non lus (point vert du bouton Chat) ── */
  let lastSeenChatTimestamp = localStorage.getItem('mc_chat_last_seen');
  if (!lastSeenChatTimestamp) {
    lastSeenChatTimestamp = new Date().toISOString();
    localStorage.setItem('mc_chat_last_seen', lastSeenChatTimestamp);
  }
  let unreadCheckInterval = null;

  /* ── Helper: get authenticated headers for Supabase REST calls ── */
  function getApiHeaders() {
    return Deblock && Deblock.getApiHeaders ? Deblock.getApiHeaders() : {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
  }

  /* ── Dictionnaire des mots interdits ── */
  const BAD_WORDS = {
    'connard': 'insulte', 'con': 'insulte', 'pute': 'insulte', 'prostituée': 'insulte',
    'salope': 'insulte', 'enculé': 'insulte', 'fdp': 'insulte', 'batard': 'insulte',
    'bâtard': 'insulte', 'merde': 'vulgarité', 'putain': 'vulgarité', 'bordel': 'vulgarité',
    'foutre': 'vulgarité', 'nique': 'insulte', 'nik': 'insulte', 'baise': 'vulgarité',
    'nègre': 'raciste', 'negro': 'raciste', 'bougnoule': 'raciste', 'bicot': 'raciste',
    'raton': 'raciste', 'youpin': 'raciste', 'feuj': 'raciste', 'pedé': 'homophobe',
    'pédé': 'homophobe', 'gouine': 'homophobe', 'tarlouze': 'homophobe', 'pd': 'homophobe',
    'c0nnard': 'insulte', 'c0n': 'insulte', 'f0utre': 'vulgarité', 'n1que': 'insulte',
    's4lope': 'insulte', 'b4tard': 'insulte', 'fuck': 'vulgarité', 'shit': 'vulgarité',
    'bitch': 'insulte', 'bastard': 'insulte', 'asshole': 'insulte', 'motherfucker': 'insulte',
    'mf': 'insulte', 'b1tch': 'insulte', '4ssh0le': 'insulte', 'f4gg0t': 'homophobe',
    'salaud': 'insulte', 'salopard': 'insulte', 'connasse': 'insulte', 'grognasse': 'insulte',
    'pétasse': 'insulte', 'traînée': 'insulte', 'trainée': 'insulte', 'chienne': 'insulte',
    'suceur': 'insulte', 'suceuse': 'insulte', 'branleur': 'insulte', 'branleuse': 'insulte',
    'trouduc': 'insulte', 'trou du cul': 'insulte', 'trouducul': 'insulte', 'enculeur': 'insulte',
    'enculeuse': 'insulte', 'débile': 'insulte', 'debile': 'insulte', 'idiot': 'insulte',
    'imbécile': 'insulte', 'imbecile': 'insulte', 'crétin': 'insulte', 'cretin': 'insulte',
    'abruti': 'insulte'
  };

  /* ── Fonctions de filtrage ── */
  function hasBadWords(text) {
    const lowerText = text.toLowerCase();
    for (const [badWord, category] of Object.entries(BAD_WORDS)) {
      const regex = new RegExp('\\b' + badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(lowerText)) return { found: true, word: badWord, category: category };
      if (lowerText.includes(badWord.toLowerCase())) return { found: true, word: badWord, category: category };
    }
    return { found: false };
  }

  function censorMessage(text) {
    let censored = text;
    for (const [badWord] of Object.entries(BAD_WORDS)) {
      const regex = new RegExp('\\b' + badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      censored = censored.replace(regex, '***');
      const simpleRegex = new RegExp(badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      censored = censored.replace(simpleRegex, '***');
    }
    return censored;
  }

  function showTemporaryNotification(message, isSuccess) {
    const notification = document.createElement('div');
    notification.className = 'chat-notification' + (isSuccess ? ' success' : '');
    notification.textContent = message;
    notification.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 10px;
      background: ${isSuccess ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)'};
      color: white;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      animation: fadeIn 0.3s ease;
      white-space: nowrap;
      z-index: 10;
    `;
    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) {
      chatFooter.style.position = 'relative';
      chatFooter.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  /* ── Fonctions Rôles (remplace l'ancien système admins) ── */
  async function fetchUserRoles() {
    try {
      const now = Date.now();
      if (rolesCache && (now - rolesCacheTime) < ROLES_CACHE_DURATION) return rolesCache;
      const url = SUPABASE_URL + '/rest/v1/user_roles?select=user_id,role_id';
      const res = await fetch(url, { headers: getApiHeaders() });
      if (res.status === 404) { rolesCache = []; rolesCacheTime = now; userRoles = []; return []; }
      if (!res.ok) throw new Error('Erreur chargement rôles (' + res.status + ')');
      const roles = await res.json();
      rolesCache = roles || [];
      rolesCacheTime = now;
      userRoles = (roles || []).map(function (r) { return r.user_id; });
      return roles || [];
    } catch (err) {
      console.error('Erreur chargement rôles:', err);
      if (!rolesCache) { rolesCache = []; userRoles = []; }
      return rolesCache;
    }
  }

  function isAdminUser(userId) {
    if (!userId) return false;
    // Check if user has role 'admin' in user_roles
    if (!rolesCache) return false;
    return rolesCache.some(function (r) { return r.user_id === userId && r.role_id === 1; });
  }

  function getUserRole(userId) {
    if (!userId || !rolesCache) return null;
    const entry = rolesCache.find(function (r) { return r.user_id === userId; });
    return entry ? entry.role_id : null;
  }

  function canModerate(userId) {
    if (!userId) return false;
    const role = getUserRole(userId);
    return role === 'admin' || role === 'moderator';
  }

  async function isUserBanned(userId) {
    try {
      const url = SUPABASE_URL + '/rest/v1/banned_users?user_id=eq.' + encodeURIComponent(userId) + '&select=*';
      const res = await fetch(url, { headers: getApiHeaders() });
      if (res.status === 404) return false;
      if (res.status === 400) { console.warn('isUserBanned: table banned_users manquante'); return false; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return data && data.length > 0;
    } catch (err) { console.error('Erreur vérification bannissement:', err); return false; }
  }

  async function banChatUser(userId, reason) {
    const currentUser = Deblock.getUser();
    if (!currentUser || !isAdminUser(currentUser.id)) {
      showTemporaryNotification('❌ Seul un admin peut bannir');
      return;
    }
    try {
      const url = SUPABASE_URL + '/rest/v1/banned_users';
      const res = await fetch(url, {
        method: 'POST',
        headers: Object.assign({}, getApiHeaders(), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          user_id: userId,
          banned_by: currentUser.id,
          reason: reason || 'Comportement inapproprié',
          banned_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const messagesToRemove = chatMessages.filter(function (m) { return m.user_id === userId; });
      messagesToRemove.forEach(function (msg) { removeMessageFromUI(msg.id); });
      showTemporaryNotification('✅ Utilisateur banni !', true);
    } catch (err) {
      console.error('Erreur bannissement:', err);
      showTemporaryNotification('❌ Erreur lors du bannissement');
    }
  }

  /* ── Deblock Auth ── */
  function updateDeblockUI() {
    const loginBtn = document.getElementById('deblock-login-btn');
    const userInfo = document.getElementById('deblock-user-info');
    const avatarEl = document.getElementById('deblock-avatar');
    const usernameEl = document.getElementById('deblock-username');

    const user = Deblock.getUser();

    if (user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userInfo) {
        userInfo.removeAttribute('hidden');
        userInfo.style.display = 'flex';
      }
      if (avatarEl) {
        avatarEl.src = Deblock.getAvatarUrl();
        avatarEl.alt = Deblock.getDisplayName();
      }
      if (usernameEl) usernameEl.textContent = Deblock.getDisplayName();
    } else {
      if (loginBtn) loginBtn.style.display = '';
      if (userInfo) {
        userInfo.setAttribute('hidden', '');
        userInfo.style.display = 'none';
      }
    }

    updateChatAuthState();
  }

  /* ── Login Modal ── */
  function openLoginModal() {
    const modal = document.getElementById('deblock-login-modal');
    if (!modal) return;
    // Reset to login mode
    document.getElementById('deblock-login-mode').hidden = false;
    document.getElementById('deblock-signup-mode').hidden = true;
    document.getElementById('deblock-forgot-mode').hidden = true;
    document.getElementById('deblock-auth-loading').hidden = true;
    document.getElementById('deblock-login-error').hidden = true;
    document.getElementById('deblock-email').value = '';
    document.getElementById('deblock-password').value = '';
    modal.hidden = false;
  }

  function closeLoginModal() {
    const modal = document.getElementById('deblock-login-modal');
    if (!modal) return;
    modal.hidden = true;
    document.getElementById('deblock-login-error').hidden = true;
  }

  function showLoginError(msg) {
    const errEl = document.getElementById('deblock-login-error');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function showAuthLoading(show) {
    document.getElementById('deblock-auth-loading').hidden = !show;
    document.getElementById('deblock-login-mode').hidden = show;
    document.getElementById('deblock-signup-mode').hidden = true;
    document.getElementById('deblock-forgot-mode').hidden = true;
  }

  function initDeblockAuth() {
    // Wait for Deblock module to be ready
    Deblock.ready().then(function () {
      // Initial UI update
      updateDeblockUI();
      fetchUserRoles();
      initProfilePage();

      // Listen for auth state changes
      Deblock.onAuthStateChanged(function () {
        updateDeblockUI();
        if (chatOpen && chatMessagesEl) {
          loadChatMessagesForTab(currentChatTab, currentPrivatePartner);
        }
      });
    });

    // ── Login modal event listeners ──
    document.addEventListener('click', function (e) {

      // Open login modal
      if (e.target.closest('#deblock-login-btn') || e.target.closest('#chat-widget-login-btn')) {
        e.preventDefault();
        if (Deblock.getUser()) return;
        openLoginModal();
      }

      // Logout
      if (e.target.closest('#deblock-logout-btn')) {
        Deblock.logout().catch(console.error);
        if (chatOpen) {
          closeChat();
        }
      }

      // Profile link
      if (e.target.closest('.deblock-profile-link')) {
        e.preventDefault();
        location.hash = 'profil';
      }

      // Close modal buttons
      if (e.target.closest('#deblock-login-close')) {
        closeLoginModal();
      }
      if (e.target.closest('#deblock-login-modal') && e.target === document.getElementById('deblock-login-modal')) {
        closeLoginModal();
      }

      // Switch to signup mode
      if (e.target.closest('#deblock-show-signup')) {
        e.preventDefault();
        document.getElementById('deblock-login-mode').hidden = true;
        document.getElementById('deblock-signup-mode').hidden = false;
        document.getElementById('deblock-login-error').hidden = true;
        document.getElementById('deblock-signup-pseudo').value = '';
        document.getElementById('deblock-signup-email').value = '';
        document.getElementById('deblock-signup-password').value = '';
        document.getElementById('deblock-signup-confirm').value = '';
      }

      // Switch to login mode
      if (e.target.closest('#deblock-show-login')) {
        e.preventDefault();
        document.getElementById('deblock-signup-mode').hidden = true;
        document.getElementById('deblock-login-mode').hidden = false;
        document.getElementById('deblock-login-error').hidden = true;
      }

      // Switch to forgot password mode
      if (e.target.closest('#deblock-show-forgot')) {
        e.preventDefault();
        document.getElementById('deblock-login-mode').hidden = true;
        document.getElementById('deblock-forgot-mode').hidden = false;
        document.getElementById('deblock-login-error').hidden = true;
        document.getElementById('deblock-forgot-email').value = '';
      }

      // Back to login from forgot mode
      if (e.target.closest('#deblock-back-to-login')) {
        e.preventDefault();
        document.getElementById('deblock-forgot-mode').hidden = true;
        document.getElementById('deblock-login-mode').hidden = false;
        document.getElementById('deblock-login-error').hidden = true;
      }

      // Password toggle
      if (e.target.closest('#deblock-password-toggle')) {
        const pwInput = document.getElementById('deblock-password');
        if (pwInput.type === 'password') {
          pwInput.type = 'text';
          e.target.textContent = '🙈';
        } else {
          pwInput.type = 'password';
          e.target.textContent = '👁';
        }
      }
    });

    // ── Login submit ──
    document.getElementById('deblock-login-submit').addEventListener('click', async function () {
      const email = document.getElementById('deblock-email').value.trim();
      const password = document.getElementById('deblock-password').value;
      if (!email || !password) { showLoginError('Veuillez remplir tous les champs.'); return; }
      showAuthLoading(true);
      try {
        await Deblock.login(email, password);
        closeLoginModal();
      } catch (err) {
        showAuthLoading(false);
        showLoginError(err.message || 'Erreur de connexion');
      }
    });

    // ── Signup submit ──
    document.getElementById('deblock-signup-submit').addEventListener('click', async function () {
      const pseudo = document.getElementById('deblock-signup-pseudo').value.trim();
      const email = document.getElementById('deblock-signup-email').value.trim();
      const password = document.getElementById('deblock-signup-password').value;
      const confirm = document.getElementById('deblock-signup-confirm').value;
      if (!email || !password) { showLoginError('Veuillez remplir tous les champs.'); return; }
      if (password.length < 6) { showLoginError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
      if (password !== confirm) { showLoginError('Les mots de passe ne correspondent pas.'); return; }
      showAuthLoading(true);
      try {
        await Deblock.signUp(email, password, pseudo || null);
        showAuthLoading(false);
        showLoginError('✅ Compte cr\u00e9\u00e9 ! V\u00e9rifiez votre email pour confirmer votre inscription.');
      } catch (err) {
        showAuthLoading(false);
        showLoginError(err.message || 'Erreur lors de l\'inscription');
      }
    });

    // ── Forgot password submit ──
    document.getElementById('deblock-forgot-submit').addEventListener('click', async function () {
      const email = document.getElementById('deblock-forgot-email').value.trim();
      if (!email) { showLoginError('Veuillez entrer votre email.'); return; }
      showAuthLoading(true);
      try {
        await Deblock.sendMagicLink(email);
        closeLoginModal();
        showTemporaryNotification('✅ Lien de réinitialisation envoyé par email', true);
      } catch (err) {
        showAuthLoading(false);
        showLoginError(err.message || 'Erreur lors de l\'envoi');
      }
    });

    // ── Allow Enter key to submit ──
    document.getElementById('deblock-password').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('deblock-login-submit').click();
    });
    document.getElementById('deblock-signup-confirm').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('deblock-signup-submit').click();
    });
    document.getElementById('deblock-forgot-email').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('deblock-forgot-submit').click();
    });

    // ── Close modal on Escape ──
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLoginModal();
    });
  }

  /* ── Profile Management ── */
  var profilePageInitialized = false;

  function refreshProfileData() {
    const user = Deblock.getUser();
    if (!user) return;
    const pseudoInput = document.getElementById('profile-pseudo');
    const emailInput = document.getElementById('profile-email');
    if (pseudoInput) pseudoInput.value = Deblock.getDisplayName() || '';
    if (emailInput) emailInput.value = user.email || '';
    // Refresh avatar preview
    const avatarPreviewEl = document.getElementById('profile-avatar-preview');
    if (avatarPreviewEl) avatarPreviewEl.src = Deblock.getAvatarUrl() || '';
    // Clear password fields
    const newPwdInput = document.getElementById('profile-new-password');
    const confirmPwdInput = document.getElementById('profile-confirm-password');
    if (newPwdInput) newPwdInput.value = '';
    if (confirmPwdInput) confirmPwdInput.value = '';
    // Reset delete flow
    const deleteBtn = document.getElementById('profile-delete-btn');
    const deleteCancel = document.getElementById('profile-delete-cancel');
    const deleteConfirm = document.getElementById('profile-delete-confirm');
    if (deleteBtn) deleteBtn.hidden = false;
    if (deleteCancel) deleteCancel.hidden = true;
    if (deleteConfirm) deleteConfirm.hidden = true;
    // Hide status message
    const msgEl = document.getElementById('profile-status-msg');
    if (msgEl) msgEl.hidden = true;
  }

  function initProfilePage() {
    if (profilePageInitialized) return;
    profilePageInitialized = true;

    const profilePage = document.getElementById('page-profil');
    if (!profilePage) return;

    const msgEl = document.getElementById('profile-status-msg');

    /* ── Avatar upload ── */
    (function initAvatarSection() {
      const previewEl   = document.getElementById('profile-avatar-preview');
      const inputEl     = document.getElementById('profile-avatar-input');
      const saveBtn     = document.getElementById('profile-avatar-save');
      const removeBtn   = document.getElementById('profile-avatar-remove');
      const progressWrap = document.getElementById('profile-avatar-progress');
      const progressBar  = progressWrap && progressWrap.querySelector('.profile-avatar-progress-bar');

      const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo
      let pendingFile = null;

      /* Affiche l'avatar actuel */
      function loadCurrentAvatar() {
        if (!previewEl) return;
        const url = Deblock.getAvatarUrl();
        previewEl.src = url || '';
        previewEl.onerror = function () { previewEl.src = ''; };
      }
      loadCurrentAvatar();

      /* Sélection d'un fichier */
      if (inputEl) {
        inputEl.addEventListener('change', function () {
          const file = inputEl.files && inputEl.files[0];
          if (!file) return;
          if (file.size > MAX_BYTES) {
            showAvatarMsg(window.i18n ? window.i18n.t('profile.avatarTooBig') : '❌ Image trop lourde (max 2 Mo).', false);
            inputEl.value = '';
            return;
          }
          pendingFile = file;
          if (saveBtn) saveBtn.disabled = false;
          /* Aperçu local */
          const reader = new FileReader();
          reader.onload = function (e) {
            if (previewEl) previewEl.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      /* Enregistrer */
      if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
          if (!pendingFile) return;
          saveBtn.disabled = true;
          setProgress(10);
          try {
            const avatarUrl = await uploadAvatarWithFallback(pendingFile);
            setProgress(90);
            /* Sauvegarde de l'URL dans les métadonnées Supabase Auth */
            await Deblock.updateProfile({ avatar_url: avatarUrl });
            setProgress(100);
            pendingFile = null;
            inputEl.value = '';
            updateDeblockUI();
            showAvatarMsg(window.i18n ? window.i18n.t('profile.avatarSaved') : '✓ Photo de profil mise à jour !', true);
          } catch (err) {
            showAvatarMsg('❌ ' + (err.message || 'Erreur lors de l\'upload.'), false);
          } finally {
            setTimeout(function () { setProgress(0); progressWrap.hidden = true; }, 1200);
            if (saveBtn) saveBtn.disabled = !pendingFile;
          }
        });
      }

      /* Supprimer */
      if (removeBtn) {
        removeBtn.addEventListener('click', async function () {
          try {
            await Deblock.updateProfile({ avatar_url: '' });
            if (previewEl) previewEl.src = '';
            pendingFile = null;
            if (inputEl) inputEl.value = '';
            if (saveBtn) saveBtn.disabled = true;
            updateDeblockUI();
            showAvatarMsg(window.i18n ? window.i18n.t('profile.avatarRemoved') : '✓ Photo supprimée.', true);
          } catch (err) {
            showAvatarMsg('❌ ' + (err.message || 'Erreur.'), false);
          }
        });
      }

      function setProgress(pct) {
        if (!progressWrap || !progressBar) return;
        progressWrap.hidden = pct === 0;
        progressBar.style.width = pct + '%';
      }

      function showAvatarMsg(msg, ok) {
        /* Réutilise la zone de statut globale du profil */
        if (!msgEl) return;
        msgEl.textContent = msg;
        msgEl.hidden = false;
        msgEl.style.color = ok ? 'var(--green, #4ade80)' : 'var(--red, #ef4444)';
        setTimeout(function () { msgEl.hidden = true; }, 4000);
      }

      /* ── Upload : Supabase Storage → fallback CatBox ── */
      async function uploadAvatarWithFallback(file) {
        /* 1. Essai Supabase Storage */
        try {
          const url = await uploadToSupabase(file);
          if (url) return url;
        } catch (e) {
          console.warn('[Avatar] Supabase Storage échoué, bascule sur CatBox :', e.message);
        }
        /* 2. Fallback CatBox */
        return await uploadToCatBox(file);
      }

      async function uploadToSupabase(file) {
        const client = Deblock.getClient();
        if (!client) throw new Error('Client Supabase non disponible');
        const user = Deblock.getUser();
        if (!user) throw new Error('Non authentifié');

        const ext = file.name.split('.').pop() || 'jpg';
        const path = 'avatars/' + user.id + '.' + ext;

        const { error } = await client.storage
          .from('avatars')
          .upload(path, file, { upsert: true, contentType: file.type });

        if (error) throw new Error(error.message);

        const { data } = client.storage.from('avatars').getPublicUrl(path);
        if (!data || !data.publicUrl) throw new Error('URL publique introuvable');
        /* Ajoute un cache-buster pour forcer le rechargement de l'image */
        return data.publicUrl + '?t=' + Date.now();
      }

      async function uploadToCatBox(file) {
        // CatBox bloque le CORS direct depuis le navigateur - on passe par des proxies

        // Proxy 1 : corsproxy.io
        try {
          const f1 = new FormData();
          f1.append('reqtype', 'fileupload');
          f1.append('fileToUpload', file);
          const r1 = await fetch('https://corsproxy.io/?url=https://catbox.moe/user/api.php', { method: 'POST', body: f1 });
          if (r1.ok) { const u1 = (await r1.text()).trim(); if (u1.startsWith('https://')) return u1; }
        } catch (_) {}

        // Proxy 2 : crossorigin.me
        try {
          const f2 = new FormData();
          f2.append('reqtype', 'fileupload');
          f2.append('fileToUpload', file);
          const r2 = await fetch('https://crossorigin.me/https://catbox.moe/user/api.php', { method: 'POST', body: f2 });
          if (r2.ok) { const u2 = (await r2.text()).trim(); if (u2.startsWith('https://')) return u2; }
        } catch (_) {}

        throw new Error('Upload impossible (CORS). Active le bucket Supabase Storage "avatars" pour résoudre ce problème.');
      }
    })();

    function showProfileMsg(msg, isSuccess) {
      if (!msgEl) return;
      msgEl.textContent = msg;
      msgEl.hidden = false;
      msgEl.style.color = isSuccess ? 'var(--green, #4ade80)' : 'var(--red, #ef4444)';
      setTimeout(function () { msgEl.hidden = true; }, 4000);
    }

    // Save pseudo
    document.getElementById('profile-save-pseudo').addEventListener('click', async function () {
      const pseudoInput = document.getElementById('profile-pseudo');
      const newPseudo = pseudoInput ? pseudoInput.value.trim() : '';
      if (!newPseudo) { showProfileMsg('Le pseudo ne peut pas \u00eatre vide.'); return; }
      try {
        await Deblock.updateProfile({ display_name: newPseudo });
        updateDeblockUI();
        showProfileMsg(window.i18n ? window.i18n.t('profile.pseudoChanged') : '\u2713 Pseudo mis \u00e0 jour !', true);
      } catch (err) {
        showProfileMsg((window.i18n ? window.i18n.t('profile.error') : 'Erreur : ') + (err.message || ''));
      }
    });

    // Save email
    document.getElementById('profile-save-email').addEventListener('click', async function () {
      const emailInput = document.getElementById('profile-email');
      const newEmail = emailInput ? emailInput.value.trim() : '';
      if (!newEmail) { showProfileMsg('L\'email ne peut pas \u00eatre vide.'); return; }
      try {
        await Deblock.updateEmail(newEmail);
        showProfileMsg(window.i18n ? window.i18n.t('profile.emailChanged') : '\u2713 Email de confirmation envoy\u00e9.', true);
      } catch (err) {
        showProfileMsg((window.i18n ? window.i18n.t('profile.error') : 'Erreur : ') + (err.message || ''));
      }
    });

    // Save password
    document.getElementById('profile-save-password').addEventListener('click', async function () {
      const newPwdInput = document.getElementById('profile-new-password');
      const confirmPwdInput = document.getElementById('profile-confirm-password');
      const pwd = newPwdInput ? newPwdInput.value : '';
      const confirm = confirmPwdInput ? confirmPwdInput.value : '';
      if (!pwd || pwd.length < 6) { showProfileMsg('Le mot de passe doit contenir au moins 6 caract\u00e8res.'); return; }
      if (pwd !== confirm) { showProfileMsg('Les mots de passe ne correspondent pas.'); return; }
      try {
        await Deblock.updatePassword(pwd);
        if (newPwdInput) newPwdInput.value = '';
        if (confirmPwdInput) confirmPwdInput.value = '';
        showProfileMsg(window.i18n ? window.i18n.t('profile.passwordChanged') : '\u2713 Mot de passe chang\u00e9 !', true);
      } catch (err) {
        showProfileMsg((window.i18n ? window.i18n.t('profile.error') : 'Erreur : ') + (err.message || ''));
      }
    });

    // Enter key on confirm password triggers save
    if (document.getElementById('profile-confirm-password')) {
      document.getElementById('profile-confirm-password').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') document.getElementById('profile-save-password').click();
      });
    }

    // Delete account flow
    const deleteBtn = document.getElementById('profile-delete-btn');
    const deleteCancel = document.getElementById('profile-delete-cancel');
    const deleteConfirm = document.getElementById('profile-delete-confirm');

    deleteBtn.addEventListener('click', function () {
      deleteBtn.hidden = true;
      if (deleteCancel) deleteCancel.hidden = false;
      if (deleteConfirm) deleteConfirm.hidden = false;
    });

    if (deleteCancel) {
      deleteCancel.addEventListener('click', function () {
        deleteCancel.hidden = true;
        deleteConfirm.hidden = true;
        if (deleteBtn) deleteBtn.hidden = false;
      });
    }

    if (deleteConfirm) {
      deleteConfirm.addEventListener('click', async function () {
        try {
          await Deblock.deleteAccount();
          showProfileMsg(window.i18n ? window.i18n.t('profile.deleted') : '\u2713 Compte supprim\u00e9.', true);
          setTimeout(function () {
            navigateTo('accueil');
            updateDeblockUI();
          }, 1500);
        } catch (err) {
          showProfileMsg((window.i18n ? window.i18n.t('profile.error') : 'Erreur : ') + (err.message || ''));
          if (deleteCancel) deleteCancel.hidden = true;
          if (deleteConfirm) deleteConfirm.hidden = true;
          if (deleteBtn) deleteBtn.hidden = false;
        }
      });
    }
  }

  /* ── Navigation SPA ── */  /* ── Navigation SPA ── */
  const pages = {
    accueil: document.getElementById('page-accueil'),
    'mises-a-jour': document.getElementById('page-mises-a-jour'),
    serveurs: document.getElementById('page-serveurs'),
    'le-jeu': document.getElementById('page-le-jeu'),
    'info-du-site': document.getElementById('page-info-du-site'),
    profil: document.getElementById('page-profil'),
  };
  const legacyPageRedirects = { 'info-du-jeu': 'le-jeu', telecharger: 'le-jeu' };

  const navLinks = document.querySelectorAll('[data-nav]');
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  function navigateTo(pageId) {
    if (!pages[pageId]) return;
    Object.values(pages).forEach(function (p) { if (p) p.classList.remove('active'); });
    if (pages[pageId]) pages[pageId].classList.add('active');
    document.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.dataset.nav === pageId) link.classList.add('active');
      else link.classList.remove('active');
    });
    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) { navToggle.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); }
    if (pageId === 'mises-a-jour' && !updatesLoaded) loadUpdates();
    if (pageId === 'le-jeu' && !datacentersLoaded) renderDatacenters();
    if (pageId === 'serveurs' && !serversLoaded) loadServers();
    if (pageId === 'le-jeu' && !downloadsLoaded) loadDownloads();
    if (pageId === 'profil') {
      document.getElementById('app').style.display = 'none';
      refreshProfileData();
    } else {
      document.getElementById('app').style.display = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRoute() {
    const hash = location.hash.slice(1) || 'accueil';
    const target = legacyPageRedirects[hash] || hash;
    if (pages[target]) navigateTo(target);
    else navigateTo('accueil');
  }

  navLinks.forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); const page = el.dataset.nav; location.hash = page; });
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
  let haloX = 0, haloY = 0, targetX = 0, targetY = 0, rafId = null;

  function isDesktopPointer() { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }

  function animateHalo() {
    haloX += (targetX - haloX) * 0.08;
    haloY += (targetY - haloY) * 0.08;
    halo.style.transform = 'translate(' + (haloX - size) + 'px, ' + (haloY - size) + 'px)';
    rafId = requestAnimationFrame(animateHalo);
  }

  function initCursorHalo() {
    if (!isDesktopPointer() || !halo) return;
    document.body.classList.add('cursor-active');
    if (!rafId) rafId = requestAnimationFrame(animateHalo);
    document.addEventListener('mousemove', function (e) { targetX = e.clientX; targetY = e.clientY; });
    document.addEventListener('mouseleave', function () { document.body.classList.remove('cursor-active'); });
    document.addEventListener('mouseenter', function () { if (isDesktopPointer()) document.body.classList.add('cursor-active'); });
  }

  /* ── Markdown parser ── */
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
        val = val.slice(1, -1).split(',').map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
      } else { val = val.replace(/^["']|["']$/g, ''); }
      meta[key] = val;
    });
    return { meta: meta, body: match[2].trim() };
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\n');
    const html = [];
    let inCode = false, codeBuffer = [], listType = null;

    function closeList() { if (listType === 'ul') { html.push('</ul>'); listType = null; } else if (listType === 'ol') { html.push('</ol>'); listType = null; } }

    function inline(text) {
      if (!text) return '';
      return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        closeList();
        if (inCode) { html.push('<pre><code>' + escapeHtml(codeBuffer.join('\n')) + '</code></pre>'); codeBuffer = []; inCode = false; }
        else { inCode = true; }
        continue;
      }
      if (inCode) { codeBuffer.push(line); continue; }
      if (/^---+\$/.test(line.trim())) { closeList(); html.push('<hr>'); continue; }
      const h3 = line.match(/^### (.+)/);
      if (h3) { closeList(); html.push('<h3>' + inline(h3[1]) + '</h3>'); continue; }
      const h2 = line.match(/^## (.+)/);
      if (h2) { closeList(); html.push('<h2>' + inline(h2[1]) + '</h2>'); continue; }
      const bq = line.match(/^> (.+)/);
      if (bq) { closeList(); html.push('<blockquote>' + inline(bq[1]) + '</blockquote>'); continue; }
      const ul = line.match(/^[-*] (.+)/);
      if (ul) { if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; } html.push('<li>' + inline(ul[1]) + '</li>'); continue; }
      const ol = line.match(/^\d+\. (.+)/);
      if (ol) { if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; } html.push('<li>' + inline(ol[1]) + '</li>'); continue; }
      if (line.trim() === '') { closeList(); continue; }
      closeList();
      html.push('<p>' + inline(line) + '</p>');
    }
    closeList();
    if (inCode && codeBuffer.length) html.push('<pre><code>' + escapeHtml(codeBuffer.join('\n')) + '</code></pre>');
    return html.join('\n');
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      const locale = window.i18n && window.i18n.lang === 'en' ? 'en-US' : 'fr-FR';
      return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return dateStr; }
  }

  /* ── Updates loader ── */
  let updatesLoaded = false;
  const updatesContainer = document.getElementById('updates-container');

  async function loadUpdates() {
    try {
      const manifestRes = await fetch('updates/manifest.json');
      if (!manifestRes.ok) throw new Error('Manifest introuvable');
      const folders = await manifestRes.json();
      const posts = await Promise.all(folders.map(async function (folder) {
        const lang = window.i18n.lang;
        let raw = null;
        if (lang === 'en') {
          try { const enRes = await fetch('updates/' + folder + '/post-en.md'); if (enRes.ok) raw = await enRes.text(); } catch (e) { /* ignore */ }
        }
        if (raw === null) { const res = await fetch('updates/' + folder + '/post.md'); if (!res.ok) return null; raw = await res.text(); }
        const parsed = parseFrontmatter(raw);
        return {
          folder: folder,
          date: parsed.meta.date || folder.split('-').slice(0, 3).join('-'),
          title: parsed.meta.title || folder,
          images: Array.isArray(parsed.meta.images) ? parsed.meta.images : parsed.meta.images ? [parsed.meta.images] : [],
          body: parsed.body,
        };
      }));
      const valid = posts.filter(function (p) { return p !== null; }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      if (valid.length === 0) updatesContainer.innerHTML = '<div class="empty-state"><p>' + window.i18n.t('updates.empty') + '</p></div>';
      else { updatesContainer.innerHTML = valid.map(renderUpdatePost).join(''); bindLightbox(); }
      updatesLoaded = true;
    } catch (err) {
      console.error(err);
      updatesContainer.innerHTML = '<div class="error-state"><p>' + window.i18n.t('updates.error') + '</p><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">' + window.i18n.t('updates.errorHint') + '</p></div>';
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
      const safeHost = escapeHtml(dc.host);
      html += '<article class="dc-card"><div class="dc-header">' +
        '<span class="dc-name">' + safeHost + '</span>' +
        '<span class="dc-latency-badge" id="lat-' + safeHost.replace(/\./g, '-') + '">' +
        '<span class="dc-latency-dot"></span><span class="dc-latency-val">Test…</span></span>' +
        '</div><div class="dc-details">' +
        '<div class="dc-row"><span class="dc-label">Localisation</span><span class="dc-value">' +
        escapeHtml(window.i18n.loc(dc.location)) + '</span></div>' +
        '<div class="dc-row"><span class="dc-label">Hébergeur</span><span class="dc-value">' +
        escapeHtml(dc.provider) + '</span></div></div></article>';
    }
    dcContainer.innerHTML = html;
    datacentersLoaded = true;
    setTimeout(function () { runLatencyTests(); }, 100);
  }

  async function measureLatency(host) {
    try {
      const res = await fetch(
        'https://lag-test.creatif-france.workers.dev/?url=' +
        encodeURIComponent(host)
      );
      if (!res.ok) return null;
      const data = await res.json();
      const avg = data?.results?.[0]?.result?.stats?.avg;
      if (typeof avg === 'number') return Math.round(avg);
      const timings = data?.results?.[0]?.result?.timings;
      if (Array.isArray(timings) && timings.length) {
        const sum = timings.reduce((a, b) => a + b.rtt, 0);
        return Math.round(sum / timings.length);
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  function latencyClass(ms) {
    if (ms === null) return 'latency-error';
    if (ms < 250) return 'latency-good';
    if (ms < 500) return 'latency-medium';
    return 'latency-high';
  }

  async function runLatencyTests() {
    DATACENTERS.forEach(async function (dc) {
      const id = 'lat-' + dc.host.replace(/\./g, '-');
      const badge = document.getElementById(id);
      if (!badge) return;
      const dot = badge.querySelector('.dc-latency-dot');
      const val = badge.querySelector('.dc-latency-val');
      const ms = await measureLatency(dc.host);
      const cls = latencyClass(ms);
      badge.className = 'dc-latency-badge ' + cls;
      if (dot) dot.className = 'dc-latency-dot';
      if (val) val.textContent = ms !== null ? ms + ' ms' : 'N/A';
    });
  }

  /* ── Téléchargements ── */
  let downloadsLoaded = false;
  let downloadsData = null;
  const androidSelect = document.getElementById('android-version-select');
  const windowsSelect = document.getElementById('windows-version-select');
  const androidBtn = document.getElementById('android-download-btn');
  const windowsBtn = document.getElementById('windows-download-btn');

  function sortVersionsDesc(list) {
    return list.slice().sort(function (a, b) {
      return String(b.version).localeCompare(String(a.version), undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function populateVersionSelect(selectEl, btnEl, versions) {
    if (!selectEl || !btnEl) return;
    const sorted = sortVersionsDesc(versions);
    let html = '';
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      const label = v.version + (v.build ? ' (build ' + v.build + ')' : '') + (v.latest ? ' ' + window.i18n.t('download.latest') : '');
      html += '<option value="' + escapeHtml(v.url) + '">' + escapeHtml(label) + '</option>';
    }
    selectEl.innerHTML = html;
    function updateBtn() { btnEl.href = selectEl.value; }
    updateBtn();
    selectEl.addEventListener('change', updateBtn);
  }

  function loadDownloads() {
    if (!androidSelect && !windowsSelect) return;
    fetch('downloads.json')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { downloadsData = data; populateVersionSelect(androidSelect, androidBtn, data.android || []); populateVersionSelect(windowsSelect, windowsBtn, data.windows || []); downloadsLoaded = true; })
      .catch(function (err) { console.error('Erreur de chargement des téléchargements:', err); if (androidSelect) androidSelect.innerHTML = '<option>' + escapeHtml(window.i18n.t('download.error')) + '</option>'; if (windowsSelect) windowsSelect.innerHTML = '<option>' + escapeHtml(window.i18n.t('download.error')) + '</option>'; });
  }

  /* ── Serveurs ── */
  const SERVERS_API_URL = 'https://multicraft-servers.creatif-france.workers.dev';
  const SERVERS_PER_PAGE = 50;
  let serversLoaded = false;
  let allServers = [];
  let filteredServers = [];
  let serversDisplayedCount = 0;
  const serversContainer = document.getElementById('servers-container');
  const serverSearchInput = document.getElementById('server-search');
  const serversCountEl = document.getElementById('servers-count');
  const sortBySelect = document.getElementById('sort-by');
  const filterCountrySelect = document.getElementById('filter-country');

  function getServerCountry(server) {
    const text = (server.description || '') + ' ' + (server.server_name || '');
    const lowerText = text.toLowerCase();
    const countryPatterns = {
      'France': ['france', 'fr ', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', '🇫🇷'],
      'Allemagne': ['allemagne', 'germany', 'deutschland', 'de ', 'berlin', 'frankfurt', 'munich', 'münchen', 'hamburg', 'falkenstein', 'nuremberg', '🇩🇪'],
      'États-Unis': ['usa', 'united states', 'amérique', 'etats-unis', 'new york', 'california', 'texas', 'chicago', 'los angeles', 'miami', 'seattle', 'dallas', '🇺🇸', 'us '],
      'Royaume-Uni': ['uk', 'united kingdom', 'angleterre', 'royaume-uni', 'londres', 'london', 'manchester', 'écosse', 'scotland', '🏴', '🇬🇧'],
      'Canada': ['canada', 'quebec', 'québec', 'toronto', 'montreal', 'montréal', 'vancouver', 'ottawa', '🇨🇦'],
      'Australie': ['australia', 'australie', 'sydney', 'melbourne', 'brisbane', 'perth', '🇦🇺'],
      'Singapour': ['singapore', 'singapour', '🇸🇬'],
      'Hong Kong': ['hong kong', '🇭🇰'],
      'Finlande': ['finlande', 'finland', 'helsinki', '🇫🇮'],
      'Pays-Bas': ['pays-bas', 'netherlands', 'naaldwijk', 'amsterdam', 'rotterdam', 'hollande', '🇳🇱'],
      'Japon': ['japan', 'tokyo', 'japon', 'osaka', 'yokohama', '🇯🇵'],
      'Corée du Sud': ['korea', 'south korea', 'seoul', 'corée du sud', 'corée', '🇰🇷'],
      'Brésil': ['brazil', 'brésil', 'bresil', 'sao paulo', 'são paulo', 'rio de janeiro', '🇧🇷'],
      'Pologne': ['poland', 'pologne', 'warsaw', 'varsovie', 'cracovie', 'krakow', '🇵🇱'],
      'Suède': ['sweden', 'suède', 'suede', 'stockholm', 'göteborg', 'gothenburg', '🇸🇪'],
      'Belgique': ['belgium', 'belgique', 'bruxelles', 'brussels', 'anvers', 'antwerp', '🇧🇪'],
      'Suisse': ['switzerland', 'suisse', 'zurich', 'genève', 'geneve', 'berne', 'bern', '🇨🇭'],
      'Espagne': ['spain', 'espagne', 'madrid', 'barcelone', 'barcelona', 'séville', 'sevilla', 'valence', '🇪🇸'],
      'Portugal': ['portugal', 'lisbonne', 'lisbon', 'porto', '🇵🇹'],
      'Italie': ['italy', 'italie', 'rome', 'milan', 'milano', 'naples', 'turin', 'torino', '🇮🇹'],
      'Autriche': ['austria', 'autriche', 'vienne', 'vienna', 'salzbourg', 'salzburg', '🇦🇹'],
      'Norvège': ['norway', 'norvège', 'norvege', 'oslo', 'bergen', '🇳🇴'],
      'Danemark': ['denmark', 'danemark', 'copenhague', 'copenhagen', 'aarhus', '🇩🇰'],
      'Irlande': ['ireland', 'irlande', 'dublin', 'cork', '🇮🇪'],
      'République tchèque': ['czech', 'tchèque', 'tcheque', 'prague', '🇨🇿'],
      'Roumanie': ['romania', 'roumanie', 'bucarest', 'bucharest', 'cluj', '🇷🇴'],
      'Hongrie': ['hungary', 'hongrie', 'budapest', '🇭🇺'],
      'Grèce': ['greece', 'grèce', 'grece', 'athènes', 'athens', 'thessalonique', '🇬🇷'],
      'Ukraine': ['ukraine', 'kiev', 'kyiv', 'kharkiv', '🇺🇦'],
      'Russie': ['russia', 'russie', 'moscou', 'moscow', 'saint-pétersbourg', 'saint petersburg', '🇷🇺'],
      'Turquie': ['turkey', 'turquie', 'istanbul', 'ankara', '🇹🇷'],
      'Bulgarie': ['bulgaria', 'bulgarie', 'sofia', '🇧🇬'],
      'Serbie': ['serbia', 'serbie', 'belgrade', '🇷🇸'],
      'Croatie': ['croatia', 'croatie', 'zagreb', 'split', '🇭🇷'],
      'Lituanie': ['lithuania', 'lituanie', 'vilnius', '🇱🇹'],
      'Lettonie': ['latvia', 'lettonie', 'riga', '🇱🇻'],
      'Estonie': ['estonia', 'estonie', 'tallinn', '🇪🇪'],
      'Slovaquie': ['slovakia', 'slovaquie', 'bratislava', '🇸🇰'],
      'Slovénie': ['slovenia', 'slovénie', 'slovenie', 'ljubljana', '🇸🇮'],
      'Islande': ['iceland', 'islande', 'reykjavik', '🇮🇸'],
      'Luxembourg': ['luxembourg', '🇱🇺'],
      'Maroc': ['morocco', 'maroc', 'casablanca', 'rabat', 'marrakech', '🇲🇦'],
      'Algérie': ['algeria', 'algérie', 'algerie', 'alger', 'algiers', '🇩🇿'],
      'Tunisie': ['tunisia', 'tunisie', 'tunis', '🇹🇳'],
      'Égypte': ['egypt', 'égypte', 'egypte', 'le caire', 'cairo', 'caire', 'alexandrie', '🇪🇬'],
      'Afrique du Sud': ['south africa', 'afrique du sud', 'johannesburg', 'le cap', 'cape town', 'pretoria', '🇿🇦'],
      'Nigéria': ['nigeria', 'nigéria', 'lagos', 'abuja', '🇳🇬'],
      'Sénégal': ['senegal', 'sénégal', 'dakar', '🇸🇳'],
      'Côte d\'Ivoire': ['ivory coast', 'côte d\'ivoire', 'cote d\'ivoire', 'abidjan', '🇨🇮'],
      'Inde': ['india', 'inde', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', '🇮🇳'],
      'Chine': ['china', 'chine', 'beijing', 'pékin', 'pekin', 'shanghai', 'shenzhen', 'guangzhou', '🇨🇳'],
      'Taïwan': ['taiwan', 'taïwan', 'taipei', '🇹🇼'],
      'Indonésie': ['indonesia', 'indonésie', 'indonesie', 'jakarta', 'bali', '🇮🇩'],
      'Malaisie': ['malaysia', 'malaisie', 'kuala lumpur', '🇲🇾'],
      'Thaïlande': ['thailand', 'thaïlande', 'thailande', 'bangkok', '🇹🇭'],
      'Vietnam': ['vietnam', 'hanoi', 'ho chi minh', 'saigon', '🇻🇳'],
      'Philippines': ['philippines', 'manille', 'manila', 'cebu', '🇵🇭'],
      'Émirats arabes unis': ['united arab emirates', 'émirats', 'emirats', 'dubai', 'dubaï', 'abu dhabi', '🇦🇪'],
      'Arabie saoudite': ['saudi arabia', 'arabie saoudite', 'riyad', 'riyadh', 'djeddah', 'jeddah', '🇸🇦'],
      'Israël': ['israel', 'israël', 'tel aviv', 'jérusalem', 'jerusalem', '🇮🇱'],
      'Mexique': ['mexico', 'mexique', 'mexico city', 'guadalajara', '🇲🇽'],
      'Argentine': ['argentina', 'argentine', 'buenos aires', 'cordoba', 'córdoba', '🇦🇷'],
      'Chili': ['chile', 'chili', 'santiago', 'valparaiso', '🇨🇱'],
      'Colombie': ['colombia', 'colombie', 'bogota', 'bogotá', 'medellin', 'medellín', '🇨🇴'],
      'Pérou': ['peru', 'pérou', 'lima', '🇵🇪'],
      'Nouvelle-Zélande': ['new zealand', 'nouvelle-zélande', 'nouvelle zelande', 'auckland', 'wellington', '🇳🇿']
    };
    for (const [country, patterns] of Object.entries(countryPatterns)) {
      for (const pattern of patterns) { if (lowerText.includes(pattern)) return country; }
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
      for (const pattern of patterns) { if (!lowerText.includes(pattern)) { match = false; break; } }
      if (match) return location;
    }
    return null;
  }

  function updateCountryFilter() {
    if (!filterCountrySelect) return;
    const countries = new Set();
    allServers.forEach(function (server) { countries.add(getServerCountry(server)); });
    const sortedCountries = Array.from(countries).sort();
    filterCountrySelect.innerHTML = '<option value="all">🌍 Tous les pays</option>';
    sortedCountries.forEach(function (country) {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = country;
      filterCountrySelect.appendChild(option);
    });
  }

  async function fetchAllServerRatings() {
    const ratings = new Map();
    try {
      const url = SUPABASE_URL + '/rest/v1/reviews?select=server_id,rating&limit=10000';
      const res = await fetch(url, { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Erreur chargement des notes (' + res.status + ')');
      const rows = await res.json();
      const totals = new Map();
      rows.forEach(function (row) {
        if (!row.server_id || typeof row.rating !== 'number') return;
        const current = totals.get(row.server_id) || { sum: 0, count: 0 };
        current.sum += row.rating;
        current.count += 1;
        totals.set(row.server_id, current);
      });
      totals.forEach(function (value, serverId) { ratings.set(serverId, { avg: value.sum / value.count, count: value.count }); });
    } catch (err) { console.error('Impossible de charger les notes des serveurs', err); }
    return ratings;
  }

  function applyServerRatings(servers, ratings) {
    servers.forEach(function (server) {
      const r = ratings.get(server.server_id);
      server._avgRating = r ? r.avg : null;
      server._reviewsCount = r ? r.count : 0;
    });
  }

  function applyFiltersAndSort() {
    if (!allServers.length) return;
    const searchQuery = serverSearchInput ? serverSearchInput.value : '';
    const sortType = sortBySelect ? sortBySelect.value : 'players-desc';
    const countryFilter = filterCountrySelect ? filterCountrySelect.value : 'all';
    let filtered = filterServers(searchQuery);
    if (countryFilter !== 'all') {
      filtered = filtered.filter(function (server) { return getServerCountry(server) === countryFilter; });
    }
    if (sortType === 'rating-desc' || sortType === 'rating-asc') {
      const rated = filtered.filter(function (s) { return s._avgRating != null; });
      const unrated = filtered.filter(function (s) { return s._avgRating == null; });
      rated.sort(function (a, b) { return sortType === 'rating-desc' ? b._avgRating - a._avgRating : a._avgRating - b._avgRating; });
      filtered = rated.concat(unrated);
    } else {
      filtered.sort(function (a, b) {
        const aPlayers = a.online ? (a.connected_players || 0) : -1;
        const bPlayers = b.online ? (b.connected_players || 0) : -1;
        return sortType === 'players-asc' ? aPlayers - bPlayers : bPlayers - aPlayers;
      });
    }
    filteredServers = filtered;
    renderServers(filtered);
  }

  function extractServers(data) {
    const found = new Map();
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.server_id) { if (!found.has(node.server_id)) found.set(node.server_id, node); return; }
      Object.keys(node).forEach(function (key) { walk(node[key]); });
    }
    walk(data);
    return Array.from(found.values());
  }

  function countLabel(n) { return n + ' ' + (n === 1 ? window.i18n.t('servers.count1') : window.i18n.t('servers.countN')); }

  function renderServerCard(server) {
    const online = !!server.online;
    const players = (online ? (server.connected_players || 0) : 0) + ' / ' + (server.max_players != null ? server.max_players : '?');
    const description = server.description ? escapeHtml(server.description) : window.i18n.t('servers.noDesc');
    const name = escapeHtml(server.server_name || window.i18n.t('servers.noName'));
    const adminName = server.admin_name ? escapeHtml(server.admin_name) : '';
    const country = getServerCountry(server);
    const location = extractServerLocation(server) || country;
    const discordBtn = server.url ? '<a href="' + escapeHtml(server.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-discord">Discord</a>' : '';
    const adminHtml = adminName ? '<div class="server-admin">👑 ' + adminName + '</div>' : '';
    const ratingHtml = server._avgRating != null ? '<span class="server-rating">★ ' + server._avgRating.toFixed(1) + ' <span class="server-rating-count">(' + server._reviewsCount + ')</span></span>' : '<span class="server-rating server-rating-none">' + window.i18n.t('servers.noRating') + '</span>';
    const serverDataAttr = escapeHtml(JSON.stringify(server));
    return '<article class="server-card"><div class="server-card-head"><div class="server-name-wrapper"><h2 class="server-name">' + name + '</h2><span class="server-location">📍 ' + escapeHtml(location) + '</span></div><span class="server-players' + (online ? '' : ' offline') + '"><span class="dot"></span>' + players + '</span></div>' + adminHtml + '<div class="server-meta-row">' + ratingHtml + '</div><p class="server-desc">' + description.substring(0, 100) + (description.length > 100 ? '...' : '') + '</p><div class="server-actions">' + discordBtn + '<button type="button" class="btn btn-players" data-server="' + serverDataAttr + '">' + window.i18n.t('servers.playersList') + '</button><button type="button" class="btn btn-primary btn-details" data-server="' + serverDataAttr + '">Détails</button></div></article>';
  }

  function bindServerCardActions() {
    if (!serversContainer) return;
    serversContainer.querySelectorAll('.btn-details').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try { const serverData = JSON.parse(btn.dataset.server); openServerDetailsModal(serverData); } catch (e) { console.error('Erreur lors du parsing des données du serveur', e); }
      });
    });
    serversContainer.querySelectorAll('.btn-players').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try { const serverData = JSON.parse(btn.dataset.server); openPlayersModal(serverData); } catch (e) { console.error('Erreur lors du parsing des données du serveur', e); }
      });
    });
  }

  function renderServers(list) {
    if (!serversContainer) return;
    if (!list) list = filteredServers;
    var oldBtn = document.getElementById('load-more-servers-btn');
    if (oldBtn) oldBtn.remove();
    serversDisplayedCount = 0;
    if (!list || !list.length) {
      serversContainer.innerHTML = '<div class="empty-state"><p>' + window.i18n.t('servers.empty') + '</p></div>';
    } else {
      var firstBatch = list.slice(0, SERVERS_PER_PAGE);
      serversDisplayedCount = firstBatch.length;
      serversContainer.innerHTML = firstBatch.map(renderServerCard).join('');
      bindServerCardActions();
      if (serversDisplayedCount < list.length) {
        renderLoadMoreButton(list);
      }
    }
    if (serversCountEl) serversCountEl.textContent = countLabel((list || []).length);
  }

  function renderLoadMoreButton(list) {
    var existingBtn = document.getElementById('load-more-servers-btn');
    if (existingBtn) existingBtn.remove();
    if (serversDisplayedCount >= list.length) return;
    var remaining = list.length - serversDisplayedCount;
    var nextCount = Math.min(SERVERS_PER_PAGE, remaining);
    var wrap = document.createElement('div');
    wrap.id = 'load-more-servers-btn';
    wrap.className = 'load-more-wrap';
    wrap.innerHTML = '<button class="btn btn-ghost load-more-btn">Charger ' + nextCount + ' serveurs de plus <span class="load-more-count">(' + remaining + ' restants)</span></button>';
    wrap.querySelector('button').addEventListener('click', function () { loadMoreServers(list); });
    serversContainer.after(wrap);
  }

  function loadMoreServers(list) {
    if (!serversContainer) return;
    var nextBatch = list.slice(serversDisplayedCount, serversDisplayedCount + SERVERS_PER_PAGE);
    serversDisplayedCount += nextBatch.length;
    var fragment = document.createDocumentFragment();
    nextBatch.forEach(function (server) {
      var tmp = document.createElement('div');
      tmp.innerHTML = renderServerCard(server);
      if (tmp.firstElementChild) fragment.appendChild(tmp.firstElementChild);
    });
    serversContainer.appendChild(fragment);
    bindServerCardActions();
    renderLoadMoreButton(list);
  }

  function filterServers(query) {
    const q = query.trim().toLowerCase();
    if (!q) return allServers.slice();
    return allServers.filter(function (s) {
      return (s.server_name && s.server_name.toLowerCase().indexOf(q) !== -1) ||
        (s.description && s.description.toLowerCase().indexOf(q) !== -1) ||
        (s.admin_name && s.admin_name.toLowerCase().indexOf(q) !== -1);
    });
  }

  async function loadServers() {
    try {
      const [res, ratings] = await Promise.all([fetch(SERVERS_API_URL), fetchAllServerRatings()]);
      if (!res.ok) throw new Error('Réponse API invalide (' + res.status + ')');
      const data = await res.json();
      allServers = extractServers(data);
      applyServerRatings(allServers, ratings);
      serversLoaded = true;
      updateCountryFilter();
      applyFiltersAndSort();
      handleServerShare();
    } catch (err) {
      console.error(err);
      if (serversContainer) serversContainer.innerHTML = '<div class="error-state"><p>' + window.i18n.t('servers.errorLoad') + '</p><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">Vérifiez votre connexion et réessayez dans un instant.</p></div>';
      if (serversCountEl) serversCountEl.textContent = '';
    }
  }

  const searchBtn = document.getElementById('search-btn');

  function triggerServerSearch() { if (!serversLoaded) return; applyFiltersAndSort(); }

  if (serverSearchInput) {
    serverSearchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); triggerServerSearch(); } });
    serverSearchInput.addEventListener('search', triggerServerSearch);
  }
  if (searchBtn) searchBtn.addEventListener('click', triggerServerSearch);
  if (sortBySelect) sortBySelect.addEventListener('change', function () { if (!serversLoaded) return; applyFiltersAndSort(); });
  if (filterCountrySelect) filterCountrySelect.addEventListener('change', function () { if (!serversLoaded) return; applyFiltersAndSort(); });

  /* ══════════════════════════════════════════════════════
     Système d'avis
     ══════════════════════════════════════════════════════ */
  function hasRecentlyReviewed(serverId) {
    const user = Deblock.getUser();
    if (user) return false;
    try { const data = JSON.parse(localStorage.getItem('mc_reviewed') || '{}'); const last = data[serverId]; return last && (Date.now() - last) < 3600000; } catch { return false; }
  }

  function markReviewed(serverId) {
    const user = Deblock.getUser();
    if (user) return;
    try { const data = JSON.parse(localStorage.getItem('mc_reviewed') || '{}'); data[serverId] = Date.now(); localStorage.setItem('mc_reviewed', JSON.stringify(data)); } catch { /* ignore */ }
  }

  async function fetchReviews(serverId) {
    const url = SUPABASE_URL + '/rest/v1/reviews?server_id=eq.' + encodeURIComponent(serverId) + '&order=created_at.desc&limit=50';
    const res = await fetch(url, { headers: getApiHeaders() });
    if (!res.ok) throw new Error('Erreur chargement avis (' + res.status + ')');
    return res.json();
  }

  async function submitReview(serverId, pseudo, rating, text) {
    const currentUser = Deblock.getUser();
    const payload = { server_id: serverId, pseudo: (pseudo || 'Anonyme').slice(0, 32).trim() || 'Anonyme', rating: rating, text: (text || '').slice(0, 280).trim() };
    if (currentUser) { payload.user_id = currentUser.id; payload.pseudo = Deblock.getDisplayName().slice(0, 32); }
    const res = await fetch(SUPABASE_URL + '/rest/v1/reviews', {
      method: 'POST',
      headers: Object.assign({}, getApiHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); if (err.code === '23505') throw new Error('already_reviewed'); throw new Error(err.message || 'Erreur soumission'); }
  }

  function buildStarsHtml(rating, total) { total = total || 5; let html = ''; for (let i = 1; i <= total; i++) { html += '<span class="review-star' + (i <= rating ? ' filled' : '') + '">★</span>'; } return html; }

  function buildAvgHtml(reviews) {
    if (!reviews.length) return '<span class="reviews-no-badge">' + window.i18n.t('reviews.noReviewsBadge') + '</span>';
    const avg = (reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length).toFixed(1);
    return '<span class="reviews-avg-badge">★ ' + avg + ' <span class="reviews-count">(' + reviews.length + ' avis)</span></span>';
  }

  function buildReviewCardsHtml(reviews) {
    if (!reviews.length) return '<p class="reviews-empty">' + window.i18n.t('reviews.noReviews') + '</p>';
    return reviews.map(function (r) {
      const verifiedBadge = r.user_id ? '<span class="review-deblock-badge">✓ Vérifié</span>' : '';
      return '<div class="review-card"><div class="review-header"><span class="review-stars">' + buildStarsHtml(r.rating) + '</span><span class="review-pseudo">' + escapeHtml(r.pseudo || 'Anonyme') + '</span>' + verifiedBadge + '<span class="review-date">' + escapeHtml(r.date || new Date(r.created_at).toLocaleDateString('fr-FR')) + '</span></div>' + (r.text ? '<p class="review-text">' + escapeHtml(r.text) + '</p>' : '') + '</div>';
    }).join('');
  }

  function bindStarPicker(picker) {
    if (!picker) return;
    const stars = picker.querySelectorAll('.star-pick');
    function refresh(selected, hovered) { stars.forEach(function (s) { const v = parseInt(s.dataset.val); s.classList.toggle('active', hovered ? v <= hovered : v <= selected); }); }
    stars.forEach(function (star) {
      star.addEventListener('mouseenter', function () { refresh(parseInt(picker.dataset.selected || 0), parseInt(star.dataset.val)); });
      star.addEventListener('mouseleave', function () { refresh(parseInt(picker.dataset.selected || 0), 0); });
      star.addEventListener('click', function () { picker.dataset.selected = star.dataset.val; refresh(parseInt(star.dataset.val), 0); });
    });
  }

  function renderReviewsSection(serverId) {
    const section = document.getElementById('modal-reviews-section');
    if (!section) return;
    const currentUser = Deblock.getUser();
    const alreadyReviewed = hasRecentlyReviewed(serverId);
    let formHtml;

    if (!currentUser) {
      formHtml = '<div class="review-deblock-prompt"><svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg><span>Connectez-vous pour laisser un avis vérifié.</span><button type="button" class="btn-deblock-inline" id="review-deblock-login-btn">' + window.i18n.t('reviews.loginBtn') + '</button></div>';
    } else if (alreadyReviewed) { formHtml = '<p class="review-already-done">' + window.i18n.t('reviews.alreadyDone') + '</p>'; }
    else {
      formHtml = '<div class="review-form" id="review-form-wrap"><p class="review-form-title">Laisser un avis en tant que <strong style="color:var(--green-muted)">' + escapeHtml(Deblock.getDisplayName()) + '</strong></p><div class="review-form-fields"><div class="review-form-row"><div class="review-star-picker" data-selected="0"><span class="review-star-picker-label">' + window.i18n.t('reviews.ratingLabel') + '</span><span class="star-pick" data-val="1">★</span><span class="star-pick" data-val="2">★</span><span class="star-pick" data-val="3">★</span><span class="star-pick" data-val="4">★</span><span class="star-pick" data-val="5">★</span></div></div><textarea class="review-input review-text-input" placeholder="' + window.i18n.t('reviews.placeholder') + '" maxlength="280" rows="2"></textarea><div class="review-form-footer"><span class="review-char-count" id="review-char-count">0 / 280</span><button type="button" class="btn btn-primary review-submit-btn">Publier</button></div></div></div>';
    }

    section.innerHTML = '<div class="reviews-divider"></div><div class="reviews-header"><h3 class="reviews-title">' + window.i18n.t('reviews.title') + '</h3><div class="reviews-header-right"><span class="reviews-avg-wrap"><span class="reviews-no-badge">' + window.i18n.t('reviews.loading') + '</span></span><select class="reviews-sort-select" id="reviews-sort-select" aria-label="Trier les avis"><option value="recent">' + window.i18n.t('reviews.sortRecent') + '</option><option value="desc">' + window.i18n.t('reviews.sortDesc') + '</option><option value="asc">' + window.i18n.t('reviews.sortAsc') + '</option></select></div></div><div class="reviews-list" id="reviews-list-inner"><div class="reviews-spinner"><div class="spinner"></div></div></div>' + formHtml;
    const reviewLoginBtn = section.querySelector('#review-deblock-login-btn');
    if (reviewLoginBtn) reviewLoginBtn.addEventListener('click', function () { if (!Deblock.getUser()) openLoginModal(); });
    bindStarPicker(section.querySelector('.review-star-picker'));
    const textarea = section.querySelector('.review-text-input');
    const charCount = section.querySelector('#review-char-count');
    if (textarea && charCount) { textarea.addEventListener('input', function () { charCount.textContent = textarea.value.length + ' / 280'; }); }
    const submitBtn = section.querySelector('.review-submit-btn');
    const picker = section.querySelector('.review-star-picker');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        const rating = picker ? parseInt(picker.dataset.selected || 0) : 0;
        if (!rating) { if (picker) { picker.classList.add('shake'); setTimeout(function () { picker.classList.remove('shake'); }, 450); } return; }
        const pseudo = currentUser ? Deblock.getDisplayName() : '';
        const text = textarea ? textarea.value.trim() : '';
        submitBtn.disabled = true;
        submitBtn.textContent = '…';
        submitReview(serverId, pseudo, rating, text)
          .then(function () { markReviewed(serverId); const form = document.getElementById('review-form-wrap'); if (form) form.innerHTML = '<p class="review-success-msg">' + window.i18n.t('reviews.success') + '</p>'; return fetchReviews(serverId); })
          .then(function (reviews) { refreshReviewsList(reviews, section); })
          .catch(function (err) { console.error(err); submitBtn.disabled = false; submitBtn.textContent = 'Publier'; const msg = err.message === 'already_reviewed' ? window.i18n.t('reviews.alreadyLeft') : window.i18n.t('reviews.error') + escapeHtml(err.message); submitBtn.insertAdjacentHTML('afterend', '<p class="review-error-msg">' + msg + '</p>'); });
      });
    }
    fetchReviews(serverId).then(function (reviews) { refreshReviewsList(reviews, section); const sortSelect = section.querySelector('#reviews-sort-select'); if (sortSelect) { sortSelect.addEventListener('change', function () { refreshReviewsList(reviews, section); }); } }).catch(function () { const list = document.getElementById('reviews-list-inner'); if (list) list.innerHTML = '<p class="reviews-empty">Impossible de charger les avis.</p>'; });
  }

  function sortReviews(reviews, mode) { const sorted = reviews.slice(); if (mode === 'desc') sorted.sort(function (a, b) { return b.rating - a.rating; }); else if (mode === 'asc') sorted.sort(function (a, b) { return a.rating - b.rating; }); return sorted; }

  function refreshReviewsList(reviews, section) { const sortSelect = section.querySelector('#reviews-sort-select'); const mode = sortSelect ? sortSelect.value : 'recent'; const sorted = sortReviews(reviews, mode); const list = document.getElementById('reviews-list-inner'); if (list) list.innerHTML = buildReviewCardsHtml(sorted); const avgWrap = section.querySelector('.reviews-avg-wrap'); if (avgWrap) avgWrap.innerHTML = buildAvgHtml(reviews); }

  /* ── Pop-up "Rejoindre" ── */
  const serverModal = document.getElementById('server-modal');
  const modalServerName = document.getElementById('modal-server-name');
  const modalCode = document.getElementById('modal-code');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCloseBtn2 = document.getElementById('modal-close-btn-2');
  let modalCopyResetTimer = null;

  function syncModalOpenState() { const serverModalOpen = !!(serverModal && !serverModal.hidden); const playersModalOpen = !!(playersModal && !playersModal.hidden); document.body.classList.toggle('modal-open', serverModalOpen || playersModalOpen); }

  function openServerDetailsModal(server) {
    if (!serverModal) return;
    const name = server.server_name || window.i18n.t('servers.noName');
    const description = server.description || 'Aucune description disponible.';
    const code = server.server_id || '';
    const players = server.online ? (server.connected_players || 0) : 0;
    const maxPlayers = server.max_players != null ? server.max_players : '?';
    const onlineStatus = server.online ? '🟢 En ligne' : '🔴 Hors ligne';
    const url = server.url || null;
    const adminName = server.admin_name || 'Non spécifié';
    const country = getServerCountry(server);
    const location = extractServerLocation(server) || country;
    if (modalServerName) modalServerName.textContent = name;
    if (modalCode) modalCode.textContent = code;
    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = '<div class="modal-details"><div class="modal-status ' + (server.online ? 'online' : 'offline') + '"><span class="status-dot"></span>' + onlineStatus + '</div><div class="modal-description"><h3>Description</h3><p>' + escapeHtml(description) + '</p></div><div class="modal-info-grid"><div class="modal-info-item"><span class="modal-info-label">👥 Joueurs</span><span class="modal-info-value">' + players + ' / ' + maxPlayers + '</span></div><div class="modal-info-item"><span class="modal-info-label">👑 Administrateur</span><span class="modal-info-value">' + escapeHtml(adminName) + '</span></div><div class="modal-info-item"><span class="modal-info-label">📍 Localisation</span><span class="modal-info-value">' + escapeHtml(location) + '</span></div></div>' + (url ? '<div class="modal-deblock-link"><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-deblock">Rejoindre Discord</a></div>' : '') + '</div>';
    }
    serverModal.hidden = false;
    syncModalOpenState();
    renderReviewsSection(code);
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
      shareBtn.onclick = function () {
        const shareUrl = window.location.origin + window.location.pathname + '#serveurs?server=' + encodeURIComponent(code);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () { shareBtn.textContent = '✅ Lien copié !'; setTimeout(function () { shareBtn.textContent = window.i18n.t('modal.share'); }, 2000); }).catch(function () { fallbackCopyText(shareUrl); shareBtn.textContent = '✅ Lien copié !'; setTimeout(function () { shareBtn.textContent = window.i18n.t('modal.share'); }, 2000); });
        } else { fallbackCopyText(shareUrl); shareBtn.textContent = '✅ Lien copié !'; setTimeout(function () { shareBtn.textContent = window.i18n.t('modal.share'); }, 2000); }
      };
    }
    const modalEyebrow = document.querySelector('.modal-eyebrow');
    if (modalEyebrow) modalEyebrow.textContent = window.i18n.t('modal.serverInfo');
  }

  function handleServerShare() {
    let serverId = null;
    const hash = window.location.hash;
    if (hash && hash.includes('?server=')) { const hashParts = hash.split('?'); if (hashParts.length > 1) { const params = new URLSearchParams(hashParts[1]); serverId = params.get('server'); } }
    if (!serverId) { const params = new URLSearchParams(window.location.search); serverId = params.get('server'); }
    if (serverId && allServers.length > 0) { const server = allServers.find(function (s) { return s.server_id === serverId; }); if (server) { if (!document.getElementById('page-serveurs').classList.contains('active')) navigateTo('serveurs'); setTimeout(function () { openServerDetailsModal(server); }, 300); } }
  }

  function openServerModal(name, code) { if (!serverModal) return; if (modalServerName) modalServerName.textContent = name || window.i18n.t('modal.server'); if (modalCode) modalCode.textContent = code || '—'; if (modalCopyBtn) modalCopyBtn.textContent = window.i18n.t('modal.copy'); serverModal.hidden = false; syncModalOpenState(); }

  function closeServerModal() { if (!serverModal) return; serverModal.hidden = true; syncModalOpenState(); }

  function fallbackCopyText(text) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } document.body.removeChild(ta); }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', function () {
      const code = modalCode ? modalCode.textContent : '';
      if (!code) return;
      function showCopied() { modalCopyBtn.textContent = 'Copié ✓'; clearTimeout(modalCopyResetTimer); modalCopyResetTimer = setTimeout(function () { modalCopyBtn.textContent = window.i18n.t('modal.copy'); }, 1600); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(showCopied).catch(function () { fallbackCopyText(code); showCopied(); });
      else { fallbackCopyText(code); showCopied(); }
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeServerModal);
  if (modalCloseBtn2) modalCloseBtn2.addEventListener('click', closeServerModal);
  if (serverModal) serverModal.addEventListener('click', function (e) { if (e.target === serverModal) closeServerModal(); });

  /* ── Pop-up "Liste des joueurs" ── */
  const PLAYERS_API_URL = 'https://autumn-shadow-2f3a.creatif-france.workers.dev/';
  const playersModal = document.getElementById('players-modal');
  const playersModalTitle = document.getElementById('players-modal-title');
  const playersModalCount = document.getElementById('players-modal-count');
  const playersListContainer = document.getElementById('players-list-container');
  const playersSearchInput = document.getElementById('players-search-input');
  const playersModalCloseBtn = document.getElementById('players-modal-close-btn');
  const playersModalCloseBtn2 = document.getElementById('players-modal-close-btn-2');
  let currentPlayersList = [];
  let playersFetchAbortController = null;

  function genderIcon(gender) { switch (gender) { case 'staff': return '🛡️'; case 'admin': return '👑'; case 'female': return '♀️'; case 'male': return '♂️'; default: return '👤'; } }

  function renderPlayerTagHtml(tag, fallbackName) {
    if (!tag) return '<span class="player-name">' + escapeHtml(fallbackName || '') + '</span>';
    const ESC = '\u001b';
    let out = '', currentColor = null, inBadge = false, buffer = '', badgeBuffer = '', i = 0;
    function colorSpan(text) { if (!text) return ''; const style = currentColor ? ' style="color:' + escapeHtml(currentColor) + '"' : ''; return '<span' + style + '>' + escapeHtml(text) + '</span>'; }
    function flushBuffer() { if (buffer) { out += colorSpan(buffer); buffer = ''; } }
    while (i < tag.length) {
      const ch = tag[i];
      if (ch === ESC) {
        const next = tag[i + 1];
        if (next === '(') { const closeIdx = tag.indexOf(')', i + 2); if (closeIdx === -1) { i += 1; continue; } const code = tag.slice(i + 2, closeIdx); const atIdx = code.indexOf('@'); const key = atIdx === -1 ? code : code.slice(0, atIdx); const value = atIdx === -1 ? '' : code.slice(atIdx + 1); if (key === 'c') { flushBuffer(); currentColor = value || null; } else if (key === 'T') { flushBuffer(); inBadge = true; badgeBuffer = ''; } i = closeIdx + 1; continue; }
        if (next === 'E') { if (inBadge) { const style = currentColor ? ' style="border-color:' + escapeHtml(currentColor) + ';color:' + escapeHtml(currentColor) + '"' : ''; out += '<span class="player-badge"' + style + '>' + escapeHtml(badgeBuffer) + '</span>'; inBadge = false; badgeBuffer = ''; } i += 2; continue; }
        i += 1; continue;
      }
      if (inBadge) badgeBuffer += ch;
      else buffer += ch;
      i += 1;
    }
    flushBuffer(); if (inBadge && badgeBuffer) out += colorSpan(badgeBuffer);
    return '<span class="player-name">' + out + '</span>';
  }

  function renderPlayersList(players, query) {
    if (!playersListContainer) return;
    if (!players.length) { playersListContainer.innerHTML = '<div class="empty-state"><p>' + window.i18n.t('modal.noPlayers') + '</p></div>'; return; }
    const q = (query || '').trim().toLowerCase();
    const list = q ? players.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1; }) : players;
    if (!list.length) { playersListContainer.innerHTML = '<div class="empty-state"><p>' + window.i18n.t('modal.noPlayerMatch') + '</p></div>'; return; }
    playersListContainer.innerHTML = list.map(function (p) { const icon = genderIcon(p.gender); const nameHtml = renderPlayerTagHtml(p.tag, p.name); return '<div class="player-row"><span class="player-icon" aria-hidden="true">' + icon + '</span>' + nameHtml + '</div>'; }).join('');
  }

  function openPlayersModal(server) {
    if (!playersModal) return;
    const name = server.server_name || window.i18n.t('modal.server');
    const serverId = server.server_id || '';
    if (playersModalTitle) playersModalTitle.textContent = name;
    if (playersSearchInput) playersSearchInput.value = '';
    currentPlayersList = [];
    if (playersModalCount) playersModalCount.textContent = '';
    if (playersListContainer) playersListContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>' + window.i18n.t('modal.loadingPlayers') + '</p></div>';
    playersModal.hidden = false;
    syncModalOpenState();
    if (!serverId) { playersListContainer.innerHTML = '<div class="error-state"><p>' + window.i18n.t('modal.noInviteCode') + '</p></div>'; return; }
    if (playersFetchAbortController) playersFetchAbortController.abort();
    playersFetchAbortController = new AbortController();
    fetch(PLAYERS_API_URL + '?server_id=' + encodeURIComponent(serverId), { signal: playersFetchAbortController.signal })
      .then(function (res) { if (!res.ok) throw new Error('Réponse API invalide (' + res.status + ')'); return res.json(); })
      .then(function (data) { const players = Array.isArray(data.players) ? data.players : []; const max = data.max_players != null ? data.max_players : (server.max_players != null ? server.max_players : '?'); currentPlayersList = players; if (playersModalCount) playersModalCount.textContent = players.length + ' / ' + max + ' ' + (players.length === 1 ? window.i18n.t('modal.playerOnline1') : window.i18n.t('modal.playerOnlineN')); renderPlayersList(players, playersSearchInput ? playersSearchInput.value : ''); })
      .catch(function (err) { if (err && err.name === 'AbortError') return; console.error(err); if (playersListContainer) playersListContainer.innerHTML = '<div class="error-state"><p>' + window.i18n.t('modal.errorPlayers') + '</p><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">' + window.i18n.t('modal.errorPlayersHint') + '</p></div>'; });
  }

  function closePlayersModal() { if (!playersModal) return; playersModal.hidden = true; syncModalOpenState(); if (playersFetchAbortController) playersFetchAbortController.abort(); }
  if (playersSearchInput) playersSearchInput.addEventListener('input', function () { renderPlayersList(currentPlayersList, playersSearchInput.value); });
  if (playersModalCloseBtn) playersModalCloseBtn.addEventListener('click', closePlayersModal);
  if (playersModalCloseBtn2) playersModalCloseBtn2.addEventListener('click', closePlayersModal);
  if (playersModal) playersModal.addEventListener('click', function (e) { if (e.target === playersModal) closePlayersModal(); });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (playersModal && !playersModal.hidden) { closePlayersModal(); return; } if (serverModal && !serverModal.hidden) closeServerModal(); });

  /* ── Language change ── */
  document.addEventListener('langchange', function () { if (serversLoaded) renderServers(); if (updatesLoaded && updatesContainer) { updatesLoaded = false; serversLoaded = false; loadUpdates(); loadServers(); } var dcPage = document.getElementById('page-le-jeu'); if (dcPage && dcPage.classList.contains('active')) renderDatacenters(); if (downloadsLoaded && downloadsData) { populateVersionSelect(androidSelect, androidBtn, downloadsData.android || []); populateVersionSelect(windowsSelect, windowsBtn, downloadsData.windows || []); } var modalCopyBtn = document.getElementById('modal-copy-btn'); if (modalCopyBtn && !modalCopyBtn._copied) modalCopyBtn.textContent = window.i18n.t('modal.copy'); });

  /* ── Son ── */
  document.addEventListener('click', function (e) { const target = e.target.closest('a, button, [role="button"]'); if (target) { const audio = new Audio('btn_press.ogg'); audio.play().catch(function (err) { console.warn('Impossible de jouer le son :', err); }); } });

  /* ── Fonctions du chat ── */

  function switchChatTab(tab, partnerId, partnerName) {
    currentChatTab = tab;

    document.querySelectorAll('.chat-tab').forEach(function (el) {
      el.classList.remove('active');
    });

    var tabEl = document.querySelector('.chat-tab[data-tab="' + tab + '"]');
    if (tabEl) tabEl.classList.add('active');

    var privateTab = document.getElementById('private-tab');
    if (privateTab) {
      if (tab === 'private' && partnerId) {
        privateTab.removeAttribute('hidden');
        privateTab.textContent = '💬 ' + (partnerName || 'Privé');
      } else if (tab !== 'private') {
        privateTab.setAttribute('hidden', '');
      }
    }

    var title = document.getElementById('chat-title');
    if (title) {
      var titles = {
        'global': 'Global <span class="chat-header-title-accent">Chat</span>',
        'french': '🇫🇷 <span class="chat-header-title-accent">French</span>',
        'english': '🇬🇧 <span class="chat-header-title-accent">English</span>',
        'private': '💬 <span class="chat-header-title-accent">Privé</span>'
      };
      title.innerHTML = titles[tab] || titles.global;
    }

    loadChatMessagesForTab(tab, partnerId);
  }

  function startPrivateChat(userId, username) {
    const currentUser = Deblock.getUser();
    if (!currentUser) {
      showTemporaryNotification('❌ Connectez-vous pour envoyer des messages privés');
      return;
    }
    if (userId === currentUser.id) {
      showTemporaryNotification('❌ Vous ne pouvez pas vous envoyer un message à vous-même');
      return;
    }
    currentPrivatePartner = userId;
    var chatWindow = document.getElementById('chat-window');
    if (chatWindow && chatWindow.hidden) {
      openChat();
    }
    switchChatTab('private', userId, username);
    showTemporaryNotification('💬 Conversation privée avec ' + username, true);
  }

  async function loadChatMessagesForTab(tab, partnerId) {
    const currentUser = Deblock.getUser();
    chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) {
      console.error('chatMessagesEl not found');
      return;
    }

    var hasVisibleMessages = !!chatMessagesEl.querySelector('.chat-msg');
    if (!hasVisibleMessages) {
      chatMessagesEl.innerHTML = '<p class="chat-loading">Chargement…</p>';
    }

    try {
      var url;
      if (tab === 'private' && partnerId && currentUser) {
        url = SUPABASE_URL + '/rest/v1/private_messages?select=*&or=(sender_id.eq.' +
          currentUser.id + ',receiver_id.eq.' + currentUser.id +
          ')&order=created_at.asc&limit=50';
      } else {
        url = SUPABASE_URL + '/rest/v1/global_chat?select=*&channel=eq.' + tab + '&order=created_at.desc&limit=50';
      }

      var res = await fetch(url, { headers: getApiHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var msgs = await res.json();

      if (tab === 'private') {
        msgs = msgs.filter(function (m) {
          return (m.sender_id === currentUser.id && m.receiver_id === partnerId) ||
            (m.sender_id === partnerId && m.receiver_id === currentUser.id);
        });
      }

      msgs.reverse();
      chatMessages = msgs;

      if (msgs.length === 0) {
        chatMessagesEl.innerHTML = '<p class="chat-empty">Aucun message pour le moment.</p>';
      } else {
        var isFirstLoad = !hasVisibleMessages;
        var wasAtBottom = chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop - chatMessagesEl.clientHeight < 60;

        if (isFirstLoad) {
          renderMessagesForTab(msgs, tab);
          scrollToBottom();
        } else {
          appendNewMessagesForTab(msgs, tab);
          if (wasAtBottom) scrollToBottom();
        }
      }

      if (chatOpen) {
        markChatAsSeen();
      }
    } catch (err) {
      console.error('Erreur chargement messages:', err);
      if (!hasVisibleMessages) {
        chatMessagesEl.innerHTML = '<p class="chat-error">Impossible de charger les messages.</p>';
      }
    }
  }

  function renderMessagesForTab(msgs, tab) {
    chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;

    if (tab === 'private') {
      chatMessagesEl.innerHTML = msgs.map(buildPrivateMessageHtml).join('');
    } else {
      chatMessagesEl.innerHTML = msgs.map(buildMessageHtml).join('');
    }
    addMessageActions();
  }

  function appendNewMessagesForTab(msgs, tab) {
    chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;

    var existingIds = {};
    chatMessagesEl.querySelectorAll('[data-msg-id]').forEach(function (el) {
      existingIds[el.getAttribute('data-msg-id')] = el;
    });

    var fragment = document.createDocumentFragment();
    msgs.forEach(function (msg) {
      var id = String(msg.id);
      if (existingIds[id]) {
        var newHtml = tab === 'private' ? buildPrivateMessageHtml(msg) : buildMessageHtml(msg);
        var tmp = document.createElement('div');
        tmp.innerHTML = newHtml;
        var newEl = tmp.firstElementChild;
        if (newEl && existingIds[id].outerHTML !== newEl.outerHTML) {
          existingIds[id].replaceWith(newEl);
        }
      } else {
        var html = tab === 'private' ? buildPrivateMessageHtml(msg) : buildMessageHtml(msg);
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = html;
        if (tmp2.firstElementChild) fragment.appendChild(tmp2.firstElementChild);
      }
    });
    chatMessagesEl.appendChild(fragment);
    addMessageActions();
  }

  function buildPrivateMessageHtml(msg) {
    const currentUser = Deblock.getUser();
    var isSelf = currentUser && msg.sender_id === currentUser.id;
    var senderName = isSelf ? msg.sender_username : msg.receiver_username;
    var avatar = isSelf ? Deblock.getAvatarUrl() : '';

    var avatarHtml = avatar
      ? '<img class="chat-msg-avatar" src="' + escapeHtmlChat(avatar) + '" alt="' + escapeHtmlChat(senderName) + '" loading="lazy">'
      : '<div class="chat-msg-avatar" style="background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-muted);border-radius:50%;">' + escapeHtmlChat(senderName.charAt(0).toUpperCase()) + '</div>';

    var time = msg.created_at ? formatTime(msg.created_at) : '';
    var userDisplay = senderName || 'Anonyme';

    return '<div class="chat-msg' + (isSelf ? ' self' : '') + '" data-msg-id="' + escapeHtmlChat(msg.id) + '">'
      + avatarHtml
      + '<div class="chat-msg-content">'
      + '<span class="chat-msg-user">' + escapeHtmlChat(userDisplay) + ' <span style="font-size:0.6rem;color:var(--text-dim);">(privé)</span></span>'
      + '<div class="chat-msg-bubble">' + escapeHtmlChat(msg.message) + '</div>'
      + '<span class="chat-msg-time">' + time + '</span>'
      + '</div>'
      + '</div>';
  }

  function scrollToBottom() {
    chatMessagesEl = document.getElementById('chat-messages');
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }

  function escapeHtmlChat(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(isoString) {
    try {
      var d = new Date(isoString);
      var h = d.getHours().toString().padStart(2, '0');
      var m = d.getMinutes().toString().padStart(2, '0');
      return h + ':' + m;
    } catch (e) {
      return '';
    }
  }

  function buildMessageHtml(msg) {
    const currentUser = Deblock.getUser();
    var isSelf = currentUser && msg.user_id === currentUser.id;
    var avatar = msg.avatar_url
      ? '<img class="chat-msg-avatar" src="' + escapeHtmlChat(msg.avatar_url) + '" alt="' + escapeHtmlChat(msg.username) + '" loading="lazy">'
      : '<div class="chat-msg-avatar" style="background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-muted);border-radius:50%;">' + escapeHtmlChat(msg.username ? msg.username.charAt(0).toUpperCase() : '?') + '</div>';

    var time = msg.created_at ? formatTime(msg.created_at) : '';
    var userDisplay = msg.username || 'Anonyme';
    var isAdminUserFlag = isAdminUser(msg.user_id);
    var adminBadge = isAdminUserFlag ? ' <span style="color:#22c55e;font-size:0.6rem;">🛡️ Admin</span>' : '';
    var editedIndicator = msg.is_edited ? ' <span style="font-size:0.6rem;color:var(--text-dim);font-style:italic;">(modifié)</span>' : '';
    var currentUserId = currentUser ? currentUser.id : null;
    var censoredIndicator = (msg.is_censored && isAdminUser(currentUserId))
      ? ' <span style="font-size:0.6rem;color:#fbbf24;font-style:italic;">(censuré)</span>' : '';
    var channelBadge = msg.channel && msg.channel !== 'global'
      ? ' <span style="font-size:0.5rem;color:var(--text-dim);background:rgba(255,255,255,0.05);padding:1px 6px;border-radius:8px;">#' + escapeHtmlChat(msg.channel) + '</span>'
      : '';

    return '<div class="chat-msg' + (isSelf ? ' self' : '') + '" data-msg-id="' + escapeHtmlChat(msg.id) + '">'
      + avatar
      + '<div class="chat-msg-content">'
      + '<span class="chat-msg-user">' + escapeHtmlChat(userDisplay) + adminBadge + channelBadge + '</span>'
      + '<div class="chat-msg-bubble">' + escapeHtmlChat(msg.message) + '</div>'
      + '<span class="chat-msg-time">' + time + editedIndicator + censoredIndicator + '</span>'
      + '</div>'
      + '</div>';
  }

  function removeMessageFromUI(messageId) {
    var msgElement = document.querySelector('[data-msg-id="' + messageId + '"]');
    if (msgElement) {
      msgElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      msgElement.style.opacity = '0';
      msgElement.style.transform = 'scale(0.9)';
      setTimeout(function () {
        if (msgElement.parentNode) msgElement.remove();
      }, 300);
    }
    chatMessages = chatMessages.filter(function (m) { return m.id !== messageId; });
  }

  async function deleteChatMessage(messageId, msgUserId) {
    const currentUser = Deblock.getUser();
    if (!currentUser) return;
    var isAdmin = isAdminUser(currentUser.id);
    var isOwner = currentUser.id === msgUserId;
    if (!isAdmin && !isOwner) {
      showTemporaryNotification('❌ Vous ne pouvez pas supprimer ce message');
      return;
    }
    try {
      var table = currentChatTab === 'private' ? 'private_messages' : 'global_chat';
      var url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + messageId;
      var res = await fetch(url, { method: 'DELETE', headers: getApiHeaders() });
      if (res.status === 404) {
        removeMessageFromUI(messageId);
        showTemporaryNotification('✅ Message supprimé', true);
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      removeMessageFromUI(messageId);
      showTemporaryNotification('✅ Message supprimé', true);
    } catch (err) {
      console.error('Erreur suppression:', err);
      removeMessageFromUI(messageId);
      showTemporaryNotification('✅ Message retiré', true);
    }
  }

  async function editChatMessage(messageId, newText, msgUserId) {
    const currentUser = Deblock.getUser();
    if (!currentUser) return;
    var isAdmin = isAdminUser(currentUser.id);
    var isOwner = currentUser.id === msgUserId;
    if (!isAdmin && !isOwner) {
      showTemporaryNotification('❌ Vous ne pouvez pas modifier ce message');
      return;
    }
    newText = newText.trim();
    if (!newText || newText.length > 500) {
      showTemporaryNotification('❌ Message invalide');
      return;
    }
    var badWordCheck = hasBadWords(newText);
    if (badWordCheck.found && (badWordCheck.category === 'raciste' || badWordCheck.category === 'homophobe')) {
      showTemporaryNotification('❌ Message bloqué - contenu raciste/homophobe interdit');
      return;
    }
    var finalText = badWordCheck.found ? censorMessage(newText) : newText;
    try {
      var table = currentChatTab === 'private' ? 'private_messages' : 'global_chat';
      var url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + messageId;
      var res = await fetch(url, {
        method: 'PATCH',
        headers: Object.assign({}, getApiHeaders(), { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ message: finalText, is_edited: true }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var updated = await res.json();
      if (updated && updated.length > 0) {
        updateMessageUI(messageId, finalText);
        showTemporaryNotification('✅ Message modifié', true);
      }
    } catch (err) {
      console.error('Erreur modification:', err);
      showTemporaryNotification('❌ Erreur lors de la modification');
    }
  }

  function updateMessageUI(messageId, finalText) {
    var msgElement = document.querySelector('[data-msg-id="' + messageId + '"]');
    if (msgElement) {
      var bubble = msgElement.querySelector('.chat-msg-bubble');
      if (bubble) bubble.textContent = finalText;
      var timeElement = msgElement.querySelector('.chat-msg-time');
      if (timeElement && !timeElement.textContent.includes('modifié')) {
        timeElement.textContent = timeElement.textContent + ' modifié';
      }
    }
    var msgIndex = chatMessages.findIndex(function (m) { return m.id === messageId; });
    if (msgIndex !== -1) {
      chatMessages[msgIndex].message = finalText;
      chatMessages[msgIndex].is_edited = true;
    }
  }

  function addMessageActions() {
    const currentUser = Deblock.getUser();
    if (!currentUser) return;
    document.querySelectorAll('.chat-msg').forEach(function (msgElement) {
      if (msgElement.querySelector('.chat-msg-actions')) return;

      var msgId = msgElement.dataset.msgId;
      var msg = chatMessages.find(function (m) { return m.id === msgId; });
      if (!msg) return;

      var isAdmin = isAdminUser(currentUser.id);
      var isOwner = currentUser.id === msg.user_id || currentUser.id === msg.sender_id;
      var mod = canModerate(currentUser.id);
      if (!isAdmin && !isOwner && !mod) return;

      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'chat-msg-actions';
      actionsDiv.style.cssText = 'display: flex; gap: 4px; margin-top: 4px;';

      // Bouton Message Privé
      if (msg.user_id && msg.user_id !== currentUser.id && currentChatTab !== 'private') {
        var privateBtn = document.createElement('button');
        privateBtn.className = 'chat-action-btn private';
        privateBtn.textContent = '💬';
        privateBtn.title = 'Message privé';
        privateBtn.style.cssText = 'background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s;';
        privateBtn.onmouseover = function () {
          this.style.background = 'rgba(34, 197, 94, 0.15)';
          this.style.color = '#22c55e';
        };
        privateBtn.onmouseout = function () {
          this.style.background = 'none';
          this.style.color = 'var(--text-dim)';
        };
        privateBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          startPrivateChat(msg.user_id, msg.username);
        });
        actionsDiv.appendChild(privateBtn);
      }

      if (isAdmin || mod) {
        var viewBtn = document.createElement('button');
        viewBtn.className = 'chat-action-btn';
        viewBtn.textContent = '👁️';
        viewBtn.title = "Voir l'original";
        viewBtn.style.cssText = 'background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s;';
        viewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (msg.original_message) {
            alert('Message original:\n' + msg.original_message + '\n\n(Message censuré affiché)');
          } else {
            alert('Message original:\n' + msg.message);
          }
        });
        actionsDiv.appendChild(viewBtn);
      }

      if (isOwner || isAdmin || mod) {
        var editBtn = document.createElement('button');
        editBtn.className = 'chat-action-btn';
        editBtn.textContent = '✏️';
        editBtn.title = 'Modifier';
        editBtn.style.cssText = 'background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s;';
        editBtn.onmouseover = function () {
          this.style.background = 'rgba(255,255,255,0.05)';
          this.style.color = 'var(--text)';
        };
        editBtn.onmouseout = function () {
          this.style.background = 'none';
          this.style.color = 'var(--text-dim)';
        };
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var bubble = msgElement.querySelector('.chat-msg-bubble');
          if (!bubble) return;
          var currentText = bubble.textContent;
          var newText = prompt('Modifier le message:', currentText);
          if (newText !== null && newText !== currentText) {
            editChatMessage(msgId, newText, msg.user_id || msg.sender_id);
          }
        });
        actionsDiv.appendChild(editBtn);
      }

      if (isOwner || isAdmin || mod) {
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-action-btn delete';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Supprimer';
        deleteBtn.style.cssText = 'background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s;';
        deleteBtn.onmouseover = function () {
          this.style.background = 'rgba(255,100,100,0.1)';
          this.style.color = '#f87171';
        };
        deleteBtn.onmouseout = function () {
          this.style.background = 'none';
          this.style.color = 'var(--text-dim)';
        };
        deleteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (confirm('Supprimer ce message ?')) {
            deleteChatMessage(msgId, msg.user_id || msg.sender_id);
          }
        });
        actionsDiv.appendChild(deleteBtn);
      }

      if (isAdmin || mod) {
        var banBtn = document.createElement('button');
        banBtn.className = 'chat-action-btn ban';
        banBtn.textContent = '🚫';
        banBtn.title = "Bannir l'utilisateur";
        banBtn.style.cssText = 'background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s;';
        banBtn.onmouseover = function () {
          this.style.background = 'rgba(255,50,50,0.15)';
          this.style.color = '#ff4444';
        };
        banBtn.onmouseout = function () {
          this.style.background = 'none';
          this.style.color = 'var(--text-dim)';
        };
        banBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var userToBan = msg.user_id || msg.sender_id;
          var userName = msg.username || 'Inconnu';
          var reason = prompt('Raison du bannissement de "' + userName + '" ?', 'Comportement inapproprié');
          if (reason !== null && confirm('Bannir définitivement "' + userName + '" du chat ?')) {
            banChatUser(userToBan, reason);
          }
        });
        actionsDiv.appendChild(banBtn);
      }

      if (actionsDiv.children.length > 0) {
        var contentDiv = msgElement.querySelector('.chat-msg-content');
        if (contentDiv) contentDiv.appendChild(actionsDiv);
      }
    });
  }

  async function sendChatMessage() {
    const currentUser = Deblock.getUser();
    if (!currentUser || !chatInput) return;

    var banned = await isUserBanned(currentUser.id);
    if (banned) {
      showTemporaryNotification('❌ Vous avez été banni du chat');
      return;
    }

    var text = chatInput.value.trim();
    if (!text || text.length > 500) return;

    // Message privé
    if (currentChatTab === 'private' && currentPrivatePartner) {
      var partnerName = 'Inconnu';
      var partnerMsg = chatMessages.find(function (m) {
        return m.sender_id === currentPrivatePartner || m.receiver_id === currentPrivatePartner;
      });
      if (partnerMsg) {
        partnerName = partnerMsg.sender_id === currentPrivatePartner ? partnerMsg.sender_username : partnerMsg.receiver_username;
      }
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatSendBtn.disabled = true;
      try {
        var payload = {
          sender_id: currentUser.id,
          receiver_id: currentPrivatePartner,
          sender_username: Deblock.getDisplayName().slice(0, 32),
          receiver_username: partnerName,
          message: text.trim(),
          created_at: new Date().toISOString()
        };
        var res = await fetch(SUPABASE_URL + '/rest/v1/private_messages', {
          method: 'POST',
          headers: Object.assign({}, getApiHeaders(), { 'Prefer': 'return=representation' }),
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var created = await res.json();
        if (created && created.length > 0) {
          var msg = created[0];
          chatMessages.push(msg);
          renderMessagesForTab([msg], 'private');
          scrollToBottom();
        }
      } catch (err) {
        console.error('Erreur envoi message privé:', err);
        showTemporaryNotification('❌ Erreur lors de l\'envoi du message privé');
      } finally {
        chatSendBtn.disabled = false;
        chatInput.focus();
      }
      return;
    }

    // Message public
    var channel = currentChatTab;
    var badWordCheck = hasBadWords(text);
    if (badWordCheck.found && (badWordCheck.category === 'raciste' || badWordCheck.category === 'homophobe')) {
      chatInput.value = '';
      chatInput.placeholder = '❌ Message bloqué - contenu raciste/homophobe interdit';
      chatInput.style.borderColor = '#f87171';
      setTimeout(function () {
        chatInput.placeholder = window.i18n.t('chat.placeholder') || 'Écrire un message...';
        chatInput.style.borderColor = '';
      }, 3000);
      return;
    }

    var finalText = text;
    var warningMessage = '';
    if (badWordCheck.found) {
      finalText = censorMessage(text);
      warningMessage = '⚠️ Message censuré (langage inapproprié)';
    }

    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSendBtn.disabled = true;

    try {
      var displayName = Deblock.getDisplayName().slice(0, 32);
      var payload = {
        user_id: currentUser.id,
        username: displayName,
        avatar_url: Deblock.getAvatarUrl(),
        message: finalText,
        channel: channel,
      };

      var res = await fetch(SUPABASE_URL + '/rest/v1/global_chat', {
        method: 'POST',
        headers: Object.assign({}, getApiHeaders(), { 'Prefer': 'return=representation' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 400) { console.warn('Table global_chat manquante dans Supabase'); chatSendBtn.disabled = false; return; }
        throw new Error('HTTP ' + res.status);
      }
      var created = await res.json();

      if (created && created.length > 0) {
        var msg = created[0];
        var existingIds = new Set(chatMessages.map(function (m) { return m.id; }));
        if (!existingIds.has(msg.id)) {
          chatMessages.push(msg);
          renderMessagesForTab([msg], channel);
          scrollToBottom();
          if (badWordCheck.found && warningMessage) showTemporaryNotification(warningMessage);
        }
      }
    } catch (err) {
      console.error('Chat: erreur envoi', err);
    } finally {
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  /* ── Mise à jour de l'état du chat ── */
  function updateChatAuthState() {
    var chatInputArea = document.getElementById('chat-input-area');
    var chatLoginArea = document.getElementById('chat-login-area');

    if (!chatInputArea || !chatLoginArea) return;

    if (Deblock.getUser()) {
      chatInputArea.removeAttribute('hidden');
      chatLoginArea.setAttribute('hidden', '');
    } else {
      chatInputArea.setAttribute('hidden', '');
      chatLoginArea.removeAttribute('hidden');
    }
  }

  function markChatAsSeen() {
    lastSeenChatTimestamp = new Date().toISOString();
    localStorage.setItem('mc_chat_last_seen', lastSeenChatTimestamp);
    var chatBadge = document.getElementById('chat-badge');
    if (chatBadge) chatBadge.setAttribute('hidden', '');
  }

  function openChat() {
    chatOpen = true;
    var chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    chatWindow.removeAttribute('hidden');
    var chatBadge = document.getElementById('chat-badge');
    if (chatBadge) chatBadge.setAttribute('hidden', '');
    updateChatAuthState();

    if (chatMessages.length === 0) {
      chatMessagesEl.innerHTML = '<p class="chat-loading">Chargement…</p>';
      loadChatMessagesForTab(currentChatTab, currentPrivatePartner);
    } else {
      scrollToBottom();
    }

    if (!chatPollingInterval) {
      chatPollingInterval = setInterval(function () {
        loadChatMessagesForTab(currentChatTab, currentPrivatePartner);
      }, 3000);
    }
    if (chatInput) chatInput.focus();
  }

  function closeChat() {
    chatOpen = false;
    var chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    chatWindow.setAttribute('hidden', '');
    if (chatPollingInterval) {
      clearInterval(chatPollingInterval);
      chatPollingInterval = null;
    }
    if (currentChatTab === 'private') {
      currentChatTab = 'global';
      currentPrivatePartner = null;
      switchChatTab('global');
    }
  }

  /* ── Initialisation du chat ── */
  (function initChat() {
    var chatBubble = document.getElementById('chat-bubble');
    var chatWindow = document.getElementById('chat-window');
    var chatCloseBtn = document.getElementById('chat-close-btn');
    var chatRefreshBtn = document.getElementById('chat-refresh-btn');
    var chatMessagesElement = document.getElementById('chat-messages');
    var chatInputArea = document.getElementById('chat-input-area');
    var chatLoginArea = document.getElementById('chat-login-area');
    var chatInputElement = document.getElementById('chat-input');
    var chatSendBtnElement = document.getElementById('chat-send-btn');
    var chatWidgetLoginBtn = document.getElementById('chat-widget-login-btn');
    var chatBadgeElement = document.getElementById('chat-badge');

    chatMessagesEl = chatMessagesElement;
    chatInput = chatInputElement;
    chatSendBtn = chatSendBtnElement;
    var chatBadge = chatBadgeElement;

    if (!chatBubble || !chatWindow) return;

    // ── Event Listeners ──
    chatBubble.addEventListener('click', function () {
      chatOpen ? closeChat() : openChat();
    });

    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', closeChat);
    }

    if (chatRefreshBtn) {
      chatRefreshBtn.addEventListener('click', function () {
        if (chatOpen && chatMessagesEl) {
          if (chatRefreshBtn) chatRefreshBtn.classList.add('spinning');
          chatMessagesEl.innerHTML = '<p class="chat-loading">Rechargement…</p>';
          loadChatMessagesForTab(currentChatTab, currentPrivatePartner)
            .then(function () {
              if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
            })
            .catch(function () {
              if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
            });
        }
      });
    }

    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', sendChatMessage);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
      chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      });
    }

    // Note: login button handled via event delegation in initDeblockAuth

    // ── Auto-reload messages when auth state changes ──
    var _origUpdateDeblockUI = updateDeblockUI;
    updateDeblockUI = function () {
      _origUpdateDeblockUI();
      updateChatAuthState();
    };

    // Rechargement après connexion/déconnexion authentifiée (via Deblock.onAuthStateChanged)
    Deblock.onAuthStateChanged(function () {
      setTimeout(function () {
        updateChatAuthState();
        if (chatOpen) {
          if (chatRefreshBtn) chatRefreshBtn.classList.add('spinning');
          chatMessagesEl.innerHTML = '<p class="chat-loading">Rechargement…</p>';
          loadChatMessagesForTab(currentChatTab, currentPrivatePartner)
            .then(function () {
              if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
            })
            .catch(function () {
              if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
            });
        }
      }, 300);
    });

    if (!chatWindow.hidden) {
      openChat();
    }

    window.addEventListener('beforeunload', function () {
      if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
      }
    });

    // Exposer les fonctions globalement
    window.refreshChat = function () {
      if (chatOpen && chatMessagesEl) {
        if (chatRefreshBtn) chatRefreshBtn.classList.add('spinning');
        chatMessagesEl.innerHTML = '<p class="chat-loading">Rechargement…</p>';
        loadChatMessagesForTab(currentChatTab, currentPrivatePartner)
          .then(function () {
            if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
          })
          .catch(function () {
            if (chatRefreshBtn) chatRefreshBtn.classList.remove('spinning');
          });
      }
    };
    window.switchChatTab = switchChatTab;
    window.startPrivateChat = startPrivateChat;

  })();

  /* ── Modal : Test de latence depuis un serveur distant ── */
  (function () {
    const openBtn = document.getElementById('open-lag-test-btn');
    const modal = document.getElementById('lag-test-modal');
    const closeBtn = document.getElementById('lag-test-modal-close');
    const serverSelect = document.getElementById('lag-test-server-select');
    const runBtn = document.getElementById('lag-test-run-btn');
    const resultsSection = document.getElementById('lag-test-results');
    const resultsGrid = document.getElementById('lag-test-results-grid');

    if (!openBtn || !modal) return;

    /* Ouvrir la modal et charger la liste de serveurs */
    openBtn.addEventListener('click', function () {
      modal.hidden = false;
      document.body.classList.add('modal-open');
      loadLagServerList();
    });

    /* Fermer la modal */
    closeBtn.addEventListener('click', closeLagModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeLagModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeLagModal();
    });

    function closeLagModal() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      resultsSection.hidden = true;
      resultsGrid.innerHTML = '';
      runBtn.disabled = !serverSelect.value;
    }

    /* Activer le bouton dès qu'un serveur est sélectionné */
    serverSelect.addEventListener('change', function () {
      runBtn.disabled = !serverSelect.value;
    });

    /* Charger la liste de serveurs distants */
    var lagServersLoaded = false;
    function loadLagServerList() {
      if (lagServersLoaded) return;
      fetch('https://lag-test.creatif-france.workers.dev/?action=list')
        .then(function (r) { return r.text(); })
        .then(function (text) {
          var lines = text.trim().split('\n').filter(Boolean);
          serverSelect.innerHTML = '<option value="" disabled selected>Choisir un serveur…</option>';
          lines.forEach(function (line) {
            var m = line.match(/^(\d+):\s*(.+)$/);
            if (!m) return;
            var opt = document.createElement('option');
            opt.value = m[1];
            opt.textContent = line.trim();
            serverSelect.appendChild(opt);
          });
          lagServersLoaded = true;
          runBtn.disabled = true;
        })
        .catch(function () {
          serverSelect.innerHTML = '<option value="" disabled selected>Erreur de chargement</option>';
        });
    }

    /* Effectuer le test */
    runBtn.addEventListener('click', function () {
      var serverId = serverSelect.value;
      if (!serverId) return;

      runBtn.disabled = true;
      runBtn.textContent = 'Test en cours…';
      resultsGrid.innerHTML = '';
      resultsSection.hidden = false;

      /* Afficher une ligne par datacenter avec état "en cours" */
      DATACENTERS.forEach(function (dc) {
        var row = document.createElement('div');
        row.className = 'lag-test-result-row';
        row.id = 'lagrow-' + dc.host.replace(/\./g, '-');
        row.innerHTML =
          '<div>' +
            '<div class="lag-test-result-host">' + escapeHtml(dc.host) + '</div>' +
            '<div class="lag-test-result-loc">' + escapeHtml(dc.location) + ' · ' + escapeHtml(dc.provider) + '</div>' +
          '</div>' +
          '<span class="dc-latency-badge lag-test-result-badge" id="lagbadge-' + dc.host.replace(/\./g, '-') + '">' +
            '<span class="dc-latency-dot"></span>' +
            '<span class="dc-latency-val">Test…</span>' +
          '</span>';
        resultsGrid.appendChild(row);
      });

      /* Lancer les tests en parallèle */
      var promises = DATACENTERS.map(function (dc) {
        var badgeId = 'lagbadge-' + dc.host.replace(/\./g, '-');
        return fetch(
          'https://lag-test.creatif-france.workers.dev/?server=' +
          encodeURIComponent(serverId) + '&url=' + encodeURIComponent(dc.host)
        )
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var ms = null;
            var avg = data && data.results && data.results[0] && data.results[0].result && data.results[0].result.stats && data.results[0].result.stats.avg;
            if (typeof avg === 'number') {
              ms = Math.round(avg);
            } else {
              var timings = data && data.results && data.results[0] && data.results[0].result && data.results[0].result.timings;
              if (Array.isArray(timings) && timings.length) {
                var sum = timings.reduce(function (a, b) { return a + b.rtt; }, 0);
                ms = Math.round(sum / timings.length);
              } else if (typeof data === 'number') {
                ms = Math.round(data);
              }
            }
            updateLagBadge(badgeId, ms);
          })
          .catch(function () {
            updateLagBadge(badgeId, null);
          });
      });

      Promise.all(promises).finally(function () {
        runBtn.disabled = false;
        runBtn.textContent = 'Relancer le test';
      });
    });

    function updateLagBadge(badgeId, ms) {
      var badge = document.getElementById(badgeId);
      if (!badge) return;
      var dot = badge.querySelector('.dc-latency-dot');
      var val = badge.querySelector('.dc-latency-val');
      var cls = latencyClass(ms);
      badge.className = 'dc-latency-badge lag-test-result-badge ' + cls;
      if (dot) dot.className = 'dc-latency-dot';
      if (val) val.textContent = ms !== null ? ms + ' ms' : 'N/A';
    }
  })();

  /* ── Init ── */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
  initCursorHalo();
  initDeblockAuth();
  handleRoute();

  if (location.hash === '#mises-a-jour') loadUpdates();
  if (location.hash === '#le-jeu' || location.hash === '#info-du-jeu') renderDatacenters();
  if (location.hash === '#serveurs') loadServers();
  if (location.hash === '#le-jeu' || location.hash === '#telecharger') loadDownloads();

  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (urlParams.get('server') || hashParams.get('server')) {
    if (!document.getElementById('page-serveurs').classList.contains('active')) {
      if (!serversLoaded) loadServers();
      else handleServerShare();
    }
  }

  setInterval(function () { fetchUserRoles(); }, 300000);

})();
