/* ===========================================================
   input.js — Klavye + dokunmatik (pointer/bölge tabanlı) giriş
   - Klavye ve dokunmatik ayrı tutulur, her karede birleştirilir.
   - Parmağı bir butondan diğerine kaydırmak anında algılanır.
   - Çoklu dokunuş: aynı anda yön + zıpla basılabilir.
   =========================================================== */

const Input = (() => {
  // Birleştirilmiş okunan durum (oyun bunu okur)
  const state = { left: false, right: false, up: false, down: false, jump: false };

  // Klavye: basılı kod kümesi (durumu bundan türetiriz)
  const pressed = new Set();
  // Dokunmatik o an basılı tuşlar
  let touchKeys = new Set();
  // Programatik/test enjeksiyonu (eylem adları: left/right/up/down/jump)
  const simKeys = new Set();

  let jumpPressedThisFrame = false;
  let jumpHeldPrev = false;

  const has = (...codes) => codes.some(c => pressed.has(c));

  const listeners = { restart: [] };
  const onRestart = (fn) => listeners.restart.push(fn);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') listeners.restart.forEach(f => f());
    if (e.code in MOVE_KEYS) { pressed.add(e.code); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code in MOVE_KEYS) { pressed.delete(e.code); e.preventDefault(); }
  });
  const MOVE_KEYS = {
    ArrowLeft: 1, KeyA: 1, ArrowRight: 1, KeyD: 1,
    ArrowUp: 1, KeyW: 1, ArrowDown: 1, KeyS: 1, Space: 1
  };

  /* ---------- Dokunmatik: pointer + bölge testi ---------- */
  function bindTouch() {
    const buttons = Array.from(document.querySelectorAll('.tbtn'));
    if (!buttons.length) return;

    let rects = [];
    const recalc = () => {
      rects = buttons.map(b => ({ key: b.dataset.key, el: b, r: b.getBoundingClientRect() }));
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', () => setTimeout(recalc, 300));

    const pointers = new Map(); // pointerId -> key

    function hit(x, y) {
      // Buton merkezine en yakın isabet (parmak kenardan taşsa da yakalasın)
      for (const it of rects) {
        const r = it.r;
        // butonu biraz büyüterek test et (daha toleranslı / ergonomik)
        const pad = 10;
        if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return it;
      }
      return null;
    }
    function syncVisual() {
      const active = new Set(pointers.values());
      for (const it of rects) it.el.classList.toggle('pressed', active.has(it.key));
      touchKeys = active;
    }

    function down(e) {
      const it = hit(e.clientX, e.clientY);
      if (!it) return;                 // butona değilse menü vb. dokunuşlarına karışma
      e.preventDefault();
      pointers.set(e.pointerId, it.key);
      syncVisual();
    }
    function move(e) {
      if (!pointers.has(e.pointerId)) return;  // bu parmak bir butonda başlamadıysa yok say
      e.preventDefault();
      const it = hit(e.clientX, e.clientY);
      const key = it ? it.key : null;
      if (pointers.get(e.pointerId) !== key) {
        if (key) pointers.set(e.pointerId, key);
        else pointers.delete(e.pointerId);     // butonların dışına kaydı → bırak
        syncVisual();
      }
    }
    function up(e) {
      if (pointers.delete(e.pointerId)) { e.preventDefault(); syncVisual(); }
    }

    // recalc'ı her dokunuş başında tazele (layout kaymalarına dayanıklı)
    const downFresh = (e) => { recalc(); down(e); };

    document.addEventListener('pointerdown', downFresh, { passive: false });
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up, { passive: false });
    document.addEventListener('pointercancel', up, { passive: false });
    // Pointer event yoksa (eski tarayıcı) touch'a düş
    if (!('PointerEvent' in (typeof window !== 'undefined' ? window : {}))) {
      const fromTouch = (fn) => (e) => {
        for (const t of e.changedTouches) fn({ pointerId: t.identifier, clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
      };
      document.addEventListener('touchstart', (e) => { recalc(); fromTouch(down)(e); }, { passive: false });
      document.addEventListener('touchmove', fromTouch(move), { passive: false });
      document.addEventListener('touchend', fromTouch(up), { passive: false });
      document.addEventListener('touchcancel', fromTouch(up), { passive: false });
    }
  }

  // Her karenin başında: klavye+dokunmatik birleştir + zıplama tetiğini hesapla
  function preUpdate() {
    state.left  = has('ArrowLeft', 'KeyA')  || touchKeys.has('left')  || simKeys.has('left');
    state.right = has('ArrowRight', 'KeyD') || touchKeys.has('right') || simKeys.has('right');
    state.down  = has('ArrowDown', 'KeyS')  || touchKeys.has('down')  || simKeys.has('down');
    // ▲ (touch 'up') yalnızca tırmanma/yukarı; zıplatmaz.
    state.up    = has('ArrowUp', 'KeyW')    || touchKeys.has('up')    || simKeys.has('up');
    // Zıplama: klavyede Yukarı/W/Boşluk (masaüstü beklentisi) VEYA dokunmatik 'jump'.
    state.jump  = has('ArrowUp', 'KeyW', 'Space') || touchKeys.has('jump') || simKeys.has('jump');

    jumpPressedThisFrame = state.jump && !jumpHeldPrev;
  }
  function postUpdate() {
    jumpHeldPrev = state.jump;
  }

  return {
    state, onRestart, bindTouch, preUpdate, postUpdate,
    // Test/programatik kontrol
    _sim: { set: (k, v) => { v ? simKeys.add(k) : simKeys.delete(k); }, clear: () => simKeys.clear() },
    get jumpPressed() { return jumpPressedThisFrame; }
  };
})();
