![MultiCraft-Info](./multicraft-info.svg)

<p align="center">
  A website with informations about the MultiCraft game.
</p>

<p align="center">
<a href="https://multicraft-info.netlify.app/">Website</a>
</p>
 
Developed with HTML/CSS/JS

## Features
<p>
* Displays the list of physical servers <br>
* Displays the list of game servers <br>
* Displays the list of updates <br>
* Allows users to put reviews for servers <br>
* Chat with others user <br>
And other great features coming soon! <br>
</p>

## Internationalisation (i18n)

The site is translated with plain JSON files — no framework, no dependency. Two places only:

```text
locales/*.json   one file per language (en.json is the reference file)
i18n.js          the engine: loads a file, applies it to the DOM, renders the switcher
```

```text
locales/fr.json   Français          locales/zh.json   中文
locales/en.json   English (ref.)    locales/ja.json   日本語
locales/es.json   Español           locales/ko.json   한국어
locales/de.json   Deutsch           locales/hi.json   हिन्दी
locales/pt.json   Português         locales/bn.json   বাংলা
locales/nl.json   Nederlands        locales/ar.json   العربية
locales/ru.json   Русский           locales/id.json   Bahasa Indonesia
locales/uk.json   Українська        locales/tr.json   Türkçe
locales/br.json   Brezhoneg         locales/nrm.json  Cauchois
```

Every language shows a flag image in the switcher, loaded from `/flags/<code>.svg` (see
`FLAGS_PATH` in i18n.js): the emoji kept in `LANGUAGES` is now only a fallback when an image
is missing, which also covers Breton and Norman since those flags have no Unicode emoji. All
flags come from Wikimedia Commons and are in the public domain — sources, licences and local
changes are listed in `flags/README.md`. A file named differently can be pointed at with
`flagImg: '/flags/other.svg'`. Language codes may be two or three letters (`br`, `nrm`).

The update posts themselves only exist in French (`post.md`) and English (`post-en.md`).
On every other language, the updates page therefore shows the notice `updates.langNotice`
("only available in English and French"), displayed by CSS from the `<html lang>` attribute —
see `.updates-lang-notice` in `style.css`.

### How a language is chosen

1. **URL prefix** (`/ja/serveurs`, `/pt-BR/…`) — wins over everything, so a shared link keeps
   its language. French is the site default and has no prefix.
2. **Remembered choice** — stored in `localStorage` (`mc_lang`).
3. **Browser language** — detected on the first visit (`pt-BR` → Brazilian Portuguese,
   `es-MX` → Mexican Spanish, `es-AR` → Spanish, `zh-TW` → Chinese…).
4. **French** if nothing matches.

The switcher in the header is a single button showing the current flag; clicking it opens a
dropdown that lists every language with its flag and native name. Both are generated from
the `LANGUAGES` list in i18n.js, so the HTML never needs to change.

### Add a new language (e.g. Italian)

```text
1. Copy locales/en.json to locales/it.json
2. Translate the values (never the keys)
3. Add one line to LANGUAGES in i18n.js:
     { code: 'it', flag: '🇮🇹', name: 'Italiano' }
4. Run `node scripts/check-i18n.js` and test the language switcher in the browser
```

That single line drives the switcher button, the menu entry, the URL prefix, the browser
detection and the `<html lang>` attribute. A regional variant that reuses an existing
translation file just adds `file: '<code>'` (see `es-MX` and `pt-BR` in i18n.js).

script.js re-renders dynamic content on its own when the language changes (it listens to the
`langchange` event).

### Add a new translation in the HTML

Use an attribute, then add the key to **both** `locales/fr.json` and `locales/en.json`:

```html
<span data-i18n="home.example"></span>           <!-- text -->
<h1 data-i18n-html="home.title"></h1>             <!-- text containing HTML -->
<input data-i18n-placeholder="servers.searchPlaceholder">
<button data-i18n-title="ui.example">
<button data-i18n-aria-label="modal.close">
<meta data-i18n-content="meta.description">
```

```json
"home.example": "…"
```

### Translations from JavaScript

`t()` is available everywhere (dynamic content, modals, counters, notifications…):

```js
t('servers.count1');                        // → "serveur"
t('modal.playerOnlineN', { count: 12 });    // → { count } is replaced when given
window.i18n.lang;                           // → 'fr' | 'en' | 'ja' | 'pt-BR' …
window.i18n.loc('Singapour');               // → translates a location name
window.i18n.isLang('ja');                   // → true if 'ja' is a supported language prefix
window.setLang('ja');                       // → switch language (persists the choice)
await window.i18n.ready;                    // → translations of the current language loaded
window.i18n.apply();                        // → re-applies translations to the DOM
```

If a key is missing, the engine logs `[i18n] clé inconnue : « … »` in the console and
keeps the key as-is; the HTML element keeps its existing content.

### Validate translations

```bash
node scripts/check-i18n.js
```

It reports keys present in one language but missing in the other, and keys used in the
HTML/JS but absent from the locale files. Development tool only — the site never needs it.

> Note: `netlify/edge-functions/meta.js` (link previews read by Discord/X before any
> JavaScript runs) keeps its own `LANG_CODES` list and French/English strings. When adding
> a language, add its code there too — otherwise its URL prefix is not recognized and its
> preview falls back to English.

## Licenses
<p>
License for the code : GNU General Public License V3 <br>
License for text and pictures in "updates" directory : CC-BY-NC 4.0 <br>
License of MultiCraft Font : CC-BY-SA 3.0 (Copyright MultiCraft Studio OÜ)
</p>

### (C) Deblock Studios 2026
