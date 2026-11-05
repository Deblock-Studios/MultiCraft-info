---
date: 2026-10-03
title: Test : OpenGL ES VS Vulkan ?
---

Önceki makalemizde belirttiğimiz gibi, MultiCraft artık **OpenGL ES** ile **Vulkan 1.3** arasında seçim yapmanıza olanak tanıyor. Biz de gerçekten hangisinin daha akıcı bir deneyim sunduğunu belirlemek için testlerimizi gerçekleştirdik.

Hatırlatmak gerekirse, MultiCraft **×2'ye varan** bir kazanç vaat ediyordu. Peki pratikte gerçek durum ne?

## İlk test

`default` arazi oluşturucuyla üretilmiş bir tek oyunculu dünya kullandık. Önemli: Dünya, chunk yüklemesinden kaynaklanabilecek herhangi bir yanlılığı önlemek için testlerden **önce** tamamen oluşturuldu.

OpenGL ES ile ortalama **45 FPS** elde ederken, Vulkan ile ortalama FPS **57 FPS**'e yükseliyor.

Bu da yaklaşık **%26,7** yani **×1,27**'lik bir iyileşme anlamına geliyor.

## İkinci test

Bu kez, büyük yapılardan oluşan yoğun bir şehirde bulunan bir sunucuya (**Créatif France**) bağlandık.

Burada OpenGL ES ile ortalama **19 FPS** gözlemliyoruz. Vulkan ise ortalama **25 FPS** ile seviyeyi yükseltiyor.

Burada da kazanç kayda değer: **%31,6**, yani **×1,32**.

## Sonuç

Vulkan gerçekten de **ciddi bir FPS artışı** sağlıyor, ancak **açıklanan ×2'nin oldukça uzağında** kalıyoruz. Ayrıca bir **hata payının** bulunduğunu da unutmayın.

## Kullanılan ayarlar

- **FOV**: 75
- **Görüş mesafesi**: 180
- **Maksimum FPS**: 120
- **Cihaz**: Galaxy A54 5G
