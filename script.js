/* ============================================================
   AURALIS STUDIO — CINEMATIC ENGINE v2
   Complete animation, interaction, and scroll system.
   ============================================================ */

(function () {
  'use strict';

  // ── Utilities ──
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const rand = (min, max) => Math.random() * (max - min) + min;
  const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

  // ── State ──
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let scrollY = 0;
  let vh = window.innerHeight;
  let vw = window.innerWidth;

  // ── DOM ──
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  const arcContainer = document.getElementById('arcContainer');
  const lensGlow = document.getElementById('lensGlow');
  const depthLayers = document.querySelectorAll('.bg-depth-layer');
  const heroContent = document.querySelector('.hero-content');
  const showcasePanel = document.querySelector('.showcase-panel');
  const convergenceCanvas = document.getElementById('convergenceCanvas');
  const convCtx = convergenceCanvas ? convergenceCanvas.getContext('2d') : null;

  // ============================================================
  //  PARTICLE SYSTEM
  // ============================================================
  class Particle {
    constructor() { this.reset(true); }
    reset(initial) {
      this.x = rand(0, vw);
      this.y = initial ? rand(0, vh * 2.5) : vh + rand(50, 300);
      this.size = rand(0.5, 2.2);
      this.vy = rand(-0.12, -0.5);
      this.vx = rand(-0.08, 0.08);
      this.baseOpacity = rand(0.04, 0.2);
      this.opacity = this.baseOpacity;
      this.phase = rand(0, Math.PI * 2);
      this.speed = rand(0.005, 0.02);
      this.hue = rand(260, 300);
      this.sat = rand(40, 80);
      this.lit = rand(60, 85);
    }
    update() {
      this.x += this.vx + (mouse.x - 0.5) * 0.12;
      this.y += this.vy;
      this.phase += this.speed;
      this.opacity = this.baseOpacity * (0.5 + 0.5 * Math.sin(this.phase));
      if (this.y < -30) this.reset(false);
      if (this.x < -60) this.x = vw + 60;
      if (this.x > vw + 60) this.x = -60;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},${this.sat}%,${this.lit}%,${this.opacity})`;
      ctx.fill();
      if (this.size > 1.4) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue},${this.sat}%,${this.lit}%,${this.opacity * 0.12})`;
        ctx.fill();
      }
    }
  }

  const pCount = Math.min(Math.floor((vw * vh) / 9000), 180);
  const particles = Array.from({ length: pCount }, () => new Particle());

  function resizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // ============================================================
  //  CONVERGENCE PARTICLES (Final Section)
  // ============================================================
  class ConvParticle {
    constructor(cx, cy) {
      this.cx = cx; this.cy = cy;
      this.angle = rand(0, Math.PI * 2);
      this.radius = rand(200, 500);
      this.speed = rand(0.003, 0.012);
      this.size = rand(0.8, 2);
      this.opacity = rand(0.1, 0.4);
      this.x = 0; this.y = 0;
    }
    update(progress) {
      this.angle += this.speed;
      const r = this.radius * (1 - progress * 0.6);
      this.x = this.cx + Math.cos(this.angle) * r;
      this.y = this.cy + Math.sin(this.angle) * r;
    }
    draw(c) {
      c.beginPath();
      c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      c.fillStyle = `rgba(192,132,252,${this.opacity})`;
      c.fill();
    }
  }

  let convParticles = [];
  let convProgress = 0;
  let convVisible = false;

  function initConvergence() {
    if (!convergenceCanvas) return;
    const rect = convergenceCanvas.parentElement.getBoundingClientRect();
    const w = rect.width; const h = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    convergenceCanvas.width = w * dpr; convergenceCanvas.height = h * dpr;
    convergenceCanvas.style.width = w + 'px'; convergenceCanvas.style.height = h + 'px';
    convCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2, cy = h / 2;
    convParticles = Array.from({ length: 60 }, () => new ConvParticle(cx, cy));
  }

  function updateConvergence() {
    if (!convCtx || !convVisible) return;
    const w = convergenceCanvas.width / (Math.min(devicePixelRatio || 1, 2));
    const h = convergenceCanvas.height / (Math.min(devicePixelRatio || 1, 2));
    convCtx.clearRect(0, 0, w, h);
    for (const p of convParticles) {
      p.update(convProgress);
      p.draw(convCtx);
    }
  }

  // ============================================================
  //  MOUSE TRACKING
  // ============================================================
  document.addEventListener('mousemove', e => {
    mouse.tx = e.clientX / vw;
    mouse.ty = e.clientY / vh;
  });
  document.addEventListener('touchmove', e => {
    if (e.touches.length) {
      mouse.tx = e.touches[0].clientX / vw;
      mouse.ty = e.touches[0].clientY / vh;
    }
  }, { passive: true });

  // ============================================================
  //  SCROLL TRACKING
  // ============================================================
  window.addEventListener('scroll', () => {
    scrollY = window.pageYOffset || document.documentElement.scrollTop;
  }, { passive: true });

  // ============================================================
  //  LENS GLOW
  // ============================================================
  setTimeout(() => lensGlow.classList.add('active'), 1500);

  function updateLensGlow() {
    lensGlow.style.transform = `translate(${mouse.x * vw - 300}px,${mouse.y * vh - 300}px)`;
  }

  // ============================================================
  //  ARC PARALLAX + SCROLL SINK
  // ============================================================
  function updateArc() {
    const ox = (mouse.x - 0.5) * 15;
    const oy = (mouse.y - 0.5) * 8;
    const sp = clamp(scrollY / (vh * 1.2), 0, 1);
    arcContainer.style.transform = `translateX(calc(-50% + ${ox}px)) translateY(calc(22% + ${oy}px + ${sp * 40}%))`;
    arcContainer.style.opacity = 1 - sp * 0.8;
  }

  // ============================================================
  //  DEPTH LAYERS
  // ============================================================
  function updateDepth() {
    const speeds = [0.02, 0.04, 0.06];
    depthLayers.forEach((l, i) => {
      l.style.transform = `translate(${(mouse.x - 0.5) * speeds[i] * 100}px,${(mouse.y - 0.5) * speeds[i] * 60}px)`;
    });
  }

  // ============================================================
  //  HERO SCROLL FADE
  // ============================================================
  function updateHeroScroll() {
    const sp = clamp(scrollY / (vh * 0.8), 0, 1);
    if (heroContent) {
      heroContent.style.transform = `translateY(${sp * -60}px)`;
      heroContent.style.opacity = clamp(1 - sp * 1.2, 0, 1);
    }
    if (showcasePanel) {
      showcasePanel.style.opacity = clamp(1 - sp * 1.5, 0, 1);
    }
  }

  // ============================================================
  //  SCROLL REVEAL SYSTEM
  // ============================================================
  const revealEls = document.querySelectorAll('[data-reveal]');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
  revealEls.forEach(el => revealObs.observe(el));

  // ============================================================
  //  SECTION VISIBILITY
  // ============================================================
  const sections = document.querySelectorAll('.s');
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        // Special inits
        if (e.target.id === 'sResults') startCounters();
        if (e.target.id === 'sFinal') {
          convVisible = true;
          initConvergence();
        }
      }
    });
  }, { threshold: 0.2 });
  sections.forEach(s => sectionObs.observe(s));

  // ============================================================
  //  PROCESS PATHWAY — scroll-linked progress
  // ============================================================
  const processSection = document.getElementById('sProcess');
  const pathwayProgress = document.getElementById('pathwayProgress');
  const checkpoints = document.querySelectorAll('.checkpoint');

  function updatePathway() {
    if (!processSection) return;
    const rect = processSection.getBoundingClientRect();
    const sTop = -rect.top;
    const sHeight = rect.height - vh;
    const progress = clamp(sTop / Math.max(sHeight, 1), 0, 1);

    if (pathwayProgress) {
      if (window.innerWidth <= 768) {
        pathwayProgress.style.width = '100%';
        pathwayProgress.style.height = (progress * 100) + '%';
      } else {
        pathwayProgress.style.width = (progress * 100) + '%';
        pathwayProgress.style.height = '100%';
      }
    }

    checkpoints.forEach((cp, i) => {
      const threshold = i / (checkpoints.length - 1);
      if (progress >= threshold - 0.05) {
        cp.classList.add('active');
      }
    });
  }

  // ============================================================
  //  STAT COUNTERS
  // ============================================================
  let countersStarted = false;

  function startCounters() {
    if (countersStarted) return;
    countersStarted = true;

    const spheres = document.querySelectorAll('.stat-sphere');
    spheres.forEach(sphere => {
      const target = parseInt(sphere.dataset.statTarget, 10);
      const suffix = sphere.dataset.statSuffix || '';
      const numEl = sphere.querySelector('.stat-num');
      if (!numEl) return;

      const duration = 2000;
      const start = performance.now();

      function tick(now) {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = easeOutExpo(t);
        const current = Math.round(target * eased);
        const prefix = target === 24 ? '$' : '';
        numEl.textContent = prefix + current + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ============================================================
  //  MONOLITH FLOATING ANIMATION
  // ============================================================
  const monoliths = document.querySelectorAll('.monolith');
  const monoOffsets = Array.from(monoliths, () => rand(0, Math.PI * 2));

  function updateMonoliths(time) {
    monoliths.forEach((m, i) => {
      const phase = time * 0.0008 + monoOffsets[i];
      const yOff = Math.sin(phase) * 10;
      const rotX = Math.sin(phase * 0.7) * 1.5;
      const rotY = Math.cos(phase * 0.5) * 2;
      m.style.transform = `translateY(${yOff}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
  }

  // ============================================================
  //  SHOWCASE WALL — DRAG SCROLL
  // ============================================================
  const wallViewport = document.querySelector('.wall-viewport');
  if (wallViewport) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    wallViewport.addEventListener('mousedown', e => {
      isDragging = true;
      startX = e.pageX - wallViewport.offsetLeft;
      scrollLeft = wallViewport.scrollLeft;
    });

    wallViewport.addEventListener('mousemove', e => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - wallViewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      wallViewport.scrollLeft = scrollLeft - walk;
    });

    wallViewport.addEventListener('mouseup', () => isDragging = false);
    wallViewport.addEventListener('mouseleave', () => isDragging = false);

    // Mouse wheel horizontal scroll
    wallViewport.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        wallViewport.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // ============================================================
  //  HEADLINE WORD-BY-WORD REVEAL
  // ============================================================
  const headlineWords = document.querySelectorAll('.headline-word');
  headlineWords.forEach((word, i) => {
    word.style.opacity = '0';
    word.style.transform = 'translateY(20px)';
    word.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${2.4 + i * 0.1}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${2.4 + i * 0.1}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      word.style.opacity = '1';
      word.style.transform = 'translateY(0)';
    }));
  });

  // ============================================================
  //  CLICK RIPPLE
  // ============================================================
  if (!document.getElementById('rippleStyle')) {
    const style = document.createElement('style');
    style.id = 'rippleStyle';
    style.textContent = `@keyframes clickRipple{0%{width:0;height:0;opacity:1}100%{width:300px;height:300px;opacity:0}}`;
    document.head.appendChild(style);
  }

  document.addEventListener('click', e => {
    if (e.clientY > vh * 1.5) return;
    const r = document.createElement('div');
    r.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:0;height:0;border-radius:50%;border:1px solid rgba(192,132,252,0.3);box-shadow:0 0 20px rgba(168,85,247,0.1);pointer-events:none;z-index:1000;transform:translate(-50%,-50%);animation:clickRipple 1.2s cubic-bezier(0.16,1,0.3,1) forwards;`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 1200);
  });

  // ============================================================
  //  CONVERGENCE PROGRESS (scroll-linked for final section)
  // ============================================================
  function updateFinalProgress() {
    const finalSection = document.getElementById('sFinal');
    if (!finalSection) return;
    const rect = finalSection.getBoundingClientRect();
    convProgress = clamp(1 - rect.top / vh, 0, 1);
  }

  // ============================================================
  //  MAIN ANIMATION LOOP
  // ============================================================
  function animate(time) {
    // Smooth mouse
    mouse.x = lerp(mouse.x, mouse.tx, 0.06);
    mouse.y = lerp(mouse.y, mouse.ty, 0.06);

    // Global particles
    ctx.clearRect(0, 0, vw, vh);
    for (const p of particles) { p.update(); p.draw(); }

    // Systems
    updateLensGlow();
    updateArc();
    updateDepth();
    updateHeroScroll();
    updatePathway();
    updateMonoliths(time);
    updateFinalProgress();
    updateConvergence();

    requestAnimationFrame(animate);
  }

  // ============================================================
  //  RESIZE
  // ============================================================
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      resizeCanvas();
      if (convVisible) initConvergence();
    }, 150);
  });

  // ============================================================
  //  INIT
  // ============================================================
  requestAnimationFrame(animate);

})();
