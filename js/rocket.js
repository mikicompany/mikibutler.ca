/* Shared share/send flourish — the logo pops from the pressed button, scales up
   with a green glow, and fades. Call window.arcadeRocket(originEl_or_point) from
   any share/send button. Self-contained: injects its own CSS, respects
   reduced-motion. (Named arcadeRocket for backwards-compat.) */
(function () {
  if (window.arcadeRocket) return;
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css =
    '.rk-ring{position:fixed;z-index:10048;border:3px solid rgba(160,255,0,.7);border-radius:50%;pointer-events:none;will-change:transform,opacity;}' +
    '.rk-logo{position:fixed;z-index:10050;width:32px;height:32px;border-radius:50%;object-fit:cover;pointer-events:none;will-change:transform,opacity;}';
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  // Resolve an origin (an element, a {x,y}/event, or nothing) to a screen point.
  function pt(o) {
    if (o) {
      if (o.getBoundingClientRect) { var r = o.getBoundingClientRect(); if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      if (typeof o.clientX === 'number') return { x: o.clientX, y: o.clientY };
      if (typeof o.x === 'number') return { x: o.x, y: o.y };
    }
    return { x: innerWidth / 2, y: innerHeight / 2 };
  }

  function launch(origin) {
    if (reduce) return;
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
    var p = pt(origin);
    // expanding green ring pulse
    var ring = document.createElement('div'); ring.className = 'rk-ring';
    ring.style.left = p.x + 'px'; ring.style.top = p.y + 'px'; ring.style.width = ring.style.height = '12px';
    document.body.appendChild(ring);
    (function () {
      var t0 = performance.now(), life = 650;
      (function st(now) { var q = (now - t0) / life; if (q >= 1) { ring.remove(); return; }
        var s = 12 + q * 85; ring.style.width = ring.style.height = s + 'px';
        ring.style.transform = 'translate(-50%,-50%)'; ring.style.opacity = String((1 - q) * 0.65);
        requestAnimationFrame(st); })(t0);
    })();
    // logo scales up from the button, glows green, fades out
    var img = document.createElement('img'); img.className = 'rk-logo'; img.src = 'images/logo512.jpg'; img.alt = '';
    img.style.left = p.x + 'px'; img.style.top = p.y + 'px'; document.body.appendChild(img);
    var t0 = performance.now(), dur = 820;
    (function st(now) {
      var q = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - q, 3);
      var sc = 0.35 + e * 1.95, g = Math.sin(q * Math.PI);   // glow swells then settles
      img.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
      img.style.opacity = String(1 - q * q);
      img.style.boxShadow = '0 0 0 2px rgba(160,255,0,' + (0.9 * (1 - q)) + '),0 0 ' + (22 + g * 55) + 'px rgba(160,255,0,' + (0.5 + 0.4 * g) + '),0 0 ' + (60 + g * 100) + 'px rgba(160,255,0,' + (0.35 * g) + ')';
      if (q < 1) requestAnimationFrame(st); else img.remove();
    })(t0);
  }
  window.arcadeRocket = launch;
})();
