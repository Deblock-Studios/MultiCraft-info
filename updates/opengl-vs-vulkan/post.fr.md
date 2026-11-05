---
date: 2026-10-03
title: Test : OpenGL ES VS Vulkan ?
---

Comme évoqué dans notre article précédent, MultiCraft permet désormais de choisir entre **OpenGL ES** et **Vulkan 1.3**. Nous avons donc mené nos tests pour déterminer lequel offre réellement la meilleure fluidité.

Pour rappel, MultiCraft promettait un gain pouvant aller **jusqu'à ×2**. Qu'en est-il vraiment en pratique ?

## Premier test

Nous avons utilisé un monde solo généré avec le générateur de terrain `default`. Important : le monde a été entièrement généré **avant** les tests, pour éviter tout biais lié au chargement des chunks.

Avec OpenGL ES, nous obtenons une moyenne de **45 FPS**, tandis qu'avec Vulkan le FPS moyen se réhausse à **57 FPS**.

Soit une amélioration d'environ **+26,7 %**, ou **×1,27**.

## Second test

Cette fois, nous nous sommes connectés sur un serveur (**Créatif France**), dans une ville dense composée de grands builds.

Ici, nous observons une moyenne de **19 FPS** avec OpenGL ES. Vulkan réhausse le niveau avec **25 FPS** de moyenne.

Là encore, le gain est notable : **+31,6 %**, soit **×1,32**.

## Résultat

Vulkan apporte effectivement un **boost de FPS considérable**, mais on reste **loin du ×2 annoncé**. Gardez aussi en tête qu'une **marge d'erreur** existe.

## Paramètres utilisés

- **FOV** : 75
- **Portée de vue** : 180
- **FPS maximum** : 120
- **Appareil** : Galaxy A54 5G
