/* ── MultiCraft Info — pop-up d'alerte de sécurité ──────────────────────────
   Affiche une fenêtre au chargement du site pour informer les utilisateurs de
   l'attaque subie par le site. Le message n'existe qu'en français et en
   anglais : les autres langues du site affichent la version anglaise.

   Le contenu est repris de /banner.md (même principe bilingue fr/en), mais ce
   pop-up a son propre texte : il ne s'affiche qu'à l'ouverture du site, pas à
   chaque changement de langue.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var DISCORD = '.lucas76.';

  var TEXTS = {
    fr: {
      eyebrow: 'Sécurité',
      title: 'Attaque visant MultiCraft Info',
      close: 'Fermer',
      dismiss: "J'ai compris",
      paragraphs: [
        'Chers utilisateurs,',
        "MultiCraft Info a été victime d'une attaque dans le but de voler notre base de données de serveurs. Nous avons réussi à bloquer l'attaquant au bout d'environ 1 minute 30. Néanmoins, l'attaquant a dû réussir à voler notre liste.",
        "Si l'attaquant voit ceci : merci de nous contacter sur Discord (nom d'utilisateur {discord}) afin d'avoir accès à notre base sans la voler.",
        "Cependant, vos mots de passe et emails n'ont pas été volés.",
        "Cordialement, l'équipe MultiCraft Info."
      ],
    },
    en: {
      eyebrow: 'Security',
      title: 'MultiCraft Info was attacked',
      close: 'Close',
      dismiss: 'I understand',
      paragraphs: [
        'Dear users,',
        "MultiCraft Info was the target of an attack aimed at stealing our server database. We managed to stop the attacker after about 1 minute 30. However, the attacker likely managed to steal our list.",
        'If the attacker is reading this: please contact us on Discord (username {discord}) so you can get access to our database without stealing it.',
        'Your passwords and emails were not stolen.',
        'Sincerely, the MultiCraft Info team.'
      ],
    },
  };

  // Langue du message : français uniquement si le site est en français,
  // anglais pour toutes les autres langues.
  function currentTexts() {
    return (window.i18n && window.i18n.lang) === 'fr' ? TEXTS.fr : TEXTS.en;
  }

  function getModal() {
    return document.getElementById('security-alert-modal');
  }

  // Construit un paragraphe en remplaçant {discord} par le pseudo mis en valeur,
  // sans jamais injecter de HTML (le texte est ajouté via createTextNode).
  function appendParagraph(container, text, isSignature) {
    var p = document.createElement('p');
    if (isSignature) p.className = 'security-alert-signature';

    text.split('{discord}').forEach(function (part, index) {
      if (index > 0) {
        var code = document.createElement('code');
        code.className = 'security-alert-discord';
        code.textContent = DISCORD;
        p.appendChild(code);
      }
      if (part) p.appendChild(document.createTextNode(part));
    });

    container.appendChild(p);
  }

  function render() {
    var modal = getModal();
    if (!modal) return;
    var texts = currentTexts();
    var body = document.getElementById('security-alert-body');
    var eyebrow = document.getElementById('security-alert-eyebrow');
    var title = document.getElementById('security-alert-title');
    var closeBtn = document.getElementById('security-alert-close');
    var dismissBtn = document.getElementById('security-alert-dismiss');

    if (eyebrow) eyebrow.textContent = texts.eyebrow;
    if (title) title.textContent = texts.title;
    if (closeBtn) closeBtn.setAttribute('aria-label', texts.close);
    if (dismissBtn) dismissBtn.textContent = texts.dismiss;

    if (body) {
      body.innerHTML = '';
      texts.paragraphs.forEach(function (text, index) {
        appendParagraph(body, text, index === texts.paragraphs.length - 1);
      });
    }
  }

  var lastFocused = null;

  function isOpen() {
    var modal = getModal();
    return !!modal && !modal.hidden;
  }

  function open() {
    var modal = getModal();
    if (!modal || isOpen()) return;
    render();
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    var dismissBtn = document.getElementById('security-alert-dismiss');
    if (dismissBtn) dismissBtn.focus();
  }

  function close() {
    var modal = getModal();
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  function bind() {
    var modal = getModal();
    if (!modal) return;

    ['security-alert-close', 'security-alert-dismiss'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', close);
    });

    // Clic sur le fond assombri (pas sur la boîte) : fermeture.
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) close();
    });

    // Le message est bilingue : si la langue change pendant l'affichage, on
    // remplace immédiatement le contenu par la bonne version.
    document.addEventListener('langchange', function () {
      if (isOpen()) render();
    });
  }

  function init() {
    bind();
    // On attend les traductions chargées (pour connaître la langue de
    // l'utilisateur) sans retarder indéfiniment le pop-up si le fichier de
    // langue met trop de temps à répondre.
    var shown = false;
    function showOnce() {
      if (shown) return;
      shown = true;
      open();
    }
    if (window.i18n && window.i18n.ready && typeof window.i18n.ready.then === 'function') {
      window.i18n.ready.then(showOnce, showOnce);
    }
    setTimeout(showOnce, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
