---
date: 2026-10-03
title: Test: OpenGL ES vs. Vulkan?
---

Wie in unserem vorherigen Artikel erwähnt, ermöglicht es MultiCraft nun, zwischen **OpenGL ES** und **Vulkan 1.3** zu wählen. Wir haben daher unsere Tests durchgeführt, um zu ermitteln, welches wirklich die beste Flüssigkeit bietet.

Zur Erinnerung: MultiCraft versprach einen Leistungsgewinn von bis zu **×2**. Wie sieht es in der Praxis wirklich aus?

## Erster Test

Wir haben eine Solowelt verwendet, die mit dem Weltgenerator `default` erzeugt wurde. Wichtig: Die Welt wurde vollständig **vor** den Tests generiert, um jegliche Verfälschung durch das Laden von Chunks zu vermeiden.

Mit OpenGL ES erreichen wir einen Durchschnitt von **45 FPS**, während sich der durchschnittliche FPS-Wert mit Vulkan auf **57 FPS** erhöht.

Das entspricht einer Verbesserung von etwa **+26,7 %** bzw. **×1,27**.

## Zweiter Test

Dieses Mal haben wir uns auf einem Server (**Créatif France**) verbunden, in einer dichten Stadt mit großen Builds.

Hier beobachten wir einen Durchschnitt von **19 FPS** mit OpenGL ES. Vulkan hebt das Niveau mit **25 FPS** im Durchschnitt an.

Auch hier ist der Zugewinn beachtlich: **+31,6 %**, also **×1,32**.

## Ergebnis

Vulkan bringt tatsächlich einen **beträchtlichen FPS-Schub**, aber von dem angekündigten **×2** sind wir **weit entfernt**. Bedenken Sie außerdem, dass eine **Fehlermarge** existiert.

## Verwendete Einstellungen

- **FOV**: 75
- **Sichtweite**: 180
- **Maximale FPS**: 120
- **Gerät**: Galaxy A54 5G
