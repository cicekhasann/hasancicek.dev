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
     Works & Systems Interactive Sandbox Demos
     ------------------------------------------------------------------------ */
  function initSandboxDemos() {
    const modal = document.getElementById('sandbox-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if (!modal || !modalTitle || !modalBody) return;

    let activeCleanup = null;

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

      document.body.style.overflow = 'hidden';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      switch (demoId) {
        case 'cvegrid':
          activeCleanup = renderCvegridDemo(modalTitle, modalBody);
          break;
        case 'packetveil':
          activeCleanup = renderPacketveilDemo(modalTitle, modalBody);
          break;
        case 'ringlimit':
          activeCleanup = renderRinglimitDemo(modalTitle, modalBody);
          break;
        case 'walkv':
          activeCleanup = renderWalkvDemo(modalTitle, modalBody);
          break;
        case 'tlsvault':
          activeCleanup = renderTlsvaultDemo(modalTitle, modalBody);
          break;
        default:
          modalTitle.textContent = 'SYSTEM SANDBOX';
          modalBody.innerHTML = '<p class="mono">Sandbox not found.</p>';
      }
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

    /* --- Demo 1: cvegrid --- */
    function renderCvegridDemo(titleEl, bodyEl) {
      titleEl.textContent = 'CVEGRID // THREAT INTELLIGENCE & DOSSIER EXPLORER';
      const cves = [
        { id: 'CVE-2026-3841', cvss: '9.8', sev: 'CRIT', cat: 'KERNEL/RCE', sub: 'kernel: net/sched packet overflow', epss: '0.892' },
        { id: 'CVE-2026-2910', cvss: '8.4', sev: 'HIGH', cat: 'LOCAL/PRIV', sub: 'fs/xfs: btree lock deadlock', epss: '0.412' },
        { id: 'CVE-2026-1904', cvss: '5.3', sev: 'MED',  cat: 'CRYPTO', sub: 'crypto/aead: chacha20 nonce reuse', epss: '0.045' },
        { id: 'CVE-2026-0812', cvss: '9.1', sev: 'CRIT', cat: 'AUTH/BYPASS', sub: 'oauth2/jwt: algorithm confusion', epss: '0.941' },
        { id: 'CVE-2025-4921', cvss: '7.5', sev: 'HIGH', cat: 'MEMORY', sub: 'tls/record: out-of-bounds heap read', epss: '0.334' },
        { id: 'CVE-2025-3120', cvss: '4.8', sev: 'MED',  cat: 'NETWORK', sub: 'bgp/daemon: flap damping exhaustion', epss: '0.012' }
      ];

      bodyEl.innerHTML = `
        <div class="sb-layout">
          <div class="sb-toolbar">
            <div style="flex: 1; max-width: 320px;">
              <input type="text" id="cve-search" placeholder="Filter by CVE ID, subsystem or severity..." 
                style="width: 100%; background: #04060a; border: 1px solid rgba(255,255,255,0.12); padding: 0.5rem 0.75rem; border-radius: 4px; color: #fff; font-family: var(--font-mono); font-size: 0.78rem;">
            </div>
            <div class="mono" style="font-size: 0.72rem; color: var(--text-muted);">
              Indexed: <span style="color:#4ade80;">242,109 CVEs</span> · SQLite FTS5 Zero-Alloc
            </div>
          </div>
          <div class="sb-metric-strip">
            <div class="sb-metric-box"><div class="sb-metric-box__label">Active Filter</div><div class="sb-metric-box__val" id="cve-count">6 Dossiers</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Max CVSS Score</div><div class="sb-metric-box__val" style="color:#f87171;">9.8 Critical</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Sync Latency</div><div class="sb-metric-box__val" style="color:#38bdf8;">14.2 ms</div></div>
          </div>
          <div class="sb-terminal" id="cve-list"></div>
        </div>
      `;

      function renderList(query) {
        const list = document.getElementById('cve-list');
        const count = document.getElementById('cve-count');
        const q = (query || '').toLowerCase().trim();
        const filtered = cves.filter(c => !q || c.id.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));
        if (count) count.textContent = filtered.length + ' Dossiers';
        if (!list) return;

        list.innerHTML = filtered.map(c => {
          const colorClass = c.sev === 'CRIT' ? 'sb-crit' : (c.sev === 'HIGH' ? 'sb-warn' : 'sb-info');
          return `
            <div class="sb-row ${colorClass}">
              <span style="width: 130px; font-weight: bold;">${c.id}</span>
              <span style="width: 80px;">[${c.cvss} ${c.sev}]</span>
              <span style="width: 120px;">${c.cat}</span>
              <span style="flex: 1;">${c.sub}</span>
              <span style="color: var(--text-muted);">EPSS: ${c.epss}</span>
            </div>
          `;
        }).join('');
      }

      renderList('');
      const input = document.getElementById('cve-search');
      if (input) {
        input.addEventListener('input', (e) => renderList(e.target.value));
        input.focus();
      }
      return () => {};
    }

    /* --- Demo 2: packetveil --- */
    function renderPacketveilDemo(titleEl, bodyEl) {
      titleEl.textContent = 'PACKETVEIL // L4/L7 STATEFUL INSPECTION & FLOW MONITOR';
      bodyEl.innerHTML = `
        <div class="sb-layout">
          <div class="sb-toolbar">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn--secondary btn--sm" id="pv-syn-flood">⚡ Trigger SYN Flood (100k/s)</button>
              <button type="button" class="btn btn--secondary btn--sm" id="pv-inject-drop">🛡️ Inject Port 23 Malicious Packet</button>
              <button type="button" class="btn btn--secondary btn--sm" id="pv-reset">🔄 Reset Table</button>
            </div>
            <div class="mono" style="font-size: 0.72rem; color: #38bdf8;">
              Fast-path: 0 B/op · 94.9 ns/flow
            </div>
          </div>
          <div class="sb-metric-strip">
            <div class="sb-metric-box"><div class="sb-metric-box__label">Active Flows</div><div class="sb-metric-box__val" id="pv-flows">48</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Passed (L4)</div><div class="sb-metric-box__val" style="color:#4ade80;" id="pv-passed">1,420</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Dropped (ACL)</div><div class="sb-metric-box__val" style="color:#f87171;" id="pv-dropped">12</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Tarpitted (SYN)</div><div class="sb-metric-box__val" style="color:#fbbf24;" id="pv-tarpit">0</div></div>
          </div>
          <div class="sb-terminal" id="pv-log"></div>
        </div>
      `;

      let passed = 1420, dropped = 12, tarpit = 0, flows = 48;
      const logEl = document.getElementById('pv-log');

      function addLog(action, src, dst, proto, reason) {
        if (!logEl) return;
        const color = action === 'PASS' ? 'sb-ok' : (action === 'DROP' ? 'sb-crit' : 'sb-warn');
        const div = document.createElement('div');
        div.className = `sb-row ${color}`;
        div.innerHTML = `
          <span style="width: 70px;">[${action}]</span>
          <span style="width: 220px;">${src} -> ${dst}</span>
          <span style="width: 80px;">${proto}</span>
          <span style="flex: 1;">${reason}</span>
          <span style="color: var(--text-muted);">${new Date().toISOString().substring(11, 19)}</span>
        `;
        logEl.prepend(div);
        if (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
      }

      const interval = setInterval(() => {
        passed += Math.floor(Math.random() * 4) + 1;
        flows = Math.min(256, Math.max(30, flows + (Math.random() > 0.5 ? 1 : -1)));
        const pEl = document.getElementById('pv-passed');
        const fEl = document.getElementById('pv-flows');
        if (pEl) pEl.textContent = passed.toLocaleString();
        if (fEl) fEl.textContent = flows.toLocaleString();

        if (Math.random() < 0.25) {
          const clientPort = 40000 + Math.floor(Math.random() * 20000);
          addLog('PASS', `10.8.0.4:${clientPort}`, '1.1.1.1:443', 'TCP/TLS', 'conntrack: established');
        }
      }, 400);

      const synBtn = document.getElementById('pv-syn-flood');
      if (synBtn) {
        synBtn.addEventListener('click', () => {
          tarpit += 140;
          document.getElementById('pv-tarpit').textContent = tarpit.toLocaleString();
          for (let i = 0; i < 4; i++) {
            addLog('TARPIT', '198.51.100.82:SYN', '10.0.0.1:443', 'TCP/SYN', 'anti-syn-flood: threshold exceeded');
          }
        });
      }

      const dropBtn = document.getElementById('pv-inject-drop');
      if (dropBtn) {
        dropBtn.addEventListener('click', () => {
          dropped += 1;
          document.getElementById('pv-dropped').textContent = dropped.toLocaleString();
          addLog('DROP', '192.168.1.105:51234', '10.0.0.5:23', 'TCP/TELNET', 'RULE_DROP_TELNET (Port 23 prohibited)');
        });
      }

      const resetBtn = document.getElementById('pv-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          passed = 0; dropped = 0; tarpit = 0; flows = 1;
          document.getElementById('pv-passed').textContent = '0';
          document.getElementById('pv-dropped').textContent = '0';
          document.getElementById('pv-tarpit').textContent = '0';
          document.getElementById('pv-flows').textContent = '1';
          if (logEl) logEl.innerHTML = '';
          addLog('PASS', '0.0.0.0', '0.0.0.0', 'STATE', 'conntrack table flushed');
        });
      }

      return () => clearInterval(interval);
    }

    /* --- Demo 3: ringlimit --- */
    function renderRinglimitDemo(titleEl, bodyEl) {
      titleEl.textContent = 'RINGLIMIT // LOCK-FREE TOKEN BUCKET & BACKPRESSURE SHAPER';
      bodyEl.innerHTML = `
        <div class="sb-layout">
          <div class="sb-toolbar">
            <div class="sb-slider-wrap">
              <span class="mono" style="font-size: 0.72rem; min-width: 140px;">Rate: <b id="rl-rate-label" style="color:var(--accent-1);">1,000,000 /s</b></span>
              <input type="range" id="rl-rate-slider" min="100000" max="10000000" step="100000" value="1000000">
            </div>
            <div class="mono" style="font-size: 0.72rem; color: #4ade80;">
              Zero-Alloc Atomic CAS · 33.6 ns/op
            </div>
          </div>
          <div class="sb-metric-strip">
            <div class="sb-metric-box"><div class="sb-metric-box__label">Tokens Available</div><div class="sb-metric-box__val" id="rl-tokens">500,000</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Passed Reqs</div><div class="sb-metric-box__val" style="color:#4ade80;" id="rl-passed">0</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Throttled (429)</div><div class="sb-metric-box__val" style="color:#f87171;" id="rl-throttled">0</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Allocations</div><div class="sb-metric-box__val" style="color:#38bdf8;">0 B / op</div></div>
          </div>
          <div class="sb-terminal" id="rl-terminal" style="font-family: var(--font-mono); font-size: 0.75rem;"></div>
        </div>
      `;

      let tokens = 500000, passed = 0, throttled = 0, rate = 1000000;
      const termEl = document.getElementById('rl-terminal');
      const rateSlider = document.getElementById('rl-rate-slider');
      const rateLabel = document.getElementById('rl-rate-label');

      if (rateSlider) {
        rateSlider.addEventListener('input', (e) => {
          rate = parseInt(e.target.value, 10);
          if (rateLabel) rateLabel.textContent = rate.toLocaleString() + ' /s';
        });
      }

      const interval = setInterval(() => {
        // Refill tokens
        tokens = Math.min(500000, tokens + Math.floor(rate / 10));
        // Simulate high traffic burst
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

        const tokEl = document.getElementById('rl-tokens');
        const passEl = document.getElementById('rl-passed');
        const throtEl = document.getElementById('rl-throttled');
        if (tokEl) tokEl.textContent = tokens.toLocaleString();
        if (passEl) passEl.textContent = passed.toLocaleString();
        if (throtEl) throtEl.textContent = throttled.toLocaleString();

        if (termEl) {
          const div = document.createElement('div');
          div.className = denied > 0 ? 'sb-row sb-warn' : 'sb-row sb-ok';
          div.innerHTML = `
            <span style="width: 100px;">${new Date().toISOString().substring(14, 21)}</span>
            <span style="width: 140px;">IN: ${incoming.toLocaleString()} reqs</span>
            <span style="width: 140px;">ALLOW: ${allowed.toLocaleString()}</span>
            <span style="width: 140px; color:${denied > 0 ? '#f87171' : 'var(--text-muted)'};">DROP: ${denied.toLocaleString()}</span>
            <span style="flex:1;">BUCKET: ${(tokens / 5000).toFixed(1)}% full</span>
          `;
          termEl.prepend(div);
          if (termEl.children.length > 40) termEl.removeChild(termEl.lastChild);
        }
      }, 100);

      return () => clearInterval(interval);
    }

    /* --- Demo 4: walkv --- */
    function renderWalkvDemo(titleEl, bodyEl) {
      titleEl.textContent = 'WALKV // WRITE-AHEAD LOG & MEMTABLE CRASH RECOVERY';
      bodyEl.innerHTML = `
        <div class="sb-layout">
          <div class="sb-toolbar">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn--primary btn--sm" id="wv-put">📝 Append 10 Keys to WAL</button>
              <button type="button" class="btn btn--secondary btn--sm" id="wv-crash" style="border-color:#f87171; color:#f87171;">💥 Simulate Power Outage (Corrupt Tail)</button>
              <button type="button" class="btn btn--secondary btn--sm" id="wv-recover">🔄 Replay & Recover</button>
            </div>
            <div class="mono" style="font-size: 0.72rem; color: #fbbf24;">
              Binary Frame: 11B Header + CRC32 Castagnoli
            </div>
          </div>
          <div class="sb-metric-strip">
            <div class="sb-metric-box"><div class="sb-metric-box__label">WAL Size on Disk</div><div class="sb-metric-box__val" id="wv-disk">1.4 KB</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">MemTable Keys</div><div class="sb-metric-box__val" style="color:#4ade80;" id="wv-keys">10</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">CRC Verification</div><div class="sb-metric-box__val" style="color:#38bdf8;" id="wv-crc">PASS (100%)</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Replay Latency</div><div class="sb-metric-box__val" style="color:#a78bfa;" id="wv-replay">< 1 ms</div></div>
          </div>
          <div class="sb-terminal" id="wv-log"></div>
        </div>
      `;

      let keyCount = 10, walBytes = 1420;
      const logEl = document.getElementById('wv-log');

      function appendLog(text, cls = 'sb-info') {
        if (!logEl) return;
        const div = document.createElement('div');
        div.className = `sb-row ${cls}`;
        div.innerHTML = `<span style="flex:1;">${text}</span><span style="color:var(--text-muted);">${new Date().toISOString().substring(11, 19)}</span>`;
        logEl.prepend(div);
      }

      appendLog('WAL initialized: /data/wal.log opened with O_APPEND | O_CREATE', 'sb-ok');
      appendLog('MemTable warm: 10 keys indexed from existing transaction records', 'sb-info');

      document.getElementById('wv-put')?.addEventListener('click', () => {
        keyCount += 10;
        walBytes += 840;
        document.getElementById('wv-keys').textContent = keyCount;
        document.getElementById('wv-disk').textContent = (walBytes / 1024).toFixed(1) + ' KB';
        appendLog(`Appended 10 records [CRC32: 0x9f32e18b .. 0x3d41a021] -> fsync flushed`, 'sb-ok');
      });

      document.getElementById('wv-crash')?.addEventListener('click', () => {
        walBytes += 5;
        document.getElementById('wv-disk').textContent = (walBytes / 1024).toFixed(1) + ' KB';
        document.getElementById('wv-crc').textContent = 'TAIL CORRUPTED';
        document.getElementById('wv-crc').style.color = '#f87171';
        appendLog(`[CRASH SIMULATION] Kernel panic! Appended 5 truncated unclosed bytes [0xDE 0xAD 0xBE 0xEF 0x01] to WAL tail.`, 'sb-crit');
      });

      document.getElementById('wv-recover')?.addEventListener('click', () => {
        const start = performance.now();
        document.getElementById('wv-crc').textContent = 'PASS (CLEANED)';
        document.getElementById('wv-crc').style.color = '#4ade80';
        document.getElementById('wv-replay').textContent = (performance.now() - start + 0.4).toFixed(1) + ' ms';
        appendLog(`[RECOVERY START] Scanning /data/wal.log records with CRC32...`, 'sb-info');
        appendLog(`[TAIL ERROR] Detected partial record at byte ${walBytes - 5}: truncated header safely truncated`, 'sb-warn');
        appendLog(`[RECOVERY COMPLETE] Successfully restored ${keyCount} keys into MemTable with ZERO data loss!`, 'sb-ok');
      });

      return () => {};
    }

    /* --- Demo 5: tlsvault --- */
    function renderTlsvaultDemo(titleEl, bodyEl) {
      titleEl.textContent = 'TLSVAULT // ZERO-TRUST TLS 1.3 AUDITOR & CIPHER INSPECTOR';
      bodyEl.innerHTML = `
        <div class="sb-layout">
          <div class="sb-toolbar">
            <div style="display: flex; gap: 0.5rem; flex: 1; max-width: 420px;">
              <input type="text" id="tls-host" value="hasancicek.dev:443" 
                style="flex: 1; background: #04060a; border: 1px solid rgba(255,255,255,0.12); padding: 0.5rem 0.75rem; border-radius: 4px; color: #fff; font-family: var(--font-mono); font-size: 0.78rem;">
              <button type="button" class="btn btn--primary btn--sm" id="tls-audit-btn">Audit Host</button>
            </div>
            <div class="mono" style="font-size: 0.72rem; color: #2dd4bf;">
              1-RTT ECDHE · ChaCha20-Poly1305 / AES-256-GCM
            </div>
          </div>
          <div class="sb-metric-strip">
            <div class="sb-metric-box"><div class="sb-metric-box__label">Negotiated Protocol</div><div class="sb-metric-box__val" style="color:#4ade80;" id="tls-ver">TLS 1.3</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Security Rating</div><div class="sb-metric-box__val" style="color:#2dd4bf;" id="tls-rating">A+ (SECURE)</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">ALPN Multiplex</div><div class="sb-metric-box__val" style="color:#fbbf24;" id="tls-alpn">h2</div></div>
            <div class="sb-metric-box"><div class="sb-metric-box__label">Handshake Latency</div><div class="sb-metric-box__val" style="color:#38bdf8;" id="tls-rtt">24 ms</div></div>
          </div>
          <div class="sb-terminal" id="tls-log"></div>
        </div>
      `;

      const logEl = document.getElementById('tls-log');
      function appendLog(step, detail, cls = 'sb-info') {
        if (!logEl) return;
        const div = document.createElement('div');
        div.className = `sb-row ${cls}`;
        div.innerHTML = `<span style="width: 140px; font-weight:bold;">${step}</span><span style="flex:1;">${detail}</span>`;
        logEl.appendChild(div);
      }

      function runAudit(host) {
        if (logEl) logEl.innerHTML = '';
        appendLog('0-RTT OUTBOUND', `ClientHello [SNI: ${host}, KeyShare: X25519, ALPN: h2, CipherSuites: 3 (AEAD)]`, 'sb-info');
        setTimeout(() => {
          appendLog('1-RTT INBOUND', `ServerHello [Selected: TLS_AES_128_GCM_SHA256, KeyShare: X25519 matched]`, 'sb-ok');
          appendLog('HANDSHAKE ENC', `{EncryptedExtensions, Certificate: ${host}, CertVerify, Finished}`, 'sb-ok');
          appendLog('X.509 VALIDATE', `Issuer: Let's Encrypt / Cloudflare Inc, Valid 86 days remaining`, 'sb-info');
          appendLog('ESTABLISHED', `Symmetric 1-RTT session established. Zero-Trust Rating: A+ (SECURE)`, 'sb-ok');
        }, 150);
      }

      runAudit('hasancicek.dev:443');

      document.getElementById('tls-audit-btn')?.addEventListener('click', () => {
        const h = document.getElementById('tls-host')?.value || 'hasancicek.dev:443';
        runAudit(h);
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
