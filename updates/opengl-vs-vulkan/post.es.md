---
date: 2026-10-03
title: ¿Prueba: OpenGL ES VS Vulkan?
---

Como mencionamos en nuestro artículo anterior, MultiCraft ahora permite elegir entre **OpenGL ES** y **Vulkan 1.3**. Por eso realizamos nuestras pruebas para determinar cuál ofrece realmente la mejor fluidez.

Para empezar, MultiCraft prometía una mejora de **hasta ×2**. ¿Qué hay de cierto en la práctica?

## Primera prueba

Usamos un mundo en solitario generado con el generador de terreno `default`. Importante: el mundo se generó por completo **antes** de las pruebas, para evitar cualquier sesgo relacionado con la carga.

Con OpenGL ES, obtenemos un promedio de **45 FPS**, mientras que con Vulkan el FPS medio sube a **57 FPS**.

Es decir, una mejora de aproximadamente **+26,7 %**, o **×1,27**.

## Segunda prueba

Esta vez nos conectamos a un servidor (**Créatif France**), en una ciudad densa compuesta por grandes construcciones.

Aquí observamos un promedio de **19 FPS** con OpenGL ES. Vulkan eleva el nivel con **25 FPS** de promedio.

Una vez más, la mejora es notable: **+31,6 %**, es decir, **×1,32**.

## Resultado

Vulkan sí aporta un **impulso considerable de FPS**, pero seguimos **lejos del ×2 anunciado**. Ten en cuenta también que existe un **margen de error**.

## Parámetros utilizados

- **FOV**: 75
- **Distancia de visión**: 180
- **FPS máximo**: 120
- **Dispositivo**: Galaxy A54 5G
