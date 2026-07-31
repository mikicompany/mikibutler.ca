/* ------------------------------------------------------------------ *
 *  fx.js — site-wide "feel" layer for mikibutler.ca
 *  1) Tactile sound (8-bit square-wave ticks) on hover / click
 *  2) Haptic buzz on tap (mobile)
 *  3) A small persistent mute toggle
 *  4) Playful delight: Konami code → arcade, first-visit logo intro,
 *     pixel-sparkle burst on click
 *  Self-contained, no dependencies, safe to load on every page.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── preference (persisted) ─────────────────────────────────────── */
  var KEY = 'mb_sound';
  function muted() { try { return localStorage.getItem(KEY) === 'off'; } catch (e) { return false; } }
  function setMuted(v) { try { localStorage.setItem(KEY, v ? 'off' : 'on'); } catch (e) {} }

  /* ── 8-bit sound engine (same voice as the arcade) ──────────────── */
  var actx = null;
  function ctx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx && actx.state === 'suspended') { actx.resume(); }
    return actx;
  }
  function tone(freq, dur, when, vol, type) {
    if (muted()) return;
    var c = ctx(); if (!c) return;
    try {
      var t = c.currentTime + (when || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol || 0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  var sHover = function () { tone(660, 0.035, 0, 0.018, 'square'); };            // soft high tick
  var sClick = function () { tone(300, 0.05, 0, 0.045); tone(190, 0.05, 0.04, 0.035); };
  var sToggleOn  = function () { tone(523, 0.06, 0, 0.05); tone(784, 0.08, 0.06, 0.05); };
  var sJingle = function () { tone(523,0.08,0,0.05); tone(659,0.08,0.08,0.05); tone(784,0.08,0.16,0.05); tone(1047,0.16,0.24,0.05); };

  /* Which elements count as "interactive" for feedback. */
  var SEL = 'a, button, [role="button"], .skill-tag, .software-item, ' +
            '#gameography-list li, input, select, textarea, summary, label';
  function interactive(el) { return el && el.closest && el.closest(SEL); }

  /* ── haptics ────────────────────────────────────────────────────── */
  function buzz(ms) { if (!muted() && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  /* ── unlock audio on first gesture (autoplay policy) ────────────── */
  function unlock() { ctx(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); }
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  /* ── hover ticks (throttled so sweeping the page never machine-guns) */
  var lastHover = 0, lastEl = null;
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var t = interactive(e.target);
    if (!t || t === lastEl) return;
    var now = performance.now();
    if (now - lastHover < 55) { lastEl = t; return; }
    lastHover = now; lastEl = t;
    sHover();
  }, { passive: true });

  /* ── click tick + haptic + sparkle ──────────────────────────────── */
  document.addEventListener('pointerdown', function (e) {
    var t = interactive(e.target);
    if (!t) return;
    sClick();
    buzz(8);
    sparkle(e.clientX, e.clientY);
  }, { passive: true });

  /* ── pixel-sparkle burst ────────────────────────────────────────── */
  var COLORS = ['#7CFF6B', '#59d1ff', '#ffd84a', '#ff7ce0'];
  function sparkle(x, y) {
    if (reduce || muted()) return;
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

  /* ── mute toggle button ─────────────────────────────────────────── */
  function icon(btn) {
    var off = muted();
    btn.textContent = off ? '🔇' : '🔊';
    btn.setAttribute('aria-label', off ? 'Sound off — click to enable' : 'Sound on — click to mute');
    btn.setAttribute('aria-pressed', off ? 'false' : 'true');
  }
  function mountToggle() {
    var btn = document.createElement('button');
    btn.id = 'fx-mute';
    btn.type = 'button';
    btn.style.cssText =
      'position:fixed;right:14px;bottom:14px;z-index:9998;width:40px;height:40px;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,.18);cursor:pointer;' +
      'background:rgba(20,22,26,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      'font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .15s ease, background .2s ease;' +
      'padding:0;color:#fff;';
    icon(btn);
    btn.addEventListener('pointerenter', function () { btn.style.transform = 'scale(1.08)'; });
    btn.addEventListener('pointerleave', function () { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', function () {
      var willMute = !muted();
      setMuted(willMute);
      icon(btn);
      if (!willMute) { ctx(); sToggleOn(); buzz(12); }   // celebrate turning ON
    });
    document.body.appendChild(btn);
  }

  /* ── Konami code → arcade ───────────────────────────────────────── */
  var CODE = [38,38,40,40,37,39,37,39,66,65], pos = 0;
  window.addEventListener('keydown', function (e) {
    pos = (e.keyCode === CODE[pos]) ? pos + 1 : (e.keyCode === CODE[0] ? 1 : 0);
    if (pos === CODE.length) {
      pos = 0;
      ctx(); sJingle(); buzz([12, 40, 12, 40, 20]);
      var cx = innerWidth / 2, cy = innerHeight / 2;
      for (var k = 0; k < 5; k++) sparkle(cx + (Math.random() - 0.5) * 160, cy + (Math.random() - 0.5) * 120);
      setTimeout(function () { location.href = 'arcade.html'; }, 620);
    }
  });

  /* ── first-visit logo intro (home only, once per session) ───────── */
  function maybeIntro() {
    if (reduce) return;
    var home = /(^\/$|index\.html$|\/mikibutler\.ca\/?$)/.test(location.pathname);
    if (!home) return;
    try { if (sessionStorage.getItem('mb_intro') === '1') return; sessionStorage.setItem('mb_intro', '1'); } catch (e) {}

    var ov = document.createElement('div');
    ov.style.cssText =
      'position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(circle at 50% 45%, #14181d 0%, #0a0c0f 70%);';
    var img = document.createElement('img');
    img.src = 'images/logo512.jpg';
    img.alt = '';
    img.style.cssText = 'width:120px;height:120px;border-radius:24px;box-shadow:0 0 0 rgba(124,255,107,0);';
    ov.appendChild(img);
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';

    if (img.animate) {
      img.animate(
        [ { transform: 'scale(.6)', opacity: 0, filter: 'blur(8px)' },
          { transform: 'scale(1.06)', opacity: 1, filter: 'blur(0)', offset: .6 },
          { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' } ],
        { duration: 620, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
      );
    }
    function done() {
      document.documentElement.style.overflow = '';
      if (ov.animate) {
        ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease', fill: 'forwards' })
          .onfinish = function () { ov.remove(); };
      } else { ov.remove(); }
    }
    setTimeout(done, 900);
  }

  /* ── boot ───────────────────────────────────────────────────────── */
  function init() { mountToggle(); maybeIntro(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
