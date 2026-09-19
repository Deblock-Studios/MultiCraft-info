# Drapeaux du sélecteur de langue

Un fichier par langue, nommé d'après son code : `/flags/<code>.svg` (voir `FLAGS_PATH` dans
`i18n.js`). Le sélecteur les affiche à 22×15 px dans le bouton et 20×13 px dans le menu
(`.lang-flag-img`, dans le `<style>` de `index.html`).

Toutes les images viennent de Wikimedia Commons et sont **dans le domaine public** (drapeaux
et insignes officiels). Les emojis de `LANGUAGES` ne servent plus que de repli si une image ne
charge pas. Les drapeaux breton et normand n'ont de toute façon aucun emoji Unicode.

| Fichier    | Source (Wikimedia Commons)                 | Licence        | Modifs locales |
| ---------- | ------------------------------------------ | -------------- | -------------- |
| br.svg     | Flag of Brittany (Gwenn ha du).svg         | CC0 1.0        | viewBox ajouté, 11ᵉ moucheture (disposition 4 + 3 + 4) |
| nrm.svg    | Flag of Normandie.svg                      | domaine public | — |
| fr.svg     | Flag of France.svg                         | domaine public | viewBox ajouté |
| en.svg     | Flag of the United Kingdom.svg             | domaine public | — |
| es.svg     | Flag of Spain.svg                          | domaine public | viewBox ajouté |
| es-MX.svg  | Flag of Mexico.svg                         | domaine public | viewBox ajouté |
| de.svg     | Flag of Germany.svg                        | domaine public | — |
| pt-BR.svg  | Flag of Brazil.svg                         | domaine public | — |
| nl.svg     | Flag of the Netherlands.svg                | domaine public | — |
| ru.svg     | Flag of Russia.svg                         | domaine public | — |
| uk.svg     | Flag of Ukraine.svg                        | domaine public | viewBox ajouté |
| tr.svg     | Flag of Turkey.svg                         | domaine public | — |
| zh.svg     | Flag of the People's Republic of China.svg | domaine public | viewBox ajouté |
| ja.svg     | Flag of Japan.svg                          | domaine public | viewBox ajouté |
| ko.svg     | Flag of South Korea.svg                    | domaine public | — |
| hi.svg     | Flag of India.svg                          | domaine public | — |
| bn.svg     | Flag of Bangladesh.svg                     | domaine public | — |
| ar.svg     | Flag of Saudi Arabia.svg                   | domaine public | — |
| id.svg     | Flag of Indonesia.svg                      | domaine public | — |

Le `viewBox` a été ajouté aux fichiers qui n'en avaient pas : sans lui, un SVG redimensionné
par CSS (20×13 px) n'est pas mis à l'échelle mais simplement recadré.

`es.svg` (156 Ko) et `es-MX.svg` (117 Ko) sont lourds : les armoiries des drapeaux espagnol et
mexicain contiennent énormément de tracés, invisibles à 13 px de haut. Si le poids devient un
problème, il suffit de les remplacer par une version simplifiée du même nom (le mexicaniser
sans aigle est à éviter : le tricolore seul ressemblerait à l'Italie).
