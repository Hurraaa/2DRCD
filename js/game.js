/* ===========================================================
   game.js — Dünya, kamera, render ve oyun döngüsü
   =========================================================== */

const VIEW_W = 960, VIEW_H = 540;

class World {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.width = def.width;
    this.height = def.height;
    this.solids = def.solids.map(s => ({ ...s }));
    this.slopes = (def.slopes || []).map(s => ({ ...s }));
    this.ladders = (def.ladders || []).map(s => ({ ...s }));
    this.ropesV = (def.ropesV || []).map(s => ({ ...s }));
    this.ropesH = (def.ropesH || []).map(s => ({ ...s }));
    this.spikes = (def.spikes || []).map(s => ({ ...s }));
    this.goal = { ...def.goal };
    this.machines = (def.machines || []).map(m => Machines.create(m)).filter(Boolean);
    this.player = new Player(def.spawn.x, def.spawn.y);
    this.solidsThisFrame = [];
    this.slopesThisFrame = [];
    this.particles = [];
  }

  // --- Tırmanılabilir alan (merdiven / dikey halat) ---
  climbableAt(cx, cy, x, y, w, h) {
    for (const l of this.ladders) {
      if (Engine.aabb(x, y, w, h, l.x - 4, l.y, l.w + 8, l.h)) return { x: l.x, w: l.w };
    }
    for (const r of this.ropesV) {
      if (cx > r.x - 16 && cx < r.x + 16 && cy > r.y - 10 && cy < r.y + r.h)
        return { x: r.x - 13, w: 26 };
    }
    return null;
  }

  // --- Yatay halat (monkey bars) ---
  hangBarAt(cx, topY, w) {
    for (const r of this.ropesH) {
      // Alt sınır geniş: ip ortada sarkar + gövde ipin altında asılı kalır (sagY+18)
      if (cx > r.x && cx < r.x + r.w && topY > r.y - 40 && topY < r.y + 56)
        return r;
    }
    return null;
  }

  // --- Eğik düzlem zemin yüksekliği ---
  slopeGroundAt(x) {
    let best = null;
    for (const s of this.slopesThisFrame) {
      const gy = Engine.slopeGroundY(s, x);
      if (gy !== null && (best === null || gy < best)) best = gy;
    }
    return best;
  }

  update() {
    const p = this.player;

    // Makineleri güncelle
    for (const m of this.machines) if (m.update) m.update(this);

    // Bu kareye ait katı yüzeyleri topla
    this.solidsThisFrame = this.solids.slice();
    for (const m of this.machines) {
      if (m.getSolid) { const s = m.getSolid(); if (s) this.solidsThisFrame.push(s); }  // çökmüş tuzak null döner
      if (m.getSolids) for (const s of m.getSolids()) this.solidsThisFrame.push(s);
    }
    // Dinamik + statik rampalar
    this.slopesThisFrame = this.slopes.slice();
    for (const m of this.machines) if (m.getSlope) this.slopesThisFrame.push(m.getSlope());

    // Oyuncu
    p.update(this);

    if (p.dead || p.won) return;

    // --- Ölümcül çarpışmalar ---
    const deadRects = this.spikes.slice();
    const deadCircles = [];
    for (const m of this.machines) {
      if (m.deadlyRects) for (const r of m.deadlyRects()) deadRects.push(r);
      if (m.deadlyCircles) for (const c of m.deadlyCircles()) deadCircles.push(c);
    }
    for (const r of deadRects) {
      if (Engine.aabb(p.x + 3, p.y + 3, p.w - 6, p.h - 6, r.x, r.y, r.w, r.h)) { this.kill(); break; }
    }
    if (!p.dead) for (const c of deadCircles) {
      if (Engine.circleRect(c.x, c.y, c.r, p.x + 3, p.y + 3, p.w - 6, p.h - 6)) { this.kill(); break; }
    }

    // --- Hedef ---
    if (!p.dead && Engine.aabb(p.x, p.y, p.w, p.h, this.goal.x, this.goal.y, this.goal.w, this.goal.h))
      p.win();

    // Parçacık güncelle
    for (const pt of this.particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life--; }
    this.particles = this.particles.filter(pt => pt.life > 0);
  }

  kill() {
    const p = this.player;
    p.die();
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: p.cx, y: p.cy,
        vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.8) * 7,
        life: 30 + Math.random() * 20, c: i % 2 ? '#f3c89b' : '#e8413a'
      });
    }
  }

  // Oyuncu öldüğünde tuzakları/durumları yeniden kur (yeniden başlatma)
  resetDynamic() {
    for (const m of this.machines) if (m.reset) m.reset();
    this.particles = [];
  }

  /* ================= ÇİZİM ================= */
  draw(ctx, cam) {
    // Gökyüzü (ekran uzayı)
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#79cfd4');
    sky.addColorStop(1, '#c4ecea');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this._drawBackdrop(ctx, cam);

    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    this._drawSolids(ctx);
    this._drawSlopes(ctx);
    for (const l of this.ladders) this._drawLadder(ctx, l);
    for (const r of this.ropesV) this._drawRopeV(ctx, r);
    for (const r of this.ropesH) this._drawRopeH(ctx, r);
    for (const s of this.spikes) this._drawSpikes(ctx, s);
    for (const m of this.machines) if (m.draw) m.draw(ctx);
    this._drawGoal(ctx, this.goal);

    // parçacıklar
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.min(1, pt.life / 20);
      ctx.fillStyle = pt.c;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    this.player.draw(ctx);
    ctx.restore();
  }

  _drawBackdrop(ctx, cam) {
    // Parallax palmiye silueti
    ctx.save();
    const off = -cam.x * 0.35;
    ctx.fillStyle = 'rgba(90,150,150,0.35)';
    const baseY = VIEW_H - 80;
    for (let i = -1; i < 14; i++) {
      const x = (i * 220 + (off % 220)) ;
      this._palm(ctx, x, baseY, 1);
    }
    ctx.fillStyle = 'rgba(70,120,120,0.5)';
    const off2 = -cam.x * 0.55;
    for (let i = -1; i < 18; i++) {
      const x = (i * 170 + (off2 % 170));
      this._palm(ctx, x, VIEW_H - 40, 0.7);
    }
    // bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const co = -cam.x * 0.15;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 320 + co) % (VIEW_W + 320)) - 160;
      this._cloud(ctx, x, 70 + (i % 2) * 40);
    }
    ctx.restore();
  }

  _palm(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillRect(-4, -90, 8, 90);
    for (let a = 0; a < 5; a++) {
      ctx.save();
      ctx.translate(0, -90);
      ctx.rotate((a - 2) * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, -10, 10, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  _cloud(ctx, x, y) {
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38, y + 6, 34, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 36, y + 8, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSolids(ctx) {
    for (const s of this.solids) {
      if (s.h >= 60) {
        // zemin: kahverengi + çim
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = '#8a5f38';
        for (let i = 0; i < s.w; i += 40)
          ctx.fillRect(s.x + i, s.y + 14, 20, s.h - 14);
        ctx.fillStyle = '#5fae3f';
        ctx.fillRect(s.x, s.y, s.w, 12);
        ctx.fillStyle = '#4f9a33';
        for (let i = 0; i < s.w; i += 14)
          ctx.fillRect(s.x + i, s.y - 3, 4, 6);
      } else {
        // platform: taş
        ctx.fillStyle = '#6b6f78';
        Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 4); ctx.fill();
        ctx.fillStyle = '#868b95';
        ctx.fillRect(s.x, s.y, s.w, 5);
        ctx.fillStyle = '#565a62';
        ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
      }
    }
  }

  _drawSlopes(ctx) {
    for (const s of this.slopes) {
      ctx.fillStyle = '#7a5230';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.lineTo(s.x2, this.height);
      ctx.lineTo(s.x1, this.height);
      ctx.closePath(); ctx.fill();
      // çim çizgisi
      ctx.strokeStyle = '#5fae3f'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
  }

  _drawLadder(ctx, l) {
    Engine.hazardBeam(ctx, l.x - 2, l.y, 5, l.h);
    Engine.hazardBeam(ctx, l.x + l.w - 3, l.y, 5, l.h);
    ctx.fillStyle = '#c9a227';
    for (let y = l.y + 8; y < l.y + l.h; y += 22)
      ctx.fillRect(l.x, y, l.w, 5);
  }

  _drawRopeV(ctx, r) {
    ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let y = r.y; y < r.y + r.h; y += 10) {
      ctx.moveTo(r.x - 2, y); ctx.lineTo(r.x + 2, y + 5);
    }
    ctx.stroke();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(r.x - 10, r.y - 6, 20, 6);
  }

  _drawRopeH(ctx, r) {
    // direkler
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(r.x - 10, r.y - 8, 12, 150);
    ctx.fillRect(r.x + r.w - 2, r.y - 8, 12, 150);
    // sarkan halat (catenary benzeri)
    ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const x = r.x + r.w * t;
      const y = r.y + Math.sin(t * Math.PI) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  _drawSpikes(ctx, s) {
    // taban
    ctx.fillStyle = '#444';
    ctx.fillRect(s.x, s.y + s.h - 8, s.w, 8);
    ctx.fillStyle = '#9aa0a6';
    const n = Math.max(1, Math.floor(s.w / 18));
    const bw = s.w / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * bw, s.y + s.h - 4);
      ctx.lineTo(s.x + i * bw + bw / 2, s.y);
      ctx.lineTo(s.x + (i + 1) * bw, s.y + s.h - 4);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * bw + bw / 2, s.y);
      ctx.lineTo(s.x + i * bw + bw * 0.42, s.y + s.h - 4);
      ctx.stroke();
    }
  }

  _drawGoal(ctx, g) {
    // direk
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(g.x, g.y - 10, 5, g.h + 10);
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(g.x + 2.5, g.y - 10, 5, 0, Math.PI * 2); ctx.fill();
    // bayrak dalgalı
    const sway = Math.sin(Date.now() / 200) * 4;
    ctx.fillStyle = '#e8413a';
    ctx.beginPath();
    ctx.moveTo(g.x + 5, g.y);
    ctx.lineTo(g.x + 5 + g.w, g.y + 8 + sway);
    ctx.lineTo(g.x + 5, g.y + 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('★', g.x + 12, g.y + 14);
  }
}

/* ===================== OYUN YÖNETİCİSİ ===================== */
const Game = (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0 };

  let world = null;
  let levelIdx = 0;
  let deaths = 0;
  let totalDeaths = 0;
  let state = 'menu';   // menu | playing | dead | clear | win
  let deadTimer = 0;
  let acc = 0, last = 0;
  const STEP = 1000 / 60;

  const el = {
    level: document.getElementById('hud-level'),
    name: document.getElementById('hud-name'),
    deaths: document.getElementById('hud-deaths'),
    hint: document.getElementById('hint'),
    overlay: document.getElementById('overlay'),
    clear: document.getElementById('level-clear'),
    clearTitle: document.getElementById('clear-title'),
    clearStats: document.getElementById('clear-stats'),
    win: document.getElementById('win-screen'),
    winStats: document.getElementById('win-stats'),
  };

  let hintTimer = 0;
  function showHint(text) {
    el.hint.textContent = text;
    el.hint.classList.add('show');
    hintTimer = 360;
  }

  function loadLevel(i) {
    levelIdx = i;
    const def = LEVELS[i];
    world = new World(def);
    deaths = 0;
    cam.x = 0; cam.y = 0;
    el.level.textContent = `Bölüm ${i + 1}/${LEVELS.length}`;
    el.name.textContent = def.name + (def.invert === 'lr' ? '  ⇆ TERS!' : '');
    el.deaths.textContent = `Ölüm: ${totalDeaths}`;
    Input.setInvert(def.invert || null);
    showHint(def.hint);
    state = 'playing';
  }

  function respawn() {
    world.player.reset();
    world.resetDynamic();
  }

  function updateCamera() {
    const p = world.player;
    const tx = Engine.clamp(p.cx - VIEW_W / 2, 0, Math.max(0, world.width - VIEW_W));
    const ty = Engine.clamp(p.cy - VIEW_H / 2 - 30, 0, Math.max(0, world.height - VIEW_H));
    cam.x += (tx - cam.x) * 0.12;
    cam.y += (ty - cam.y) * 0.12;
  }

  function step() {
    Input.preUpdate();

    if (state === 'playing') {
      world.update();
      updateCamera();
      if (world.player.dead) { state = 'dead'; deadTimer = 38; deaths++; totalDeaths++; el.deaths.textContent = `Ölüm: ${totalDeaths}`; }
      else if (world.player.won) {
        if (levelIdx + 1 >= LEVELS.length) { state = 'win'; showWin(); }
        else { state = 'clear'; showClear(); }
      }
    } else if (state === 'dead') {
      for (const pt of world.particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life--; }
      deadTimer--;
      if (deadTimer <= 0) { respawn(); state = 'playing'; }
    }

    if (hintTimer > 0) { hintTimer--; if (hintTimer === 0) el.hint.classList.remove('show'); }
    Input.postUpdate();
  }

  function showClear() {
    el.clearTitle.textContent = `BÖLÜM ${levelIdx + 1} TAMAM!`;
    el.clearStats.textContent = `Bu bölümdeki ölüm: ${deaths}`;
    el.clear.classList.remove('hidden');
  }
  function showWin() {
    el.winStats.textContent = `Toplam ölüm: ${totalDeaths}`;
    el.win.classList.remove('hidden');
  }

  function render() {
    if (world) world.draw(ctx, cam);
    else { ctx.fillStyle = '#79cfd4'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

    // ölüm flaşı
    if (state === 'dead') {
      ctx.fillStyle = `rgba(180,30,30,${Engine.clamp(deadTimer / 38, 0, 1) * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TUZAĞA DÜŞTÜN!', VIEW_W / 2, VIEW_H / 2);
      ctx.textAlign = 'left';
    }
  }

  function frame(ts) {
    if (!last) last = ts;
    let dt = ts - last; last = ts;
    if (dt > 100) dt = 100;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) { step(); acc -= STEP; guard++; }
    render();
    requestAnimationFrame(frame);
  }

  function init() {
    Input.bindTouch();
    Input.onRestart(() => { if (state === 'playing' || state === 'dead') { respawn(); state = 'playing'; } });

    // Uzun basınca "Seç" menüsü / metin seçimi ve çift-dokunuş yakınlaştırmayı engelle
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320) e.preventDefault();  // çift-dokunuş zoom'u kes
      lastTouchEnd = now;
    }, { passive: false });

    document.getElementById('start-btn').addEventListener('click', () => {
      el.overlay.classList.add('hidden');
      loadLevel(0);
    });
    document.getElementById('next-btn').addEventListener('click', () => {
      el.clear.classList.add('hidden');
      loadLevel(levelIdx + 1);
    });
    document.getElementById('restart-all-btn').addEventListener('click', () => {
      el.win.classList.add('hidden');
      totalDeaths = 0;
      loadLevel(0);
    });

    requestAnimationFrame(frame);
  }

  return { init };
})();

window.addEventListener('load', Game.init);
