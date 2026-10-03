/* ── Deblock Auth Module (Supabase Auth v2) ──
 *
 * Central auth layer for the MultiCraft Info site.
 * No other file should interact with Supabase Auth directly.
 *
 * Usage:
 *   Deblock.login(email, password)
 *   Deblock.signUp(email, password)
 *   Deblock.logout()
 *   Deblock.getUser()        → auth.user object or null
 *   Deblock.getAccessToken() → JWT string or null
 *   Deblock.getDisplayName() → string
 *   Deblock.getAvatarUrl()   → string
 *   Deblock.onAuthStateChanged(callback)
 *   Deblock.onBanStateChanged(callback)
 *   Deblock.checkBan(userId)      → Promise<ban | null>
 *   (anti-contournement inscription : via la RPC SQL is_email_banned)
 *   Deblock.refreshBanStatus()    → Promise<ban | null>
 *   Deblock.isBanned()            → boolean
 *   Deblock.getBanInfo()          → ban object ou null
 *   Deblock.banUser(userId, reason) → Promise (admin)
 *   Deblock.unbanUser(userId)       → Promise (admin)
 *   Deblock.getApiHeaders()  → headers object for REST calls
 *   Deblock.getSupabaseUrl() → string
 *   Deblock.getAnonKey()     → string
 *   Deblock.isReady()        → boolean
 */
(function () {
  'use strict';

  /* ── Supabase credentials (anon key only, never service_role) ── */
  var SUPABASE_URL = 'https://rdtvftclctwfqtpkbzlf.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdHZmdGNsY3R3ZnF0cGtiemxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTc0MjksImV4cCI6MjEwMDI5MzQyOX0.DIsdZkJaoziW2OI2hbDalDl0IQCGPF3QRcBhKT7GW7o';

  /* ── Internal state ── */
  var supabase = null;
  var currentUser = null;
  var cachedAccessToken = null;
  var authListeners = [];
  var banListeners = [];
  var currentBan = null;
  var ready = false;
  var initializationPromise = null;

  /* ── Initialize Supabase client ── */
  function init() {
    if (initializationPromise) return initializationPromise;

    initializationPromise = new Promise(function (resolve) {
      // Wait for supabase-js to be loaded on the page
      var attempts = 0;
      var MAX_ATTEMPTS = 200; // ~10s : abandonne si le CDN supabase ne charge pas
      // Libère l'initialisation une seule fois : sans cela, un getSession() qui
      // échoue ou ne répond jamais laissait le site bloqué sur « chargement »
      // pour toujours (Deblock.ready() n'était jamais résolu).
      function settleReady() {
        if (ready) return;
        ready = true;
        notifyListeners(currentUser);
        resolve();
      }

      function tryInit() {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
          try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce',
              },
            });
          } catch (e) {
            console.error('[Deblock] createClient failed:', e);
            settleReady();
            return;
          }

          // Get current session
          supabase.auth.getSession().then(function (result) {
            var session = result.data && result.data.session ? result.data.session : null;
            if (session) {
              currentUser = session.user;
              cachedAccessToken = session.access_token;
            }
            // Un compte banni ne doit jamais voir sa session restaurée
            var check = session ? enforceUserBan(session.user) : Promise.resolve(null);
            return check.then(settleReady, settleReady);
          }).catch(function (err) {
            console.error('[Deblock] getSession failed:', err);
            settleReady();
          });

          // Filet de sécurité : si getSession() ne répond jamais, on n'attend pas
          // indéfiniment pour libérer le reste de l'application.
          setTimeout(settleReady, 8000);

          // Listen for future auth changes
          supabase.auth.onAuthStateChange(function (event, session) {
            if (session) {
              currentUser = session.user;
              cachedAccessToken = session.access_token;
              // Re-vérifie le ban à chaque connexion / rotation de token
              enforceUserBan(session.user);
            } else {
              currentUser = null;
              cachedAccessToken = null;
            }
            // Notify asynchronously to avoid Supabase sync context restrictions
            setTimeout(function () { notifyListeners(currentUser); }, 0);
          });
        } else {
          // supabase-js not loaded yet, retry
          attempts += 1;
          if (attempts >= MAX_ATTEMPTS) {
            // CDN bloqué / hors-ligne : on libère l'initialisation au lieu de boucler à l'infini
            ready = true;
            resolve();
          } else {
            setTimeout(tryInit, 50);
          }
        }
      }
      tryInit();
    });

    return initializationPromise;
  }

  /* ── Notify all listeners ── */
  function notifyListeners(user) {
    for (var i = 0; i < authListeners.length; i++) {
      try { authListeners[i](user); } catch (e) { console.error('[Deblock] Listener error:', e); }
    }
  }

  /* ── Système de bannissement (table 'banned_users') ──
   * Colonnes attendues : user_id, banned_by, reason, banned_at (email optionnel).
   * Fail-open : si la table est absente (400/404) ou si la requête échoue,
   * l'utilisateur est considéré non banni — comme avant l'existence du module. */
  function notifyBanListeners(ban) {
    for (var i = 0; i < banListeners.length; i++) {
      try { banListeners[i](ban); } catch (e) { console.error('[Deblock] Ban listener error:', e); }
    }
  }

  function setBan(ban) {
    var prevJson = currentBan ? JSON.stringify(currentBan) : null;
    var nextJson = ban ? JSON.stringify(ban) : null;
    currentBan = ban || null;
    if (prevJson !== nextJson) notifyBanListeners(currentBan);
  }

  function restHeaders() {
    var headers = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    headers['Authorization'] = 'Bearer ' + (cachedAccessToken || SUPABASE_ANON_KEY);
    return headers;
  }

  /* query : paramètres PostgREST du début (ex. 'user_id=eq.xxx' ou 'email=eq.x') */
  function fetchBanRecord(query) {
    if (!supabase) return Promise.resolve(null);
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    return fetch(SUPABASE_URL + '/rest/v1/banned_users?' + query + '&select=*', {
      headers: restHeaders(),
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      // 400/404 : table ou colonne inexistante → pas de bannissement
      if (res.status === 400 || res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (rows) {
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      console.warn('[Deblock] Vérification du bannissement impossible:', err);
      return null;
    });
  }

  /* Motif de ban pour un email, via la RPC is_email_banned (option C).
     Retourne le motif (string) ou null. Fail-open si la fonction n'existe pas
     encore (404) ou si le réseau échoue → l'inscription n'est pas bloquée. */
  function fetchEmailBan(email) {
    if (!supabase) return Promise.resolve(null);
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    return fetch(SUPABASE_URL + '/rest/v1/rpc/is_email_banned', {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify({ p_email: String(email || '').trim().toLowerCase() }),
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      // 404 : RPC pas encore créée en base → fail-open
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (txt) {
      // PostgREST renvoie un scalaire JSON : "motif" ou null
      var raw = String(txt || '').trim();
      if (!raw || raw === 'null') return null;
      if (raw.charAt(0) === '"') {
        try { return JSON.parse(raw); } catch (e) { return raw.replace(/^"|"$/g, ''); }
      }
      return raw;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      console.warn('[Deblock] Vérification email banni impossible:', err);
      return null;
    });
  }

  /* Vérifie le bannissement de `user` ; si banni, révoque sa session. */
  function enforceUserBan(user) {
    if (!user) return Promise.resolve(null);
    return fetchBanRecord('user_id=eq.' + encodeURIComponent(user.id)).then(function (ban) {
      if (!ban) {
        // currentBan décrit toujours l'utilisateur de la session courante
        if (!currentUser || currentUser.id === user.id) setBan(null);
        return null;
      }
      setBan(ban);
      if (currentUser && currentUser.id === user.id) {
        return supabase.auth.signOut().catch(function () {}).then(function () {
          currentUser = null;
          cachedAccessToken = null;
          return ban;
        });
      }
      return ban;
    });
  }

  /* ── Expose once supabase-js is available ── */
  (function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();

  /* ── Public API ── */
  window.Deblock = {
    /* Wait for the module to be ready (returns a promise) */
    ready: function () { return initializationPromise || init(); },

    /* Check if the module has finished initializing */
    isReady: function () { return ready; },

    /* Get the Supabase client instance (for advanced usage) */
    getClient: function () { return supabase; },

    /* Get the Supabase URL */
    getSupabaseUrl: function () { return SUPABASE_URL; },

    /* Get the Supabase anon key */
    getAnonKey: function () { return SUPABASE_ANON_KEY; },

    /* Get the current authenticated user (from auth.users) or null */
    getUser: function () { return currentUser; },

    /* Get the current JWT access token or null */
    getAccessToken: function () { return cachedAccessToken; },

    /* Get properly authenticated headers for Supabase REST API calls.
     * - Public (no token) → uses anon key as bearer (RLS controls access)
     * - Authenticated → uses user JWT
     */
    getApiHeaders: function () {
      var headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      };
      headers['Authorization'] = 'Bearer ' + (cachedAccessToken || SUPABASE_ANON_KEY);
      return headers;
    },

    /* Get the display name from the user's profile.
     * Falls back: display_name → username → email → 'Utilisateur'
     */
    getDisplayName: function () {
      if (!currentUser) return '';
      return currentUser.user_metadata && currentUser.user_metadata.display_name
        ? currentUser.user_metadata.display_name
        : (currentUser.user_metadata && currentUser.user_metadata.username
          ? currentUser.user_metadata.username
          : (currentUser.email || ''));
    },

    /* Get the avatar URL from the user's profile */
    getAvatarUrl: function () {
      if (!currentUser) return '';
      if (currentUser.user_metadata && currentUser.user_metadata.avatar_url) {
        return currentUser.user_metadata.avatar_url;
      }
      // Fallback: generate a default avatar URL using the user's email hash
      if (currentUser.email) {
        var hash = 0;
        var email = currentUser.email.trim().toLowerCase();
        for (var i = 0; i < email.length; i++) {
          hash = ((hash << 5) - hash) + email.charCodeAt(i);
          hash |= 0;
        }
        var seed = Math.abs(hash) % 6;
        return SUPABASE_URL + '/storage/v1/object/public/avatars/default-' + seed + '.png';
      }
      return '';
    },

    /* Log in with email and password */
    login: async function (email, password) {
      if (!supabase) await init();
      var result = await supabase.auth.signInWithPassword({ email: email, password: password });
      if (result.error) throw result.error;
      // Un compte banni ne doit pas rester connecté
      var ban = await enforceUserBan(result.data && result.data.user ? result.data.user : null);
      if (ban) {
        var err = new Error('🚫 Compte banni : ' + (ban.reason || 'raison non communiquée'));
        err.code = 'banned';
        err.ban = ban;
        throw err;
      }
      return result.data;
    },

    /* Create a new account with optional display_name (pseudo) */
    signUp: async function (email, password, displayName, redirectTo) {
      if (!supabase) await init();
      var options = {
        emailRedirectTo: redirectTo || (window.location.origin + window.location.pathname),
      };
      if (displayName && displayName.trim()) {
        options.data = { display_name: displayName.trim() };
      }
      // Empêche la création d'un nouveau compte pour contourner un bannissement.
      // Passe par la RPC is_email_banned() : elle ne renvoie que le motif d'un email
      // testé, donc la table reste inaccessible avec la clé anon.
      var bannedReason = await fetchEmailBan(email);
      if (bannedReason) {
        var banErr = new Error('🚫 Inscription refusée : cet email est banni (' + bannedReason + ')');
        banErr.code = 'banned';
        throw banErr;
      }
      var result = await supabase.auth.signUp({
        email: email,
        password: password,
        options: options,
      });
      if (result.error) throw result.error;
      return result.data;
    },

    /* Send a magic link / OTP */
    sendMagicLink: async function (email, redirectTo) {
      if (!supabase) await init();
      var result = await supabase.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirectTo || (window.location.origin + window.location.pathname) },
      });
      if (result.error) throw result.error;
      return result.data;
    },

    /* Construit l'URL de retour vers un autre site (MultiDB) en y ajoutant
       les jetons de session courants, pour que le site cible puisse
       restaurer la session Supabase (authentification inter-origines). */
    buildAuthRedirect: async function (target) {
      if (!supabase) await init();
      var result = await supabase.auth.getSession();
      var session = result.data && result.data.session ? result.data.session : null;
      if (!session) return target;

      var params = new URLSearchParams();
      params.set('access_token', session.access_token);
      params.set('refresh_token', session.refresh_token);
      if (session.expires_in != null) params.set('expires_in', String(session.expires_in));
      params.set('token_type', session.token_type || 'bearer');
      params.set('type', 'signin');

      var hashIndex = target.indexOf('#');
      var base = target;
      var hash = '';
      if (hashIndex !== -1) {
        base = target.slice(0, hashIndex);
        hash = target.slice(hashIndex);
      }
      var sep = base.indexOf('?') === -1 ? '?' : '&';
      return base + sep + params.toString() + hash;
    },

    /* Log out */
    logout: async function () {
      if (!supabase) return;
      var result = await supabase.auth.signOut();
      if (result.error) throw result.error;
    },

    /* Check if user is authenticated (convenience) */
    isLoggedIn: function () { return currentUser !== null; },

    /* ── Bannissement ── */

    /* Vérifie si un utilisateur est banni → Promise<ban | null> */
    checkBan: function (userId) {
      if (!userId) return Promise.resolve(null);
      return fetchBanRecord('user_id=eq.' + encodeURIComponent(userId));
    },

    /* Re-vérifie le bannissement de l'utilisateur courant (et coupe la session si banni) */
    refreshBanStatus: function () {
      if (!currentUser) { setBan(null); return Promise.resolve(null); }
      return enforceUserBan(currentUser);
    },

    /* true si l'utilisateur courant est banni */
    isBanned: function () { return currentBan !== null; },

    /* Détail du bannissement courant ({ user_id, reason, banned_at, banned_by }) ou null */
    getBanInfo: function () { return currentBan; },

    /* Bannit un compte (admin/modérateur) — nécessite une session */
    banUser: async function (userId, reason) {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      if (!userId) throw new Error('userId manquant');
      var res = await fetch(SUPABASE_URL + '/rest/v1/banned_users', {
        method: 'POST',
        headers: Object.assign(restHeaders(), { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          user_id: userId,
          banned_by: currentUser.id,
          reason: reason || 'Comportement inapproprié',
          banned_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Erreur bannissement (HTTP ' + res.status + ')');
      var rows = await res.json().catch(function () { return []; });
      var ban = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      // L'admin s'est banni lui-même → on coupe sa session
      if (currentUser && currentUser.id === userId) {
        setBan(ban || { user_id: userId, reason: reason || 'Comportement inapproprié' });
        await supabase.auth.signOut().catch(function () {});
        currentUser = null;
        cachedAccessToken = null;
      }
      return ban || { user_id: userId, reason: reason || 'Comportement inapproprié' };
    },

    /* Retire un bannissement (admin/modérateur) */
    unbanUser: async function (userId) {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      if (!userId) throw new Error('userId manquant');
      var res = await fetch(SUPABASE_URL + '/rest/v1/banned_users?user_id=eq.' + encodeURIComponent(userId), {
        method: 'DELETE',
        headers: Object.assign(restHeaders(), { 'Prefer': 'return=representation' }),
      });
      if (!res.ok) throw new Error('Erreur débannissement (HTTP ' + res.status + ')');
      if (currentBan && currentBan.user_id === userId) setBan(null);
      return true;
    },

    /* Callback(ban | null) à chaque changement de statut de bannissement.
     * Retourne une fonction de désabonnement. */
    onBanStateChanged: function (callback) {
      banListeners.push(callback);
      if (ready) {
        setTimeout(function () { callback(currentBan); }, 0);
      }
      return function () {
        banListeners = banListeners.filter(function (cb) { return cb !== callback; });
      };
    },

    /* Register a callback for auth state changes.
     * Callback receives user (object) or null.
     * Returns an unsubscribe function.
     */
    onAuthStateChanged: function (callback) {
      authListeners.push(callback);
      // Notify immediately with current state if ready
      if (ready) {
        setTimeout(function () { callback(currentUser); }, 0);
      }
      // Return unsubscribe
      return function () {
        authListeners = authListeners.filter(function (cb) { return cb !== callback; });
      };
    },

    /* Get the Supabase auth session token for custom API use */
    getSession: async function () {
      if (!supabase) await init();
      var result = await supabase.auth.getSession();
      return result.data && result.data.session ? result.data.session : null;
    },

    /* Update user metadata (e.g. display_name / pseudo) */
    updateProfile: async function (metadata) {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      var result = await supabase.auth.updateUser({ data: metadata });
      if (result.error) throw result.error;
      // Update local state
      if (result.data && result.data.user) {
        currentUser = result.data.user;
      }
      return result.data;
    },

    /* Change email */
    updateEmail: async function (newEmail) {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      var result = await supabase.auth.updateUser({ email: newEmail });
      if (result.error) throw result.error;
      return result.data;
    },

    /* Change password (requires reauthentication in Supabase) */
    updatePassword: async function (newPassword) {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      var result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      return result.data;
    },

    /* Delete account via Supabase REST API (admin-level function) */
    deleteAccount: async function () {
      if (!supabase) await init();
      if (!currentUser) throw new Error('Not authenticated');
      // Note: Deleting a user requires the service_role key or a custom edge function.
      // We'll use the REST API with the user's access token to call a custom edge function,
      // since the anon key cannot delete users directly.
      var session = await supabase.auth.getSession();
      var accessToken = session && session.data && session.data.session
        ? session.data.session.access_token
        : null;
      if (!accessToken) throw new Error('No active session');

      var response = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        var errData = await response.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Erreur lors de la suppression du compte');
      }
      // Sign out locally
      await supabase.auth.signOut();
      return true;
    },
  };
})();
