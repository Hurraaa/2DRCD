/* ===========================================================
   player.js — Oyuncu karakteri: yürür, zıplar, tırmanır
   =========================================================== */

class Player {
  constructor(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.w = 26;
    this.h = 46;
    this.reset();
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.climbing = false;   // dikey merdiven/halat
    this.hanging = false;    // yatay halat (monkey bars)
    this.dead = false;
    this.won = false;
    this.coyote = 0;         // zemini yeni terk etme toleransı
    this.jumpBuffer = 0;
    this.animTime = 0;
    this.standingOn = null;
    this.lastGroundY = this.spawnY + this.h;   // gölge için son zemin seviyesi
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }

  // --- Fizik tabanları ---
  static get GRAVITY() { return 0.62; }
  static get MOVE() { return 0.9; }
  static get MAX_SPEED() { return 4.4; }
  static get FRICTION() { return 0.78; }
  static get JUMP_VEL() { return -12.4; }
  static get CLIMB_SPEED() { return 2.6; }

  update(world) {
    if (this.dead || this.won) return;
    const inp = Input.state;
    const prevBottom = this.bottom;

    // --- Tırmanma alanı kontrolü ---
    const ladder = world.climbableAt(this.cx, this.cy, this.x, this.y, this.w, this.h);
    const hbar = world.hangBarAt(this.cx, this.y, this.w);

    // Yatay halatta asılma
    if (hbar && !this.grounded && (this.hanging || inp.up)) {
      this.hanging = true;
      this.climbing = false;
      this.y = hbar.y - 6;       // ele asılı yükseklik
      this.vy = 0;
      this.vx = 0;
      if (inp.left)  { this.x -= Player.CLIMB_SPEED; this.facing = -1; }
      if (inp.right) { this.x += Player.CLIMB_SPEED; this.facing = 1; }
      // Halattan zıplayıp bırakma
      if (Input.jumpPressed && inp.down) { this.hanging = false; }
      else if (Input.jumpPressed) { this.hanging = false; this.vy = Player.JUMP_VEL * 0.8; }
      if (this.cx < hbar.x || this.cx > hbar.x + hbar.w) this.hanging = false;
      this.animTime += 0.2;
    } else {
      this.hanging = false;

      // Dikey tırmanma
      if (ladder && (inp.up || inp.down || this.climbing)) {
        // Zemindeyken yukarı ile zıplamayı değil tırmanmayı seç
        this.climbing = true;
      }
      if (this.climbing && !ladder) this.climbing = false;

      if (this.climbing) {
        this.vy = 0;
        this.vx = 0;
        // merdivene hizala
        const targetX = ladder.x + ladder.w / 2 - this.w / 2;
        this.x += (targetX - this.x) * 0.4;
        if (inp.up)   this.y -= Player.CLIMB_SPEED;
        if (inp.down) this.y += Player.CLIMB_SPEED;
        this.animTime += (inp.up || inp.down) ? 0.18 : 0;
        // Tırmanırken yana zıpla
        if (Input.jumpPressed && (inp.left || inp.right)) {
          this.climbing = false;
          this.vy = Player.JUMP_VEL * 0.85;
          this.vx = inp.left ? -Player.MAX_SPEED : Player.MAX_SPEED;
        }
        // Merdiven tepesinden çıkış (zemine basınca)
        this._resolve(world, prevBottom, true);
        return;
      }

      // --- Normal yatay hareket ---
      if (inp.left)  { this.vx -= Player.MOVE; this.facing = -1; }
      if (inp.right) { this.vx += Player.MOVE; this.facing = 1; }
      if (!inp.left && !inp.right) this.vx *= Player.FRICTION;
      this.vx = Engine.clamp(this.vx, -Player.MAX_SPEED, Player.MAX_SPEED);

      // --- Yerçekimi ---
      this.vy += Player.GRAVITY;
      if (this.vy > 16) this.vy = 16;

      // --- Zıplama (coyote + buffer) ---
      if (Input.jumpPressed) this.jumpBuffer = 8;
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = Player.JUMP_VEL;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.grounded = false;
      }
      // Kısa zıplama (tuşu bırakınca)
      if (!inp.jump && this.vy < -4) this.vy = -4;

      if (this.jumpBuffer > 0) this.jumpBuffer--;

      this._resolve(world, prevBottom, false);

      // animasyon
      if (this.grounded && Math.abs(this.vx) > 0.4) this.animTime += 0.22;
      else if (this.grounded) this.animTime *= 0.6;
    }
  }

  _resolve(world, prevBottom, climbMode) {
    const solids = world.solidsThisFrame;

    // X ekseni
    this.x += this.vx;
    Engine.resolveX(this, solids);

    // Y ekseni
    if (!climbMode) {
      this.y += this.vy;
      const r = Engine.resolveY(this, solids, prevBottom);

      // Eğik düzlem (rampa) çözümü
      const gy = world.slopeGroundAt(this.cx);
      if (gy !== null && this.bottom > gy && this.bottom - gy < 30 && this.vy >= 0) {
        this.y = gy - this.h;
        this.vy = 0;
        r.grounded = true;
      }

      this.grounded = r.grounded;
      this.standingOn = r.platform;
      if (r.grounded) this.lastGroundY = this.y + this.h;   // gölgeyi zemine sabitle
      if (r.grounded) this.coyote = 7;
      else if (this.coyote > 0) this.coyote--;

      // Hareketli platform yatay taşıması.
      // (Dikey takip resolveY snap'i ile zaten olur; carry.dy eklersek çift hareket olur.)
      if (r.grounded && r.platform && r.platform.carry) {
        this.x += r.platform.carry.dx;
      }
      // Konveyör itişi
      if (r.grounded && r.platform && r.platform.conveyor) {
        this.x += r.platform.conveyor;
      }
      // Yay / zıplama pedi
      if (r.grounded && r.platform && r.platform.spring) {
        this.vy = -r.platform.spring;
        this.grounded = false;
        r.platform.springAnim = 1;
      }
    } else {
      // tırmanırken sadece duvarlarla yatay çakışmayı çöz
      Engine.resolveX(this, solids);
    }

    // Dünya sınırları
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > world.width) { this.x = world.width - this.w; this.vx = 0; }

    // Çukura / haritadan düşme
    if (this.y > world.height + 80) this.die();
  }

  die() {
    if (!this.dead && !this.won) this.dead = true;
  }

  win() {
    if (!this.won && !this.dead) this.won = true;
  }

  // --- Çizim: özgün küçük kâşif (saçlı, gözlüklü, ceketli, sırt çantalı) ---
  draw(ctx) {
    const x = this.x, y = this.y, h = this.h;
    const cx = x + this.w / 2;
    const f = this.facing;

    // Palet
    const SKIN = '#e8b88c', SKIN_D = '#cf9a6e';
    const JACKET = '#ef7d3a', JACKET_D = '#cf5f23';   // turuncu ceket
    const PANTS = '#2f7d4f', PANTS_D = '#225e3b';     // yeşil pantolon
    const BOOTS = '#5a3a22';
    const HAIR = '#3a2a1c';                            // koyu kahve saç
    const PACK = '#7a4a8c';                            // mor sırt çantası

    // Gölge — dünya uzayında, son zemin seviyesine sabit (zıplayınca yukarı çıkmaz).
    // Havalandıkça hafifçe küçülüp soluyor.
    const groundY = (this.lastGroundY != null) ? this.lastGroundY : (y + h);
    const air = Math.max(0, groundY - (y + h));
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.2 - air * 0.0009)})`;
    const sw = Math.max(7, 15 - air * 0.03);
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 2, sw, sw * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(f, 1);

    const walk = (this.grounded && Math.abs(this.vx) > 0.4) || this.climbing || this.hanging;
    const swing = walk ? Math.sin(this.animTime) : 0;
    const legA = swing * 8;
    const armA = -swing * 7;
    const bob = walk ? Math.abs(Math.sin(this.animTime)) * 1.2 : 0; // hafif zıpçıp

    ctx.translate(0, -bob);

    // Sırt çantası (geride — gövdenin arkasında, -x tarafı)
    ctx.fillStyle = PACK;
    Engine.roundRect(ctx, -13, h - 35, 9, 16, 3); ctx.fill();
    ctx.fillStyle = '#693d78';
    ctx.fillRect(-12, h - 30, 7, 4);

    // Botlar + bacaklar (yeşil pantolon)
    ctx.lineCap = 'round';
    ctx.strokeStyle = PANTS; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-4, h - 18); ctx.lineTo(-4 - legA * 0.4, h - 3);
    ctx.moveTo(4, h - 18);  ctx.lineTo(4 + legA * 0.4, h - 3);
    ctx.stroke();
    ctx.fillStyle = BOOTS;  // botlar
    Engine.roundRect(ctx, -8 - legA * 0.4, h - 5, 9, 5, 2); ctx.fill();
    Engine.roundRect(ctx, -1 + legA * 0.4, h - 5, 9, 5, 2); ctx.fill();

    // Kemer
    ctx.fillStyle = '#33240f';
    ctx.fillRect(-9, h - 24, 18, 3);

    // Gövde (turuncu ceket)
    ctx.fillStyle = JACKET;
    Engine.roundRect(ctx, -9, h - 38, 18, 16, 5); ctx.fill();
    ctx.fillStyle = JACKET_D;                       // ceket fermuarı/gölge
    ctx.fillRect(-1, h - 37, 2, 14);
    ctx.fillStyle = '#ffd35a';                       // göğüs amblemi
    ctx.beginPath(); ctx.arc(-4.5, h - 31, 2, 0, Math.PI * 2); ctx.fill();

    // Kollar (ceket kollu + ten el)
    ctx.strokeStyle = JACKET; ctx.lineWidth = 5;
    ctx.beginPath();
    if (this.hanging) {
      ctx.moveTo(-5, h - 36); ctx.lineTo(-5, h - 46);
      ctx.moveTo(6, h - 36);  ctx.lineTo(6, h - 46);
    } else if (this.climbing) {
      ctx.moveTo(-5, h - 36); ctx.lineTo(-9, h - 44);
      ctx.moveTo(6, h - 36);  ctx.lineTo(10, h - 42 + armA);
    } else {
      ctx.moveTo(-5, h - 36); ctx.lineTo(-6 + armA * 0.3, h - 25);
      ctx.moveTo(6, h - 36);  ctx.lineTo(7 - armA * 0.3, h - 25);
    }
    ctx.stroke();
    ctx.fillStyle = SKIN;                            // eller
    const handY = this.hanging ? h - 46 : (this.climbing ? h - 44 : h - 25);
    ctx.beginPath(); ctx.arc(this.hanging ? -5 : (this.climbing ? -9 : -6 + armA * 0.3), handY, 2.2, 0, Math.PI * 2); ctx.fill();

    // Boyun
    ctx.strokeStyle = SKIN; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, h - 38); ctx.lineTo(0, h - 42); ctx.stroke();

    // Kafa
    const hy = h - 50;
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(0, hy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1; ctx.stroke();
    // Kulak
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(8, hy + 1, 2.2, 0, Math.PI * 2); ctx.fill();

    // Saç (kâkül + tepe tutamı)
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.arc(0, hy - 1, 9.4, Math.PI * 1.02, Math.PI * 2.05);
    ctx.lineTo(8, hy - 3);
    ctx.quadraticCurveTo(2, hy - 12, -6, hy - 7);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, hy - 9);          // tepe tutamı
    ctx.quadraticCurveTo(7, hy - 15, 4, hy - 7); ctx.fill();

    // Alındaki gözlük (kâşif goggle)
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-7, hy - 4); ctx.lineTo(8, hy - 4.5); ctx.stroke();
    ctx.fillStyle = '#9fd6e8';
    ctx.beginPath(); ctx.arc(3.5, hy - 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(3.5, hy - 4, 2.6, 0, Math.PI * 2); ctx.stroke();

    // Yüz
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(4, hy, 1.5, 0, Math.PI * 2); ctx.fill();       // göz
    ctx.fillStyle = '#d98f6a';                                              // yanak
    ctx.beginPath(); ctx.arc(6.5, hy + 3, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(4.5, hy + 3, 2.3, 0.15, 1.15); ctx.stroke();   // gülümseme

    ctx.restore();
  }
}
