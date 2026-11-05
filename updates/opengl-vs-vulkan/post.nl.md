---
date: 2026-10-03
title: Test: OpenGL ES VS Vulkan?
---

Zoals vermeld in ons vorige artikel, laat MultiCraft je nu kiezen tussen **OpenGL ES** en **Vulkan 1.3**. We hebben daarom tests uitgevoerd om te bepalen welke echt voor de beste soepelheid zorgt.

Ter herinnering: MultiCraft beloofde een winst van **tot wel ×2**. Hoe zit het nu echt in de praktijk?

## Eerste test

We gebruikten een solowereld die was gegenereerd met de terreingenerator `default`. Belangrijk: de wereld was volledig gegenereerd **vóór** de tests, om elke vertekening door het laden van chunks te vermijden.

Met OpenGL ES halen we een gemiddelde van **45 FPS**, terwijl het gemiddelde met Vulkan stijgt naar **57 FPS**.

Dat is een verbetering van ongeveer **+26,7 %**, ofwel **×1,27**.

## Tweede test

Deze keer logden we in op een server (**Créatif France**), in een dichte stad met grote builds.

Hier zien we een gemiddelde van **19 FPS** met OpenGL ES. Vulkan tilt het niveau naar **25 FPS** gemiddeld.

Ook hier is de winst aanzienlijk: **+31,6 %**, ofwel **×1,32**.

## Resultaat

Vulkan levert inderdaad een **aanzienlijke FPS-boost**, maar we blijven **ver verwijderd van de beloofde ×2**. Houd er ook rekening mee dat er een **foutmarge** bestaat.

## Gebruikte instellingen

- **FOV**: 75
- **Zichtafstand**: 180
- **Maximale FPS**: 120
- **Toestel**: Galaxy A54 5G
