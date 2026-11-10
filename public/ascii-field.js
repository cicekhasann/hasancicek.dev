/* ============================================================================
   hasancicek.dev — Yaşayan ASCII / Karakter Akış Alanı (Ultra-Fast Edition)
   ----------------------------------------------------------------------------
   Sıfır GC (string allocation yok), önbellekli renk paleti ve görünürlük
   optimizasyonu ile scroll sırasında <1ms ana iş parçacığı (main-thread) süresi.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData === true;
  if (saveData) return;

  var canvas = document.querySelector('canvas.ascii-field');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'ascii-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
  }
  var ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  var RAMP = '   ..··::--==++**##%%@@';
  var RAMP_LEN = RAMP.length;

  var CELL_W = 18, CELL_H = 22;
  var cols = 0, rows = 0, w = 0, h = 0;
  var hasanEl = document.getElementById('hasan-showcase');
  var hasanTop = 99999, hasanBottom = 99999;

  function measureSections() {
    if (!hasanEl || window.innerWidth <= 768) {
      hasanTop = 99999;
      hasanBottom = 99999;
      return;
    }
    var r = hasanEl.getBoundingClientRect();
    var sy = window.scrollY || 0;
    hasanTop = r.top + sy;
    hasanBottom = r.bottom + sy;
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cols = Math.ceil(w / CELL_W) + 1;
    rows = Math.ceil(h / CELL_H) + 1;
    ctx.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    measureSections();
  }

  // Önceden hesaplanmış renk tabloları (kare başına 0 string birleştirme)
  var PALETTES = {
    amethyst: {
      peak: ['rgba(192,132,252,0.14)', 'rgba(192,132,252,0.22)', 'rgba(192,132,252,0.34)', 'rgba(192,132,252,0.48)'],
      pos:  ['rgba(251,113,133,0.10)', 'rgba(251,113,133,0.16)', 'rgba(251,113,133,0.24)'],
      neg:  ['rgba(129,140,248,0.10)', 'rgba(129,140,248,0.16)', 'rgba(129,140,248,0.24)'],
      base: ['rgba(233,213,255,0.05)', 'rgba(233,213,255,0.09)', 'rgba(233,213,255,0.13)']
    },
    crimson: {
      peak: ['rgba(251,113,133,0.14)', 'rgba(251,113,133,0.22)', 'rgba(251,113,133,0.34)', 'rgba(251,113,133,0.48)'],
      pos:  ['rgba(251,146,60,0.10)',  'rgba(251,146,60,0.16)',  'rgba(251,146,60,0.24)'],
      neg:  ['rgba(244,63,94,0.10)',   'rgba(244,63,94,0.16)',   'rgba(244,63,94,0.24)'],
      base: ['rgba(254,205,211,0.05)', 'rgba(254,205,211,0.09)', 'rgba(254,205,211,0.13)']
    },
    sapphire: {
      peak: ['rgba(96,165,250,0.14)',  'rgba(96,165,250,0.22)',  'rgba(96,165,250,0.34)',  'rgba(96,165,250,0.48)'],
      pos:  ['rgba(251,146,60,0.10)',  'rgba(251,146,60,0.16)',  'rgba(251,146,60,0.24)'],
      neg:  ['rgba(129,140,248,0.10)', 'rgba(129,140,248,0.16)', 'rgba(129,140,248,0.24)'],
      base: ['rgba(191,219,254,0.05)', 'rgba(191,219,254,0.09)', 'rgba(191,219,254,0.13)']
    },
    titanium: {
      peak: ['rgba(248,250,252,0.14)', 'rgba(248,250,252,0.22)', 'rgba(248,250,252,0.34)', 'rgba(248,250,252,0.48)'],
      pos:  ['rgba(244,63,94,0.10)',   'rgba(244,63,94,0.16)',   'rgba(244,63,94,0.24)'],
      neg:  ['rgba(148,163,184,0.10)', 'rgba(148,163,184,0.16)', 'rgba(148,163,184,0.24)'],
      base: ['rgba(203,213,225,0.05)', 'rgba(203,213,225,0.09)', 'rgba(203,213,225,0.13)']
    }
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('load', measureSections, { once: true });

  var ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  window.addEventListener('pointermove', function (e) {
    ptr.tx = e.clientX;
    ptr.ty = e.clientY;
  }, { passive: true });
  window.addEventListener('pointerleave', function () {
    ptr.tx = -9999; ptr.ty = -9999;
  }, { passive: true });

  var scrollY = window.scrollY || 0;
  var lastScrollTime = 0;
  window.addEventListener('scroll', function () {
    scrollY = window.scrollY || 0;
    lastScrollTime = performance.now();
  }, { passive: true });

  var t0 = performance.now();
  var lastDraw = 0;

  function draw(now) {
    if (!reduce) requestAnimationFrame(draw);
    if (document.hidden) return;
    // Aktif hızlı scroll sırasında 45ms, normalde 40ms (~25fps arka plan akışı)
    var interval = (now - lastScrollTime < 120) ? 48 : 38;
    if (now - lastDraw < interval) return;

    // Tam ekran siyah HASAN WebGL sahnesi görünür alanı tamamen kapattığında çizimi atla
    if (scrollY > hasanTop + 80 && scrollY + h < hasanBottom - 80) {
      return;
    }

    lastDraw = now;
    var t = (now - t0) * 0.001;
    ptr.x += (ptr.tx - ptr.x) * 0.2;
    ptr.y += (ptr.ty - ptr.y) * 0.2;

    ctx.clearRect(0, 0, w, h);

    var sOff = scrollY * 0.015;
    var r2 = 185 * 185;
    var theme = document.documentElement.getAttribute('data-theme') || 'amethyst';
    var pal = PALETTES[theme] || PALETTES.amethyst;
    var lastStyle = '';

    for (var r = 0; r < rows; r++) {
      var py = r * CELL_H;
      var ny = r * 0.13 + sOff;
      var rowWave = Math.sin(ny * 0.9 + t * 0.55) * 1.4;

      for (var c = 0; c < cols; c++) {
        var px = c * CELL_W;

        var flow1 = Math.sin(c * 0.10 - t * 2.0 + rowWave);
        var flow2 = Math.cos(c * 0.055 - t * 1.3 - ny * 0.7);
        var band  = Math.sin(ny * 0.55 + c * 0.03 - t * 0.8);
        var v = (flow1 * 0.48 + flow2 * 0.34 + band * 0.18) * 0.5 + 0.5;

        var dx = px - ptr.x, dy = py - ptr.y;
        var d2 = dx * dx + dy * dy;
        var pBoost = 0;
        if (d2 < r2) {
          pBoost = 1 - d2 / r2;
          pBoost *= pBoost;
          v = Math.min(1, v + pBoost * 0.55);
        }

        var idx = (v * (RAMP_LEN - 1)) | 0;
        var ch = RAMP.charAt(idx);
        if (ch === ' ') continue;

        var style;
        var bIdx = v > 0.78 ? 2 : (v > 0.52 ? 1 : 0);
        if (pBoost > 0.18 || v > 0.76) {
          var pIdx = pBoost > 0.45 ? 3 : bIdx;
          style = pal.peak[pIdx];
        } else if (band > 0.35 && v > 0.58) {
          style = pal.pos[bIdx];
        } else if (band < -0.35 && v > 0.60) {
          style = pal.neg[bIdx];
        } else {
          style = pal.base[bIdx];
        }

        if (style !== lastStyle) {
          ctx.fillStyle = style;
          lastStyle = style;
        }
        ctx.fillText(ch, px, py);
      }
    }
  }

  requestAnimationFrame(draw);
})();
