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

  /* --- Makaralı asansör (pulley): TEK binilen platform + karşı ağırlık sandığı.
         Üstüne bas → karşı ağırlık iner, sen yukarı çıkarsın. Boşken geri iner. --- */
  class Pulley {
    constructor(d) {
      this.rideX = d.leftX;            // binilen platform x
      this.weX = (d.weightX != null) ? d.weightX : d.rightX;  // karşı ağırlık x
      this.topY = d.topY;              // makara çarkı yüksekliği
      this.baseY = d.baseY;            // platformun dinlenme (alt) yüksekliği
      this.range = d.range || 170;     // yükselme mesafesi
      this.w = d.platW || 84;
      this.h = 14;
      this.offset = 0;                 // 0..range (yukarı)
      this.ride = { x: this.rideX, y: this.baseY, w: this.w, h: this.h, carry: { dx: 0, dy: 0 } };
      this.weW = 30; this.weH = 30;    // sandık boyutu
    }
    update(world) {
      const onRide = world.player.standingOn === this.ride;
      const target = onRide ? this.range : 0;
      this.offset += (target - this.offset) * 0.1;
      if (Math.abs(target - this.offset) < 0.4) this.offset = target;  // tepede/altta kilitle
      const ny = this.baseY - this.offset;
      this.ride.carry.dy = ny - this.ride.y;
      this.ride.y = ny;
    }
    getSolids() { return [this.ride]; }
    _wheel(ctx, cxw) {
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath(); ctx.arc(cxw, this.topY, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath(); ctx.arc(cxw, this.topY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(cxw, this.topY, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx) {
      const rideCx = this.rideX + this.w / 2;
      const weCx = this.weX + this.weW / 2;
      const weY = this.topY + 24 + this.offset;       // ride yükselince sandık iner

      // üst kiriş + çarklar
      Engine.hazardBeam(ctx, Math.min(rideCx, weCx) - 14, this.topY - 16, Math.abs(rideCx - weCx) + 28, 8);
      this._wheel(ctx, rideCx);
      this._wheel(ctx, weCx);

      // ipler
      ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rideCx, this.topY); ctx.lineTo(this.ride.x + this.w / 2, this.ride.y);
      ctx.moveTo(weCx, this.topY); ctx.lineTo(weCx, weY);
      ctx.moveTo(rideCx, this.topY); ctx.lineTo(weCx, this.topY);
      ctx.stroke();

      // binilen platform (ahşap, "BAS" işaretli)
      const s = this.ride;
      ctx.fillStyle = '#8a5a2b';
      Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 3); ctx.fill();
      ctx.fillStyle = '#a06a33'; ctx.fillRect(s.x, s.y, s.w, 4);
      // yukarı ok işareti
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const ax = s.x + s.w / 2;
      ctx.beginPath();
      ctx.moveTo(ax, s.y - 12); ctx.lineTo(ax - 6, s.y - 4); ctx.lineTo(ax - 2, s.y - 4);
      ctx.lineTo(ax - 2, s.y + 1); ctx.lineTo(ax + 2, s.y + 1); ctx.lineTo(ax + 2, s.y - 4);
      ctx.lineTo(ax + 6, s.y - 4); ctx.closePath(); ctx.fill();

      // karşı ağırlık sandığı
      ctx.fillStyle = '#7a4a24';
      Engine.roundRect(ctx, weCx - this.weW / 2, weY, this.weW, this.weH, 3); ctx.fill();
      ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 2;
      ctx.strokeRect(weCx - this.weW / 2 + 1, weY + 1, this.weW - 2, this.weH - 2);
      ctx.beginPath();                                 // çapraz takviye
      ctx.moveTo(weCx - this.weW / 2, weY); ctx.lineTo(weCx + this.weW / 2, weY + this.weH);
      ctx.moveTo(weCx + this.weW / 2, weY); ctx.lineTo(weCx - this.weW / 2, weY + this.weH);
      ctx.stroke();
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
      this.phase = d.phase || 0;
      this.t = this.phase;
      this.y = this.topY;
      this.state = 'wait';
      this._wasBottom = false;
      this.solid = { x: this.x, y: this.y, w: this.w, h: this.h, carry: { dx: 0, dy: 0 } };
      this.smashing = false;
    }
    reset() { this.t = this.phase || 0; this.y = this.topY; this.smashing = false; this._wasBottom = false; }
    update(world) {
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
      // Darbe geri bildirimi: yere ilk değdiği an sarsıntı + toz
      const atBottom = this.y >= this.bottomY - 0.5;
      if (atBottom && !this._wasBottom && world) {
        world.requestShake(5);
        world.burst(this.x + this.w / 2, this.y + this.h, 9, '#9a8a72', 7, 1.2);
      }
      this._wasBottom = atBottom;
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

  /* --- Yuvarlanan kaya: GERÇEK FİZİK — zemine temas eder, eğimde hızlanır,
         düzde momentum/sürtünme ile yuvarlanır. Tetikle çalışır, her ölümde sıfırlanır. --- */
  class Boulder {
    constructor(d) {
      this.startX = d.x; this.startY = d.y;
      this.r = d.r || 26;
      this.triggerX = d.triggerX;
      this.endX = d.endX;
      this.maxSpeed = d.speed || 4.2;
      this.drive = (d.drive != null) ? d.drive : 0.14;   // yuvarlanma sürükleme (düzde de döner)
      this.reset();
    }
    reset() {
      this.x = this.startX; this.y = this.startY;
      this.vx = 0; this.vy = 0; this.spin = 0; this.rolling = false;
    }
    update(world) {
      if (!this.rolling && world.player.x > this.triggerX) this.rolling = true;
      if (!this.rolling) return;

      // Yerçekimi + hareket
      this.vy += 0.6;
      this.x += this.vx;
      this.y += this.vy;

      // Altındaki araziye otur (zemine temas)
      const gy = world.terrainTopAt(this.x);
      if (gy !== null && this.y + this.r >= gy) {
        this.y = gy - this.r;
        if (this.vy > 0) this.vy = 0;
        // Eğime göre yatay ivme (yokuş aşağı hızlanır) + yuvarlanma sürüklemesi
        const gA = world.terrainTopAt(this.x - 6);
        const gB = world.terrainTopAt(this.x + 6);
        if (gA !== null && gB !== null) {
          const slope = (gB - gA) / 12;            // + : sağa doğru iniş
          this.vx += slope * 0.85;                 // yokuş bileşeni
        }
        this.vx += this.drive;                     // kovalayan momentum
        this.vx *= 0.99;                           // yuvarlanma sürtünmesi
      }
      this.vx = Engine.clamp(this.vx, -this.maxSpeed, this.maxSpeed);
      this.spin += this.vx / this.r;

      // Yol bitince başa dön (sürekli tehdit)
      if (this.x > this.endX + 80) this.reset();
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

  /* ===================================================================
     ALDATICI TUZAKLAR — "basit görünür, şaşırtır, zeki sananı öldürür"
     =================================================================== */

  /* --- Çökme platformu / kapan: normal zemin gibi görünür, basınca düşer --- */
  class FakeTile {
    constructor(d) {
      this.x = d.x; this.y = d.y; this.w = d.w || 60; this.h = d.h || 16;
      this.delay = (d.delay != null) ? d.delay : 22;   // basınca kaç kare sonra çöker
      this.respawnT = d.respawn || 150;                // tekrar belirme
      this.hint = d.hint || false;                     // çatlak ipucu göster?
      this.solid = { x: this.x, y: this.y, w: this.w, h: this.h };
      this.state = 'idle'; this.timer = 0; this.shake = 0; this.fallY = 0; this.fallV = 0;
    }
    reset() { this.state = 'idle'; this.timer = 0; this.shake = 0; this.fallY = 0; this.fallV = 0; }
    update(world) {
      const onIt = world.player.standingOn === this.solid;
      if (this.state === 'idle') {
        if (onIt) { this.state = 'crack'; this.timer = this.delay; }
      } else if (this.state === 'crack') {
        this.shake = Math.sin(this.timer * 0.9) * 2;
        if (--this.timer <= 0) { this.state = 'gone'; this.timer = this.respawnT; this.shake = 0; this.fallY = 0; this.fallV = 0; }
      } else if (this.state === 'gone') {
        this.fallV += 0.6; this.fallY += this.fallV;   // düşen enkaz animasyonu
        if (--this.timer <= 0) this.state = 'idle';
      }
    }
    getSolid() { return (this.state === 'gone') ? null : this.solid; }
    draw(ctx) {
      if (this.state === 'gone') {
        // düşen parça (kısa süre) + boş iz
        if (this.fallY < 140) {
          ctx.fillStyle = '#6b6f78';
          Engine.roundRect(ctx, this.x, this.y + this.fallY, this.w, this.h, 3); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        return;
      }
      const sx = this.x + this.shake;
      // NORMAL taş platform gibi (şüphe çekmesin)
      ctx.fillStyle = '#6b6f78';
      Engine.roundRect(ctx, sx, this.y, this.w, this.h, 4); ctx.fill();
      ctx.fillStyle = '#868b95'; ctx.fillRect(sx, this.y, this.w, 5);
      ctx.fillStyle = '#565a62'; ctx.fillRect(sx, this.y + this.h - 4, this.w, 4);
      if (this.state === 'crack' || this.hint) {       // çatlaklar (basınca belli olur)
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + this.w * 0.3, this.y); ctx.lineTo(sx + this.w * 0.42, this.y + this.h);
        ctx.moveTo(sx + this.w * 0.62, this.y); ctx.lineTo(sx + this.w * 0.52, this.y + this.h);
        ctx.stroke();
      }
    }
  }

  /* --- Tavandan düşen kaya: belirli noktayı geçince yukarıdan iner --- */
  class FallingRock {
    constructor(d) {
      this.x = d.x; this.topY = (d.topY != null) ? d.topY : 70;
      this.groundY = d.groundY || 500; this.r = d.r || 24;
      this.tx1 = (d.triggerX1 != null) ? d.triggerX1 : (d.triggerX - 36);
      this.tx2 = (d.triggerX2 != null) ? d.triggerX2 : (d.triggerX + 36);
      this.delay = (d.delay != null) ? d.delay : 8;
      this.respawnT = d.respawn || 110;
      this.state = 'ready'; this.y = this.topY; this.vy = 0; this.timer = 0;
    }
    reset() { this.state = 'ready'; this.y = this.topY; this.vy = 0; this.timer = 0; }
    update(world) {
      const p = world.player;
      if (this.state === 'ready') {
        if (p.cx > this.tx1 && p.cx < this.tx2) { this.state = 'warn'; this.timer = this.delay; }
      } else if (this.state === 'warn') {
        if (--this.timer <= 0) this.state = 'fall';
      } else if (this.state === 'fall') {
        this.vy += 0.7; this.y += this.vy;
        if (this.y >= this.groundY - this.r) {
          this.y = this.groundY - this.r; this.state = 'landed'; this.timer = this.respawnT;
          if (world) { world.requestShake(5); world.burst(this.x, this.groundY, 10, '#7a6a55', 8, 1.4); }
        }
      } else if (this.state === 'landed') {
        if (--this.timer <= 0) this.reset();
      }
    }
    deadlyCircles() { return this.state === 'fall' ? [{ x: this.x, y: this.y, r: this.r - 3 }] : []; }
    draw(ctx) {
      // tavan yuvası
      ctx.fillStyle = '#4a4038'; ctx.fillRect(this.x - this.r - 2, this.topY - this.r - 4, this.r * 2 + 4, 6);
      // uyarı (toz/sallanma)
      if (this.state === 'warn') {
        ctx.fillStyle = `rgba(230,70,60,${0.4 + 0.4 * Math.abs(Math.sin(this.timer * 0.6))})`;
        ctx.beginPath(); ctx.arc(this.x, this.topY + this.r + 8, 5, 0, Math.PI * 2); ctx.fill();
      }
      // kaya (ready'de tavanda asılı durur — ipucu)
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.fillStyle = '#6e6256';
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5048';
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * this.r * 0.4, Math.sin(a) * this.r * 0.4, this.r * 0.16, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  /* --- Yerden fırlayan çiviler: tetik bölgesine basınca aniden çıkar --- */
  class PopSpikes {
    constructor(d) {
      this.x = d.x; this.y = d.y; this.w = d.w || 60; this.h = d.h || 26;
      this.tx1 = (d.triggerX1 != null) ? d.triggerX1 : this.x - 28;
      this.tx2 = (d.triggerX2 != null) ? d.triggerX2 : this.x + this.w + 28;
      this.delay = (d.delay != null) ? d.delay : 7;
      this.hold = d.hold || 46;
      this.ext = 0; this.state = 'idle'; this.timer = 0;
    }
    reset() { this.ext = 0; this.state = 'idle'; this.timer = 0; }
    update(world) {
      const p = world.player;
      if (this.state === 'idle') {
        if (p.cx > this.tx1 && p.cx < this.tx2 && p.grounded) { this.state = 'warn'; this.timer = this.delay; }
      } else if (this.state === 'warn') {
        if (--this.timer <= 0) { this.state = 'up'; this.timer = this.hold; }
      } else if (this.state === 'up') {
        this.ext = Math.min(this.h, this.ext + 5);
        if (--this.timer <= 0) this.state = 'down';
      } else if (this.state === 'down') {
        this.ext = Math.max(0, this.ext - 3);
        if (this.ext <= 0) this.reset();
      }
    }
    deadlyRects() { return this.ext > 4 ? [{ x: this.x, y: this.y + this.h - this.ext, w: this.w, h: this.ext }] : []; }
    draw(ctx) {
      if (this.ext <= 0) {  // gizli delikler (idle)
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        for (let i = 4; i < this.w; i += 12) ctx.fillRect(this.x + i, this.y + this.h - 3, 6, 3);
        return;
      }
      const topY = this.y + this.h - this.ext;
      ctx.fillStyle = '#9aa0a6';
      const n = Math.max(1, Math.floor(this.w / 14)); const bw = this.w / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(this.x + i * bw, this.y + this.h);
        ctx.lineTo(this.x + i * bw + bw / 2, topY);
        ctx.lineTo(this.x + (i + 1) * bw, this.y + this.h);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* --- Ok/dart tuzağı: görünmez tel geçilince duvardan ok fırlar --- */
  class DartTrap {
    constructor(d) {
      this.x = d.x; this.y = d.y;
      this.dir = d.dir || -1;                  // okun gidiş yönü (-1 sola, +1 sağa)
      this.tx1 = d.tripX1; this.tx2 = d.tripX2;
      this.speed = d.speed || 7; this.r = d.r || 7; this.range = d.range || 420;
      this.state = 'ready'; this.px = this.x; this.cool = 0;
    }
    reset() { this.state = 'ready'; this.px = this.x; this.cool = 0; }
    update(world) {
      const p = world.player;
      if (this.cool > 0) this.cool--;
      if (this.state === 'ready') {
        if (this.cool <= 0 && p.cx > this.tx1 && p.cx < this.tx2) { this.state = 'fire'; this.px = this.x; }
      } else if (this.state === 'fire') {
        this.px += this.speed * this.dir;
        if (Math.abs(this.px - this.x) > this.range) { this.state = 'ready'; this.cool = 36; }
      }
    }
    deadlyCircles() { return this.state === 'fire' ? [{ x: this.px, y: this.y, r: this.r }] : []; }
    draw(ctx) {
      ctx.fillStyle = '#3a3a3a';               // duvar deliği
      ctx.fillRect(this.dir < 0 ? this.x : this.x - 7, this.y - 9, 7, 18);
      if (this.state === 'fire') {
        ctx.save(); ctx.translate(this.px, this.y);
        ctx.fillStyle = '#5a4632';             // ok gövdesi
        ctx.fillRect(-8, -1.5, 16, 3);
        ctx.fillStyle = '#9aa0a6';             // uç
        ctx.beginPath();
        ctx.moveTo(8 * this.dir, 0); ctx.lineTo(8 * this.dir - 5 * this.dir, -4); ctx.lineTo(8 * this.dir - 5 * this.dir, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /* --- Buz zemini: çok kaygan, fren tutmaz, dikkatli oyuncu kayıp düşer --- */
  class IceFloor {
    constructor(d) { this.solid = { x: d.x, y: d.y, w: d.w, h: d.h || 16, ice: true }; }
    getSolid() { return this.solid; }
    draw(ctx) {
      const s = this.solid;
      ctx.fillStyle = '#bfe7f2';
      Engine.roundRect(ctx, s.x, s.y, s.w, s.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(s.x, s.y, s.w, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      for (let i = 8; i < s.w; i += 22) {
        ctx.beginPath(); ctx.moveTo(s.x + i, s.y + 3); ctx.lineTo(s.x + i + 8, s.y + s.h - 3); ctx.stroke();
      }
    }
  }

  /* --- Sahte bayrak: gerçek hedefe benzer; yaklaşınca taban çivileri fırlar --- */
  class DecoyFlag {
    constructor(d) {
      this.x = d.x; this.y = d.y;              // direk konumu (goal gibi)
      this.groundY = d.groundY || 500;
      this.span = d.span || 96;
      this.tx1 = (d.triggerX1 != null) ? d.triggerX1 : this.x - 70;
      this.tx2 = (d.triggerX2 != null) ? d.triggerX2 : this.x + 70;
      this.state = 'idle'; this.ext = 0; this.timer = 0; this.lean = 0;
    }
    reset() { this.state = 'idle'; this.ext = 0; this.timer = 0; this.lean = 0; }
    update(world) {
      const p = world.player;
      if (this.state === 'idle') {
        if (p.cx > this.tx1 && p.cx < this.tx2) { this.state = 'spring'; this.timer = 6; }
      } else if (this.state === 'spring') {
        if (--this.timer <= 0) this.state = 'up';
      } else if (this.state === 'up') {
        this.ext = Math.min(30, this.ext + 6);
        this.lean = Math.min(0.5, this.lean + 0.06);   // bayrak yana devrilir (tuzak ortaya çıkar)
      }
    }
    deadlyRects() {
      return this.ext > 4 ? [{ x: this.x - this.span / 2, y: this.groundY - this.ext, w: this.span, h: this.ext }] : [];
    }
    draw(ctx) {
      // Gerçek bayrağa benzer (aldatma)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.lean);
      ctx.fillStyle = '#cfcfcf'; ctx.fillRect(0, -10, 5, this.groundY - this.y + 10);
      ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(2.5, -10, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8413a';
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(35, 8); ctx.lineTo(5, 20); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Tetiklenince taban çivileri
      if (this.ext > 0) {
        ctx.fillStyle = '#9aa0a6';
        const n = 6, bw = this.span / n, bx = this.x - this.span / 2;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(bx + i * bw, this.groundY);
          ctx.lineTo(bx + i * bw + bw / 2, this.groundY - this.ext);
          ctx.lineTo(bx + (i + 1) * bw, this.groundY);
          ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  const registry = {
    pendulum: Pendulum, pulley: Pulley, conveyor: Conveyor,
    spring: Spring, movingPlatform: MovingPlatform, crusher: Crusher,
    boulder: Boulder, spikewall: SpikeWall, sawblade: Sawblade, seesaw: Seesaw,
    // Aldatıcı tuzaklar
    fakeTile: FakeTile, fallingRock: FallingRock, popSpikes: PopSpikes,
    dartTrap: DartTrap, iceFloor: IceFloor, decoyFlag: DecoyFlag
  };

  function create(def) {
    const C = registry[def.type];
    if (!C) { console.warn('Bilinmeyen makine:', def.type); return null; }
    return new C(def);
  }

  return { create };
})();
