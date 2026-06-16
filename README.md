# 🪤 Bubi Tuzağı — Fizik & Basit Makineler Macerası

Retro "red car games" estetiğinde, **bölüm bölüm** ilerleyen 2D yan-görünüm fizik
platform oyunu. Kel çizgi-film karakterimiz **yürür, zıplar, tırmanır**; yolunu
basit makineler ve bir sürü bubi tuzağı keser.

Hiçbir kurulum gerektirmez — `index.html` dosyasını bir tarayıcıda aç, oyna.

## ▶️ Oynanış

| Tuş | İşlev |
|-----|-------|
| `← →` veya `A D` | Yürü |
| `↑` / `Boşluk` / `W` | Zıpla |
| `↑ ↓` (merdiven/halat üstünde) | Tırman / in |
| `↑` (yatay halat altında, havadayken) | Halata tutun, `← →` ile geç |
| `R` | Bölümü yeniden başlat |

Mobilde ekrandaki dokunmatik tuşlar otomatik görünür.

## 🎯 Amaç
Her bölümün sonundaki **★ bayrağa** ulaş. Tuzağa düşersen bölüm başından başlarsın
(ölüm sayacı tutulur). 5 bölümü de bitir.

## ⚙️ Basit Makineler
- **Makaralı asansör (pulley):** Platforma bin, seni yukarı taşır (karşı ağırlık iner).
- **Kaldıraç / Tahterevalli (lever):** Ağırlığınla eğilen köprü.
- **Eğik düzlem (rampa):** Yokuştan in/çık.
- **Konveyör (tekerlek-aks):** Seni yatay iter.
- **Yay / mancınık:** Elastik enerjiyle yukarı fırlatır.

## 🪤 Tuzaklar & Fizik
Yerçekimi, momentum ve sürtünme · Sallanan dikenli top (sarkaç) · Yuvarlanan kaya ·
Düşen ezici pres · Fırlayan çivili duvar · Dönen testere · Sabit çiviler · Çukurlar ·
Hareketli platformlar · Yatay halatta el-ele geçiş (monkey bars).

## 🗺️ Bölümler
1. **İlk Adımlar** — yürü, çukur atla, çividen kaç, merdiven tırman.
2. **Sallanan Tehlike** — sarkaçlardan geç, makaralı asansörle yüksel.
3. **Fabrika** — konveyör, testere, ezici pres, yayla fırla.
4. **Yokuş Tehlikesi** — yuvarlanan kayadan kaç, tahterevalli köprü, halat tırman.
5. **Final Geçidi** — her şey bir arada gauntlet.

## 🧩 Proje Yapısı
```
index.html          # Sahne, HUD, menüler, dokunmatik kontroller
css/style.css       # Görünüm
js/engine.js        # Geometri, AABB/daire çarpışma, çizim yardımcıları
js/input.js         # Klavye + dokunmatik giriş
js/player.js        # Karakter fiziği (yürü/zıpla/tırman) ve çizimi
js/machines.js      # Basit makineler + tuzaklar (her biri bir sınıf)
js/levels.js        # Bölüm verileri (data-driven)
js/game.js          # Dünya, kamera, render, oyun döngüsü
test/headless.js    # Tarayıcısız mantık testi (çökme/NaN + Bölüm 1 bitirme)
```

## ➕ Yeni Bölüm Eklemek
`js/levels.js` içindeki `LEVELS` dizisine bir nesne ekle. Kullanılabilir alanlar:
`solids`, `slopes`, `ladders`, `ropesV`, `ropesH`, `spikes`, `machines`, `goal`, `spawn`.
Makine türleri (basit makineler): `pendulum, pulley, conveyor, spring,
movingPlatform, crusher, boulder, spikewall, sawblade, seesaw`.

Aldatıcı tuzaklar ("basit görünür, şaşırtır"):
- `fakeTile` — normal zemin gibi görünür, basınca çöker (`delay`, `respawn`, `hint`)
- `fallingRock` — `triggerX` noktası geçilince tavandan kaya iner (`topY`, `groundY`)
- `popSpikes` — tetik bölgesine basınca yerden çiviler fırlar (`triggerX1/2`, `hold`)
- `dartTrap` — görünmez tel (`tripX1/2`) geçilince duvardan ok fırlar (`dir`, `speed`)
- `iceFloor` — çok kaygan zemin; fren tutmaz, dikkatli oyuncu kayıp düşer

Oyuncu ölünce tuzaklar otomatik yeniden kurulur (`World.resetDynamic`).

İpucu: oyuncu ~120px yukarı zıplar, ~160px yatay atlar — boşlukları buna göre ayarla.

## ✅ Test
```bash
node test/headless.js
```
Canvas/document stub'lanır; tüm bölümlerin güncelleme+çizim döngüsü çökme/NaN
için taranır ve Bölüm 1 senaryoyla baştan sona bitirilir.
