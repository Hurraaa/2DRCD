/* ===========================================================
   input.js — Klavye + dokunmatik giriş yönetimi
   =========================================================== */

const Input = (() => {
  const state = { left: false, right: false, up: false, down: false, jump: false };
  // jumpPressed: bu karede yeni basıldı mı (tek zıplama tetiği)
  let jumpPressedThisFrame = false;
  let jumpHeldPrev = false;

  const keyMap = {
    'ArrowLeft': 'left',  'KeyA': 'left',
    'ArrowRight': 'right','KeyD': 'right',
    'ArrowUp': 'up',      'KeyW': 'up',
    'ArrowDown': 'down',  'KeyS': 'down',
    'Space': 'jump'
  };

  const listeners = { restart: [], anyKey: [] };
  const onRestart = (fn) => listeners.restart.push(fn);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') { listeners.restart.forEach(f => f()); }
    const a = keyMap[e.code];
    if (a) {
      state[a] = true;
      if (a === 'up') state.jump = true; // yukarı ok = zıpla (tırmanma ayrı ele alınır)
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    const a = keyMap[e.code];
    if (a) {
      state[a] = false;
      if (a === 'up') state.jump = false;
      e.preventDefault();
    }
  });

  // Dokunmatik
  function bindTouch() {
    document.querySelectorAll('.tbtn').forEach(btn => {
      const key = btn.dataset.key;
      const map = key === 'jump' ? ['jump'] : (key === 'up' ? ['up', 'jump'] : [key]);
      const press = (v) => (e) => { e.preventDefault(); map.forEach(k => state[k] = v); };
      btn.addEventListener('touchstart', press(true), { passive: false });
      btn.addEventListener('touchend', press(false), { passive: false });
      btn.addEventListener('touchcancel', press(false), { passive: false });
      btn.addEventListener('mousedown', press(true));
      btn.addEventListener('mouseup', press(false));
      btn.addEventListener('mouseleave', press(false));
    });
  }

  // Her karenin sonunda çağrılır: zıplama tetik durumunu günceller
  function postUpdate() {
    jumpHeldPrev = state.jump;
  }
  // Her karenin başında: yeni mi basıldı?
  function preUpdate() {
    jumpPressedThisFrame = state.jump && !jumpHeldPrev;
  }

  return {
    state,
    onRestart,
    bindTouch,
    preUpdate,
    postUpdate,
    get jumpPressed() { return jumpPressedThisFrame; }
  };
})();
