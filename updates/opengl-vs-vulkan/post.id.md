---
date: 2026-10-03
title: Tes: OpenGL ES VS Vulkan?
---

Seperti yang disebutkan dalam artikel kami sebelumnya, MultiCraft kini memungkinkan Anda memilih antara **OpenGL ES** dan **Vulkan 1.3**. Kami pun melakukan pengujian untuk menentukan mana yang benar-benar memberikan kelancaran terbaik.

Sebagai pengingat, MultiCraft menjanjikan peningkatan hingga **×2**. Bagaimana kenyataannya dalam praktik?

## Tes pertama

Kami menggunakan dunia solo yang dihasilkan dengan generator terrain `default`. Penting: dunia telah dihasilkan sepenuhnya **sebelum** pengujian, untuk menghindari bias akibat pemuatan chunk.

Dengan OpenGL ES, kami memperoleh rata-rata **45 FPS**, sedangkan dengan Vulkan FPS rata-rata naik menjadi **57 FPS**.

Artinya peningkatan sekitar **+26,7 %**, atau **×1,27**.

## Tes kedua

Kali ini, kami terhubung ke sebuah server (**Créatif France**), di sebuah kota padat yang terdiri dari build-build besar.

Di sini, kami mengamati rata-rata **19 FPS** dengan OpenGL ES. Vulkan menaikkan levelnya dengan rata-rata **25 FPS**.

Di sini pun, peningkatannya signifikan: **+31,6 %**, yaitu **×1,32**.

## Hasil

Vulkan memang memberikan **peningkatan FPS yang cukup besar**, tetapi kita masih **jauh dari ×2 yang dijanjikan**. Ingat juga bahwa **margin kesalahan** tetap ada.

## Parameter yang digunakan

- **FOV**: 75
- **Jarak pandang**: 180
- **FPS maksimum**: 120
- **Perangkat**: Galaxy A54 5G
