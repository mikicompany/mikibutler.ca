/* ------------------------------------------------------------------ *
 *  fx.js — light "delight" layer for mikibutler.ca (no sound)
 *  1) Pixel-sparkle burst on click
 *  2) Subtle haptic tap on mobile
 *  3) Konami code → arcade
 *  Self-contained, no dependencies, safe to load on every page.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Which elements count as "interactive" for feedback. */
  var SEL = 'a, button, [role="button"], .skill-tag, .software-item, ' +
            '#gameography-list li, input, select, textarea, summary, label';
  function interactive(el) { return el && el.closest && el.closest(SEL); }

  /* ── haptics (mobile only; silent) ──────────────────────────────── */
  function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  /* ── click: haptic + sparkle ────────────────────────────────────── */
  document.addEventListener('pointerdown', function (e) {
    if (!interactive(e.target)) return;
    buzz(8);
    sparkle(e.clientX, e.clientY);
  }, { passive: true });

  /* ── pixel-sparkle burst ────────────────────────────────────────── */
  var COLORS = ['#7CFF6B', '#4be03a', '#a8ff9c', '#2fbf22']; // all green, a few shades for depth
  function sparkle(x, y) {
    if (reduce) return;
    var n = 6;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('span');
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      var dist = 16 + Math.random() * 20;
      p.style.cssText =
        'position:fixed;left:' + x + 'px;top:' + y + 'px;width:5px;height:5px;' +
        'background:' + COLORS[(Math.random() * COLORS.length) | 0] + ';' +
        'pointer-events:none;z-index:99999;border-radius:1px;' +
        'image-rendering:pixelated;will-change:transform,opacity;';
      document.body.appendChild(p);
      (function (el, dx, dy) {
        if (el.animate) {
          el.animate(
            [ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
              { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(0)', opacity: 0 } ],
            { duration: 480 + Math.random() * 220, easing: 'cubic-bezier(.2,.7,.3,1)' }
          ).onfinish = function () { el.remove(); };
        } else { el.remove(); }
      })(p, Math.cos(a) * dist, Math.sin(a) * dist);
    }
  }

  /* ── Konami code → arcade ───────────────────────────────────────── */
  var CODE = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], pos = 0;
  window.addEventListener('keydown', function (e) {
    pos = (e.keyCode === CODE[pos]) ? pos + 1 : (e.keyCode === CODE[0] ? 1 : 0);
    if (pos === CODE.length) {
      pos = 0;
      buzz([12, 40, 12, 40, 20]);
      var cx = innerWidth / 2, cy = innerHeight / 2;
      for (var k = 0; k < 5; k++) sparkle(cx + (Math.random() - 0.5) * 160, cy + (Math.random() - 0.5) * 120);
      setTimeout(function () { location.href = 'arcade.html'; }, 620);
    }
  });
})();
