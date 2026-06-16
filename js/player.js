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

  // --- Çizim: kel çizgi-film karakter (görsellerdeki gibi) ---
  draw(ctx) {
    const x = this.x, y = this.y, w = this.w, h = this.h;
    const cx = x + w / 2;
    const f = this.facing;

    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(f, 1);

    // Yürüme bacak salınımı
    const walk = (this.grounded && Math.abs(this.vx) > 0.4) || this.climbing || this.hanging;
    const swing = walk ? Math.sin(this.animTime) : 0;
    const legA = swing * 8;
    const armA = -swing * 7;

    // Gölge
    ctx.save();
    ctx.translate(0, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bacaklar (mavi şort + bacak)
    ctx.strokeStyle = '#f0c08c';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, h - 16); ctx.lineTo(-4 - legA * 0.4, h);
    ctx.moveTo(4, h - 16);  ctx.lineTo(4 + legA * 0.4, h);
    ctx.stroke();
    // Şort
    ctx.fillStyle = '#3b5bb5';
    Engine.roundRect(ctx, -8, h - 24, 16, 11, 3);
    ctx.fill();

    // Gövde (beyaz tişört)
    ctx.fillStyle = '#f5f5f5';
    Engine.roundRect(ctx, -9, h - 36, 18, 16, 5);
    ctx.fill();
    ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = 1; ctx.stroke();

    // Kollar
    ctx.strokeStyle = '#f0c08c';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    if (this.hanging) {
      ctx.moveTo(-6, h - 34); ctx.lineTo(-6, h - 44);
      ctx.moveTo(6, h - 34);  ctx.lineTo(6, h - 44);
    } else if (this.climbing) {
      ctx.moveTo(-6, h - 34); ctx.lineTo(-9, h - 42);
      ctx.moveTo(6, h - 34);  ctx.lineTo(9, h - 40 + armA);
    } else {
      ctx.moveTo(-6, h - 34); ctx.lineTo(-7 + armA * 0.3, h - 22);
      ctx.moveTo(6, h - 34);  ctx.lineTo(7 - armA * 0.3, h - 22);
    }
    ctx.stroke();

    // Boyun
    ctx.strokeStyle = '#f0c08c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, h - 36); ctx.lineTo(0, h - 41); ctx.stroke();

    // Kafa (kel)
    ctx.fillStyle = '#f3c89b';
    ctx.beginPath();
    ctx.arc(0, h - 49, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0ad7c'; ctx.lineWidth = 1; ctx.stroke();
    // Kulak
    ctx.fillStyle = '#f3c89b';
    ctx.beginPath(); ctx.arc(8, h - 49, 2.4, 0, Math.PI * 2); ctx.fill();
    // Yüz
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(4, h - 51, 1.4, 0, Math.PI * 2); ctx.fill(); // göz
    ctx.strokeStyle = '#a9743f'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(5, h - 47, 2.5, 0.1, 1.1); ctx.stroke(); // gülümseme

    ctx.restore();
  }
}
