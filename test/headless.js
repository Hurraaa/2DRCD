/* Headless test: canvas/document stub'layıp her bölümün
   güncelleme + çizim döngüsünü çalıştırır; çökme/NaN arar.
   Tarayıcı render'ı test edilmez, sadece JS mantığı. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Sahte 2D context (tüm metotlar no-op) ---
function makeCtx() {
  const grad = { addColorStop() {} };
  const ctx = {};
  const noop = () => {};
  const methods = ['save','restore','translate','scale','rotate','beginPath',
    'moveTo','lineTo','arc','arcTo','ellipse','closePath','fill','stroke',
    'fillRect','strokeRect','clip','rect','fillText','setTransform',
    'quadraticCurveTo','bezierCurveTo'];
  for (const m of methods) ctx[m] = noop;
  ctx.createLinearGradient = () => grad;
  ctx.fillStyle = ''; ctx.strokeStyle = ''; ctx.lineWidth = 1;
  ctx.lineCap = ''; ctx.font = ''; ctx.globalAlpha = 1; ctx.textAlign = '';
  return ctx;
}

function makeEl() {
  return {
    getContext: () => makeCtx(),
    addEventListener() {}, removeEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, dataset: {}, style: {}, textContent: '', title: '',
    width: 960, height: 540,
  };
}

const listeners = {};
const sandbox = {
  console,
  Math, Date, JSON, parseInt, parseFloat, isNaN,
  requestAnimationFrame: () => 0,      // döngüyü otomatik başlatma
  location: { search: '', hash: '' },
  document: {
    getElementById: () => makeEl(),
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    addEventListener() {},
  },
  window: {
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  },
};
sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
sandbox.globalThis = sandbox;

const ctxObj = vm.createContext(sandbox);

const files = ['engine.js','input.js','player.js','machines.js','levels.js','game.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, ctxObj, { filename: f });
}

// Lexical const/class bağlamalarını dışa aktar
vm.runInContext('globalThis.__x = { World, LEVELS, Player, Input };', ctxObj);

// 'load' event'ini tetikle (Game.init)
(listeners['load'] || []).forEach(fn => fn());

const { World, LEVELS, Player, Input } = sandbox.__x;
const drawCtx = makeCtx();
const cam = { x: 0, y: 0 };

let failures = 0;
function check(cond, msg) { if (!cond) { console.error('  ✗', msg); failures++; } }

for (let li = 0; li < LEVELS.length; li++) {
  const world = new World(LEVELS[li]);
  let reached = false, deaths = 0, nanSeen = false;

  for (let frame = 0; frame < 4000; frame++) {
    // Basit bot: hep sağa yürü, takılınca/zaman zaman zıpla, ara sıra yukarı
    Input._sim.set('right', true);
    Input._sim.set('left', false);
    Input._sim.set('up', frame % 90 < 25);
    Input._sim.set('jump', frame % 50 < 8);
    Input.preUpdate();

    world.update();
    world.draw(drawCtx, cam);   // çizim kodunu da çalıştır (çökme kontrolü)
    Input.postUpdate();

    const p = world.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
      nanSeen = true; break;
    }
    if (p.won) { reached = true; break; }
    if (p.dead) { deaths++; p.reset(); }
  }

  const tag = `Bölüm ${li + 1} (${LEVELS[li].name})`;
  check(!nanSeen, `${tag}: NaN konum oluştu`);
  console.log(`  ${tag}: çökme yok • bot ölümü=${deaths} • hedefe ulaştı=${reached}`);
}

// --- Hedefe yönelik test: Bölüm 1'i elle senaryoyla bitir ---
(function completeLevel1() {
  const world = new World(LEVELS[0]);
  const p = world.player;
  let won = false;
  for (let f = 0; f < 2000; f++) {
    let left = false, right = true, up = false, jump = false;
    // çukuru aş: tüm yay boyunca zıplamayı basılı tut
    if (p.x > 600 && p.x < 800 && p.y < 520) jump = true;
    // çiviyi aş
    if (p.x > 945 && p.x < 1080 && p.y < 520) jump = true;
    const nearLadder = p.x > 1185 && p.x < 1245;
    if (p.climbing) {
      // platform seviyesine (feet ~340 => y~294) kadar tırman
      if (p.y > 292) { up = true; right = false; } else { up = false; right = false; }
    } else if (nearLadder && p.y > 360) {
      up = true; right = false;                // merdivene tırmanmaya başla
    } else if (p.y < 360 && p.x > 1180) {
      right = true;                            // tepede bayrağa yürü
    }
    Input._sim.set('left', left); Input._sim.set('right', right);
    Input._sim.set('up', up); Input._sim.set('jump', jump);
    Input.preUpdate();
    world.update();
    Input.postUpdate();
    if (p.dead) p.reset();
    if (p.won) { won = true; break; }
  }
  check(won, 'Bölüm 1 senaryoyla bitirilemedi (yürü/zıpla/tırman/bayrak zinciri)');
  console.log(`  Bölüm 1 senaryo testi: bitirildi=${won}`);
})();

// --- Hedefe yönelik test: Bölüm 2 makaralı asansör oyuncuyu taşıyıp çıkışa ulaştırır ---
(function ridePulley() {
  const world = new World(LEVELS[1]);
  const p = world.player;
  p.x = 1100; p.y = 430; p.vx = 0; p.vy = 0;   // asansör platformuna yerleştir
  let rose = false, won = false;
  for (let f = 0; f < 1600; f++) {
    if (p.y < 270) rose = true;
    const right = rose;                          // tepeye çıkınca bayrağa yürü
    Input._sim.set('left', false); Input._sim.set('right', right);
    Input._sim.set('up', false); Input._sim.set('jump', false);
    Input.preUpdate(); world.update(); Input.postUpdate();
    if (p.won) { won = true; break; }
    if (p.dead) { p.reset(); p.x = 1100; p.y = 430; rose = false; }
  }
  check(rose, 'Bölüm 2: makara asansörü oyuncuyu yukarı taşımadı');
  check(won, 'Bölüm 2: makarayla çıktıktan sonra bayrağa ulaşılamadı');
  console.log(`  Bölüm 2 makara testi: yükseldi=${rose} • bayrak=${won}`);
})();

// --- Hedefe yönelik test: Bölüm 5 maymun-barına otomatik tutunma + geçiş ---
(function monkeyBars() {
  const world = new World(LEVELS[4]);
  const p = world.player;
  p.x = 300; p.y = 454; p.vx = 0; p.vy = 0;
  let grabbed = false, crossed = false;
  for (let f = 0; f < 900; f++) {
    Input._sim.clear();
    Input._sim.set('right', true);
    if (!grabbed && p.grounded) Input._sim.set('jump', true);  // zıpla, sonra otomatik tutun
    Input.preUpdate(); world.update(); Input.postUpdate();
    if (p.hanging) grabbed = true;
    if (grabbed && p.x > 765 && p.grounded) { crossed = true; break; }
    if (p.dead) { p.reset(); p.x = 300; p.y = 454; grabbed = false; }
  }
  check(grabbed, 'Bölüm 5: maymun-barına otomatik tutunulmadı');
  check(crossed, 'Bölüm 5: maymun-barından karşıya geçilemedi');
  console.log(`  Bölüm 5 halat testi: tutundu=${grabbed} • geçti=${crossed}`);
})();

// --- Hedefe yönelik test: Bölüm 6 ters kontrol (sağ bas → sola gider) ---
(function invertCheck() {
  const world = new World(LEVELS[5]);
  const p = world.player; const x0 = p.x;
  Input.setInvert('lr');
  for (let f = 0; f < 12; f++) {
    Input._sim.clear(); Input._sim.set('right', true);
    Input.preUpdate(); world.update(); Input.postUpdate();
  }
  Input.setInvert(null);
  check(p.x < x0, 'Bölüm 6: ters kontrol çalışmadı (sağ bas → sola gitmeli)');
  console.log(`  Bölüm 6 ters kontrol testi: sağ→sol=${p.x < x0}`);
})();

// --- Yeni aldatıcı tuzaklar: örnekle, çalıştır, çökme/NaN + reset kontrolü ---
(function trapLab() {
  const def = {
    name: 'Tuzak Laboratuvarı', width: 1700, height: 600, spawn: { x: 60, y: 440 },
    solids: [{ x: -40, y: 500, w: 1800, h: 140 }],
    slopes: [], ladders: [], ropesV: [], ropesH: [], spikes: [],
    machines: [
      { type: 'fakeTile', x: 200, y: 480, w: 60, delay: 12 },
      { type: 'fallingRock', x: 420, topY: 80, groundY: 500, triggerX: 400 },
      { type: 'popSpikes', x: 620, y: 474, w: 70 },
      { type: 'iceFloor', x: 820, y: 486, w: 140 },
      { type: 'dartTrap', x: 1200, y: 470, dir: -1, tripX1: 980, tripX2: 1040 },
    ],
    goal: { x: 1640, y: 440, w: 30, h: 60 },
  };
  const world = new World(def);
  const p = world.player;
  let nan = false, anyDeath = false;
  for (let f = 0; f < 800; f++) {
    Input._sim.clear(); Input._sim.set('right', true);
    if (f % 36 < 6) Input._sim.set('jump', true);
    Input.preUpdate(); world.update(); world.draw(drawCtx, cam); Input.postUpdate();
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { nan = true; break; }
    if (p.dead) { anyDeath = true; p.reset(); world.resetDynamic(); }
  }
  check(!nan, 'Tuzak laboratuvarı: NaN oluştu');
  // reset sonrası fakeTile yeniden katı mı? (idle'a dönmeli)
  const ft = world.machines[0]; ft.reset();
  check(ft.getSolid() !== null, 'FakeTile reset sonrası katı değil');
  console.log(`  Tuzak laboratuvarı: çökme yok • tuzaklar tetiklendi (ölüm gözlendi=${anyDeath})`);
})();

if (failures === 0) console.log('\n✓ Tüm bölümler çökmeden çalıştı, NaN yok.');
else { console.log(`\n✗ ${failures} sorun bulundu.`); process.exit(1); }
