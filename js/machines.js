/* ===========================================================
   machines.js — Basit makineler + Bubi tuzakları
   Her makine isteğe bağlı olarak şu metotları sunar:
     update(world), draw(ctx)
     getSolid() -> solid rect (carry/conveyor/spring flag'li olabilir)
     getSlope() -> {x1,y1,x2,y2} dinamik rampa (kaldıraç)
     deadlyRects() -> [ {x,y,w,h} ]
     deadlyCircles() -> [ {x,y,r} ]
   =========================================================== */

const Machines = (() => {

  /* --- Sarkaç: sallanan dikenli top (pendulum) --- */
  class Pendulum {
    constructor(d) {
      this.px = d.x; this.py = d.y;
      this.len = d.length || 160;
      this.r = d.ballR || 22;
      this.amp = d.amp || 1.1;           // radyan genlik
      this.speed = d.speed || 0.03;
      this.t = d.phase || 0;
      this.angle = 0; this.bx = 0; this.by = 0;
    }
    update() {
      this.t += this.speed;
      this.angle = Math.sin(this.t) * this.amp;
      this.bx = this.px + Math.sin(this.angle) * this.len;
      this.by = this.py + Math.cos(this.angle) * this.len;
    }
    deadlyCircles() { return [{ x: this.bx, y: this.by, r: this.r - 3 }]; }
    draw(ctx) {
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(this.px, this.py); ctx.lineTo(this.bx, this.by); ctx.stroke();
      // tavan bağlantısı
      ctx.fillStyle = '#555'; ctx.fillRect(this.px - 8, this.py - 6, 16, 8);
      // dikenli top
      const r = this.r;
      ctx.save(); ctx.translate(this.bx, this.by); ctx.rotate(this.t);
      ctx.fillStyle = '#444';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(-4, -r + 8); ctx.lineTo(4, -r + 8);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a7a7a';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* --- Makara / Asansör (pulley): iki platform, ağırlık dengesi --- */
  class Pulley {
    constructor(d) {
      this.lx = d.leftX; this.rx = d.rightX;
      this.topY = d.topY;
      this.baseY = d.baseY;            // platformların dinlenme yüksekliği
      this.range = d.range || 150;
      this.w = d.platW || 70;
      this.h = 14;
      this.offset = 0;                 // + : sol aşağı / sağ yukarı
      this.left = this._solid(this.lx, this.baseY + this.offset);
      this.right = this._solid(this.rx, this.baseY - this.offset);
      this.left._prevY = this.left.y; this.right._prevY = this.right.y;
    }
    _solid(x, y) {
      return { x, y, w: this.w, h: this.h, carry: { dx: 0, dy: 0 } };
    }
    update(world) {
      const p = world.player;
      const onLeft = p.standingOn === this.left;
      const onRight = p.standingOn === this.right;
      // Üzerine binilen platform YUKARI kalkar (karşı taraf iner — denge)
      let target = this.offset;
      if (onLeft) target = -this.range;
      else if (onRight) target = this.range;
      else target *= 0.92;
      this.offset += (target - this.offset) * 0.12;

      const ly = this.baseY + this.offset;
      const ry = this.baseY - this.offset;
      this.left.carry.dy = ly - this.left.y;
      this.right.carry.dy = ry - this.right.y;
      this.left.y = ly; this.right.y = ry;
    }
    getSolids() { return [this.left, this.right]; }
    draw(ctx) {
      // makara çarkı
      const midX = (this.lx + this.rx) / 2 + this.w / 2;
      ctx.fillStyle = '#666';
      ctx.beginPath(); ctx.arc(this.lx + this.w / 2, this.topY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.rx + this.w / 2, this.topY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#999';
      ctx.beginPath(); ctx.arc(this.lx + this.w / 2, this.topY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.rx + this.w / 2, this.topY, 5, 0, Math.PI * 2); ctx.fill();
      // ipler
      ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.lx + this.w / 2, this.topY); ctx.lineTo(this.left.x + this.w / 2, this.left.y);
      ctx.moveTo(this.rx + this.w / 2, this.topY); ctx.lineTo(this.right.x + this.w / 2, this.right.y);
      ctx.moveTo(this.lx + this.w / 2, this.topY); ctx.lineTo(this.rx + this.w / 2, this.topY);
      ctx.stroke();
      // platformlar (ahşap)
      for (const s of [this.left, this.right]) {
        ctx.fillStyle = '#8a5a2b';
        Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 3); ctx.fill();
        ctx.fillStyle = '#a06a33';
        ctx.fillRect(s.x, s.y, s.w, 4);
      }
    }
  }

  /* --- Konveyör bant (tekerlek/aks) --- */
  class Conveyor {
    constructor(d) {
      this.solid = { x: d.x, y: d.y, w: d.w, h: d.h || 16, conveyor: d.speed || 1.6 };
      this.dir = (d.speed || 1.6) >= 0 ? 1 : -1;
      this.scroll = 0;
    }
    update() { this.scroll = (this.scroll + this.solid.conveyor) % 24; }
    getSolid() { return this.solid; }
    draw(ctx) {
      const s = this.solid;
      ctx.fillStyle = '#2b2b2b';
      Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 6); ctx.fill();
      // çarklar
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(s.x + 12, s.y + s.h / 2, s.h / 2 + 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + s.w - 12, s.y + s.h / 2, s.h / 2 + 2, 0, Math.PI * 2); ctx.fill();
      // bant okları
      ctx.fillStyle = '#888';
      for (let i = 0; i < s.w - 16; i += 24) {
        const px = s.x + 8 + ((i + this.scroll) % (s.w - 16));
        ctx.beginPath();
        ctx.moveTo(px, s.y + 4);
        ctx.lineTo(px + 6 * this.dir, s.y + s.h / 2);
        ctx.lineTo(px, s.y + s.h - 4);
        ctx.fill();
      }
    }
  }

  /* --- Yay / zıplama pedi --- */
  class Spring {
    constructor(d) {
      this.solid = { x: d.x, y: d.y, w: d.w || 44, h: 14, spring: d.power || 16, springAnim: 0 };
    }
    update() { if (this.solid.springAnim > 0) this.solid.springAnim -= 0.08; }
    getSolid() { return this.solid; }
    draw(ctx) {
      const s = this.solid;
      const sq = Math.max(0, s.springAnim);
      const top = s.y + sq * 8;
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3;
      ctx.beginPath();
      const coils = 4, h = (s.y + 20) - top;
      for (let i = 0; i <= coils; i++) {
        const yy = top + 14 + (h / coils) * i;
        ctx.moveTo(s.x + 4, yy); ctx.lineTo(s.x + s.w - 4, yy + 4);
      }
      ctx.stroke();
      ctx.fillStyle = '#e8413a';
      Engine.roundRect(ctx, s.x, top, s.w, 12, 4); ctx.fill();
    }
  }

  /* --- Hareketli platform --- */
  class MovingPlatform {
    constructor(d) {
      this.ax = d.ax; this.ay = d.ay; this.bx = d.bx; this.by = d.by;
      this.speed = d.speed || 1.2;
      this.w = d.w || 80; this.h = d.h || 14;
      this.t = d.phase || 0;
      this.solid = { x: this.ax, y: this.ay, w: this.w, h: this.h, carry: { dx: 0, dy: 0 } };
    }
    update() {
      this.t += this.speed * 0.01;
      const k = (Math.sin(this.t) + 1) / 2;
      const nx = Engine.lerp(this.ax, this.bx, k);
      const ny = Engine.lerp(this.ay, this.by, k);
      this.solid.carry.dx = nx - this.solid.x;
      this.solid.carry.dy = ny - this.solid.y;
      this.solid.x = nx; this.solid.y = ny;
    }
    getSolid() { return this.solid; }
    draw(ctx) {
      const s = this.solid;
      ctx.fillStyle = '#7a6c52';
      Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 4); ctx.fill();
      ctx.fillStyle = '#9a8a68'; ctx.fillRect(s.x, s.y, s.w, 4);
      // ray noktaları
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.ax + this.w / 2, this.ay + this.h / 2);
      ctx.lineTo(this.bx + this.w / 2, this.by + this.h / 2); ctx.stroke();
    }
  }

  /* --- Ezici blok (düşen tuzak / press) --- */
  class Crusher {
    constructor(d) {
      this.x = d.x; this.w = d.w || 70;
      this.topY = d.topY;              // dinlenme (yukarı)
      this.bottomY = d.bottomY;        // ezme noktası
      this.h = d.h || 50;
      this.period = d.period || 150;
      this.t = d.phase || 0;
      this.y = this.topY;
      this.state = 'wait';
      this.solid = { x: this.x, y: this.y, w: this.w, h: this.h, carry: { dx: 0, dy: 0 } };
      this.smashing = false;
    }
    update() {
      this.t++;
      const cycle = this.t % this.period;
      const prevY = this.y;
      if (cycle < this.period * 0.55) { this.y = this.topY; this.smashing = false; }
      else if (cycle < this.period * 0.62) {
        // hızlı düşüş
        const k = (cycle - this.period * 0.55) / (this.period * 0.07);
        this.y = Engine.lerp(this.topY, this.bottomY, k);
        this.smashing = true;
      } else if (cycle < this.period * 0.78) { this.y = this.bottomY; this.smashing = true; }
      else {
        const k = (cycle - this.period * 0.78) / (this.period * 0.22);
        this.y = Engine.lerp(this.bottomY, this.topY, k);
        this.smashing = false;
      }
      this.solid.carry.dy = this.y - prevY;
      this.solid.y = this.y;
    }
    getSolid() { return this.solid; }
    deadlyRects() {
      // ezerken alt yüzü ölümcül
      return this.smashing ? [{ x: this.x + 3, y: this.y + this.h - 10, w: this.w - 6, h: 14 }] : [];
    }
    draw(ctx) {
      // raylar
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(this.x - 4, this.topY - 4, 4, this.bottomY - this.topY + this.h);
      ctx.fillRect(this.x + this.w, this.topY - 4, 4, this.bottomY - this.topY + this.h);
      Engine.hazardBeam(ctx, this.x, this.y, this.w, this.h);
      // alt dikenler
      ctx.fillStyle = '#2a2a2a';
      for (let i = 6; i < this.w - 6; i += 14) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y + this.h);
        ctx.lineTo(this.x + i + 7, this.y + this.h);
        ctx.lineTo(this.x + i + 3.5, this.y + this.h + 9);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* --- Yuvarlanan kaya (eğik düzlem + tekerlek), tetikle çalışır --- */
  class Boulder {
    constructor(d) {
      this.startX = d.x; this.startY = d.y;
      this.r = d.r || 26;
      this.triggerX = d.triggerX;
      this.endX = d.endX;
      this.slopeY1 = d.y; this.slopeY2 = d.endY || d.y;
      this.speed = d.speed || 3.2;
      this.x = this.startX; this.y = this.startY;
      this.rolling = false; this.spin = 0;
    }
    update(world) {
      if (!this.rolling && world.player.x > this.triggerX) this.rolling = true;
      if (this.rolling) {
        this.x += this.speed;
        const t = Engine.clamp((this.x - this.startX) / (this.endX - this.startX), 0, 1);
        this.y = Engine.lerp(this.slopeY1, this.slopeY2, t);
        this.spin += this.speed / this.r;
        if (this.x > this.endX + 60) { this.x = this.startX; this.y = this.startY; this.rolling = false; }
      }
    }
    deadlyCircles() { return this.rolling ? [{ x: this.x, y: this.y, r: this.r - 4 }] : []; }
    draw(ctx) {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
      ctx.fillStyle = '#6e6256';
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5048';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * this.r * 0.4, Math.sin(a) * this.r * 0.4, this.r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#4a4038'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.r - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /* --- Fırlayan çivili duvar (piston tuzak) --- */
  class SpikeWall {
    constructor(d) {
      this.baseX = d.x; this.y = d.y;
      this.w = d.w || 26; this.h = d.h || 80;
      this.reach = d.reach || 60;
      this.fromLeft = d.fromLeft !== false; // true: soldan sağa fırlar
      this.period = d.period || 120;
      this.t = d.phase || 0;
      this.ext = 0;
    }
    update() {
      this.t++;
      const c = this.t % this.period;
      if (c < this.period * 0.4) this.ext = 0;
      else if (c < this.period * 0.5) this.ext = (c - this.period * 0.4) / (this.period * 0.1) * this.reach;
      else if (c < this.period * 0.7) this.ext = this.reach;
      else this.ext = Engine.clamp((1 - (c - this.period * 0.7) / (this.period * 0.3)) * this.reach, 0, this.reach);
    }
    _rect() {
      const x = this.fromLeft ? this.baseX + this.ext : this.baseX - this.ext;
      return { x, y: this.y, w: this.w, h: this.h };
    }
    deadlyRects() { return this.ext > 4 ? [this._rect()] : []; }
    draw(ctx) {
      const r = this._rect();
      // yuva
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(this.fromLeft ? this.baseX - 6 : this.baseX + this.w - 6, this.y - 4, 12, this.h + 8);
      // gövde
      Engine.hazardBeam(ctx, r.x, r.y, r.w, r.h);
      // çiviler (ileri yön)
      ctx.fillStyle = '#888';
      const tipX = this.fromLeft ? r.x + r.w : r.x;
      const dir = this.fromLeft ? 1 : -1;
      for (let i = 6; i < r.h - 6; i += 12) {
        ctx.beginPath();
        ctx.moveTo(tipX, r.y + i);
        ctx.lineTo(tipX, r.y + i + 8);
        ctx.lineTo(tipX + 10 * dir, r.y + i + 4);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* --- Testere (ray boyunca gidip gelen) --- */
  class Sawblade {
    constructor(d) {
      this.ax = d.ax; this.ay = d.ay; this.bx = d.bx; this.by = d.by;
      this.r = d.r || 22; this.speed = d.speed || 0.02;
      this.t = d.phase || 0; this.x = d.ax; this.y = d.ay; this.spin = 0;
    }
    update() {
      this.t += this.speed;
      const k = (Math.sin(this.t) + 1) / 2;
      this.x = Engine.lerp(this.ax, this.bx, k);
      this.y = Engine.lerp(this.ay, this.by, k);
      this.spin += 0.3;
    }
    deadlyCircles() { return [{ x: this.x, y: this.y, r: this.r - 4 }]; }
    draw(ctx) {
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(this.ax, this.ay); ctx.lineTo(this.bx, this.by); ctx.stroke();
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
      ctx.fillStyle = '#c0c4c8';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 === 0 ? this.r : this.r - 7;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* --- Kaldıraç / Tahterevalli (lever, dinamik rampa olarak) --- */
  class Seesaw {
    constructor(d) {
      this.px = d.x; this.py = d.y;
      this.half = d.half || 90;
      this.maxAngle = d.maxAngle || 0.42;
      this.angle = d.angle || 0;     // + : sağ aşağı
      this.angVel = 0;
    }
    update(world) {
      const p = world.player;
      // oyuncu kirişin üstündeyse tork uygula
      const onPlank = this._near(p.cx, p.bottom);
      let torque = 0;
      if (onPlank) torque = Engine.sign(p.cx - this.px) * 0.0016 * Math.abs(p.cx - this.px) / this.half;
      this.angVel += torque;
      this.angVel *= 0.9;
      this.angle += this.angVel;
      this.angle = Engine.clamp(this.angle, -this.maxAngle, this.maxAngle);
    }
    _ends() {
      const c = Math.cos(this.angle), s = Math.sin(this.angle);
      return {
        lx: this.px - this.half * c, ly: this.py - this.half * s,
        rx: this.px + this.half * c, ry: this.py + this.half * s
      };
    }
    _near(x, bottom) {
      if (x < this.px - this.half || x > this.px + this.half) return false;
      const e = this._ends();
      const gy = Engine.lerp(e.ly, e.ry, (x - e.lx) / (e.rx - e.lx));
      return Math.abs(bottom - gy) < 24;
    }
    getSlope() {
      const e = this._ends();
      return { x1: e.lx, y1: e.ly, x2: e.rx, y2: e.ry };
    }
    draw(ctx) {
      const e = this._ends();
      // destek üçgeni
      ctx.fillStyle = '#7a5a33';
      ctx.beginPath();
      ctx.moveTo(this.px, this.py);
      ctx.lineTo(this.px - 16, this.py + 34);
      ctx.lineTo(this.px + 16, this.py + 34);
      ctx.closePath(); ctx.fill();
      // kiriş
      ctx.save();
      ctx.translate(this.px, this.py); ctx.rotate(this.angle);
      ctx.fillStyle = '#9a6a33';
      Engine.roundRect(ctx, -this.half, -7, this.half * 2, 14, 4); ctx.fill();
      ctx.fillStyle = '#b07a3a';
      ctx.fillRect(-this.half, -7, this.half * 2, 4);
      ctx.restore();
    }
  }

  const registry = {
    pendulum: Pendulum, pulley: Pulley, conveyor: Conveyor,
    spring: Spring, movingPlatform: MovingPlatform, crusher: Crusher,
    boulder: Boulder, spikewall: SpikeWall, sawblade: Sawblade, seesaw: Seesaw
  };

  function create(def) {
    const C = registry[def.type];
    if (!C) { console.warn('Bilinmeyen makine:', def.type); return null; }
    return new C(def);
  }

  return { create };
})();
