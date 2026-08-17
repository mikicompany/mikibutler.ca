/* Site-wide game-controller support.
 *
 * Plug in a gamepad and:
 *   • D-pad / left stick  → move a focus ring between links, buttons & tiles
 *   • A (0)               → activate the focused element
 *   • B (1)               → go back (or close an open lightbox/overlay)
 *   • Start (9)           → toggle the button-map help
 *
 * Inside an image lightbox (Work / Collection) the D-pad, A and B are routed
 * to Arrow / Enter / Escape so those pages' own keyboard nav drives them.
 * Self-contained: injects its own styles, no dependencies. */
(function () {
  if (!('getGamepads' in navigator) || window.__mbGamepad) return;
  window.__mbGamepad = true;

  // ── styles ──────────────────────────────────────────────────────────────
  var css =
    '.gp-focus{outline:3px solid var(--accent,#a0ff00)!important;outline-offset:3px;' +
      'box-shadow:0 0 0 3px rgba(160,255,0,.30),0 0 18px rgba(160,255,0,.45)!important;' +
      'border-radius:8px;scroll-margin:90px;transition:outline-color .1s,box-shadow .1s;}' +
    '.gp-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(18px);' +
      'z-index:100000;background:#12161c;color:#e8eaed;border:1px solid #2a2f37;border-radius:12px;' +
      'padding:11px 18px;font:600 13px/1.4 Inter,system-ui,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);' +
      'opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease;max-width:90vw;text-align:center;}' +
    '.gp-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}' +
    '.gp-toast b{color:var(--accent,#a0ff00);}' +
    '.gp-help{position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;' +
      'background:rgba(6,7,5,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}' +
    '.gp-help.show{display:flex;}' +
    '.gp-help-card{background:#12161c;border:1px solid #2a2f37;border-radius:16px;padding:20px 24px;color:#e8eaed;' +
      'font:14px/1.6 Inter,system-ui,Arial,sans-serif;min-width:280px;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.6);}' +
    '.gp-help-card h3{color:var(--accent,#a0ff00);margin:0 0 12px;font-size:15px;letter-spacing:.04em;}' +
    '.gp-help-card .row{display:flex;justify-content:space-between;gap:20px;padding:5px 0;border-bottom:1px solid #20242b;}' +
    '.gp-help-card .row:last-child{border-bottom:0;}' +
    '.gp-help-card kbd{background:#0e1116;border:1px solid #2a2f37;border-radius:6px;padding:1px 9px;font-weight:700;color:var(--accent,#a0ff00);}';
  var st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);

  var toast = document.createElement('div'); toast.className = 'gp-toast'; toast.setAttribute('role', 'status');
  var help = document.createElement('div'); help.className = 'gp-help';
  help.innerHTML = '<div class="gp-help-card"><h3>🎮 Controller</h3>' +
    '<div class="row"><span>Move</span><kbd>D-pad / Stick</kbd></div>' +
    '<div class="row"><span>Select</span><kbd>A</kbd></div>' +
    '<div class="row"><span>Back / Close</span><kbd>B</kbd></div>' +
    '<div class="row"><span>This help</span><kbd>Start</kbd></div></div>';
  function onReady() {
    (document.body || document.documentElement).appendChild(toast);
    (document.body || document.documentElement).appendChild(help);
  }
  if (document.body) onReady(); else document.addEventListener('DOMContentLoaded', onReady);

  var toastT = 0;
  function showToast(html, ms) {
    toast.innerHTML = html; toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, ms || 3200);
  }

  // ── focus navigation ─────────────────────────────────────────────────────
  var SEL = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), ' +
            'textarea:not([disabled]), [role="button"], [tabindex]:not([tabindex="-1"]), ' +
            '.masonry-item, .cab-list li, .rz-game, .filter-btn';
  var cur = null;

  function isVis(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    var s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    return true;
  }
  function focusables() {
    var seen = [], out = [];
    document.querySelectorAll(SEL).forEach(function (el) {
      if (seen.indexOf(el) >= 0) return; seen.push(el);
      if (isVis(el)) out.push(el);
    });
    return out;
  }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function setFocus(el) {
    if (!el) return;
    if (cur && cur !== el) cur.classList.remove('gp-focus');
    cur = el; el.classList.add('gp-focus');
    try { el.focus({ preventScroll: true }); } catch (_) {}
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  function nearestToCenter() {
    var items = focusables(); if (!items.length) return;
    var cx = innerWidth / 2, cy = innerHeight / 2, best = null, bd = Infinity;
    items.forEach(function (el) {
      var c = center(el.getBoundingClientRect());
      // prefer things currently on screen
      var onScreen = c.y > 0 && c.y < innerHeight;
      var d = Math.hypot(c.x - cx, c.y - cy) + (onScreen ? 0 : 100000);
      if (d < bd) { bd = d; best = el; }
    });
    setFocus(best);
  }
  function move(dir) {
    var items = focusables(); if (!items.length) return;
    if (!cur || items.indexOf(cur) < 0 || !isVis(cur)) { nearestToCenter(); return; }
    var c = center(cur.getBoundingClientRect()), best = null, bestCost = Infinity;
    items.forEach(function (el) {
      if (el === cur) return;
      var e = center(el.getBoundingClientRect());
      var dx = e.x - c.x, dy = e.y - c.y, primary, perp;
      if (dir === 'left') { if (dx > -6) return; primary = -dx; perp = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 6) return; primary = dx; perp = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -6) return; primary = -dy; perp = Math.abs(dx); }
      else { if (dy < 6) return; primary = dy; perp = Math.abs(dx); }
      var cost = primary + perp * 2;
      if (cost < bestCost) { bestCost = cost; best = el; }
    });
    if (best) setFocus(best);
  }
  function activate() {
    if (!cur || !isVis(cur)) { nearestToCenter(); return; }
    try { cur.focus({ preventScroll: true }); } catch (_) {}
    cur.click();
  }

  // ── lightbox routing ──────────────────────────────────────────────────────
  function overlayOpen() { return document.querySelector('.lightbox.open, .lb.open'); }
  function key(k) {
    var o = { key: k, code: k, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', o));
    document.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  var ARROW = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
  function onDir(dir) { if (overlayOpen()) key(ARROW[dir]); else move(dir); }
  function onA() { if (overlayOpen()) key('Enter'); else activate(); }
  function onB() {
    var ov = document.querySelector('.lightbox.open, .lb.open, .cart-drawer.open, .draw-radial.open');
    if (ov) { key('Escape'); return; }
    if (history.length > 1) history.back();
  }
  function toggleHelp() { help.classList.toggle('show'); }
  help.addEventListener('click', function (e) { if (e.target === help) help.classList.remove('show'); });

  // ── polling loop ──────────────────────────────────────────────────────────
  var prev = {};                       // previous pressed state per button
  var repeatAt = 0, lastDir = '';
  var DEAD = 0.55, FIRST = 340, REPEAT = 150;

  function pressed(gp, i) { return gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5); }
  function edge(gp, i) {
    var p = pressed(gp, i), was = prev[i]; prev[i] = p;
    return p && !was;
  }
  function dirFrom(gp) {
    if (pressed(gp, 14)) return 'left';
    if (pressed(gp, 15)) return 'right';
    if (pressed(gp, 12)) return 'up';
    if (pressed(gp, 13)) return 'down';
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) > Math.abs(ay)) {
      if (ax < -DEAD) return 'left'; if (ax > DEAD) return 'right';
    } else {
      if (ay < -DEAD) return 'up'; if (ay > DEAD) return 'down';
    }
    return '';
  }

  var raf = 0;
  function loop() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
    if (gp) {
      // directions with hold-to-repeat
      var dir = dirFrom(gp), now = performance.now();
      if (dir) {
        if (dir !== lastDir) { onDir(dir); lastDir = dir; repeatAt = now + FIRST; }
        else if (now >= repeatAt) { onDir(dir); repeatAt = now + REPEAT; }
      } else { lastDir = ''; }
      // buttons (edge-triggered)
      if (edge(gp, 0)) onA();
      if (edge(gp, 1)) onB();
      if (edge(gp, 9)) toggleHelp();
      if (edge(gp, 8)) toggleHelp();
      // keep other button states current so they don't misfire
      [2, 3, 4, 5, 6, 7, 10, 11, 16].forEach(function (b) { prev[b] = pressed(gp, b); });
    }
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!raf) { nearestToCenter(); loop(); } }
  window.addEventListener('gamepadconnected', function (e) {
    showToast('🎮 <b>Controller connected</b> — D-pad to move · <b>A</b> select · <b>B</b> back · <b>Start</b> help');
    start();
  });
  window.addEventListener('gamepaddisconnected', function () {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var any = false; for (var i = 0; i < pads.length; i++) if (pads[i]) any = true;
    if (!any && raf) { cancelAnimationFrame(raf); raf = 0; if (cur) cur.classList.remove('gp-focus'); }
  });
  // Some browsers only surface an already-connected pad after the first input.
  if (navigator.getGamepads) {
    var probe = setInterval(function () {
      var pads = navigator.getGamepads();
      for (var i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { start(); } }
    }, 800);
    setTimeout(function () { clearInterval(probe); }, 20000);
  }
})();
