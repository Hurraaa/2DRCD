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
    classList: { add() {}, remove() {} },
    dataset: {}, style: {}, textContent: '',
    width: 960, height: 540,
  };
}

const listeners = {};
const sandbox = {
  console,
  Math, Date, JSON, parseInt, parseFloat, isNaN,
  requestAnimationFrame: () => 0,      // döngüyü otomatik başlatma
  document: {
    getElementById: () => makeEl(),
    querySelectorAll: () => [],
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
    Input.state.right = true;
    Input.state.left = false;
    Input.state.up = (frame % 90 < 25);
    Input.state.jump = (frame % 50 < 8);
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
    const s = Input.state;
    s.left = false; s.right = true; s.up = false; s.jump = false;
    // çukuru aş: tüm yay boyunca zıplamayı basılı tut
    if (p.x > 600 && p.x < 800 && p.y < 520) { s.jump = true; }
    // çiviyi aş
    if (p.x > 945 && p.x < 1080 && p.y < 520) { s.jump = true; }
    const nearLadder = p.x > 1185 && p.x < 1245;
    if (p.climbing) {
      // platform seviyesine (feet ~340 => y~294) kadar tırman
      if (p.y > 292) { s.up = true; s.right = false; } else { s.up = false; s.right = false; }
    } else if (nearLadder && p.y > 360) {
      s.up = true; s.right = false;            // merdivene tırmanmaya başla
    } else if (p.y < 360 && p.x > 1180) {
      s.right = true;                          // tepede bayrağa yürü
    }
    Input.preUpdate();
    world.update();
    Input.postUpdate();
    if (p.dead) p.reset();
    if (p.won) { won = true; break; }
  }
  check(won, 'Bölüm 1 senaryoyla bitirilemedi (yürü/zıpla/tırman/bayrak zinciri)');
  console.log(`  Bölüm 1 senaryo testi: bitirildi=${won}`);
})();

if (failures === 0) console.log('\n✓ Tüm bölümler çökmeden çalıştı, NaN yok.');
else { console.log(`\n✗ ${failures} sorun bulundu.`); process.exit(1); }
