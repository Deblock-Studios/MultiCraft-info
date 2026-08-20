/* ── MultiCraft Info — Alert Banner Loader ── */
(function () {
  'use strict';

  /**
   * Parse banner.md content.
   * Expected format:
   *   ---
   *   isDisplayed: oui|non
   *   ---
   *
   *   **fr:** Message en français
   *   **en:** English message
   */
  var COLOR_MAP = {
    'vert':  { bg: '#16a34a', text: '#fff' },
    'bleu':  { bg: '#2563eb', text: '#fff' },
    'rouge': { bg: '#dc2626', text: '#fff' },
    'noir':  { bg: '#111827', text: '#fff' },
    'blanc': { bg: '#f9fafb', text: '#111827' },
  };

  function parseBanner(raw) {
    var result = { isDisplayed: false, fr: '', en: '', color: null };

    // Extract frontmatter between first two ---
    var fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fmMatch) {
      var fm = fmMatch[1];
      var displayedMatch = fm.match(/isDisplayed\s*:\s*(\S+)/i);
      if (displayedMatch) {
        result.isDisplayed = displayedMatch[1].trim().toLowerCase() === 'oui';
      }
      var colorMatch = fm.match(/color\s*:\s*(\S+)/i);
      if (colorMatch) {
        result.color = colorMatch[1].trim().toLowerCase();
      }
    }

    // Extract **fr:** and **en:** lines
    var frMatch = raw.match(/\*\*fr:\*\*\s*(.+)/i);
    var enMatch = raw.match(/\*\*en:\*\*\s*(.+)/i);
    if (frMatch) result.fr = frMatch[1].trim();
    if (enMatch) result.en = enMatch[1].trim();

    return result;
  }

  var DISMISS_KEY = 'mc_banner_dismissed';

  // Signature of the current announcement content. Storing the signature
  // (instead of a plain "1") means the banner reappears whenever the
  // announcement is changed — it is only hidden for content already seen.
  function signature(data) {
    var s = (data.fr || '') + '|' + (data.en || '') + '|' + (data.color || '');
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  function isDismissed(data) {
    try {
      return localStorage.getItem(DISMISS_KEY) === signature(data);
    } catch (e) {
      return false;
    }
  }

  function dismissBanner(data) {
    try {
      localStorage.setItem(DISMISS_KEY, signature(data));
    } catch (e) { /* storage unavailable — just hide for this visit */ }
  }

  function updateBanner(data) {
    var banner = document.getElementById('alert-banner');
    if (!banner) return;

    if (!data.isDisplayed || isDismissed(data)) {
      banner.classList.remove('visible');
      return;
    }

    var lang = (window.i18n && window.i18n.lang) || 'fr';
    var msg = lang === 'en' ? data.en : data.fr;
    var closeLabel = lang === 'en' ? 'Close announcement' : 'Fermer l\'annonce';

    banner.innerHTML = '';
    var msgEl = document.createElement('span');
    msgEl.className = 'alert-banner-msg';
    msgEl.textContent = msg;
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'alert-banner-close';
    closeBtn.setAttribute('aria-label', closeLabel);
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', function () {
      banner.classList.remove('visible');
      dismissBanner(data);
    });
    banner.appendChild(msgEl);
    banner.appendChild(closeBtn);

    // Apply color from frontmatter, fallback to default red
    var palette = (data.color && COLOR_MAP[data.color]) || COLOR_MAP['rouge'];
    banner.style.background = palette.bg;
    banner.style.color = palette.text;

    banner.classList.add('visible');
  }

  function loadBanner() {
    fetch('/banner.md?_=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('banner.md not found');
        return res.text();
      })
      .then(function (raw) {
        var data = parseBanner(raw);
        updateBanner(data);

        // Re-apply the correct language when the user switches
        document.addEventListener('langchange', function () {
          updateBanner(data);
        });
      })
      .catch(function (err) {
        // Silently fail — banner simply stays hidden
        console.warn('[banner.js]', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBanner);
  } else {
    loadBanner();
  }
})();
