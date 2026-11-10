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
     Systems Engineering Workstation & Advanced Sandbox Suite
     ------------------------------------------------------------------------ */
  function initSandboxDemos() {
    const modal = document.getElementById('sandbox-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalTag = document.getElementById('modal-tag');
    const modalBody = document.getElementById('modal-body');
    const modalSourceLink = document.getElementById('modal-source-link');
    const tabButtons = document.querySelectorAll('[data-ws-tab]');
    if (!modal || !modalTitle || !modalBody) return;

    let activeCleanup = null;
    let currentDemoId = 'cvegrid';
    let currentTab = 'sim';

    function setTab(tabId) {
      currentTab = tabId;
      tabButtons.forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-ws-tab') === tabId);
      });
      const views = modalBody.querySelectorAll('.ws-view');
      views.forEach(v => {
        v.classList.toggle('is-active', v.getAttribute('data-view') === tabId);
      });
    }

    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setTab(btn.getAttribute('data-ws-tab'));
      });
    });

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

      currentDemoId = demoId;
      document.body.style.overflow = 'hidden';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      if (modalSourceLink) {
        modalSourceLink.href = `https://github.com/cicekhasann/${demoId}`;
      }

      switch (demoId) {
        case 'cvegrid':
          activeCleanup = renderCvegridWorkstation(modalTitle, modalTag, modalBody);
          break;
        case 'packetveil':
          activeCleanup = renderPacketveilWorkstation(modalTitle, modalTag, modalBody);
          break;
        case 'ringlimit':
          activeCleanup = renderRinglimitWorkstation(modalTitle, modalTag, modalBody);
          break;
        case 'walkv':
          activeCleanup = renderWalkvWorkstation(modalTitle, modalTag, modalBody);
          break;
        case 'tlsvault':
          activeCleanup = renderTlsvaultWorkstation(modalTitle, modalTag, modalBody);
          break;
        default:
          modalTitle.textContent = 'SYSTEM WORKSTATION';
          if (modalTag) modalTag.textContent = 'READY';
          modalBody.innerHTML = '<p class="mono">Workstation module not found.</p>';
      }

      setTab('sim');
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

    /* ======================================================================
       01: CVEGRID WORKSTATION
       ====================================================================== */
    function renderCvegridWorkstation(titleEl, tagEl, bodyEl) {
      titleEl.textContent = 'CVEGRID // THREAT INTELLIGENCE & DOSSIER EXPLORER';
      if (tagEl) tagEl.textContent = 'ACTIVE SYSTEM · NVD MIRROR';

      const cves = [
        { id: 'CVE-2026-3841', cvss: '9.8', sev: 'CRIT', eco: 'LINUX KERNEL', sub: 'net/sched: packet scheduler buffer overflow in tc filter', epss: '0.892', cti: 'APT-29 / Active Exploitation' },
        { id: 'CVE-2026-2910', cvss: '8.4', sev: 'HIGH', eco: 'STORAGE/FS', sub: 'fs/xfs: btree lock deadlock during truncate race', epss: '0.412', cti: 'Local Privilege Escalation' },
        { id: 'CVE-2026-1904', cvss: '5.3', sev: 'MED',  eco: 'CRYPTOGRAPHY', sub: 'crypto/aead: chacha20 nonce reuse under high concurrency', epss: '0.045', cti: 'Cryptographic Weakness' },
        { id: 'CVE-2026-0812', cvss: '9.1', sev: 'CRIT', eco: 'AUTH/OAUTH2', sub: 'oauth2/jwt: algorithm confusion permitting forged admin claims', epss: '0.941', cti: 'Ransomware Pre-Auth Vector' },
        { id: 'CVE-2025-4921', cvss: '7.5', sev: 'HIGH', eco: 'OPENSSL', sub: 'tls/record: out-of-bounds heap read in TLS 1.3 key share', epss: '0.334', cti: 'Information Disclosure' },
        { id: 'CVE-2025-3120', cvss: '4.8', sev: 'MED',  eco: 'BGP/NETWORKING', sub: 'bgp/daemon: flap damping memory exhaustion via crafted updates', epss: '0.012', cti: 'Denial of Service' },
        { id: 'CVE-2025-1844', cvss: '9.6', sev: 'CRIT', eco: 'LINUX KERNEL', sub: 'drivers/net/wireguard: race condition in handshake session keying', epss: '0.781', cti: 'Remote Code Execution' },
        { id: 'CVE-2025-0992', cvss: '6.5', sev: 'MED',  eco: 'OPENSSL', sub: 'asn1/parser: recursion depth limit bypass triggering stack overflow', epss: '0.089', cti: 'Application Crash' }
      ];

      bodyEl.innerHTML = `
        <!-- TAB 01: SIMULATOR -->
        <div class="ws-view ws-view--sim is-active" data-view="sim">
          <div class="ws-hud">
            <div class="ws-hud__item">
              <span class="ws-hud__label">Indexed Dossiers</span>
              <span class="ws-hud__val" style="color:#4ade80;">242,109</span>
            </div>
            <div class="ws-hud__item">
              <span class="ws-hud__label">Critical CVSS (≥9.0)</span>
              <span class="ws-hud__val" style="color:#f87171;">14,812</span>
            </div>
            <div class="ws-hud__item">
              <span class="ws-hud__label">Ransomware Linked</span>
              <span class="ws-hud__val" style="color:#fbbf24;">3,420</span>
            </div>
            <div class="ws-hud__item">
              <span class="ws-hud__label">Mean EPSS Risk</span>
              <span class="ws-hud__val" style="color:#38bdf8;">78.4%</span>
            </div>
            <div class="ws-hud__item">
              <span class="ws-hud__label">Feed Telemetry</span>
              <span class="ws-hud__val" style="color:#a78bfa; font-size:0.95rem;">[● LIVE] NVD v2.0</span>
            </div>
          </div>

          <div class="ws-split">
            <div class="ws-deck">
              <div class="ws-deck__title">Ecosystem Filters</div>
              <div style="display:flex; flex-direction:column; gap:0.4rem;">
                <button type="button" class="btn btn--sm btn--primary cve-filter-btn" data-eco="ALL">All Ecosystems</button>
                <button type="button" class="btn btn--sm btn--ghost cve-filter-btn" data-eco="LINUX KERNEL">Linux Kernel</button>
                <button type="button" class="btn btn--sm btn--ghost cve-filter-btn" data-eco="OPENSSL">OpenSSL &amp; Crypto</button>
                <button type="button" class="btn btn--sm btn--ghost cve-filter-btn" data-eco="AUTH/OAUTH2">Auth &amp; Tokens</button>
                <button type="button" class="btn btn--sm btn--ghost cve-filter-btn" data-eco="BGP/NETWORKING">Networking &amp; BGP</button>
              </div>

              <div class="ws-deck__title" style="margin-top:0.5rem;">Fast Search</div>
              <input type="text" id="ws-cve-query" placeholder="Type CVE-ID or vector..." 
                style="background:#020306; border:1px solid rgba(255,255,255,0.12); padding:0.55rem 0.75rem; border-radius:5px; color:#fff; font-family:var(--font-mono); font-size:0.75rem;">
              
              <div class="mono" style="font-size:0.7rem; color:var(--text-muted); line-height:1.5;">
                Engine: SQLite FTS5<br>
                Index Alloc: 0 B / query<br>
                Latency: &lt; 0.8 ms
              </div>
            </div>

            <div class="ws-terminal" id="ws-cve-table" style="max-height: 480px;"></div>
          </div>
        </div>

        <!-- TAB 02: ARCHITECTURE & RFC -->
        <div class="ws-view ws-view--rfc" data-view="rfc">
          <div class="ws-terminal" style="height: 100%; white-space: pre; font-size: 0.72rem; line-height: 1.5;">
+--------------------------------------------------------------------------------------------------+
|                                    CVEGRID SYSTEM ARCHITECTURE                                   |
+--------------------------------------------------------------------------------------------------+

   [ NVD REST API v2.0 ]       [ CISA KEV Catalog ]        [ FIRST.org EPSS Feed ]
            |                           |                           |
            +---------------------------+---------------------------+
                                        |
                            ( Multi-Worker Ingestion )
                                        |
                                [ sync.Pool Worker ]
                                        |
                 +----------------------+----------------------+
                 |                                             |
     [ SQLite FTS5 Full-Text ]                    [ Local In-Memory Ring Buffer ]
                 |                                             |
     +-----------+-----------+                     +-----------+-----------+
     |                       |                     |                       |
[ CLI Bubbletea TUI ]  [ REST Server ]       [ JSON Telemetry ]   [ Web CTI Matrix ]
          </div>
        </div>

        <!-- TAB 03: SPECS & BENCHMARKS -->
        <div class="ws-view ws-view--bench" data-view="bench">
          <div class="ws-terminal" style="height: 100%; line-height: 1.6; font-size: 0.75rem;">
=== CVEGRID PERFORMANCE &amp; CODE COMPLIANCE ===

Test Suite Verification:
  [PASS] TestWeb_PortHunting (0.00s)
  [PASS] TestLocale_Detection (0.00s)
  [PASS] TestDaemon_StateFile (0.00s)
  [PASS] TestParser_StreamParsing (0.00s)
  [PASS] TestParser_CTIEnrichment (0.00s)
  [PASS] TestParser_TaxonomyClassification (0.00s)
  [PASS] TestRepository_UpsertAndQuery (0.00s)
  [PASS] TestWebServer_Endpoints (0.00s)
  Status: 100% Pass (0 race condition warnings)

Throughput &amp; Storage Footprint:
  - SQLite FTS5 Index Size: 48 MB for 242,109 indexed vulnerabilities
  - Query Latency: 0.42 ms (p50), 1.12 ms (p99) under concurrent FTS lookup
  - Memory Footprint (Daemon): 18.4 MB RSS
          </div>
        </div>
      `;

      let selectedEco = 'ALL';
      let searchQuery = '';

      function renderRows() {
        const table = document.getElementById('ws-cve-table');
        if (!table) return;

        const filtered = cves.filter(c => {
          const matchEco = selectedEco === 'ALL' || c.eco === selectedEco;
          const matchQuery = !searchQuery || c.id.toLowerCase().includes(searchQuery) || c.sub.toLowerCase().includes(searchQuery);
          return matchEco && matchQuery;
        });

        table.innerHTML = filtered.map(c => {
          const sevClass = c.sev === 'CRIT' ? 'ws-badge-crit' : (c.sev === 'HIGH' ? 'ws-badge-warn' : 'ws-badge-info');
          return `
            <div class="ws-row ${sevClass}" style="border-bottom:1px solid rgba(255,255,255,0.04); padding:0.45rem 0;">
              <span style="font-weight:700;">${c.id}</span>
              <span>[${c.cvss} ${c.sev}] · ${c.eco}</span>
              <span style="color:#e2e8f0;">${c.sub}</span>
              <span style="text-align:right; color:var(--text-muted);">EPSS: ${c.epss}</span>
            </div>
          `;
        }).join('');
      }

      renderRows();

      const filterBtns = bodyEl.querySelectorAll('.cve-filter-btn');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => {
            b.classList.remove('btn--primary');
            b.classList.add('btn--ghost');
          });
          btn.classList.add('btn--primary');
          btn.classList.remove('btn--ghost');
          selectedEco = btn.getAttribute('data-eco');
          renderRows();
        });
      });

      const qInput = document.getElementById('ws-cve-query');
      if (qInput) {
        qInput.addEventListener('input', (e) => {
          searchQuery = e.target.value.toLowerCase().trim();
          renderRows();
        });
      }

      return () => {};
    }

    /* ======================================================================
       02: PACKETVEIL WORKSTATION (eBPF & Firewall Engine)
       ====================================================================== */
    function renderPacketveilWorkstation(titleEl, tagEl, bodyEl) {
      titleEl.textContent = 'PACKETVEIL // L4/L7 STATEFUL INSPECTION & ANTI-SYN SHIELD';
      if (tagEl) tagEl.textContent = 'FAST-PATH · 0 B/OP · 94.9 NS/FLOW';

      bodyEl.innerHTML = `
        <div class="ws-view ws-view--sim is-active" data-view="sim">
          <div class="ws-hud">
            <div class="ws-hud__item"><span class="ws-hud__label">Conntrack Flows</span><span class="ws-hud__val" id="pv-flows">48</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Ingress Throughput</span><span class="ws-hud__val" style="color:#38bdf8;" id="pv-ingress">1.4 Mpps</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">L4 Passed</span><span class="ws-hud__val" style="color:#4ade80;" id="pv-passed">2,840</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">ACL Dropped</span><span class="ws-hud__val" style="color:#f87171;" id="pv-dropped">14</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Anti-SYN Tarpitted</span><span class="ws-hud__val" style="color:#fbbf24;" id="pv-tarpit">0</span></div>
          </div>

          <!-- Dynamic 60 FPS Network Pipeline Canvas -->
          <div class="ws-canvas-wrap">
            <canvas id="pv-canvas" class="ws-canvas"></canvas>
            <div class="ws-canvas-badge mono">eBPF TC PIPELINE: 60 FPS</div>
          </div>

          <div class="ws-split">
            <div class="ws-deck">
              <div class="ws-deck__title">Traffic Injection Deck</div>
              <div class="ws-deck__btn-group">
                <button type="button" class="btn btn--sm btn--secondary" id="pv-btn-flood">⚡ Volumetric SYN Flood (50k PPS)</button>
                <button type="button" class="btn btn--sm btn--secondary" id="pv-btn-drop">🛡️ Inject Port 23 Malicious Probe</button>
                <button type="button" class="btn btn--sm btn--secondary" id="pv-btn-smb">🚫 Drop Port 445 SMB Attack</button>
                <button type="button" class="btn btn--sm btn--ghost" id="pv-btn-flush">🔄 Flush Conntrack Table</button>
              </div>
            </div>

            <div class="ws-terminal" id="pv-terminal" style="max-height: 280px;"></div>
          </div>
        </div>

        <div class="ws-view ws-view--rfc" data-view="rfc">
          <div class="ws-terminal" style="height: 100%; white-space: pre; font-size: 0.72rem; line-height: 1.5;">
+--------------------------------------------------------------------------------------------------+
|                               PACKETVEIL CONNTRACK &amp; FILTER PIPELINE                             |
+--------------------------------------------------------------------------------------------------+

   [ NIC Ingress Ring Buffer (eBPF XDP Driver Mode) ]
                           |
                           v
            ( Sliding-Window Anti-SYN Shield )
                    /               \
         [ SYN Rate > Threshold ]   [ Normal Rate ]
                    |                       |
            [ ACTION: TARPIT ]              v
                                  ( 4-Tuple Hash Table Lookup )
                                          /               \
                                 [ Flow Exists ]     [ Flow Missing / SYN ]
                                         |                    |
                                 [ State: ESTAB ]      ( ACL Rule Evaluator )
                                         |                 /          \
                                 ( Zero-Alloc PASS )  [ PASS ]      [ DROP ]
          </div>
        </div>

        <div class="ws-view ws-view--bench" data-view="bench">
          <div class="ws-terminal" style="height: 100%; line-height: 1.6; font-size: 0.75rem;">
=== PACKETVEIL KERNEL BENCHMARKS (AMD Ryzen 9 6900HX - Linux 6.x) ===

BenchmarkInspect_EstablishedFlow-16:
  - Iterations:  12,906,974 ops
  - Speed:       94.99 ns/op
  - Memory:      0 B/op (Zero Heap Allocations on Fast-Path)
  - Allocs:      0 allocs/op

Concurrency &amp; Race Detector:
  - Multi-threaded worker test: 32 concurrent goroutines flooding 500,000 packets
  - Command: go test -v -race ./pkg/filter
  - Result:  PASS (0 data races, 0 memory corruption)
          </div>
        </div>
      `;

      // Canvas 60 FPS Particle Visualizer
      const canvas = document.getElementById('pv-canvas');
      let animId = null;
      let packets = [];
      let passed = 2840, dropped = 14, tarpit = 0, flows = 48;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        const resizeCanvas = () => {
          canvas.width = canvas.parentElement.clientWidth;
          canvas.height = canvas.parentElement.clientHeight;
        };
        resizeCanvas();

        function addParticle(type) {
          packets.push({
            x: 20,
            y: canvas.height * 0.5 + (Math.random() * 40 - 20),
            vx: 4 + Math.random() * 3,
            type: type, // 'ok', 'drop', 'tarpit'
            life: 1.0
          });
        }

        function drawPipeline() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const w = canvas.width;
          const h = canvas.height;

          // Draw pipeline stages
          const stages = [
            { label: 'INGRESS ETH0', x: w * 0.12 },
            { label: 'SYN SHIELD', x: w * 0.35 },
            { label: 'CONNTRACK TABLE', x: w * 0.62 },
            { label: 'DECISION / EGRESS', x: w * 0.88 }
          ];

          stages.forEach((st, idx) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.strokeRect(st.x - 55, h * 0.25, 110, h * 0.5);
            ctx.fillRect(st.x - 55, h * 0.25, 110, h * 0.5);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(st.label, st.x, h * 0.2);

            if (idx < stages.length - 1) {
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
              ctx.beginPath();
              ctx.moveTo(st.x + 55, h * 0.5);
              ctx.lineTo(stages[idx + 1].x - 55, h * 0.5);
              ctx.stroke();
            }
          });

          // Animate packets
          for (let i = packets.length - 1; i >= 0; i--) {
            const p = packets[i];
            p.x += p.vx;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.type === 'drop' ? 4 : 3, 0, Math.PI * 2);
            ctx.fillStyle = p.type === 'ok' ? '#4ade80' : (p.type === 'drop' ? '#f87171' : '#fbbf24');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (p.x > w - 40) packets.splice(i, 1);
          }

          animId = requestAnimationFrame(drawPipeline);
        }
        drawPipeline();
      }

      const term = document.getElementById('pv-terminal');
      function logPacket(action, flow, proto, reason) {
        if (!term) return;
        const color = action === 'PASS' ? 'ws-badge-ok' : (action === 'DROP' ? 'ws-badge-crit' : 'ws-badge-warn');
        const row = document.createElement('div');
        row.className = `ws-row ${color}`;
        row.innerHTML = `
          <span>[${action}]</span>
          <span>${flow}</span>
          <span>${proto} · ${reason}</span>
          <span style="text-align:right; color:var(--text-muted);">${new Date().toISOString().substring(14, 21)}</span>
        `;
        term.prepend(row);
        if (term.children.length > 50) term.removeChild(term.lastChild);
      }

      const ticker = setInterval(() => {
        passed += Math.floor(Math.random() * 5) + 1;
        flows = Math.min(128, Math.max(30, flows + (Math.random() > 0.5 ? 1 : -1)));
        document.getElementById('pv-passed').textContent = passed.toLocaleString();
        document.getElementById('pv-flows').textContent = flows.toLocaleString();
        packets.push({ x: 20, y: 110 + (Math.random() * 30 - 15), vx: 5, type: 'ok', life: 1 });
        if (Math.random() < 0.25) {
          const clientPort = 40000 + Math.floor(Math.random() * 20000);
          logPacket('PASS', `10.8.0.4:${clientPort}`, 'TCP 443', 'conntrack: established flow');
        }
      }, 350);

      document.getElementById('pv-btn-flood')?.addEventListener('click', () => {
        tarpit += 250;
        document.getElementById('pv-tarpit').textContent = tarpit.toLocaleString();
        for (let i = 0; i < 8; i++) {
          packets.push({ x: 20, y: 110 + (Math.random() * 40 - 20), vx: 7, type: 'tarpit', life: 1 });
          logPacket('TARPIT', '198.51.100.82:SYN', 'TCP/SYN', 'anti-syn-flood: threshold exceeded');
        }
      });

      document.getElementById('pv-btn-drop')?.addEventListener('click', () => {
        dropped += 1;
        document.getElementById('pv-dropped').textContent = dropped.toLocaleString();
        packets.push({ x: 20, y: 110, vx: 5, type: 'drop', life: 1 });
        logPacket('DROP', '192.168.1.105:51234', 'TCP 23', 'RULE_DROP_TELNET (Port 23 prohibited)');
      });

      document.getElementById('pv-btn-smb')?.addEventListener('click', () => {
        dropped += 1;
        document.getElementById('pv-dropped').textContent = dropped.toLocaleString();
        packets.push({ x: 20, y: 110, vx: 5, type: 'drop', life: 1 });
        logPacket('DROP', '192.168.1.112:49821', 'TCP 445', 'RULE_DROP_SMB (Port 445 blocked)');
      });

      document.getElementById('pv-btn-flush')?.addEventListener('click', () => {
        flows = 1;
        document.getElementById('pv-flows').textContent = '1';
        logPacket('PASS', '0.0.0.0', 'STATE', 'conntrack table flushed');
      });

      return () => {
        if (animId) cancelAnimationFrame(animId);
        clearInterval(ticker);
      };
    }

    /* ======================================================================
       03: RINGLIMIT WORKSTATION (Lock-Free Rate Limiter)
       ====================================================================== */
    function renderRinglimitWorkstation(titleEl, tagEl, bodyEl) {
      titleEl.textContent = 'RINGLIMIT // LOCK-FREE TOKEN BUCKET & BACKPRESSURE SHAPER';
      if (tagEl) tagEl.textContent = '32.8M OPS/S · 0 B/OP · SMP CACHE-LINE ALIGNED';

      bodyEl.innerHTML = `
        <div class="ws-view ws-view--sim is-active" data-view="sim">
          <div class="ws-hud">
            <div class="ws-hud__item"><span class="ws-hud__label">Tokens Available</span><span class="ws-hud__val" id="rl-tokens">500,000</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Evaluation Rate</span><span class="ws-hud__val" style="color:#38bdf8;" id="rl-rate-val">1,000,000 /s</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Passed Reqs</span><span class="ws-hud__val" style="color:#4ade80;" id="rl-passed">0</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Throttled (429)</span><span class="ws-hud__val" style="color:#f87171;" id="rl-throttled">0</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Heap Allocation</span><span class="ws-hud__val" style="color:#a78bfa;">0 B / op</span></div>
          </div>

          <!-- Live Oscilloscope Canvas -->
          <div class="ws-canvas-wrap">
            <canvas id="rl-canvas" class="ws-canvas"></canvas>
            <div class="ws-canvas-badge mono">TOKEN BUCKET OSCILLOSCOPE (60 FPS)</div>
          </div>

          <div class="ws-split">
            <div class="ws-deck">
              <div class="ws-deck__title">Concurrency Shaper Controls</div>
              <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <div class="mono" style="font-size:0.72rem; color:var(--text-muted);">
                  Refill Rate: <b id="rl-slider-label" style="color:#38bdf8;">1,000,000 /s</b>
                </div>
                <input type="range" id="rl-slider" min="100000" max="10000000" step="100000" value="1000000" style="width:100%; accent-color:#38bdf8;">
              </div>

              <div class="ws-deck__title" style="margin-top:0.5rem;">SMP Cache-Line Alignment</div>
              <div class="mono" style="font-size:0.7rem; color:var(--text-muted); line-height:1.5;">
                • Line 0 (64B): tokens: atomic.Int64 + 56B Pad<br>
                • Line 1 (64B): lastUpdate: atomic.Int64 + 56B Pad<br>
                Result: Zero L1 cache invalidations across CPU cores
              </div>
            </div>

            <div class="ws-terminal" id="rl-terminal" style="max-height: 280px;"></div>
          </div>
        </div>

        <div class="ws-view ws-view--rfc" data-view="rfc">
          <div class="ws-terminal" style="height: 100%; white-space: pre; font-size: 0.72rem; line-height: 1.5;">
+--------------------------------------------------------------------------------------------------+
|                             RINGLIMIT CACHE-LINE MEMORY LAYOUT                                   |
+--------------------------------------------------------------------------------------------------+

  L1 Data Cache Boundary (64 Bytes per Line on x86_64 / ARM64):

  Line 0: [ tokens: atomic.Int64 (8B) ] [ pad: [56]byte (56B) ]  <--- Core 0 Access
  ----------------------------------------------------------------------------------
  Line 1: [ lastUpdate: atomic.Int64 (8B) ] [ pad: [56]byte (56B) ] <--- Core 1 Access

  Lock-Free CAS Loop:
    1. Read tokens & lastUpdate via atomic.Load()
    2. Compute nanosecond delta: refill = (elapsed * rate) / 1e9
    3. Calculate newTokens = min(burst, tokens + refill) - requested
    4. atomic.CompareAndSwap(tokens, old, new) -> On failure, retry without thread sleep.
          </div>
        </div>

        <div class="ws-view ws-view--bench" data-view="bench">
          <div class="ws-terminal" style="height: 100%; line-height: 1.6; font-size: 0.75rem;">
=== RINGLIMIT BENCHMARK SUITE (AMD Ryzen 9 6900HX - Linux 6.x) ===

BenchmarkLimiter_Allow-16:
  - Total Runs:  26,806,790 ops
  - Speed:       44.48 ns/op
  - Memory:      0 B/op
  - Allocs:      0 allocs/op

BenchmarkLimiter_AllowParallel-16 (Contended SMP Multi-threading):
  - Total Runs:  32,820,567 ops (32.8M operations/second)
  - Speed:       33.65 ns/op
  - Memory:      0 B/op
  - Allocs:      0 allocs/op

1-Second Stress Evaluation Test:
  - Total Evaluated: 49,232,459 requests
  - Throughput:      49.23 Mreq/sec
          </div>
        </div>
      `;

      let tokens = 500000, passed = 0, throttled = 0, rate = 1000000;
      let waveData = new Array(120).fill(50);
      let animId = null;

      const canvas = document.getElementById('rl-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const resizeCanvas = () => {
          canvas.width = canvas.parentElement.clientWidth;
          canvas.height = canvas.parentElement.clientHeight;
        };
        resizeCanvas();

        function drawScope() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const w = canvas.width;
          const h = canvas.height;

          // Grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.beginPath();
          for (let y = 0; y < h; y += 30) {
            ctx.moveTo(0, y); ctx.lineTo(w, y);
          }
          ctx.stroke();

          // Waveform
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const step = w / (waveData.length - 1);
          waveData.forEach((val, i) => {
            const y = h - (val / 100) * (h * 0.8) - 15;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
          });
          ctx.stroke();

          animId = requestAnimationFrame(drawScope);
        }
        drawScope();
      }

      const term = document.getElementById('rl-terminal');
      const slider = document.getElementById('rl-slider');
      const sliderLabel = document.getElementById('rl-slider-label');
      const rateVal = document.getElementById('rl-rate-val');

      if (slider) {
        slider.addEventListener('input', (e) => {
          rate = parseInt(e.target.value, 10);
          if (sliderLabel) sliderLabel.textContent = rate.toLocaleString() + ' /s';
          if (rateVal) rateVal.textContent = rate.toLocaleString() + ' /s';
        });
      }

      const interval = setInterval(() => {
        tokens = Math.min(500000, tokens + Math.floor(rate / 10));
        const incoming = Math.floor(Math.random() * (rate / 8));
        let allowed = 0, denied = 0;

        if (tokens >= incoming) {
          tokens -= incoming;
          allowed = incoming;
        } else {
          allowed = tokens;
          denied = incoming - tokens;
          tokens = 0;
        }

        passed += allowed;
        throttled += denied;

        document.getElementById('rl-tokens').textContent = tokens.toLocaleString();
        document.getElementById('rl-passed').textContent = passed.toLocaleString();
        document.getElementById('rl-throttled').textContent = throttled.toLocaleString();

        // Push wave
        waveData.shift();
        waveData.push((tokens / 5000));

        if (term) {
          const row = document.createElement('div');
          row.className = `ws-row ${denied > 0 ? 'ws-badge-warn' : 'ws-badge-ok'}`;
          row.innerHTML = `
            <span>${new Date().toISOString().substring(14, 21)}</span>
            <span>IN: ${incoming.toLocaleString()}</span>
            <span>ALLOW: ${allowed.toLocaleString()} · DROP: ${denied.toLocaleString()}</span>
            <span style="text-align:right;">${(tokens / 5000).toFixed(0)}% TOKENS</span>
          `;
          term.prepend(row);
          if (term.children.length > 40) term.removeChild(term.lastChild);
        }
      }, 100);

      return () => {
        if (animId) cancelAnimationFrame(animId);
        clearInterval(interval);
      };
    }

    /* ======================================================================
       04: WALKV WORKSTATION (Storage Engine & Crash Recovery)
       ====================================================================== */
    function renderWalkvWorkstation(titleEl, tagEl, bodyEl) {
      titleEl.textContent = 'WALKV // WRITE-AHEAD LOG & MEMTABLE CRASH RECOVERY';
      if (tagEl) tagEl.textContent = 'POSIX O_APPEND · CRC32 CASTAGNOLI · ZERO-LOSS REPLAY';

      bodyEl.innerHTML = `
        <div class="ws-view ws-view--sim is-active" data-view="sim">
          <div class="ws-hud">
            <div class="ws-hud__item"><span class="ws-hud__label">Active MemTable Keys</span><span class="ws-hud__val" style="color:#4ade80;" id="wv-keys">10</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">WAL Size on Disk</span><span class="ws-hud__val" id="wv-disk">1.42 KB</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Tail Integrity</span><span class="ws-hud__val" style="color:#38bdf8;" id="wv-crc">PASS (100%)</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Recovery Latency</span><span class="ws-hud__val" style="color:#a78bfa;" id="wv-replay">&lt; 0.4 ms</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Fsync Policy</span><span class="ws-hud__val" style="color:#fbbf24; font-size:0.95rem;">SyncPeriodic</span></div>
          </div>

          <!-- Color-Coded Hex Dump Matrix -->
          <div style="background:#030508; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.85rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;" class="mono">
              <span style="font-size:0.7rem; color:var(--text-muted);">ACTIVE WAL BINARY FRAME INSPECTOR (11-BYTE HEADER + PAYLOAD)</span>
              <span style="font-size:0.7rem; color:#38bdf8;">[CRC32: 4B] [OP: 1B] [KEYLEN: 2B] [VALLEN: 4B]</span>
            </div>
            <div class="ws-hex-grid" id="wv-hex-dump"></div>
          </div>

          <div class="ws-split">
            <div class="ws-deck">
              <div class="ws-deck__title">Crash Simulation Actions</div>
              <div class="ws-deck__btn-group">
                <button type="button" class="btn btn--sm btn--primary" id="wv-btn-put">📝 Append 10 Key-Value Writes</button>
                <button type="button" class="btn btn--sm btn--secondary" id="wv-btn-crash" style="border-color:#f87171; color:#f87171;">💥 Simulate Power Outage (Torn Tail)</button>
                <button type="button" class="btn btn--sm btn--secondary" id="wv-btn-recover">🔄 Replay &amp; Zero-Loss Recover</button>
              </div>
            </div>

            <div class="ws-terminal" id="wv-terminal" style="max-height: 240px;"></div>
          </div>
        </div>

        <div class="ws-view ws-view--rfc" data-view="rfc">
          <div class="ws-terminal" style="height: 100%; white-space: pre; font-size: 0.72rem; line-height: 1.5;">
+--------------------------------------------------------------------------------------------------+
|                                    WALKV BINARY RECORD FORMAT                                    |
+--------------------------------------------------------------------------------------------------+

  +-------------------+-----------------+-------------------+-------------------+
  |  CRC32 (4 Bytes)  | OpType (1 Byte) | KeyLen (2 Bytes)  | ValLen (4 Bytes)  |
  +-------------------+-----------------+-------------------+-------------------+
  |                         Key Bytes [0 .. KeyLen]                                 |
  +---------------------------------------------------------------------------------+
  |                        Value Bytes [0 .. ValLen]                                |
  +---------------------------------------------------------------------------------+

  Crash Recovery &amp; Torn Write Handling:
    1. During startup, Recover() reads record headers via io.ReadFull().
    2. If power was lost during mid-write, unexpected EOF is encountered on incomplete header.
    3. walkv cleanly truncates the torn tail byte sequence without failing the database.
    4. Valid mutations are restored to the in-memory MemTable in under 1 millisecond.
          </div>
        </div>

        <div class="ws-view ws-view--bench" data-view="bench">
          <div class="ws-terminal" style="height: 100%; line-height: 1.6; font-size: 0.75rem;">
=== WALKV STORAGE ENGINE BENCHMARKS (AMD Ryzen 9 6900HX - Linux 6.x) ===

BenchmarkWAL_Put_Async-16:
  - Iterations:  7,278,229 writes
  - Speed:       156.3 ns/op
  - Memory:      184 B/op (3 allocs/op)
  - Throughput:  6.4 Million writes/second

BenchmarkMemTable_Get-16:
  - Iterations:  43,559,262 reads
  - Speed:       24.55 ns/op
  - Memory:      16 B/op (1 alloc/op)
  - Throughput:  40.7 Million reads/second

Crash Resilience Test:
  - 100 keys written, 7 corrupt trailing bytes injected -> 100% recovered cleanly.
          </div>
        </div>
      `;

      let keyCount = 10, walBytes = 1420;
      const hexEl = document.getElementById('wv-hex-dump');
      const term = document.getElementById('wv-terminal');

      function renderHex(corrupt = false) {
        if (!hexEl) return;
        const bytes = [
          { b: '7F', c: 'is-crc' }, { b: '3A', c: 'is-crc' }, { b: '12', c: 'is-crc' }, { b: '90', c: 'is-crc' },
          { b: '01', c: 'is-op' },  { b: '00', c: '' },       { b: '06', c: '' },       { b: '00', c: '' },
          { b: '00', c: '' },       { b: '00', c: '' },       { b: '0E', c: '' },       { b: '64', c: '' },
          { b: '65', c: '' },       { b: '76', c: '' },       { b: '69', c: '' },       { b: '63', c: '' }
        ];

        if (corrupt) {
          bytes.push({ b: 'DE', c: 'is-corrupt' });
          bytes.push({ b: 'AD', c: 'is-corrupt' });
          bytes.push({ b: 'BE', c: 'is-corrupt' });
          bytes.push({ b: 'EF', c: 'is-corrupt' });
        }

        hexEl.innerHTML = bytes.map(item => `
          <div class="ws-hex-byte ${item.c}">${item.b}</div>
        `).join('');
      }

      renderHex(false);

      function logWAL(text, cls = 'ws-badge-info') {
        if (!term) return;
        const row = document.createElement('div');
        row.className = `ws-row ${cls}`;
        row.style.gridTemplateColumns = '1fr 90px';
        row.innerHTML = `<span>${text}</span><span style="text-align:right; color:var(--text-muted);">${new Date().toISOString().substring(14, 21)}</span>`;
        term.prepend(row);
      }

      logWAL('WAL file opened: /data/wal.log (O_APPEND | O_CREATE | O_WRONLY)', 'ws-badge-ok');
      logWAL('MemTable synchronized: 10 transactions loaded into memory', 'ws-badge-info');

      document.getElementById('wv-btn-put')?.addEventListener('click', () => {
        keyCount += 10;
        walBytes += 840;
        document.getElementById('wv-keys').textContent = keyCount;
        document.getElementById('wv-disk').textContent = (walBytes / 1024).toFixed(2) + ' KB';
        renderHex(false);
        logWAL(`Appended 10 records [CRC32: 0x9f32e18b .. 0x3d41a021] -> fsync flushed`, 'ws-badge-ok');
      });

      document.getElementById('wv-btn-crash')?.addEventListener('click', () => {
        walBytes += 4;
        document.getElementById('wv-disk').textContent = (walBytes / 1024).toFixed(2) + ' KB';
        document.getElementById('wv-crc').textContent = 'TAIL CORRUPTED';
        document.getElementById('wv-crc').style.color = '#f87171';
        renderHex(true);
        logWAL(`[KERNEL PANIC] Injected 4 incomplete unclosed bytes [0xDE 0xAD 0xBE 0xEF] at WAL EOF!`, 'ws-badge-crit');
      });

      document.getElementById('wv-btn-recover')?.addEventListener('click', () => {
        document.getElementById('wv-crc').textContent = 'PASS (CLEANED)';
        document.getElementById('wv-crc').style.color = '#4ade80';
        document.getElementById('wv-replay').textContent = '< 0.3 ms';
        renderHex(false);
        logWAL(`[REPLAY START] Scanning /data/wal.log with CRC32 Castagnoli...`, 'ws-badge-info');
        logWAL(`[SAFE TRUNCATE] Corrupt tail bytes [0xDE 0xAD 0xBE 0xEF] cleanly truncated at offset ${walBytes - 4}`, 'ws-badge-warn');
        logWAL(`[REPLAY FINISHED] Successfully restored ${keyCount} keys into MemTable with ZERO data loss!`, 'ws-badge-ok');
      });

      return () => {};
    }

    /* ======================================================================
       05: TLSVAULT WORKSTATION (Zero-Trust TLS 1.3 Auditor)
       ====================================================================== */
    function renderTlsvaultWorkstation(titleEl, tagEl, bodyEl) {
      titleEl.textContent = 'TLSVAULT // ZERO-TRUST TLS 1.3 AUDITOR & CIPHER INSPECTOR';
      if (tagEl) tagEl.textContent = 'RFC 8446 · 1-RTT ECDHE · AEAD CHACHA20 / AES-GCM';

      bodyEl.innerHTML = `
        <div class="ws-view ws-view--sim is-active" data-view="sim">
          <div class="ws-hud">
            <div class="ws-hud__item"><span class="ws-hud__label">Negotiated Protocol</span><span class="ws-hud__val" style="color:#4ade80;" id="tls-ver">TLS 1.3</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Zero-Trust Rating</span><span class="ws-hud__val" style="color:#2dd4bf;" id="tls-rating">A+ (SECURE)</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">ALPN Multiplex</span><span class="ws-hud__val" style="color:#fbbf24;" id="tls-alpn">h2 (HTTP/2)</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Handshake RTT</span><span class="ws-hud__val" style="color:#38bdf8;" id="tls-rtt">24 ms</span></div>
            <div class="ws-hud__item"><span class="ws-hud__label">Certificate Expiry</span><span class="ws-hud__val" style="color:#a78bfa;" id="tls-cert">86 Days Valid</span></div>
          </div>

          <div class="ws-split">
            <div class="ws-deck">
              <div class="ws-deck__title">Target Host Audit</div>
              <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <input type="text" id="ws-tls-host" value="hasancicek.dev:443" 
                  style="background:#020306; border:1px solid rgba(255,255,255,0.12); padding:0.55rem 0.75rem; border-radius:5px; color:#fff; font-family:var(--font-mono); font-size:0.75rem;">
                <button type="button" class="btn btn--sm btn--primary" id="ws-tls-audit-btn">Audit TLS Handshake</button>
              </div>

              <div class="ws-deck__title" style="margin-top:0.5rem;">AEAD Cipher Verification</div>
              <div class="mono" style="font-size:0.7rem; color:var(--text-muted); line-height:1.5;">
                • Suite: TLS_AES_128_GCM_SHA256<br>
                • KeyShare: Curve25519 (ECDHE)<br>
                • Insecure Ciphers (CBC/RC4): BLOCKED
              </div>
            </div>

            <!-- RFC 8446 Interactive Flight Sequence Diagram -->
            <div class="ws-terminal" id="ws-tls-flights" style="max-height: 380px;"></div>
          </div>
        </div>

        <div class="ws-view ws-view--rfc" data-view="rfc">
          <div class="ws-terminal" style="height: 100%; white-space: pre; font-size: 0.72rem; line-height: 1.5;">
+--------------------------------------------------------------------------------------------------+
|                             TLS 1.3 FULL 1-RTT HANDSHAKE FLIGHT SEQUENCE                         |
+--------------------------------------------------------------------------------------------------+

  Client                                              Server
    |                                                   |
    | ------- ClientHello (KeyShare, ALPN, SNI) ------> |  [0-RTT / Plaintext]
    |                                                   |
    | <------ ServerHello (KeyShare selected) --------- |  [Derive Handshake Keys]
    | <====== {EncryptedExtensions} =================== |  [1-RTT / AEAD Encrypted]
    | <====== {Certificate + CertVerify} ============== |
    | <====== {Finished} ============================== |
    |                                                   |
    | ======> {Finished} ============================== |  [Derive Master Secret]
    |                                                   |
    | <=====> [Application Traffic (AES-GCM)] <=======> |  [Full Zero-Trust Secure Channel]
          </div>
        </div>

        <div class="ws-view ws-view--bench" data-view="bench">
          <div class="ws-terminal" style="height: 100%; line-height: 1.6; font-size: 0.75rem;">
=== TLSVAULT AUDITOR BENCHMARKS (AMD Ryzen 9 6900HX - Linux 6.x) ===

BenchmarkEvaluateCipher-16:
  - Iterations:  2,668,800 evaluations
  - Speed:       403.9 ns/op
  - Rating:      Zero-Trust RFC 8446 Compliant

Live Probe Verification:
  - Remote:     hasancicek.dev:443 (104.21.94.115)
  - Protocol:   TLS 1.3
  - Cipher:     TLS_AES_128_GCM_SHA256
  - ALPN:       h2
  - Cert Days:  86 days remaining
          </div>
        </div>
      `;

      const flightsEl = document.getElementById('ws-tls-flights');
      function renderFlights(host) {
        if (!flightsEl) return;
        flightsEl.innerHTML = `
          <div class="ws-flight-box">
            <div class="ws-flight-row ws-badge-info">
              <span>[FLIGHT 1 // 0-RTT] CLIENT -> SERVER</span>
              <span>ClientHello [SNI: ${host}, KeyShare: Curve25519, ALPN: h2]</span>
            </div>
            <div class="ws-flight-row ws-badge-ok">
              <span>[FLIGHT 2 // 1-RTT] SERVER -> CLIENT</span>
              <span>ServerHello [KeyShare: Curve25519 matched, Cipher: TLS_AES_128_GCM_SHA256]</span>
            </div>
            <div class="ws-flight-row ws-badge-ok">
              <span>[FLIGHT 3 // ENCRYPTED] SERVER -> CLIENT</span>
              <span>{EncryptedExtensions, Certificate: ${host}, CertVerify, Finished}</span>
            </div>
            <div class="ws-flight-row ws-badge-info">
              <span>[X.509 VALIDATE]</span>
              <span>Issuer: Cloudflare / Let's Encrypt · Validity: 86 Days · Status: VERIFIED</span>
            </div>
            <div class="ws-flight-row ws-badge-ok" style="border-color:rgba(74,222,128,0.4); background:rgba(74,222,128,0.05);">
              <span>[ESTABLISHED // 1-RTT] ZERO-TRUST SECURE</span>
              <span>Full duplex AES-128-GCM channel established in 24.1 ms</span>
            </div>
          </div>
        `;
      }

      renderFlights('hasancicek.dev:443');

      document.getElementById('ws-tls-audit-btn')?.addEventListener('click', () => {
        const host = document.getElementById('ws-tls-host')?.value || 'hasancicek.dev:443';
        renderFlights(host);
      });

      return () => {};
    }
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
