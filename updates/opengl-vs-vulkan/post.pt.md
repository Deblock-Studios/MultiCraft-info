---
date: 2026-10-03
title: Teste: OpenGL ES VS Vulkan?
---

Como mencionado em nosso artigo anterior, o MultiCraft agora permite escolher entre **OpenGL ES** e **Vulkan 1.3**. Por isso, realizamos nossos testes para determinar qual realmente oferece a melhor fluidez.

Vale lembrar que o MultiCraft prometia um ganho de **até ×2**. E na prática, será que é isso mesmo?

## Primeiro teste

Usamos um mundo solo gerado com o gerador de terreno `default`. Importante: o mundo foi totalmente gerado **antes** dos testes, para evitar qualquer viés relacionado ao carregamento dos chunks.

Com OpenGL ES, obtemos uma média de **45 FPS**, enquanto com Vulkan o FPS médio sobe para **57 FPS**.

Ou seja, uma melhoria de cerca de **+26,7 %**, ou **×1,27**.

## Segundo teste

Desta vez, nos conectamos a um servidor (**Créatif France**), em uma cidade densa composta por grandes construções.

Aqui, observamos uma média de **19 FPS** com OpenGL ES. O Vulkan eleva o patamar para uma média de **25 FPS**.

Mais uma vez, o ganho é notável: **+31,6 %**, ou **×1,32**.

## Resultado

O Vulkan de fato traz um **aumento considerável de FPS**, mas ainda estamos **longe do ×2 anunciado**. Tenha também em mente que existe uma **margem de erro**.

## Parâmetros utilizados

- **FOV**: 75
- **Distância de renderização**: 180
- **FPS máximo**: 120
- **Dispositivo**: Galaxy A54 5G
