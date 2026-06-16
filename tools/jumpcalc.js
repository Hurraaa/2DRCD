/* ===========================================================
   tools/jumpcalc.js — Zıplama Hesaplama Ajanı
   Oyuncunun GERÇEK fiziğini (player.js sabitleri, 60fps sabit adım)
   simüle eder; boşluk/tuzak mesafelerini matematikle değerlendirir.

   Kullanım:
     node tools/jumpcalc.js              # zıplama profili + tüm bölümlerin analizi
     node tools/jumpcalc.js 7            # sadece 7. bölümün ayrıntılı analizi
     node tools/jumpcalc.js suggest 0.85 # %85 sıkılıkta (hassas) boşluk öner
   =========================================================== */

const fs = require('fs'), path = require('path'), vm = require('vm');

// --- Oyun sabitlerini player.js'ten al (senkron kalsın diye) ---
const sandbox = { Math, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'player.js'), 'utf8'), sandbox);
vm.runInContext('globalThis.__P = Player;', sandbox);
const P = sandbox.__P;

const G = P.GRAVITY;        // yerçekimi (px/kare²)
const SPD = P.MAX_SPEED;    // yatay azami hız (px/kare)
const JV = P.JUMP_VEL;      // zıplama ilk hızı (px/kare, negatif=yukarı)
const VYMAX = 16;           // düşüş hız sınırı (player.js ile aynı)

// --- Tek bir zıplama simülasyonu (oyundaki fizikle birebir) ---
// vx: kalkış yatay hız, hold: zıpla tuşu kaç kare basılı, dyTarget: iniş yüksekliği farkı
//   (pozitif = daha AŞAĞI bir platforma, negatif = daha YUKARI)
function simJump(vx, hold, dyTarget = 0) {
  let x = 0, y = 0, vy = JV, frame = 0, peak = 0;
  for (let i = 0; i < 300; i++) {
    if (frame >= hold && vy < -4) vy = -4;     // tuş bırakılınca kısa zıplama
    vy += G; if (vy > VYMAX) vy = VYMAX;
    x += vx; y += vy;
    if (y < peak) peak = y;
    frame++;
    if (vy > 0 && y >= dyTarget) break;        // hedef yüksekliğe inerken bitir
  }
  return { dist: x, frames: frame, height: -peak };
}

// Belirli yükseklik farkı için ERİŞİLEBİLİR azami yatay mesafe (tam zıplama, tam hız)
function maxReach(dyTarget = 0, vx = SPD) {
  // tam zıplama = uzun hold
  return simJump(vx, 999, dyTarget).dist;
}

function jumpProfile() {
  const flat = simJump(SPD, 999, 0);
  console.log('=== ZIPLAMA PROFİLİ (tam hız, tam zıplama) ===');
  console.log(`  Sabitler: g=${G}  vmax=${SPD}  jumpV=${JV}`);
  console.log(`  Azami yükseklik : ${flat.height.toFixed(1)} px`);
  console.log(`  Havada süre     : ${flat.frames} kare (${(flat.frames / 60).toFixed(2)} sn)`);
  console.log(`  Düz azami mesafe : ${flat.dist.toFixed(1)} px`);
  console.log('  Yukarı çıkışlı erişim (dy=basamak yüksekliği):');
  for (const dy of [0, -30, -60, -90, -120]) {
    const r = maxReach(dy);
    console.log(`     ${String(dy).padStart(4)} px yukarı → ${r.toFixed(0).padStart(4)} px yatay`);
  }
  console.log('  Kısa hop tablosu (hold kare → düz mesafe):');
  let row = '     ';
  for (let h = 3; h <= 20; h += 1) row += `h${h}:${simJump(SPD, h, 0).dist.toFixed(0)}  `;
  console.log(row);
  console.log('');
}

// --- Bir boşluğun değerlendirmesi ---
// gap: yatay boşluk (px), dy: iniş platformu yükseklik farkı (negatif=yukarı)
function verdictGap(gap, dy = 0) {
  const max = maxReach(dy);                  // tam zıplama erişimi
  const ratio = gap / max;                   // sıkılık (1.0 = sınırda)
  let tag, note;
  if (gap <= 0) { tag = 'BİTİŞİK'; note = 'boşluk yok'; }
  else if (ratio > 1.0) { tag = 'İMKANSIZ'; note = `azami ${max.toFixed(0)}px < ${gap.toFixed(0)}px` ; }
  else if (ratio > 0.92) { tag = 'ÇOK SIKI'; note = 'tam kenardan, frame-hassas (riskli)'; }
  else if (ratio > 0.75) { tag = 'SIKI/İYİ'; note = 'kenardan tam zıplama gerek (yetenek+hesap)'; }
  else if (ratio > 0.5) { tag = 'ORTA'; note = 'rahat zıplama'; }
  else { tag = 'KOLAY'; note = 'neredeyse önemsiz'; }
  return { gap, dy, max, ratio, tag, note };
}

// İki taş arasının "atlanabilir mi" (skip exploit) kontrolü:
// bir sonraki-sonraki yüzeye tek zıplamada ulaşılırsa taş işe yaramaz.
function skipCheck(gapToNextNext, dy = 0) {
  return gapToNextNext <= maxReach(dy);   // true => ATLANABİLİR (kötü)
}

// --- Bölüm yüzeylerini çıkar (üst yüzeyi olan her şey) ---
function surfacesOf(level) {
  const surf = [];
  for (const s of level.solids || []) surf.push({ x: s.x, x2: s.x + s.w, top: s.y, kind: 'zemin' });
  for (const m of level.machines || []) {
    if (['fakeTile', 'iceFloor', 'conveyor', 'spring', 'movingPlatform'].includes(m.type)) {
      const w = m.w || 80;
      surf.push({ x: m.x, x2: m.x + w, top: m.y, kind: m.type });
    }
  }
  surf.sort((a, b) => a.x - b.x);
  return surf;
}

function analyzeLevel(level, idx) {
  console.log(`=== BÖLÜM ${idx + 1}: ${level.name} — boşluk analizi ===`);
  const surf = surfacesOf(level);
  let issues = 0;
  for (let i = 0; i < surf.length - 1; i++) {
    const a = surf[i], b = surf[i + 1];
    const gap = b.x - a.x2;
    if (gap < -5) continue;                 // örtüşen yüzeyler (atla)
    const dy = b.top - a.top;
    const v = verdictGap(Math.max(0, gap), dy);
    // skip exploit: i'den i+2'ye ulaşılıyor mu?
    let skip = '';
    if (surf[i + 2]) {
      const gg = surf[i + 2].x - a.x2;
      const ddy = surf[i + 2].top - a.top;
      if (gg > 0 && skipCheck(gg, ddy)) skip = '  ⚠ ATLANABİLİR(skip)';
    }
    const bad = (v.tag === 'İMKANSIZ' || v.tag === 'KOLAY' || skip);
    if (bad) issues++;
    console.log(
      `  x${String(Math.round(a.x2)).padStart(5)} →${String(Math.round(b.x)).padEnd(5)}` +
      ` boşluk ${String(Math.round(gap)).padStart(4)}px dy ${String(Math.round(dy)).padStart(4)}` +
      `  [${v.tag}] (oran ${v.ratio.toFixed(2)})  ${v.note}${skip}`
    );
  }
  if (issues === 0) console.log('  ✓ Tüm geçişler dengeli (imkansız/önemsiz/atlanabilir yok).');
  else console.log(`  ⚠ ${issues} geçiş gözden geçirilmeli.`);
  console.log('');
  return issues;
}

// --- Öneri: hedef sıkılıkta boşluk + tuzak yerleşimi ---
function suggest(tightness, dy = 0) {
  const max = maxReach(dy);
  const gap = max * tightness;
  console.log(`=== ÖNERİ (sıkılık ${tightness}, dy ${dy}) ===`);
  console.log(`  Azami erişim: ${max.toFixed(0)}px`);
  console.log(`  Önerilen boşluk: ${gap.toFixed(0)}px  (kalkış kenarından)`);
  console.log(`  İniş platformu kalkış kenarından ${gap.toFixed(0)}px ileride başlamalı.`);
  console.log(`  → Ölümcül engel (çivi) boşluğun TABANINI baştan sona doldurmalı ki`);
  console.log(`    kısa zıplayan ya da kenardan zıplamayan düşsün (yetenek+hesap).`);
  // güvenli iki-taş-arası (skip olmasın): bir sonraki-sonraki > max olmalı
  console.log(`  Atlanmasın diye: i+2 yüzeyi kalkıştan > ${max.toFixed(0)}px uzakta olmalı`);
  console.log(`    (ardışık taş merkez aralığı > ${(max / 2 + 10).toFixed(0)}px ÷ değil; pratikte aralık ≥ ${(gap).toFixed(0)}px tutup taş+2 ≥ ${(max + 5).toFixed(0)}px).`);
  console.log('');
}

// --- LEVELS'ı yükle (headless gibi) ---
function loadLevels() {
  const sb = { Math, console, JSON };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'levels.js'), 'utf8'), sb);
  vm.runInContext('globalThis.__L = LEVELS;', sb);
  return sb.__L;
}

// --- CLI ---
const args = process.argv.slice(2);
if (args[0] === 'suggest') {
  jumpProfile();
  suggest(parseFloat(args[1] || '0.85'), parseFloat(args[2] || '0'));
} else if (args[0] != null) {
  jumpProfile();
  const LEVELS = loadLevels();
  const idx = parseInt(args[0], 10) - 1;
  if (LEVELS[idx]) analyzeLevel(LEVELS[idx], idx);
  else console.log('Geçersiz bölüm no:', args[0]);
} else {
  jumpProfile();
  const LEVELS = loadLevels();
  let total = 0;
  LEVELS.forEach((lv, i) => { total += analyzeLevel(lv, i); });
  console.log(total === 0 ? '✓ Tüm bölümler dengeli.' : `⚠ Toplam ${total} geçiş gözden geçirilmeli.`);
}
