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

    // Hareketli platformla ÖNCE taşı (çarpışmadan önce) — asansör/makara mantığı.
    // Böylece yukarı kalkan platform oyuncunun içine girip onu yana fırlatmaz.
    if (!climbMode && this.grounded && this.standingOn && this.standingOn.carry) {
      this.x += this.standingOn.carry.dx;
      this.y += this.standingOn.carry.dy;
    }

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

      // (Hareketli platform taşıması artık çözümden ÖNCE yapılıyor — yukarıya bakın.)
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

    // Palet — atletli, tombul, "burada ne işim var" tipli amca
    const SKIN = '#e8b88c', SKIN_D = '#cf9a6e';
    const TANK = '#f3efe6', TANK_D = '#d6d0c2';       // kirli-beyaz atlet
    const SHORTS = '#3f5d8f', SHORTS_D = '#324c75';   // mavi şort
    const SHOES = '#5a3a22';                           // kahve ayakkabı
    const HAIR = '#c4beb2';                            // seyrek, kırlaşmış saç (yaşlı baba)

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

    ctx.lineCap = 'round';

    // Bacaklar (kısa, tombul) + ayakkabı
    ctx.strokeStyle = SKIN; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-5, h - 14); ctx.lineTo(-5 - legA * 0.35, h - 3);
    ctx.moveTo(5, h - 14);  ctx.lineTo(5 + legA * 0.35, h - 3);
    ctx.stroke();
    ctx.fillStyle = SHOES;
    Engine.roundRect(ctx, -11 - legA * 0.35, h - 5, 12, 5, 2.5); ctx.fill();
    Engine.roundRect(ctx, -1 + legA * 0.35, h - 5, 12, 5, 2.5); ctx.fill();

    // Şort (geniş)
    ctx.fillStyle = SHORTS;
    Engine.roundRect(ctx, -11, h - 24, 22, 12, 5); ctx.fill();
    ctx.fillStyle = SHORTS_D;
    ctx.fillRect(-1, h - 23, 2, 9);                  // şort orta dikiş

    // Üst gövde (ten — kolsuz atlet, tombul omuzlar)
    ctx.fillStyle = SKIN;
    Engine.roundRect(ctx, -12, h - 40, 24, 17, 9); ctx.fill();

    // Atlet (kirli beyaz) — göbeği saran ön
    ctx.fillStyle = TANK;
    ctx.beginPath(); ctx.ellipse(0, h - 28, 12.5, 10.5, 0, 0, Math.PI * 2); ctx.fill();
    // omuz askıları
    Engine.roundRect(ctx, -8.5, h - 40, 4.5, 14, 2); ctx.fill();
    Engine.roundRect(ctx, 4, h - 40, 4.5, 14, 2); ctx.fill();
    // göbek deliği
    ctx.strokeStyle = TANK_D; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, h - 24, 1.3, 0, Math.PI * 2); ctx.stroke();

    // Tombul kollar (çıplak, ten)
    ctx.strokeStyle = SKIN; ctx.lineWidth = 6;
    ctx.beginPath();
    if (this.hanging) {
      ctx.moveTo(-7, h - 37); ctx.lineTo(-6, h - 47);
      ctx.moveTo(7, h - 37);  ctx.lineTo(6, h - 47);
    } else if (this.climbing) {
      ctx.moveTo(-7, h - 37); ctx.lineTo(-11, h - 45);
      ctx.moveTo(7, h - 37);  ctx.lineTo(11, h - 43 + armA);
    } else {
      ctx.moveTo(-8, h - 37); ctx.lineTo(-9 + armA * 0.3, h - 26);
      ctx.moveTo(8, h - 37);  ctx.lineTo(9 - armA * 0.3, h - 26);
    }
    ctx.stroke();
    ctx.fillStyle = SKIN_D;                          // eller
    const hx = this.hanging ? -6 : (this.climbing ? -11 : -9 + armA * 0.3);
    const hYp = this.hanging ? h - 47 : (this.climbing ? h - 45 : h - 26);
    ctx.beginPath(); ctx.arc(hx, hYp, 2.4, 0, Math.PI * 2); ctx.fill();

    // Boyun (kısa, kalın — gıdık)
    ctx.strokeStyle = SKIN; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, h - 41); ctx.lineTo(0, h - 44); ctx.stroke();

    // Kafa (yuvarlak, biraz iri)
    const hy = h - 51;
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(0, hy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1; ctx.stroke();
    // çift gıdık
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(0, hy + 8, 6, 3.2, 0, 0, Math.PI); ctx.fill();
    // kulak
    ctx.beginPath(); ctx.arc(9, hy + 1, 2.6, 0, Math.PI * 2); ctx.fill();

    // Seyrek, kırlaşmış saç: yanlarda kısa tutamlar + tepede birkaç ince tel
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, hy + 1, 9.5, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();  // arka-alt tutam
    ctx.beginPath(); ctx.arc(0, hy + 1, 9.5, Math.PI * 1.74, Math.PI * 1.96); ctx.stroke(); // kulak üstü ön
    ctx.lineWidth = 1.2;                             // tepede 3 seyrek tel
    ctx.beginPath();
    ctx.moveTo(-3, hy - 8.4); ctx.lineTo(-2.4, hy - 11);
    ctx.moveTo(0.2, hy - 9.2); ctx.lineTo(0.8, hy - 11.8);
    ctx.moveTo(3.2, hy - 8.3); ctx.lineTo(3.8, hy - 10.7);
    ctx.stroke();

    // Kaşlar (kır, yumuşak — yorgun ama sevecen baba)
    ctx.strokeStyle = '#a39c90'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(2, hy - 3.4); ctx.lineTo(5.6, hy - 3.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2.6, hy - 3.3); ctx.lineTo(0, hy - 3.7); ctx.stroke();

    // Gözler (küçük, şaşkın)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(4.3, hy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.2, hy + 0.2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(4.8, hy + 0.3, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.6, hy + 0.5, 1.0, 0, Math.PI * 2); ctx.fill();

    // Patates burun
    ctx.fillStyle = SKIN_D;
    ctx.beginPath(); ctx.arc(6.5, hy + 3.5, 2.2, 0, Math.PI * 2); ctx.fill();

    // Bıyık
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(1.5, hy + 5.5);
    ctx.quadraticCurveTo(4.5, hy + 7, 7, hy + 5);
    ctx.stroke();

    // Ağız (endişeli — aşağı kıvrık)
    ctx.strokeStyle = '#7a4a35'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2.5, hy + 8.6);
    ctx.quadraticCurveTo(4.5, hy + 7.7, 6.5, hy + 8.7);
    ctx.stroke();

    // Ter damlası ("burada ne işim var" havası)
    ctx.fillStyle = 'rgba(120,200,235,0.92)';
    ctx.beginPath();
    ctx.moveTo(9, hy - 7);
    ctx.quadraticCurveTo(7, hy - 4.5, 9, hy - 3.5);
    ctx.quadraticCurveTo(10.6, hy - 4.8, 9, hy - 7);
    ctx.fill();

    ctx.restore();
  }
}
