/* ===========================================================
   levels.js — Bölüm tanımları
   Koordinat: zemin üst yüzeyi genelde y=500. Oyuncu ~120px zıplar,
   yatay ~160px atlar. Boşluklar buna göre ayarlı.
   =========================================================== */

const LEVELS = [

  /* ---------- BÖLÜM 1: İlk Adımlar ---------- */
  {
    name: 'İlk Adımlar',
    hint: '← → yürü • ↑ / Boşluk zıpla • Çukuru atla, çivilere basma • Merdivenden tırman',
    width: 1700, height: 620,
    spawn: { x: 60, y: 440 },
    solids: [
      { x: -40, y: 500, w: 700, h: 140 },          // başlangıç zemini (..660)
      { x: 800, y: 500, w: 560, h: 140 },          // orta zemin (800..1360)
      { x: 1180, y: 340, w: 360, h: 20 },          // üst platform
    ],
    slopes: [],
    ladders: [ { x: 1210, y: 340, w: 26, h: 160 } ],
    ropesV: [], ropesH: [],
    spikes: [
      { x: 660, y: 580, w: 140, h: 40 },           // çukur dibi çivileri
      { x: 1000, y: 476, w: 70, h: 24 },           // yolda çivi
    ],
    machines: [],
    goal: { x: 1470, y: 280, w: 30, h: 60 },
  },

  /* ---------- BÖLÜM 2: Sallanan Tehlike (sarkaç + makara asansör) ---------- */
  {
    name: 'Sallanan Tehlike',
    hint: 'Sallanan toplardan zamanla geç • Ok işaretli asansör platformuna BAS ve bekle — karşı ağırlık seni yukarı çıkarır',
    width: 2100, height: 640,
    spawn: { x: 50, y: 440 },
    solids: [
      { x: -40, y: 500, w: 1140, h: 140 },         // uzun yürüyüş yolu (..1100)
      { x: 1180, y: 300, w: 760, h: 20 },          // üst çıkış platformu (1180..1940)
    ],
    slopes: [],
    ladders: [], ropesV: [], ropesH: [],
    spikes: [],
    machines: [
      { type: 'pendulum', x: 320, y: 150, length: 320, ballR: 22, amp: 1.15, speed: 0.032, phase: 0 },
      { type: 'pendulum', x: 640, y: 150, length: 320, ballR: 22, amp: 1.15, speed: 0.032, phase: 1.6 },
      { type: 'pendulum', x: 940, y: 150, length: 320, ballR: 22, amp: 1.0,  speed: 0.030, phase: 0.8 },
      { type: 'pulley', leftX: 1080, weightX: 950, topY: 130, baseY: 480, range: 180, platW: 84 },
    ],
    goal: { x: 1870, y: 240, w: 30, h: 60 },
  },

  /* ---------- BÖLÜM 3: Fabrika (konveyör + testere + ezici + yay) ---------- */
  {
    name: 'Fabrika',
    hint: 'Konveyör seni iter • Testere ve ezici presten kaç • Yay seni yukarı fırlatır',
    width: 2000, height: 640,
    spawn: { x: 50, y: 440 },
    solids: [
      { x: -40, y: 500, w: 340, h: 140 },          // başlangıç (..300)
      { x: 560, y: 500, w: 480, h: 140 },          // orta zemin (560..1040)
      { x: 1080, y: 300, w: 520, h: 20 },          // üst çıkış platformu (1080..1600)
    ],
    slopes: [],
    ladders: [], ropesV: [], ropesH: [],
    spikes: [],
    machines: [
      { type: 'conveyor', x: 300, y: 486, w: 260, h: 16, speed: 5.2 },
      { type: 'crusher', x: 700, w: 70, topY: 300, bottomY: 470, h: 60, period: 130, phase: 0 },
      { type: 'sawblade', ax: 900, ay: 330, bx: 900, by: 460, r: 20, speed: 0.028 },
      { type: 'spring', x: 980, y: 486, w: 50, power: 19 },
    ],
    goal: { x: 1540, y: 240, w: 30, h: 60 },
  },

  /* ---------- BÖLÜM 4: Yokuş (kovalayan kaya + çivi çukurları + sarkaç + tahterevalli) ---------- */
  {
    name: 'Yokuş Tehlikesi',
    hint: 'Kaya seni kovalıyor — KOŞ! • Çivi çukurlarını atla • Sarkacı zamanla • Dik tahterevalliden hızlı geç • Halattan tırman',
    width: 2400, height: 680,
    spawn: { x: 40, y: 240 },
    solids: [
      { x: -40, y: 300, w: 420, h: 20 },           // tepe platformu (..380)
      { x: 920, y: 500, w: 260, h: 180 },          // rampa altı zemin A (920..1180)
      { x: 1320, y: 500, w: 240, h: 180 },         // zemin B (1320..1560)
      { x: 1760, y: 500, w: 220, h: 180 },         // zemin C (1760..1980)
      { x: 1900, y: 230, w: 380, h: 20 },          // çıkış platformu (1900..2280)
    ],
    slopes: [
      { x1: 380, y1: 300, x2: 940, y2: 500 },      // ana eğik düzlem (rampa)
    ],
    ladders: [],
    ropesV: [ { x: 1930, y: 230, h: 290 } ],        // çıkış halatı (y230..520)
    ropesH: [],
    spikes: [
      { x: 1180, y: 548, w: 140, h: 72 },          // atlanacak çivi çukuru 1 (1180..1320)
      { x: 1560, y: 548, w: 200, h: 72 },          // tahterevalli altı çivi çukuru (1560..1760)
    ],
    machines: [
      // Kovalayan kaya: rampadan iner, çukura kadar takip eder (oyuncudan biraz yavaş)
      { type: 'boulder', x: 410, y: 285, r: 26, triggerX: 460, endX: 1150, endY: 480, speed: 4.0 },
      // Zemin B üstünde sarkaç — zamanla geç
      { type: 'pendulum', x: 1440, y: 160, length: 300, ballR: 22, amp: 1.0, speed: 0.034, phase: 0.4 },
      // Çivi çukurunu köprüleyen DİK tahterevalli — fazla beklersen devrilir
      { type: 'seesaw', x: 1660, y: 500, half: 115, maxAngle: 0.32 },
    ],
    goal: { x: 2220, y: 170, w: 30, h: 60 },
  },

  /* ---------- BÖLÜM 5: Final Geçidi (her şey bir arada) ---------- */
  {
    name: 'Final Geçidi',
    hint: 'ZIPLA ile halata atla (kendi tutunur), ← → ile geç • Çivili duvarlardan kaç • Hareketli platformla uçurumu aş',
    width: 2800, height: 660,
    spawn: { x: 40, y: 440 },
    solids: [
      { x: -40, y: 500, w: 380, h: 140 },          // başlangıç (..340)
      { x: 760, y: 500, w: 360, h: 140 },          // halat sonrası (760..1120)
      { x: 1480, y: 500, w: 1320, h: 140 },        // final düzlüğü (1480..2800)
    ],
    slopes: [],
    ladders: [],
    ropesV: [],
    ropesH: [ { x: 300, y: 415, w: 480 } ],         // monkey bars (300..780): zemin üstüne kadar uzanır
    spikes: [
      { x: 340, y: 560, w: 420, h: 60 },           // halat altı çivi tarlası
      { x: 1120, y: 560, w: 360, h: 80 },          // hareketli platform altı çivili uçurum
    ],
    machines: [
      { type: 'spikewall', x: 800, y: 420, w: 26, h: 80, reach: 70, fromLeft: true, period: 110, phase: 0 },
      { type: 'spikewall', x: 1000, y: 420, w: 26, h: 80, reach: 70, fromLeft: true, period: 110, phase: 55 },
      { type: 'movingPlatform', ax: 1180, ay: 480, bx: 1420, by: 480, w: 90, speed: 1.4 },
      { type: 'pendulum', x: 1640, y: 150, length: 330, ballR: 22, amp: 1.1, speed: 0.033, phase: 0.5 },
      { type: 'sawblade', ax: 2000, ay: 330, bx: 2000, by: 470, r: 22, speed: 0.026 },
      { type: 'crusher', x: 2300, w: 70, topY: 300, bottomY: 470, h: 60, period: 120, phase: 30 },
    ],
    goal: { x: 2680, y: 440, w: 30, h: 60 },
  },

  /* ---------- BÖLÜM 6: Ters Geçit (TERS KONTROL + acele + asılı gülleler) ---------- */
  {
    name: 'Ters Geçit',
    invert: 'lr',                                   // SOL↔SAĞ ters!
    hint: '⇆ KONTROLLER TERS! Sağ için SOLA bas • Kaya seni kovalıyor, ACELE ET • Asılı güllelerden zamanla geç',
    width: 2200, height: 640,
    spawn: { x: 140, y: 440 },
    solids: [
      { x: -40, y: 500, w: 2240, h: 140 },         // uzun düz zemin (0..2200)
    ],
    slopes: [],
    ladders: [], ropesV: [], ropesH: [],
    spikes: [],
    machines: [
      // Sürekli kovalayan kaya — acele ettirir (ters kontrolle panik!)
      { type: 'boulder', x: -40, y: 474, r: 26, triggerX: 60, endX: 2050, endY: 474, speed: 3.5 },
      // Havadan iple asılı dikenli gülleler (sevilen sarkaçlar)
      { type: 'pendulum', x: 560,  y: 150, length: 320, ballR: 22, amp: 1.15, speed: 0.033, phase: 0.0 },
      { type: 'pendulum', x: 980,  y: 150, length: 320, ballR: 22, amp: 1.1,  speed: 0.031, phase: 1.4 },
      { type: 'pendulum', x: 1400, y: 150, length: 320, ballR: 22, amp: 1.15, speed: 0.034, phase: 0.7 },
      { type: 'pendulum', x: 1780, y: 150, length: 320, ballR: 22, amp: 1.0,  speed: 0.030, phase: 2.0 },
    ],
    goal: { x: 2080, y: 440, w: 30, h: 60 },
  },
];
