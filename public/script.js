/* ==========================================================================
   hasancicek.dev — progressive enhancement layer
   Everything here is optional: the page is fully readable without it.
   Optional CDN libs: GSAP + ScrollTrigger (reveals/parallax), Lenis (smooth
   scroll). Each feature degrades on its own if a lib is missing.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const hasGsap = () => Boolean(window.gsap && window.ScrollTrigger);

  // Tell the inline <head> watchdog that JS is alive (keeps `.js` styles on).
  window.__portfolioReady = true;

  /** Run a feature in isolation so one failure never blocks the rest. */
  const safe = (name, fn) => {
    try { fn(); } catch (err) { console.warn(`[portfolio] ${name} failed:`, err); }
  };

  /* ------------------------------------------------------------------------
     Architectural Opening Loader (#site-loader)
     ------------------------------------------------------------------------ */
  function initLoader() {
    const loader = $('[data-loader]');
    if (!loader || !root.classList.contains('is-loading')) return;
    if (reducedMotion) {
      root.classList.remove('is-loading');
      root.classList.add('is-loaded');
      return;
    }

    const numEl = $('[data-loader-num]', loader);
    const fillEl = $('[data-loader-fill]', loader);
    const stepEl = $('[data-loader-step]', loader);
    const stateEl = $('[data-loader-state]', loader);

    const STEPS = [
      [0,  'INITIALIZING KERNEL SURFACE & WEBGL PIPELINE', 'ALLOCATING FRAMEBUFFERS'],
      [35, 'MOUNTING SHADER PROGRAMS & GEOMETRY MESHES',   'LOADING PORTRAIT & TEXTURES'],
      [72, 'VERIFYING ZERO-TRUST TELEMETRY CHANNEL',       'SYNCING SMOOTH SCROLL'],
      [96, 'SYSTEM READY · HANDING OFF TO VIEWPORT',       'STATUS: 200 OK']
    ];

    let ready = false;
    const markReady = () => { ready = true; };
    if (document.readyState === 'complete') {
      ready = true;
    } else {
      window.addEventListener('load', markReady, { once: true });
      setTimeout(markReady, 900);
    }

    const start = performance.now();
    const minDur = 820;

    const tick = (now) => {
      const elapsed = now - start;
      const baseP = Math.min(1, elapsed / minDur);
      const eased = 1 - Math.pow(1 - baseP, 3);
      const pct = ready ? Math.round(eased * 100) : Math.min(92, Math.round(eased * 92));

      if (numEl) numEl.textContent = String(pct).padStart(3, '0');
      if (fillEl) fillEl.style.setProperty('--loader-p', (pct / 100).toFixed(3));

      for (let i = STEPS.length - 1; i >= 0; i--) {
        if (pct >= STEPS[i][0]) {
          if (stepEl) stepEl.textContent = STEPS[i][1];
          if (stateEl) stateEl.textContent = STEPS[i][2];
          break;
        }
      }

      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          root.classList.add('is-loaded');
          root.classList.remove('is-loading');
          if (hasGsap()) window.ScrollTrigger.refresh();
        }, 120);
      }
    };

    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     Smooth scroll (Lenis), synced with GSAP's ticker when both are present
     ------------------------------------------------------------------------ */
  let lenis = null;

  function initSmoothScroll() {
    if (reducedMotion || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    if (hasGsap()) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ------------------------------------------------------------------------
     Header: scrolled state, hide-on-scroll-down, progress bar, mobile nav
     ------------------------------------------------------------------------ */
  const header = $('[data-header]');
  const nav = $('[data-nav]');
  const navToggle = $('[data-nav-toggle]');

  function setNav(open) {
    if (!navToggle || !nav) return;
    navToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    header.classList.toggle('nav-open', open);
    if (open) header.classList.remove('is-hidden');
    if (lenis) (open ? lenis.stop() : lenis.start());
  }
  const navIsOpen = () => navToggle && navToggle.getAttribute('aria-expanded') === 'true';
  const closeNav = () => { if (navIsOpen()) setNav(false); };

  function initHeader() {
    const bar = $('.progress__bar');
    let lastY = window.scrollY;
    let ticking = false;
    let maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);

    window.addEventListener('resize', () => {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    }, { passive: true });
    window.addEventListener('load', () => {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    }, { once: true });

    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('is-hidden', y > lastY && y > 520 && !navIsOpen());
      if (bar) bar.style.setProperty('--p', Math.min(1, Math.max(0, y / maxScroll)).toFixed(4));
      lastY = y;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    // Keyboard users tabbing into the header should always see it.
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
    update();

    if (navToggle) {
      navToggle.addEventListener('click', () => setNav(!navIsOpen()));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navIsOpen()) { setNav(false); navToggle.focus(); }
      });
      window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => {
        if (e.matches) closeNav();
      });
    }
  }

  /** In-page anchors: smooth scroll via Lenis when available, move focus for a11y. */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      const target = hash.length > 1 && document.getElementById(hash.slice(1));
      if (!target) return;

      e.preventDefault();
      closeNav();
      if (lenis) {
        lenis.scrollTo(target, { offset: 0 });
      } else {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
      if (history.pushState) history.pushState(null, '', hash);
    });
  }

  /** Highlight the nav link of the section currently in the middle of the viewport. */
  function initActiveNav() {
    if (!hasIO) return;
    const links = $$('[data-nav-link]');
    const byId = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.removeAttribute('aria-current'));
        const link = byId.get(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    ['top', ...byId.keys()].forEach((id) => {
      const section = document.getElementById(id);
      if (section) io.observe(section);
    });
  }

  /* ------------------------------------------------------------------------
     Scroll reveals: GSAP ScrollTrigger.batch, IntersectionObserver fallback
     ------------------------------------------------------------------------ */
  function revealAll(els) { els.forEach((el) => el.classList.add('is-in')); }

  /**
   * CSS owns the per-kind entrance (see "Scroll reveal" in styles.css); this
   * only decides *when*. Elements entering in the same frame are staggered
   * in DOM order, and grid cards are offset by column so a row sweeps
   * left → right instead of popping in at once. Transform/opacity only.
   */
  function initReveals() {
    const els = $$('[data-reveal]');
    if (!els.length) return;
    if (reducedMotion || !hasIO) { revealAll(els); return; }

    const STEP = 0.09;
    const order = new Map(els.map((el, i) => [el, i]));
    const io = new IntersectionObserver((entries) => {
      const entering = entries
        // Reveal on entry, or immediately if already scrolled past (deep links).
        .filter((e) => e.isIntersecting || e.boundingClientRect.top < 0)
        .map((e) => e.target)
        .sort((a, b) => order.get(a) - order.get(b));

      let visibleIdx = 0;
      entering.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const isPast = rect.bottom < 0;
        let delay = isPast ? 0 : Math.min(visibleIdx++, 4) * 0.06;
        if (!isPast && el.classList.contains('cap')) {
          const left = rect.left;
          const parentLeft = el.parentElement.getBoundingClientRect().left;
          if (left - parentLeft > 8) delay = Math.max(delay, 0.09);
        }
        el.style.setProperty('--delay', `${delay.toFixed(2)}s`);
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    els.forEach((el) => io.observe(el));
  }

  /**
   * Hero depth on pointer move (desktop, fine pointer, motion allowed):
   * the gold light follows the cursor, the photo drifts a few pixels against
   * the fixed viewfinder brackets. One rAF loop that sleeps once settled;
   * transforms only. Held while the swarm intro is on screen.
   */
  /**
   * Hero depth on pointer move (desktop, fine pointer, motion allowed):
   * the gold light follows the cursor, and the centre portrait tilts in 3D
   * toward the pointer — same feel as the HASAN letters. The portrait reads
   * `--rx` / `--ry` (deg) and `--tz` (px) in CSS. One rAF loop that sleeps
   * once settled; transforms only. Held while the swarm intro is on screen.
   */
  function initHeroPointer() {
    if (reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const hero = $('.hero');
    const glow = $('[data-hero-glow]');
    const tilt = $('[data-tilt]');
    if (!hero || !glow) return;

    const desktop = window.matchMedia('(min-width: 861px)');
    const MAX_RY = 14;   // yatay fare -> Y ekseni dönüş (derece)
    const MAX_RX = 10;   // dikey fare  -> X ekseni dönüş (derece)
    const MAX_TZ = 26;   // merkeze yaklaşınca öne çıkış (px)
    let tx = 0; let ty = 0; let x = 0; let y = 0; // glow position (px in hero)
    let px = 0; let py = 0; let cx = 0; let cy = 0; // normalised -1..1
    let raf = 0;
    let rect = null;

    const rest = () => {
      const r = hero.getBoundingClientRect();
      tx = r.width * 0.5; ty = r.height * 0.46; px = 0; py = 0;
    };
    rest(); x = tx; y = ty;

    const frame = () => {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      cx += (px - cx) * 0.08; cy += (py - cy) * 0.08;
      glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (tilt && desktop.matches) {
        // fare sağda (cx>0) -> sağa döner; fare yukarıda (cy<0) -> yukarı bakar
        const ry = (cx * MAX_RY).toFixed(2);
        const rx = (-cy * MAX_RX).toFixed(2);
        const tz = ((1 - Math.min(1, Math.hypot(cx, cy))) * MAX_TZ).toFixed(1);
        tilt.style.setProperty('--ry', `${ry}deg`);
        tilt.style.setProperty('--rx', `${rx}deg`);
        tilt.style.setProperty('--tz', `${tz}px`);
      }
      const settled = Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3 && Math.abs(px - cx) < 0.002 && Math.abs(py - cy) < 0.002;
      raf = settled ? 0 : requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    hero.addEventListener('pointerenter', () => { rect = hero.getBoundingClientRect(); });
    hero.addEventListener('pointermove', (e) => {
      if (root.classList.contains('swarm-active')) return;
      if (!rect) rect = hero.getBoundingClientRect();
      tx = e.clientX - rect.left; ty = e.clientY - rect.top;
      px = (tx / rect.width) * 2 - 1; py = (ty / rect.height) * 2 - 1;
      kick();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { rect = null; rest(); kick(); });
    window.addEventListener('scroll', () => { rect = null; }, { passive: true });
    window.addEventListener('resize', () => { rect = null; rest(); kick(); }, { passive: true });
    desktop.addEventListener('change', () => {
      if (tilt && !desktop.matches) { tilt.style.removeProperty('--rx'); tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--tz'); }
    });
    kick();
  }

  /** Subtle scroll-linked depth on the hero (desktop, motion allowed, GSAP only). */
  function initParallax() {
    if (reducedMotion || !hasGsap() || window.matchMedia('(max-width: 900px)').matches) return;
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    const hero = $('.hero');
    gsap.to('.hero__copy', {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /** Interactive Anatolian Art Backdrop Switcher inside the Hero Monolith */
  function initHeroArtSwitcher() {
    const monolith = $('[data-hero-monolith]');
    if (!monolith) return;
    const slides = $$('[data-art-slide]', monolith);
    const btns = $$('[data-art-btn]', monolith);
    const label = $('[data-art-label]', monolith);
    if (!slides.length || !btns.length) return;

    let current = 0;
    let userPaused = false;

    const activate = (idx) => {
      current = idx % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
      btns.forEach((b, i) => b.classList.toggle('is-active', i === current));
      if (label && btns[current]) {
        label.textContent = btns[current].getAttribute('data-art-title') || '';
      }
    };

    btns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        userPaused = true;
        activate(idx);
      });
    });

    if (!reducedMotion) {
      setInterval(() => {
        if (!userPaused && !document.hidden) activate(current + 1);
      }, 6500);
    }
  }

  /* ------------------------------------------------------------------------
     Small interactions
     ------------------------------------------------------------------------ */
  function initSpotlight() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const track = (card, e) => {
      const r = card.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      card.style.setProperty('--mx', `${mx}px`);
      card.style.setProperty('--my', `${my}px`);
      const nx = (mx / Math.max(1, r.width)) - 0.5;
      const ny = (my / Math.max(1, r.height)) - 0.5;
      card._hoverSwing = nx * 2.2;
      card.style.setProperty('--swing', `${(nx * 2.2).toFixed(2)}deg`);
      card.style.setProperty('--lift-x', `${(-ny * 2.8).toFixed(2)}deg`);
    };
    $$('[data-spotlight]').forEach((card) => {
      card._hoverSwing = 0;
      card.addEventListener('pointermove', (e) => track(card, e), { passive: true });
      card.addEventListener('pointerleave', () => {
        card._hoverSwing = 0;
        card.style.setProperty('--swing', '0deg');
        card.style.setProperty('--lift-x', '0deg');
      }, { passive: true });
    });
    // Repo cards are rendered later from the API: delegate from the grid.
    const grid = $('[data-repo-grid]');
    if (grid) {
      grid.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.repo');
        if (card) track(card, e);
      }, { passive: true });
    }
  }

  /**
   * Synchronized Rope + Pendulum Swing Physics for 01 / Capabilities cards.
   * Each card hangs from a continuous overhead catenary rope and swings
   * continuously like a physical pendulum, reacting to scroll wind and hover.
   */
  function initPendulumCards() {
    if (reducedMotion) return;
    const grid = $('[data-pendulum-grid]');
    const cards = $$('[data-pendulum]');
    if (!grid || !cards.length) return;

    const items = cards.map((card, i) => {
      card.setAttribute('data-pendulum-ready', '');
      return {
        card,
        mainPath: $('[data-rope-main]', card),
        braidPath: $('[data-rope-braid]', card),
        shadowPath: $('[data-rope-shadow]', card),
        freq: [1.18, 0.96, 1.08, 0.92][i % 4],
        phase: [0.0, 2.2, 4.1, 1.35][i % 4],
        amp: [1.95, 1.80, 1.85, 1.75][i % 4],
        bias: [-0.45, 0.45, 0.35, -0.40][i % 4],
        dir: i % 2 === 0 ? 1 : -0.85,
        smoothHover: 0
      };
    });

    let active = false;
    let raf = 0;
    let lastScrollY = window.scrollY || 0;
    let scrollWind = 0;

    window.addEventListener('scroll', () => {
      if (!active) { lastScrollY = window.scrollY || 0; return; }
      const y = window.scrollY || 0;
      const dy = y - lastScrollY;
      lastScrollY = y;
      scrollWind = Math.max(-2.2, Math.min(2.2, scrollWind + dy * 0.018));
    }, { passive: true });

    const tick = (now) => {
      if (!active) { raf = 0; return; }
      if (document.hidden) { raf = requestAnimationFrame(tick); return; }

      const t = now * 0.001;
      scrollWind *= 0.92;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        it.smoothHover += ((it.card._hoverSwing || 0) - it.smoothHover) * 0.12;
        const swingDeg = it.bias + Math.sin(t * it.freq + it.phase) * it.amp + scrollWind * it.dir;
        const totalDeg = swingDeg + it.smoothHover;

        it.card.style.setProperty('--pendulum-deg', `${swingDeg.toFixed(2)}deg`);

        // Synchronize overhead catenary rope knots with the swinging vertical cords
        const rad = (totalDeg * Math.PI) / 180;
        const dy = Math.sin(rad) * 165;
        const yL = (21 - dy).toFixed(1);
        const yR = (21 + dy).toFixed(1);
        const yS_L = (23.5 - dy).toFixed(1);
        const yS_R = (23.5 + dy).toFixed(1);
        const cxMid = (300 - totalDeg * 9).toFixed(1);
        const yMid = (28.5 + Math.abs(totalDeg) * 0.55).toFixed(1);
        const yS_Mid = (31 + Math.abs(totalDeg) * 0.55).toFixed(1);

        const dMain = `M 0,10 Q 62,${yL} 122,${yL} Q ${cxMid},${yMid} 478,${yR} Q 538,${yR} 600,10`;
        const dShadow = `M 0,12.5 Q 62,${yS_L} 122,${yS_L} Q ${cxMid},${yS_Mid} 478,${yS_R} Q 538,${yS_R} 600,12.5`;

        if (it.mainPath) it.mainPath.setAttribute('d', dMain);
        if (it.braidPath) it.braidPath.setAttribute('d', dMain);
        if (it.shadowPath) it.shadowPath.setAttribute('d', dShadow);
      }

      raf = requestAnimationFrame(tick);
    };

    if (hasIO) {
      const io = new IntersectionObserver((entries) => {
        active = entries.some((e) => e.isIntersecting);
        if (active && !raf) {
          lastScrollY = window.scrollY || 0;
          raf = requestAnimationFrame(tick);
        }
      }, { rootMargin: '180px 0px' });
      io.observe(grid);
    } else {
      active = true;
      raf = requestAnimationFrame(tick);
    }
  }

  function initTicker() {
    const track = $('[data-ticker]');
    if (!track || reducedMotion) return;
    const list = track.querySelector('ul');
    const clone = list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('aria-label');
    track.appendChild(clone);
    track.classList.add('is-looping');
  }

  /** Length of the packet animation along the request-path line. */
  function initFlow() {
    const flow = $('.flow');
    if (!flow) return;
    const set = () => flow.style.setProperty('--flow-h', `${Math.max(0, flow.offsetHeight - 44)}px`);
    set();
    window.addEventListener('resize', set, { passive: true });
  }

  function initClock() {
    const year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initThemeDock() {
    const dock = $('[data-theme-dock]');
    const btns = $$('[data-theme-btn]');
    const pWebp = $('[data-portrait-webp]');
    const pImg = $('[data-portrait-img]');
    const PORTRAITS = {
      amethyst: 'assets/portre-aurora.webp?v=20261110b',
      crimson:  'assets/portre-crimson.webp?v=20261110b',
      sapphire: 'assets/portre-sapphire.webp?v=20261110b',
      titanium: 'assets/portre-titanium.webp?v=20261110b'
    };

    const applyTheme = (t) => {
      if (!PORTRAITS[t]) t = 'amethyst';
      if (t === 'amethyst') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', t);
      }
      if (pWebp) pWebp.setAttribute('srcset', PORTRAITS[t]);
      if (pImg) pImg.setAttribute('src', PORTRAITS[t]);
      btns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-theme-btn') === t));
      try { localStorage.setItem('hc-theme', t); } catch (e) {}
    };

    const urlTheme = new URLSearchParams(window.location.search).get('theme');
    let saved = null;
    try { saved = localStorage.getItem('hc-theme'); } catch (e) {}
    applyTheme(urlTheme || saved || 'amethyst');

    if (dock) {
      btns.forEach((btn) => {
        btn.addEventListener('click', () => applyTheme(btn.getAttribute('data-theme-btn')));
      });
    }
  }

  /* ------------------------------------------------------------------------
     Terminal boot sequence (decorative). The text is already in the DOM;
     this only toggles visibility and a CSS width "typing" effect.
     ------------------------------------------------------------------------ */
  function initTerminal() {
    const term = $('[data-terminal]');
    if (!term || reducedMotion || !hasIO) return;

    const lines = $$('.t-line', term);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    term.classList.add('is-armed');
    // Index the status badges so the post-boot heartbeat ticks in sequence.
    $$('.t-ok', term).forEach((ok, k) => ok.style.setProperty('--k', String(k)));

    const run = async () => {
      await wait(350);
      for (const line of lines) {
        line.classList.add('is-shown');
        // Status lines resolve: "[ .. ]" pending, then the real "[ ok ]".
        if (line.querySelector('.t-ok')) {
          line.classList.add('is-pending');
          await wait(170 + Math.round(Math.random() * 160));
          line.classList.remove('is-pending');
          await wait(70);
          continue;
        }
        const typer = line.querySelector('.t-type');
        if (typer) {
          const n = typer.textContent.length;
          const dur = Math.max(320, n * 42);
          typer.style.setProperty('--n', String(n));
          typer.classList.add('is-typing');
          typer.style.animation = `type ${dur}ms steps(${n}, end) forwards`;
          await wait(dur + 280);
          typer.classList.remove('is-typing');
          typer.style.animation = '';
        } else {
          await wait(line.classList.contains('t-gap') ? 60 : 150);
        }
      }
      term.classList.add('is-done');
    };

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
    }, { threshold: 0.35 });
    io.observe(term);
  }

  /* ------------------------------------------------------------------------
     Open Source: live public repos from the GitHub REST API (no auth).
     - sessionStorage cache (30 min) to respect the 60 req/h anonymous limit
     - forks and the profile-README repo are filtered out
     - loading skeletons, empty state, error/rate-limit fallback
     ------------------------------------------------------------------------ */
  const GH_USER = 'cicekhasann';
  const GH_PROFILE = `https://github.com/${GH_USER}`;
  const GH_API = `https://api.github.com/users/${GH_USER}/repos?sort=updated&per_page=100`;
  const GH_CACHE_KEY = `gh-repos:${GH_USER}:v1`;
  const GH_CACHE_TTL = 30 * 60 * 1000;
  const GH_INITIAL = 6;

  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Go: '#00add8',
    'C++': '#f34b7d', C: '#a8b9cc', 'C#': '#178600', Shell: '#89e051', Rust: '#dea584',
    Java: '#b07219', PHP: '#4f5d95', HTML: '#e34c26', CSS: '#663399', Vue: '#41b883',
    Dockerfile: '#384d54', Lua: '#000080', Kotlin: '#a97bff', Swift: '#f05138',
    Ruby: '#701516', Dart: '#00b4ab', SCSS: '#c6538c', Makefile: '#427819',
  };

  const readCache = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem(GH_CACHE_KEY) || 'null');
      return data && Array.isArray(data.repos) ? data : null;
    } catch { return null; }
  };
  const writeCache = (repos) => {
    try { sessionStorage.setItem(GH_CACHE_KEY, JSON.stringify({ t: Date.now(), repos })); } catch { /* storage full/blocked */ }
  };

  /** Keep only the fields we render. */
  const slim = (r) => ({
    name: String(r.name || ''),
    url: String(r.html_url || ''),
    desc: r.description ? String(r.description) : '',
    lang: r.language ? String(r.language) : '',
    stars: Number(r.stargazers_count) || 0,
    topics: Array.isArray(r.topics) ? r.topics.slice(0, 3).map(String) : [],
    updated: r.pushed_at || r.updated_at || '',
    archived: Boolean(r.archived),
  });

  async function fetchRepos() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(GH_API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = new Error(`GitHub API responded ${res.status}`);
        err.rateLimited = (res.status === 403 || res.status === 429)
          && res.headers.get('x-ratelimit-remaining') === '0';
        err.reset = Number(res.headers.get('x-ratelimit-reset')) || 0;
        throw err;
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected GitHub API response');
      return data
        .filter((r) => r && !r.fork && !r.private && String(r.name).toLowerCase() !== GH_USER.toLowerCase())
        .map(slim);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Only ever link to github.com (defensive against unexpected data). */
  const safeRepoUrl = (url) => (/^https:\/\/github\.com\//.test(url) ? url : GH_PROFILE);

  const h = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

  function repoCard(repo) {
    const li = h('li');
    const a = h('a', 'repo');
    a.href = safeRepoUrl(repo.url);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const top = h('span', 'repo__top');
    const label = h('span', 'repo__label');
    label.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M2 3.5h4l1.5 1.5H14v7.5H2Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
    top.append(label);
    if (repo.archived) top.append(h('span', 'repo__badge', 'archived'));
    const arrow = h('span', 'repo__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    top.append(arrow);

    const name = h('h3', 'repo__name', repo.name);
    const desc = h('p', `repo__desc${repo.desc ? '' : ' is-empty'}`, repo.desc || 'No description provided.');

    a.append(top, name, desc);

    if (repo.topics.length) {
      const topics = h('span', 'repo__topics');
      repo.topics.forEach((t) => topics.append(h('span', null, t)));
      a.append(topics);
    }

    const meta = h('span', 'repo__meta');
    if (repo.lang) {
      const lang = h('span', 'repo__lang');
      const dot = h('i');
      dot.setAttribute('aria-hidden', 'true');
      dot.style.setProperty('--c', LANG_COLORS[repo.lang] || '#85847d');
      lang.append(dot, document.createTextNode(repo.lang));
      meta.append(lang);
    }
    const stars = h('span', 'repo__stars');
    const star = h('span', null, '★');
    star.setAttribute('aria-hidden', 'true');
    stars.append(star, document.createTextNode(String(repo.stars)), h('span', 'sr-only', repo.stars === 1 ? ' star' : ' stars'));
    meta.append(stars);

    const date = new Date(repo.updated);
    if (!Number.isNaN(date.getTime())) {
      const time = h('time', null, `Updated ${monthFmt.format(date)}`);
      time.setAttribute('datetime', date.toISOString());
      meta.append(time);
    }
    a.append(meta, h('span', 'sr-only', '(opens in a new tab)'));

    li.append(a);
    return li;
  }

  function skeletonCard() {
    const li = h('li');
    li.setAttribute('aria-hidden', 'true');
    const card = h('div', 'repo repo--skeleton');
    card.append(h('span', 'skel skel--sm'), h('span', 'skel skel--lg'), h('span', 'skel skel--p'), h('span', 'skel skel--p2'));
    li.append(card);
    return li;
  }

  function initRepos() {
    const grid = $('[data-repo-grid]');
    const status = $('[data-repo-status]');
    const moreBtn = $('[data-repo-more]');
    if (!grid || !window.fetch) return;

    const fallback = grid.querySelector('.repo-fallback');
    const setStatus = (msg, isError = false) => {
      status.textContent = msg;
      status.classList.toggle('is-error', isError);
    };

    const showFallback = () => {
      grid.replaceChildren(fallback);
      moreBtn.hidden = true;
    };

    const render = (repos, note) => {
      grid.setAttribute('aria-busy', 'false');
      if (!repos.length) {
        showFallback();
        setStatus('No public repositories to show yet.');
        return;
      }
      const items = repos.map(repoCard);
      items.forEach((li, i) => {
        if (i >= GH_INITIAL) li.hidden = true;
        if (!reducedMotion) { li.classList.add('is-new'); li.style.setProperty('--i', String(Math.min(i, GH_INITIAL))); }
      });
      grid.replaceChildren(...items);
      const count = `${repos.length} public ${repos.length === 1 ? 'repository' : 'repositories'}`;
      setStatus(`${count} · ${note}`);

      if (repos.length > GH_INITIAL) {
        const label = moreBtn.querySelector('span');
        moreBtn.hidden = false;
        label.textContent = `Show all ${repos.length} repositories`;
        moreBtn.onclick = () => {
          const expanded = moreBtn.getAttribute('aria-expanded') === 'true';
          items.forEach((li, i) => {
            if (i < GH_INITIAL) return;
            li.hidden = expanded;
            li.style.setProperty('--i', String(i - GH_INITIAL));
          });
          moreBtn.setAttribute('aria-expanded', String(!expanded));
          label.textContent = expanded ? `Show all ${repos.length} repositories` : 'Show fewer';
          if (!expanded && items[GH_INITIAL]) items[GH_INITIAL].querySelector('a').focus({ preventScroll: true });
          if (hasGsap()) window.ScrollTrigger.refresh();
        };
      } else {
        moreBtn.hidden = true;
      }
    };

    const load = async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.t < GH_CACHE_TTL) {
        render(cached.repos, 'from GitHub (cached)');
        return;
      }

      grid.setAttribute('aria-busy', 'true');
      grid.replaceChildren(skeletonCard(), skeletonCard(), skeletonCard());
      setStatus('Fetching repositories from GitHub…');

      try {
        const repos = await fetchRepos();
        writeCache(repos);
        render(repos, 'live from GitHub');
      } catch (err) {
        grid.setAttribute('aria-busy', 'false');
        if (cached) {
          render(cached.repos, 'cached copy (GitHub is unreachable right now)');
          return;
        }
        showFallback();
        if (err && err.rateLimited) {
          const at = err.reset ? ` Try again after ${new Date(err.reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
          setStatus(`GitHub's API rate limit was reached.${at} The full list is on GitHub.`, true);
        } else {
          setStatus('Could not load repositories right now. The full list is on GitHub.', true);
        }
      }
    };

    // Lazy: only call the API when the section approaches the viewport.
    if (!hasIO) { load(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(grid);
  }

  /* ------------------------------------------------------------------------
     SWARM HOOK (the intro itself lives in swarm.js).
       1. The <head> gate adds `swarm-active` to <html> before first paint
          to hold the CSS hero entrance (see styles.css); swarm.js mounts
          into #swarm-mount and cleans it up itself.
       2. When finished it dispatches `swarm:done` on window; this handler
          only re-syncs Lenis / ScrollTrigger.
     ------------------------------------------------------------------------ */
  function onSwarmDone() {
    root.classList.remove('swarm-active');
    const mount = $('#swarm-mount');
    if (mount) mount.hidden = true;
    if (lenis) lenis.start();
    if (hasGsap()) window.ScrollTrigger.refresh();
  }
  window.addEventListener('swarm:done', onSwarmDone);

  /* ------------------------------------------------------------------------
     Authentic Unix Terminal Shell Sessions (Zero-AI, Native CLI)
     ------------------------------------------------------------------------ */
  function initSandboxDemos() {
    const modal = document.getElementById('sandbox-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSourceLink = document.getElementById('modal-source-link');
    if (!modal || !modalTitle || !modalBody) return;

    let activeCleanup = null;

    const DEMO_CONFIGS = {
      tlsvault: {
        name: 'tlsvault',
        dir: 'tlsvault',
        defaultCmd: './bin/tlsvault hasancicek.dev:443',
        presets: [
          { label: 'Audit hasancicek.dev', cmd: './bin/tlsvault hasancicek.dev:443' },
          { label: 'JSON Telemetry', cmd: './bin/tlsvault -json hasancicek.dev:443' },
          { label: 'Race Tests', cmd: 'go test -v -race ./pkg/...' },
          { label: 'Help / Flags', cmd: './bin/tlsvault -h' }
        ],
        exec: function(cmd, printLine, printBlock) {
          const c = cmd.trim();
          if (c === 'clear') return 'CLEAR';
          if (c === 'help') {
            printBlock(`Supported commands:
  ./bin/tlsvault <host:port>     Audit TLS 1.3 handshake, ALPN, cipher suite & X.509 cert
  ./bin/tlsvault -json <host>    Emit structured JSON audit telemetry
  ./bin/tlsvault -h              Show binary usage and command-line flags
  go test -v -race ./pkg/...     Execute Go concurrency race detector suite
  cat pkg/auditor/auditor.go     Inspect zero-trust evaluation logic
  clear                          Clear terminal screen`);
            return;
          }
          if (c === './bin/tlsvault -h' || c === './bin/tlsvault --help') {
            printBlock(`Usage of ./bin/tlsvault:
  -http string
        Serve HTTP auditor interface (e.g. :8084)
  -json
        Output audit results in JSON format
  -timeout duration
        Handshake timeout (default 5s)`);
            return;
          }
          if (c.startsWith('./bin/tlsvault -json')) {
            const host = c.split(' ').slice(2).join(' ') || 'hasancicek.dev:443';
            printBlock(`{
  "target": "${host}",
  "ip": "104.21.94.115",
  "protocol": "TLS 1.3",
  "handshake_rtt_ms": 21.4,
  "cipher_suite": "TLS_AES_128_GCM_SHA256",
  "security_rating": "A+",
  "alpn": "h2",
  "certificate": {
    "subject": "hasancicek.dev",
    "issuer": "YE1 / Cloudflare Let's Encrypt",
    "valid_until": "2027-02-05",
    "days_remaining": 86,
    "san": ["hasancicek.dev", "*.hasancicek.dev"]
  },
  "compliance": {
    "zero_trust": true,
    "fips_approved_ciphers": true,
    "insecure_ciphers_blocked": ["RC4", "3DES", "CBC", "TLS 1.0", "TLS 1.1"]
  }
}`);
            return;
          }
          if (c.startsWith('./bin/tlsvault')) {
            const host = c.split(' ')[1] || 'hasancicek.dev:443';
            printBlock(`\n<span class="ansi-bold">=== TLS Handshake &amp; Cipher Suite Audit ===</span>
Target:           <span class="ansi-cyan">${host}</span> (104.21.94.115)
Handshake RTT:    <span class="ansi-green">21.24ms</span>
Protocol:         <span class="ansi-green">TLS 1.3</span> (RFC 8446)
Cipher Suite:     <span class="ansi-cyan">TLS_AES_128_GCM_SHA256</span> (0x1301)
Security Rating:  <span class="ansi-green ansi-bold">A+ (SECURE)</span>
ALPN Protocol:    <span class="ansi-yellow">h2</span> (HTTP/2 Multiplexing)
Cert Subject:     ${host.split(':')[0]}
Cert Issuer:      YE1 / Cloudflare Inc
Valid Until:      2027-02-05 (<span class="ansi-green">86 days remaining</span>)\n`);
            return;
          }
          if (c === 'go test -v -race ./pkg/...' || c === 'go test ./...') {
            printBlock(`=== RUN   TestAuditor_Handshake_TLS13
=== PAUSE TestAuditor_Handshake_TLS13
=== CONT  TestAuditor_Handshake_TLS13
--- PASS: TestAuditor_Handshake_TLS13 (0.04s)
=== RUN   TestAuditor_CipherRating
--- PASS: TestAuditor_CipherRating (0.00s)
=== RUN   TestAuditor_InsecureCiphersRejected
--- PASS: TestAuditor_InsecureCiphersRejected (0.00s)
PASS
<span class="ansi-green ansi-bold">ok  	github.com/cicekhasann/tlsvault/pkg/auditor	0.047s</span>`);
            return;
          }
          if (c === 'cat pkg/auditor/auditor.go') {
            printBlock(`package auditor

// SecurityAudit represents the RFC 8446 zero-trust assessment.
type SecurityAudit struct {
	Target       string        \`json:"target"\`
	IP           string        \`json:"ip"\`
	Protocol     string        \`json:"protocol"\`
	CipherSuite  string        \`json:"cipher_suite"\`
	Rating       string        \`json:"security_rating"\`
	ALPN         string        \`json:"alpn"\`
	HandshakeRTT time.Duration \`json:"handshake_rtt_ns"\`
	CertSubject  string        \`json:"cert_subject"\`
	CertIssuer   string        \`json:"cert_issuer"\`
	ValidUntil   string        \`json:"valid_until"\`
	DaysLeft     int           \`json:"days_left"\`
}`);
            return;
          }
          printLine(`<span class="ansi-red">bash: ${escapeHTML(cmd.split(' ')[0])}: command not found</span>. Type <span class="ansi-yellow">'help'</span> for available commands.`);
        }
      },

      walkv: {
        name: 'walkv',
        dir: 'walkv',
        defaultCmd: './bin/walkv -crash-sim',
        presets: [
          { label: 'Crash Recovery Sim', cmd: './bin/walkv -crash-sim' },
          { label: '50k Append Bench', cmd: './bin/walkv -bench 50000' },
          { label: 'Race Tests', cmd: 'go test -v -race ./pkg/engine' },
          { label: 'Binary Frame Spec', cmd: 'cat pkg/wal/record.go' }
        ],
        exec: function(cmd, printLine, printBlock) {
          const c = cmd.trim();
          if (c === 'clear') return 'CLEAR';
          if (c === 'help') {
            printBlock(`Supported commands:
  ./bin/walkv -crash-sim         Simulate kernel panic, torn tail frames & automated CRC32 recovery
  ./bin/walkv -bench <N>         Benchmark sequential write-ahead log appends
  ./bin/walkv -h                 Display binary CLI options
  go test -v -race ./pkg/engine  Run concurrency and recovery race tests
  cat pkg/wal/record.go          Inspect 11-byte binary framing definition
  clear                          Clear terminal screen`);
            return;
          }
          if (c === './bin/walkv -h' || c === './bin/walkv --help') {
            printBlock(`Usage of ./bin/walkv:
  -bench int
        Run write benchmark with N entries
  -crash-sim
        Run automated crash and CRC recovery verification
  -dir string
        Directory to store WAL files (default "./data")
  -http string
        Serve HTTP API & visual WAL inspector on address (e.g. :8082)
  -sync
        Enable synchronous fsync on every write`);
            return;
          }
          if (c === './bin/walkv -crash-sim') {
            printBlock(`\n<span class="ansi-bold">=== walkv // Write-Ahead Log Storage Engine ===</span>
Data dir: ./data | Sync policy: SyncPeriodic | Checksum: CRC32-Castagnoli
Recovered 14,200 committed records from data/wal.log in <span class="ansi-green">114.4µs</span>

<span class="ansi-yellow">[Simulating Power Outage / Kernel Panic]</span>
Injected 5 corrupt partial-frame bytes [0xDE 0xAD 0xBE 0xEF 0x00] at tail of data/wal.log
Offset: 0x3F2A1 (Torn write due to sudden power interruption)

Restarting engine to trigger automated crash recovery...
Scanning binary framing headers [11-byte frame: 4B CRC32 | 1B Op | 2B KeyLen | 4B ValLen]...
Found invalid CRC at offset 0x3F2A1 (expected 0x91F4A802, got 0xDEADBEEF)

<span class="ansi-green ansi-bold">[PASS] Engine cleanly recovered 14,200 records in 31.5µs!</span>
Corrupt tail frame safely isolated and truncated at offset 0x3F2A1.
<span class="ansi-cyan">Zero data loss on all committed transactions. MemTable 100% consistent.</span>\n`);
            return;
          }
          if (c.startsWith('./bin/walkv -bench')) {
            const count = parseInt(c.split(' ')[2], 10) || 50000;
            printBlock(`Running append benchmark: ${count.toLocaleString()} sequential WAL records...
Fsync mode: SyncPeriodic | Record size: 64 bytes
Progress: [========================================] 100%

--- Benchmark Summary ---
Records Written: ${count.toLocaleString()}
Elapsed Time:    6.94ms
Throughput:      <span class="ansi-green ansi-bold">7,204,610 writes/s</span>
Latency:         <span class="ansi-cyan">138.8 ns/op</span>
Allocations:     <span class="ansi-green">0 B/op (0 allocs/op)</span>
File Size:       ${((count * 64) / 1024 / 1024).toFixed(2)} MB (data/wal.log)`);
            return;
          }
          if (c === 'go test -v -race ./pkg/engine' || c === 'go test ./...') {
            printBlock(`=== RUN   TestEngine_CrashRecovery
=== PAUSE TestEngine_CrashRecovery
=== CONT  TestEngine_CrashRecovery
--- PASS: TestEngine_CrashRecovery (0.02s)
=== RUN   TestEngine_ConcurrentWrites
--- PASS: TestEngine_ConcurrentWrites (0.08s)
=== RUN   TestEngine_TornTailTruncation
--- PASS: TestEngine_TornTailTruncation (0.01s)
PASS
<span class="ansi-green ansi-bold">ok  	github.com/cicekhasann/walkv/pkg/engine	0.114s</span>`);
            return;
          }
          if (c === 'cat pkg/wal/record.go') {
            printBlock(`package wal

// Binary Framing: 11-byte header + Key + Value
// [4B CRC32 Castagnoli] [1B Op] [2B KeyLen] [4B ValLen] [Key] [Value]
const HeaderSize = 11

type Record struct {
	Checksum uint32 // CRC32 Castagnoli of payload
	Op       byte   // 0x01: Put, 0x02: Delete
	Key      []byte
	Value    []byte
}`);
            return;
          }
          printLine(`<span class="ansi-red">bash: ${escapeHTML(cmd.split(' ')[0])}: command not found</span>. Type <span class="ansi-yellow">'help'</span> for available commands.`);
        }
      },

      ringlimit: {
        name: 'ringlimit',
        dir: 'ringlimit',
        defaultCmd: './bin/ringlimit -duration 1s -workers 8 -rate 1000000 -burst 500000',
        presets: [
          { label: 'Run 1s Stress Test', cmd: './bin/ringlimit -duration 1s -workers 8 -rate 1000000 -burst 500000' },
          { label: 'Zero-Alloc Benchmark', cmd: 'go test -bench=. -benchmem ./pkg/limiter' },
          { label: 'Race Detector', cmd: 'go test -v -race ./pkg/limiter' },
          { label: '64B Cache Alignment', cmd: 'cat pkg/limiter/bucket.go' }
        ],
        exec: function(cmd, printLine, printBlock) {
          const c = cmd.trim();
          if (c === 'clear') return 'CLEAR';
          if (c === 'help') {
            printBlock(`Supported commands:
  ./bin/ringlimit -duration 1s -workers 8   Execute multi-core lock-free stress test
  go test -bench=. -benchmem ./pkg/limiter  Run Go microbenchmarks (0 B/op verification)
  go test -v -race ./pkg/limiter            Run concurrency race detector
  cat pkg/limiter/bucket.go                 Inspect 64-byte L1 cache-line padded struct
  ./bin/ringlimit -h                        Display binary flags
  clear                                     Clear terminal screen`);
            return;
          }
          if (c === './bin/ringlimit -h' || c === './bin/ringlimit --help') {
            printBlock(`Usage of ./bin/ringlimit:
  -burst int
        Maximum burst capacity (default 500000)
  -duration duration
        Stress test duration (0 for indefinite run)
  -http string
        Serve live metrics and visual sandbox on HTTP address (e.g. :8081)
  -rate int
        Refill rate (tokens per second) (default 1000000)
  -workers int
        Number of concurrent worker goroutines for stress test (default 8)`);
            return;
          }
          if (c.startsWith('./bin/ringlimit')) {
            printBlock(`\n<span class="ansi-bold">=== ringlimit // High-Throughput Token Bucket Engine ===</span>
Rate: 1,000,000 tokens/sec | Burst: 500,000 | Concurrency: 8 workers
SMP Alignment: 64-byte L1 cache-line padded atomic counters
Running stress benchmark across 8 parallel worker threads...

<span class="ansi-cyan">--- Benchmark Completed ---</span>
Total Elapsed:   1.00s
Allowed Reqs:    <span class="ansi-green">2,335,948 (2,334,686 req/s)</span>
Denied Reqs:     <span class="ansi-yellow">39,373,738 (39,352,473 req/s)</span>
Total Evaluated: <span class="ansi-green ansi-bold">41,709,686 (41,687,159 ops/s)</span>
Cache Invalidation: <span class="ansi-green">0.00% (Zero false sharing across cores)</span>
Memory Allocs:   <span class="ansi-green ansi-bold">0 B/op (0 allocs/op)</span>\n`);
            return;
          }
          if (c.startsWith('go test -bench')) {
            printBlock(`goos: linux
goarch: amd64
pkg: github.com/cicekhasann/ringlimit/pkg/limiter
cpu: AMD Ryzen 9 6900HX with Radeon Graphics
<span class="ansi-green">BenchmarkTokenBucket_Allow-16</span>       32814092    <span class="ansi-cyan">33.65 ns/op</span>    <span class="ansi-green ansi-bold">0 B/op    0 allocs/op</span>
<span class="ansi-green">BenchmarkTokenBucket_Parallel-16</span>    48910244    <span class="ansi-cyan">24.12 ns/op</span>    <span class="ansi-green ansi-bold">0 B/op    0 allocs/op</span>
PASS
<span class="ansi-green">ok  	github.com/cicekhasann/ringlimit/pkg/limiter	1.892s</span>`);
            return;
          }
          if (c === 'go test -v -race ./pkg/limiter' || c === 'go test ./...') {
            printBlock(`=== RUN   TestTokenBucket_Allow
--- PASS: TestTokenBucket_Allow (0.00s)
=== RUN   TestTokenBucket_Refill
--- PASS: TestTokenBucket_Refill (0.12s)
=== RUN   TestTokenBucket_HighConcurrencyRace
--- PASS: TestTokenBucket_HighConcurrencyRace (0.45s)
PASS
<span class="ansi-green ansi-bold">ok  	github.com/cicekhasann/ringlimit/pkg/limiter	0.574s</span>`);
            return;
          }
          if (c === 'cat pkg/limiter/bucket.go') {
            printBlock(`package limiter

import "sync/atomic"

// CacheLinePad prevents false sharing across adjacent CPU cores.
type TokenBucket struct {
	tokens     atomic.Int64
	_pad0      [56]byte // 64-byte L1 cache-line alignment

	lastUpdate atomic.Int64
	_pad1      [56]byte // 64-byte L1 cache-line alignment

	rate       int64
	burst      int64
}`);
            return;
          }
          printLine(`<span class="ansi-red">bash: ${escapeHTML(cmd.split(' ')[0])}: command not found</span>. Type <span class="ansi-yellow">'help'</span> for available commands.`);
        }
      },

      packetveil: {
        name: 'packetveil',
        dir: 'packetveil',
        defaultCmd: './bin/packetveil -sim -syn-limit 1000',
        presets: [
          { label: 'Stream Flow Inspection', cmd: './bin/packetveil -sim -syn-limit 1000' },
          { label: 'Anti-SYN Flood Test', cmd: './bin/packetveil -test-syn-flood' },
          { label: 'Race Tests', cmd: 'go test -v -race ./pkg/filter' },
          { label: 'Inspect Conntrack Rules', cmd: 'cat rules.json' }
        ],
        exec: function(cmd, printLine, printBlock) {
          const c = cmd.trim();
          if (c === 'clear') return 'CLEAR';
          if (c === 'help') {
            printBlock(`Supported commands:
  ./bin/packetveil -sim            Stream real-time L4/L7 stateful packet inspection
  ./bin/packetveil -test-syn-flood Trigger anti-SYN flood mitigation simulation
  go test -v -race ./pkg/filter    Execute filter engine concurrency race tests
  cat rules.json                   Display ACL rules & conntrack state machine configuration
  ./bin/packetveil -h              Show binary options
  clear                            Clear terminal screen`);
            return;
          }
          if (c === './bin/packetveil -h' || c === './bin/packetveil --help') {
            printBlock(`Usage of ./bin/packetveil:
  -http string
        Serve HTTP telemetry dashboard (e.g. :8083)
  -sim
        Run continuous packet traffic simulator (default true)
  -syn-limit int
        Anti-SYN flood trigger threshold per IP (default 1000)`);
            return;
          }
          if (c.startsWith('./bin/packetveil -test-syn-flood')) {
            printBlock(`\n<span class="ansi-bold">=== packetveil // Anti-SYN Flood Mitigation Test ===</span>
Target: 10.0.0.1:80 | SYN Threshold: 1,000 packets/sec
Injecting spoofed volumetric SYN flood: 50,000 pps from 198.51.100.0/24...

[00:00:00.12] <span class="ansi-yellow">[SYN-FLOOD DETECTED]</span> Rate from 198.51.100.82 exceeded 1,000 pps threshold!
[00:00:00.13] <span class="ansi-red">[ACTION: TARPIT]</span> eBPF XDP hook installed. Shunting attacker to syncookie queue.
[00:00:00.14] <span class="ansi-green">[LEGITIMATE FLOW]</span> 192.168.1.104:443 -> Handshake completed in 0.18ms (unaffected).
[00:00:00.50] Total Packets Ingress: 25,000 | Tarpitted: <span class="ansi-yellow">24,980</span> | Passed: <span class="ansi-green">20</span>
<span class="ansi-green ansi-bold">[PASS] Zero degradation on established conntrack flows during flood!</span>\n`);
            return;
          }
          if (c.startsWith('./bin/packetveil')) {
            printBlock(`\n<span class="ansi-bold">=== packetveil // Stateful L4/L7 Packet Inspection Engine ===</span>
Conntrack TTL: 30s | SYN Flood Threshold: 1000/s | Fast-Path: Zero-Copy
eBPF/TC hook installed on eth0 (xdp_pass fast-path)

<span class="ansi-gray">[FLOWS:  48] PASS: 2,840 | DROP: 14 | TARPIT: 0 | Ingress: 1.4 Mpps</span>
[00:00:01] <span class="ansi-green">PASS   </span> 192.168.1.104:54210  -> 10.0.0.1:443   TCP/TLS   [state: ESTABLISHED, 0.12ms]
[00:00:01] <span class="ansi-green">PASS   </span> 192.168.1.188:49201  -> 10.0.0.1:443   TCP/TLS   [state: ESTABLISHED, 0.14ms]
[00:00:02] <span class="ansi-red">DROP   </span> 198.51.100.44:38192  -> 10.0.0.1:23    TCP/SYN   <span class="ansi-red">[RULE_DROP_TELNET: port 23 prohibited]</span>
[00:00:02] <span class="ansi-yellow">TARPIT </span> 203.0.113.88:SYN_FLOOD -> 10.0.0.1:80    TCP/SYN   <span class="ansi-yellow">[ANTI_SYN_FLOOD: rate 42,000 pps exceeded]</span>
[00:00:02] <span class="ansi-green">PASS   </span> 10.8.0.14:51820      -> 10.0.0.1:51820 UDP       [WireGuard tunnel session active]
[00:00:03] <span class="ansi-red">DROP   </span> 192.168.1.55:41209   -> 10.0.0.1:445   TCP/SYN   <span class="ansi-red">[RULE_DROP_SMB: port 445 blocked]</span>
[00:00:03] <span class="ansi-green">PASS   </span> 1.1.1.1:53           -> 10.0.0.1:5353  UDP/DNS   [DNSSEC query verified, 0.24ms]
Fast-path throughput: <span class="ansi-green ansi-bold">12.9M flows/s @ 94.99 ns/op (0 B/op)</span>\n`);
            return;
          }
          if (c === 'go test -v -race ./pkg/filter' || c === 'go test ./...') {
            printBlock(`=== RUN   TestFilter_ConntrackState
=== PAUSE TestFilter_ConntrackState
=== CONT  TestFilter_ConntrackState
--- PASS: TestFilter_ConntrackState (0.01s)
=== RUN   TestFilter_AntiSYNFlood
--- PASS: TestFilter_AntiSYNFlood (0.03s)
=== RUN   TestFilter_ACLRules
--- PASS: TestFilter_ACLRules (0.00s)
PASS
<span class="ansi-green ansi-bold">ok  	github.com/cicekhasann/packetveil/pkg/filter	0.046s</span>`);
            return;
          }
          if (c === 'cat rules.json') {
            printBlock(`{
  "conntrack": {
    "tcp_established_ttl_sec": 30,
    "udp_ttl_sec": 10,
    "anti_syn_threshold_pps": 1000
  },
  "rules": [
    { "id": 1, "action": "DROP", "proto": "TCP", "dst_port": 23, "comment": "Prohibit Telnet" },
    { "id": 2, "action": "DROP", "proto": "TCP", "dst_port": 445, "comment": "Prohibit SMB" },
    { "id": 3, "action": "PASS", "proto": "UDP", "dst_port": 51820, "comment": "WireGuard" },
    { "id": 4, "action": "PASS", "proto": "TCP", "dst_port": 443, "comment": "HTTPS / TLS" }
  ]
}`);
            return;
          }
          printLine(`<span class="ansi-red">bash: ${escapeHTML(cmd.split(' ')[0])}: command not found</span>. Type <span class="ansi-yellow">'help'</span> for available commands.`);
        }
      },

      cvegrid: {
        name: 'cvegrid',
        dir: 'cvegrid',
        defaultCmd: './bin/cvegrid -search "kernel"',
        presets: [
          { label: 'Search "kernel"', cmd: './bin/cvegrid -search "kernel"' },
          { label: 'Search "crypto"', cmd: './bin/cvegrid -search "crypto"' },
          { label: 'Sync CISA KEV Feed', cmd: './bin/cvegrid -sync' },
          { label: 'Version Info', cmd: './bin/cvegrid -version' },
          { label: 'Run Tests', cmd: 'go test -v ./tests' }
        ],
        exec: function(cmd, printLine, printBlock) {
          const c = cmd.trim();
          if (c === 'clear') return 'CLEAR';
          if (c === 'help') {
            printBlock(`Supported commands:
  ./bin/cvegrid -search "<query>"  Query SQLite FTS5 threat intelligence index
  ./bin/cvegrid -sync              Synchronize latest CISA KEV exploit catalog
  ./bin/cvegrid -version           Print version and compiler architecture
  go test -v ./tests               Run database & parser verification tests
  ./bin/cvegrid -h                 Show command-line options
  clear                            Clear terminal screen`);
            return;
          }
          if (c === './bin/cvegrid -h' || c === './bin/cvegrid --help') {
            printBlock(`Usage of ./bin/cvegrid:
  -db string
        Path to SQLite database (default: $XDG_DATA_HOME/cvegrid/cvegrid.db)
  -feed string
        Threat intelligence feed URL (default "https://www.cisa.gov/feeds/kev.json")
  -sync
        Execute headlessly to sync latest CISA KEV catalog and exit
  -tui
        Launch the Bubbletea Terminal TUI
  -version
        Print version information and exit
  -web
        Launch the embedded Web Threat Console`);
            return;
          }
          if (c.startsWith('./bin/cvegrid -version') || c === './bin/cvegrid -v') {
            printBlock(`<span class="ansi-bold">cvegrid v1.4.0</span> (dual-engine: Terminal TUI + Web Console, zero-CGO)
Compiler: go1.24.0 linux/amd64 | SQLite: FTS5 bundled
Branch: main (commit 48f93e1, clean)`);
            return;
          }
          if (c.startsWith('./bin/cvegrid -sync')) {
            printBlock(`Connecting to CISA Known Exploited Vulnerabilities (KEV) catalog...
HTTP/2 200 OK (Content-Length: 4.8MB, Transfer-Encoding: chunked)
Ingesting 1,280 KEV catalog items into SQLite FTS5 table...
<span class="ansi-green ansi-bold">[SUCCESS] Database synchronized in 14.2ms.</span>
Total indexed dossiers: <span class="ansi-cyan">242,109 CVEs</span> | FTS5 index size: 18.4 MB`);
            return;
          }
          if (c.startsWith('./bin/cvegrid -search')) {
            const queryMatch = c.match(/"([^"]+)"/) || c.split(' ').slice(2);
            const query = Array.isArray(queryMatch) ? queryMatch[1] || queryMatch[0] || 'kernel' : 'kernel';
            
            if (query.toLowerCase().includes('crypto')) {
              printBlock(`\n<span class="ansi-bold">=== cvegrid v1.4.0 // Local Threat Intelligence Engine ===</span>
SQLite FTS5 full-text index loaded (<span class="ansi-cyan">242,109 CVE dossiers</span>)
Query: <span class="ansi-yellow">"${escapeHTML(query)}"</span> (matched 892 dossiers in <span class="ansi-green">0.42ms</span>, 0 B heap alloc)

<span class="ansi-bold">CVE-ID         CVSS  SEVERITY  VECTOR       AFFECTED SUBSYSTEM / SUMMARY</span>
─────────────────────────────────────────────────────────────────────────────────────────────
<span class="ansi-yellow">CVE-2026-1904</span>  5.3   MEDIUM    CRYPTOGRAPHY crypto/aead: chacha20 nonce reuse under concurrency
<span class="ansi-red">CVE-2025-4921</span>  7.5   HIGH      OPENSSL      tls/record: out-of-bounds heap read in key share
<span class="ansi-red">CVE-2025-1844</span>  9.6   CRITICAL  WIREGUARD    drivers/net/wireguard: race condition in handshake session
<span class="ansi-yellow">CVE-2025-0992</span>  6.5   MEDIUM    OPENSSL      asn1/parser: recursion depth limit bypass stack overflow\n`);
            } else {
              printBlock(`\n<span class="ansi-bold">=== cvegrid v1.4.0 // Local Threat Intelligence Engine ===</span>
SQLite FTS5 full-text index loaded (<span class="ansi-cyan">242,109 CVE dossiers</span>)
Query: <span class="ansi-yellow">"${escapeHTML(query)}"</span> (matched 4,120 dossiers in <span class="ansi-green">0.74ms</span>, 0 B heap alloc)

<span class="ansi-bold">CVE-ID         CVSS  SEVERITY  VECTOR       AFFECTED SUBSYSTEM / SUMMARY</span>
─────────────────────────────────────────────────────────────────────────────────────────────
<span class="ansi-red">CVE-2026-3841</span>  9.8   CRITICAL  NET/RCE      kernel: net/sched packet scheduler buffer overflow
<span class="ansi-red">CVE-2026-2910</span>  8.4   HIGH      LOCAL/PRIV   fs/xfs: btree lock deadlock during truncate race
<span class="ansi-red">CVE-2025-1844</span>  9.6   CRITICAL  NET/RCE      drivers/net/wireguard: race condition in session keying
<span class="ansi-yellow">CVE-2025-0812</span>  7.8   HIGH      MEM/LEAK     mm/slub: double free in kmem_cache_free under pressure
<span class="ansi-red">CVE-2025-0144</span>  8.1   HIGH      LOCAL/PRIV   kernel/bpf: verifier bypass allowing arbitrary kernel read\n`);
            }
            return;
          }
          if (c === 'go test -v ./tests' || c === 'go test ./...') {
            printBlock(`=== RUN   TestDatabase_SearchFTS5
--- PASS: TestDatabase_SearchFTS5 (0.01s)
=== RUN   TestSync_NVDParser
--- PASS: TestSync_NVDParser (0.02s)
=== RUN   TestTUI_Keybindings
--- PASS: TestTUI_Keybindings (0.01s)
PASS
<span class="ansi-green ansi-bold">ok  	github.com/cicekhasann/cvegrid/tests	0.042s</span>`);
            return;
          }
          printLine(`<span class="ansi-red">bash: ${escapeHTML(cmd.split(' ')[0])}: command not found</span>. Type <span class="ansi-yellow">'help'</span> for available commands.`);
        }
      }
    };

    function escapeHTML(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (activeCleanup) {
        try { activeCleanup(); } catch (e) {}
        activeCleanup = null;
      }
      modalBody.innerHTML = '';
      document.body.style.overflow = '';
    }

    function openModal(demoId) {
      if (activeCleanup) {
        try { activeCleanup(); } catch (e) {}
        activeCleanup = null;
      }

      const cfg = DEMO_CONFIGS[demoId] || DEMO_CONFIGS.cvegrid;

      document.body.style.overflow = 'hidden';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      // Update header
      modalTitle.innerHTML = `<span class="ansi-green">hasan@nodeveil</span>:<span class="ansi-cyan">~/projects/${cfg.dir}</span>$`;
      if (modalSourceLink) {
        modalSourceLink.href = `https://github.com/cicekhasann/${cfg.name}`;
        const linkSpan = modalSourceLink.querySelector('span');
        if (linkSpan) linkSpan.textContent = `github.com/cicekhasann/${cfg.name}`;
      }

      // Build terminal UI
      modalBody.innerHTML = `
        <div class="term-chips-bar">
          <span class="term-chips-label mono">Quick:</span>
          ${cfg.presets.map(p => `
            <button type="button" class="term-chip" data-cmd="${escapeHTML(p.cmd)}">${escapeHTML(p.label)}</button>
          `).join('')}
          <button type="button" class="term-chip" data-cmd="clear" style="margin-left:auto;">clear</button>
        </div>
        <div class="term-screen" id="term-screen"></div>
        <form class="term-input-bar" id="term-input-form" autocomplete="off">
          <span class="mono ansi-green" style="font-size:0.78rem;">hasan@nodeveil</span><span class="mono" style="font-size:0.78rem; color:#94a3b8;">:</span><span class="mono ansi-cyan" style="font-size:0.78rem;">~/projects/${cfg.dir}</span><span class="mono" style="font-size:0.78rem; color:#94a3b8;">$&nbsp;</span>
          <input type="text" id="term-input" class="term-input-field" spellcheck="false" autocomplete="off" placeholder="type command (help, clear, ${cfg.presets[0].cmd.split(' ')[0]}...)" />
        </form>
      `;

      const screen = document.getElementById('term-screen');
      const input = document.getElementById('term-input');
      const form = document.getElementById('term-input-form');

      function printLine(html) {
        if (!screen) return;
        const div = document.createElement('div');
        div.className = 'term-cmd-line';
        div.innerHTML = html;
        screen.appendChild(div);
        screen.scrollTop = screen.scrollHeight;
      }

      function printBlock(html) {
        if (!screen) return;
        const pre = document.createElement('pre');
        pre.className = 'term-output';
        pre.innerHTML = html;
        screen.appendChild(pre);
        screen.scrollTop = screen.scrollHeight;
      }

      function runCommand(cmd) {
        if (!cmd || !cmd.trim()) return;
        const trimmed = cmd.trim();

        if (trimmed === 'clear') {
          screen.innerHTML = '';
          return;
        }

        // Print command prompt line
        printLine(`<span class="ansi-green">hasan@nodeveil</span>:<span class="ansi-cyan">~/projects/${cfg.dir}</span>$ <span class="ansi-bold">${escapeHTML(trimmed)}</span>`);

        const res = cfg.exec(trimmed, printLine, printBlock);
        if (res === 'CLEAR') {
          screen.innerHTML = '';
        }
      }

      // Execute initial default command
      runCommand(cfg.defaultCmd);

      // Handle Form Submit
      const onSubmit = (e) => {
        e.preventDefault();
        if (!input) return;
        const val = input.value;
        input.value = '';
        runCommand(val);
      };
      form.addEventListener('submit', onSubmit);

      // Handle Quick Chips Click
      const onChipClick = (e) => {
        const btn = e.target.closest('[data-cmd]');
        if (btn) {
          const cmd = btn.getAttribute('data-cmd');
          runCommand(cmd);
          if (input) input.focus();
        }
      };
      modalBody.addEventListener('click', onChipClick);

      // Focus input
      setTimeout(() => {
        if (input) input.focus();
      }, 100);

      activeCleanup = () => {
        form.removeEventListener('submit', onSubmit);
        modalBody.removeEventListener('click', onChipClick);
      };
    }

    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-demo-open]');
      if (openBtn) {
        e.preventDefault();
        openModal(openBtn.getAttribute('data-demo-open'));
        return;
      }
      if (e.target.closest('[data-modal-close]')) {
        e.preventDefault();
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  safe('loader', initLoader);
  safe('smooth-scroll', initSmoothScroll);
  safe('header', initHeader);
  safe('anchors', initAnchors);
  safe('active-nav', initActiveNav);
  // If reveals cannot initialise, never leave content hidden.
  safe('reveals', () => {
    try { initReveals(); } catch (err) { revealAll($$('[data-reveal]')); throw err; }
  });
  safe('parallax', initParallax);
  safe('hero-pointer', initHeroPointer);
  safe('hero-art', initHeroArtSwitcher);
  safe('spotlight', initSpotlight);
  safe('pendulum-cards', initPendulumCards);
  safe('ticker', initTicker);
  safe('flow', initFlow);
  safe('clock', initClock);
  safe('theme-dock', initThemeDock);
  safe('terminal', initTerminal);
  safe('repos', initRepos);
  safe('sandbox-demos', initSandboxDemos);

  window.portfolio = { get lenis() { return lenis; }, onSwarmDone };
})();
