/* ===========================================================
   engine.js — Geometri, çarpışma ve çizim yardımcıları
   =========================================================== */

const Engine = (() => {

  // --- Matematik ---
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = (v) => (v > 0 ? 1 : (v < 0 ? -1 : 0));
  // hedefe sabit adımla yaklaş (belge 2.2)
  const approach = (v, target, step) => {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  };

  // --- AABB çarpışma testi ---
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function rectsOverlap(a, b) {
    return aabb(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
  }

  // Daire-dikdörtgen çarpışma (tuzaklar için)
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) < r * r;
  }

  // Bir dikdörtgenin bir solidler listesi ile yatay çözümü.
  // Döner: {x, hitLeft, hitRight}
  function resolveX(box, solids) {
    let hitLeft = false, hitRight = false;
    for (const s of solids) {
      if (s.oneWay) continue; // tek yönlü platformlar yatayda engellemez
      if (aabb(box.x, box.y, box.w, box.h, s.x, s.y, s.w, s.h)) {
        if (box.vx > 0) { box.x = s.x - box.w; hitRight = true; }
        else if (box.vx < 0) { box.x = s.x + s.w; hitLeft = true; }
        box.vx = 0;
      }
    }
    return { hitLeft, hitRight };
  }

  // Dikey çözüm. Döner: {grounded, ceiling, platform}
  function resolveY(box, solids, prevBottom) {
    let grounded = false, ceiling = false, platform = null;
    for (const s of solids) {
      if (!aabb(box.x, box.y, box.w, box.h, s.x, s.y, s.w, s.h)) continue;

      if (s.oneWay) {
        // Sadece yukarıdan düşerken üstüne basılır
        if (box.vy >= 0 && prevBottom <= s.y + 6) {
          box.y = s.y - box.h;
          box.vy = 0;
          grounded = true;
          platform = s;
        }
        continue;
      }

      if (box.vy > 0) {           // aşağı düşüyor → tepeye otur
        box.y = s.y - box.h;
        box.vy = 0;
        grounded = true;
        platform = s;
      } else if (box.vy < 0) {    // yukarı zıplıyor → tavana çarp
        box.y = s.y + s.h;
        box.vy = 0;
        ceiling = true;
      }
    }
    return { grounded, ceiling, platform };
  }

  // Eğik düzlem (rampa) için: verilen x'te zemin yüksekliğini bul.
  // slope = {x1,y1,x2,y2}. x aralık dışındaysa null döner.
  function slopeGroundY(slope, x) {
    const lo = Math.min(slope.x1, slope.x2);
    const hi = Math.max(slope.x1, slope.x2);
    if (x < lo || x > hi) return null;
    const t = (x - slope.x1) / (slope.x2 - slope.x1);
    return slope.y1 + (slope.y2 - slope.y1) * t;
  }

  // --- Çizim yardımcıları ---
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Tehlike şeritli metal kiriş (iskele/scaffolding)
  function hazardBeam(ctx, x, y, w, h) {
    ctx.fillStyle = '#f4c430';
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#1c1c1c';
    const step = 18;
    for (let i = -h; i < w + h; i += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.lineTo(x + i + h + step, y + h);
      ctx.lineTo(x + i + step, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    clamp, lerp, sign, approach, aabb, rectsOverlap, circleRect,
    resolveX, resolveY, slopeGroundY, roundRect, hazardBeam
  };
})();
