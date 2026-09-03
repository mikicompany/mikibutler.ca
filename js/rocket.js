/* Shared "branded launch" flourish — a logo rocket flies diagonally with a
   fire trail and confetti burst. Call window.arcadeRocket() from any share/send
   button. Self-contained: injects its own CSS, respects reduced-motion. */
(function () {
  if (window.arcadeRocket) return;                 // a page may already define it (arcade)
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css =
    '.rk{position:fixed;z-index:10050;font-size:40px;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(255,180,80,.5));}' +
    '.rk-spark{position:fixed;z-index:10049;width:7px;height:7px;border-radius:50%;pointer-events:none;will-change:transform,opacity;}' +
    '.rk-ring{position:fixed;z-index:10048;border:3px solid rgba(160,255,0,.75);border-radius:50%;pointer-events:none;will-change:transform,opacity;box-shadow:0 0 18px rgba(160,255,0,.5);}' +
    '.rk-conf{position:fixed;z-index:10049;border-radius:1px;pointer-events:none;will-change:transform,opacity;}' +
    '.rk-logo{position:fixed;z-index:10050;width:58px;height:58px;border-radius:50%;object-fit:cover;pointer-events:none;will-change:transform,opacity;box-shadow:0 0 0 2px var(--accent,#a0ff00),0 0 24px rgba(160,255,0,.65),0 0 60px rgba(160,255,0,.35);}';
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  function mk(cls) { var d = document.createElement('div'); d.className = cls; return d; }

  var FIRE = ['#ffffff', '#a0ff00', '#d4ff4d', '#ffcf5a', '#ff8a3d', '#ff5030'];
  function flame(x, y) {
    var s = mk('rk-spark'), col = FIRE[(Math.random() * FIRE.length) | 0], sz = 5 + Math.random() * 9;
    s.style.width = s.style.height = sz + 'px'; s.style.background = col; s.style.boxShadow = '0 0 12px ' + col;
    s.style.left = x + 'px'; s.style.top = y + 'px'; document.body.appendChild(s);
    var vx = (Math.random() * 2 - 1) * 0.08, vy = -(0.02 + Math.random() * 0.06), t0 = performance.now(), life = 300 + Math.random() * 260;
    (function step(now) { var d = now - t0, p = d / life; if (p >= 1) { s.remove(); return; }
      var wob = Math.sin(d * 0.03) * 6;
      s.style.transform = 'translate(' + (vx * d + wob) + 'px,' + (vy * d) + 'px) scale(' + (1 - p) + ')'; s.style.opacity = String(1 - p);
      requestAnimationFrame(step); })(t0);
  }
  function confPiece(cx, cy) {
    var cols = ['#a0ff00', '#d4ff4d', '#ffd36b', '#ff7a3d', '#ffffff', '#61e0ff'];
    var c = mk('rk-conf'); c.style.width = (5 + Math.random() * 6) + 'px'; c.style.height = (8 + Math.random() * 8) + 'px';
    c.style.background = cols[(Math.random() * cols.length) | 0]; c.style.left = cx + 'px'; c.style.top = cy + 'px'; document.body.appendChild(c);
    var ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - 3;
    var g = 0.18, rot = Math.random() * 360, vr = (Math.random() * 2 - 1) * 12, t0 = performance.now(), life = 900 + Math.random() * 700, x = 0, y = 0;
    (function step(now) { var p = (now - t0) / life; if (p >= 1) { c.remove(); return; }
      vy += g; x += vx; y += vy; vx *= 0.99; rot += vr;
      c.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)'; c.style.opacity = String(1 - p * p);
      requestAnimationFrame(step); })(t0);
  }
  function starPiece(cx, cy) {
    var s = mk('rk'); s.style.fontSize = '22px'; s.textContent = ['✨', '⭐', '🌟'][(Math.random() * 3) | 0];
    s.style.left = cx + 'px'; s.style.top = cy + 'px'; document.body.appendChild(s);
    var a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, t0 = performance.now(), life = 800;
    (function step(now) { var d = now - t0, p = d / life; if (p >= 1) { s.remove(); return; }
      s.style.transform = 'translate(-50%,-50%) translate(' + (vx * d * 0.06) + 'px,' + (vy * d * 0.06) + 'px) scale(' + (1 + p) + ')'; s.style.opacity = String(1 - p);
      requestAnimationFrame(step); })(t0);
  }
  function confettiBurst(cx, cy) { for (var i = 0; i < 46; i++) confPiece(cx, cy); for (var k = 0; k < 6; k++) starPiece(cx, cy); }

  function launchRocket() {
    if (reduce) return;
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
    var sx = innerWidth * 0.12, sy = innerHeight + 40, ex = innerWidth * 0.92, ey = -120;
    var dx = ex - sx, dy = ey - sy, ang = Math.atan2(dy, dx), tailLen = 30, tx = Math.cos(ang), ty = Math.sin(ang), deg = ang * 180 / Math.PI + 90;
    var ring = mk('rk-ring'); ring.style.left = sx + 'px'; ring.style.top = (sy - 30) + 'px'; ring.style.width = ring.style.height = '20px'; document.body.appendChild(ring);
    (function () { var t0 = performance.now(), life = 460;
      (function step(now) { var p = (now - t0) / life; if (p >= 1) { ring.remove(); return; }
        var s = 20 + p * 190; ring.style.width = ring.style.height = s + 'px'; ring.style.transform = 'translate(-50%,-50%)'; ring.style.opacity = String(1 - p);
        requestAnimationFrame(step); })(t0); })();
    var rk = document.createElement('img'); rk.className = 'rk-logo'; rk.src = 'images/logo512.jpg'; rk.alt = ''; document.body.appendChild(rk);
    var t0 = performance.now(), dur = 1500, wobA = (18 + Math.random() * 16), burst = false;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 2.2);
      var px = sx + dx * e, py = sy + dy * e, wob = Math.sin(p * Math.PI * 3) * wobA * (1 - p);
      var x = px + (-ty) * wob, y = py + (tx) * wob;
      rk.style.left = x + 'px'; rk.style.top = y + 'px';
      rk.style.transform = 'translate(-50%,-50%) rotate(' + (deg + Math.sin(p * Math.PI * 3) * 6) + 'deg) scale(' + (0.85 + 0.35 * p) + ')';
      rk.style.opacity = p > 0.9 ? String(1 - (p - 0.9) / 0.1) : '1';
      if (p < 0.9) { var fx = x - tx * tailLen, fy = y - ty * tailLen; flame(fx, fy); if (Math.random() < 0.7) flame(fx + (Math.random() * 10 - 5), fy + (Math.random() * 10 - 5)); }
      if (!burst && p > 0.72) { burst = true; confettiBurst(x, y); }
      if (p < 1) requestAnimationFrame(step); else rk.remove();
    })(t0);
  }
  window.arcadeRocket = launchRocket;
})();
