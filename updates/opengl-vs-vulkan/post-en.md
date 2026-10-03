---
date: 2026-10-03
title: Test: OpenGL ES VS Vulkan?
---

As mentioned in our previous article, MultiCraft now allows you to choose between **OpenGL ES** and **Vulkan 1.3**. So we ran our tests to determine which one actually offers the best smoothness.

As a reminder, MultiCraft promised a gain of **up to ×2**. What does that really look like in practice?

## First test

We used a solo world generated with the `default` terrain generator. Important: the world was fully generated **before** the tests, to avoid any bias related to chunk loading.

With OpenGL ES, we get an average of **45 FPS**, while with Vulkan the average FPS rises to **57 FPS**.

That's an improvement of about **+26.7%**, or **×1.27**.

## Second test

This time, we connected to a server (**Créatif France**), in a dense city made up of large builds.

Here, we observe an average of **19 FPS** with OpenGL ES. Vulkan raises the level with **25 FPS** on average.

Once again, the gain is notable: **+31.6%**, or **×1.32**.

## Result

Vulkan does indeed provide a **considerable FPS boost**, but we're still **far from the announced ×2**. Also keep in mind that a **margin of error** exists.

## Settings used

- **FOV**: 75
- **View distance**: 180
- **Maximum FPS**: 120
- **Device**: Galaxy A54 5G
