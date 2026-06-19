/* ============================================================
   AURALIS PORTAL EXPERIENCE SYSTEM
   Each service card expands into an immersive cinematic world.
   ============================================================ */

(function () {
  'use strict';

  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  // ── State ──
  const pmouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let activeWorld = null;
  let worldRaf = null;
  let isOpen = false;
  let activeCard = null;
  let worldSpeed = 1.0;

  // ── DOM ──
  const overlay = document.getElementById('portalOverlay');
  const backdrop = document.getElementById('portalBackdrop');
  const closeBtn = document.getElementById('portalCloseBtn');
  const portals = document.querySelectorAll('.portal[data-portal]');

  // ── Mouse tracking inside overlay ──
  overlay.addEventListener('mousemove', e => {
    pmouse.tx = e.clientX / window.innerWidth;
    pmouse.ty = e.clientY / window.innerHeight;
  });

  // ============================================================
  //  EXPANSION SYSTEM
  // ============================================================
  function openPortal(portalCard) {
    const portalType = portalCard.dataset.portal;
    const rect = portalCard.getBoundingClientRect();
    activeCard = portalCard;
    worldSpeed = 6.0;

    // Lock scroll
    document.body.classList.add('portal-locked');
    portalCard.classList.add('is-activating');

    // Create phantom that expands from card to full screen
    const phantom = document.createElement('div');
    phantom.className = 'portal-phantom';
    phantom.style.top = rect.top + 'px';
    phantom.style.left = rect.left + 'px';
    phantom.style.width = rect.width + 'px';
    phantom.style.height = rect.height + 'px';
    document.body.appendChild(phantom);

    // Force layout
    phantom.offsetHeight;

    // Expand to full screen
    requestAnimationFrame(() => {
      phantom.classList.add('expanded');
      phantom.style.top = '0';
      phantom.style.left = '0';
      phantom.style.width = '100vw';
      phantom.style.height = '100vh';
    });

    // After phantom expands, show overlay and activate world
    setTimeout(() => {
      overlay.classList.add('is-open');
      const world = document.getElementById('pw' + capitalize(portalType));
      if (world) {
        world.classList.add('is-active');
        activeWorld = portalType;

        // Initialize the world
        initWorld(portalType, world);

        // Reveal content
        setTimeout(() => {
          world.classList.add('is-revealed');
        }, 200);
      }

      // Remove phantom after overlay is visible
      setTimeout(() => {
        phantom.remove();
      }, 400);
    }, 700);

    isOpen = true;
  }

  function closePortal() {
    if (!isOpen || !activeCard) return;

    const world = document.querySelector('.portal-world.is-active');
    if (world) {
      world.classList.remove('is-revealed');
    }

    const rect = activeCard.getBoundingClientRect();

    // Create phantom at full screen
    const phantom = document.createElement('div');
    phantom.className = 'portal-phantom expanded';
    phantom.style.top = '0';
    phantom.style.left = '0';
    phantom.style.width = '100vw';
    phantom.style.height = '100vh';
    document.body.appendChild(phantom);

    // Force reflow
    phantom.offsetHeight;

    // Immediately close overlay and active world behind the phantom
    overlay.classList.remove('is-open');
    if (world) {
      world.classList.remove('is-active');
      destroyWorld();
      activeWorld = null;
    }

    // Shrink phantom back to card location
    requestAnimationFrame(() => {
      phantom.classList.remove('expanded');
      phantom.style.top = rect.top + 'px';
      phantom.style.left = rect.left + 'px';
      phantom.style.width = rect.width + 'px';
      phantom.style.height = rect.height + 'px';
    });

    // Clean up phantom after transition
    setTimeout(() => {
      phantom.remove();
      document.body.classList.remove('portal-locked');
      if (activeCard) {
        activeCard.classList.remove('is-activating');
        activeCard = null;
      }
    }, 950);

    isOpen = false;
  }

  function capitalize(s) {
    const map = { web: 'Web', ai: 'AI', brand: 'Brand', dev: 'Dev' };
    return map[s] || s;
  }

  // ── Click handlers ──
  portals.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isOpen) openPortal(card);
    });
  });

  closeBtn.addEventListener('click', closePortal);
  backdrop.addEventListener('click', closePortal);

  overlay.addEventListener('click', (e) => {
    // If the click lands on the backdrop, the world container, the canvas, or the empty content margin area
    if (e.target === overlay || e.target === backdrop || e.target.classList.contains('pw-canvas') || e.target.classList.contains('portal-world') || e.target.classList.contains('pw-content')) {
      closePortal();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closePortal();
  });

  // ============================================================
  //  WORLD INITIALIZATION
  // ============================================================
  function initWorld(type, worldEl) {
    const canvas = worldEl.querySelector('.pw-canvas');
    if (!canvas) return;

    const c = canvas.getContext('2d');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    switch (type) {
      case 'web': startWebWorld(worldEl, c, w, h); break;
      case 'ai': startAIWorld(c, w, h); break;
      case 'brand': startBrandWorld(c, w, h); break;
      case 'dev': startDevWorld(c, w, h); break;
    }
  }

  function destroyWorld() {
    if (worldRaf) {
      cancelAnimationFrame(worldRaf);
      worldRaf = null;
    }
  }

  // ============================================================
  //  WEB EXPERIENCES WORLD
  //  Particles + assembling website mockup (DOM-driven)
  // ============================================================
  function startWebWorld(worldEl, c, w, h) {
    // Background particles
    const particles = Array.from({ length: 80 }, () => ({
      x: rand(0, w), y: rand(0, h),
      vx: rand(-0.3, 0.3), vy: rand(-0.5, -0.1),
      size: rand(0.5, 2), opacity: rand(0.05, 0.2),
      hue: rand(260, 300)
    }));

    // Assemble the website pieces with staggered timing
    const pieces = worldEl.querySelectorAll('.as-piece');
    pieces.forEach((piece, i) => {
      setTimeout(() => piece.classList.add('built'), 800 + i * 350);
    });

    const orbitRing = worldEl.querySelector('.pw-orbit-ring');
    let orbitAngle = 0;

    function frame() {
      c.clearRect(0, 0, w, h);
      worldSpeed = lerp(worldSpeed, 1.0, 0.03);

      pmouse.x = lerp(pmouse.x, pmouse.tx, 0.05);
      pmouse.y = lerp(pmouse.y, pmouse.ty, 0.05);

      for (const p of particles) {
        p.x += (p.vx + (pmouse.x - 0.5) * 0.3) * worldSpeed;
        p.y += p.vy * worldSpeed;
        if (p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fillStyle = `hsla(${p.hue},60%,70%,${p.opacity})`;
        c.fill();
      }

      orbitAngle += 0.002 * worldSpeed;
      if (orbitRing) {
        orbitRing.style.transform = `rotate(${orbitAngle}rad)`;
      }

      // Central glow
      const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 400);
      grd.addColorStop(0, 'rgba(168,85,247,0.04)');
      grd.addColorStop(1, 'transparent');
      c.fillStyle = grd;
      c.fillRect(0, 0, w, h);

      worldRaf = requestAnimationFrame(frame);
    }
    frame();
  }

  // ============================================================
  //  AI SYSTEMS WORLD
  //  Neural network: nodes, connections, energy pulses
  // ============================================================
  function startAIWorld(c, w, h) {
    const nodeCount = 120;
    const connectionDist = 160;

    // Create nodes
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: rand(50, w - 50),
      y: rand(50, h - 50),
      baseX: 0, baseY: 0,
      size: rand(1.5, 4),
      activation: 0,
      targetActivation: 0,
      phase: rand(0, Math.PI * 2),
      speed: rand(0.005, 0.015)
    }));
    nodes.forEach(n => { n.baseX = n.x; n.baseY = n.y; });

    // Precompute connections
    const connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        if (d < connectionDist) {
          connections.push({ a: i, b: j, dist: d });
        }
      }
    }

    // Energy pulses
    const pulses = [];
    let pulseTimer = 0;

    function spawnPulse() {
      if (connections.length === 0) return;
      const conn = connections[Math.floor(rand(0, connections.length))];
      const a = nodes[conn.a];
      const b = nodes[conn.b];
      pulses.push({
        x: a.x, y: a.y,
        tx: b.x, ty: b.y,
        progress: 0,
        speed: rand(0.01, 0.03),
        size: rand(1.5, 3),
        opacity: rand(0.3, 0.7)
      });
    }

    function frame(time) {
      c.clearRect(0, 0, w, h);
      worldSpeed = lerp(worldSpeed, 1.0, 0.03);

      pmouse.x = lerp(pmouse.x, pmouse.tx, 0.04);
      pmouse.y = lerp(pmouse.y, pmouse.ty, 0.04);

      const mx = pmouse.x * w;
      const my = pmouse.y * h;

      // Update nodes
      for (const n of nodes) {
        n.phase += n.speed * worldSpeed;
        n.x = n.baseX + Math.sin(n.phase) * 3 + (pmouse.x - 0.5) * 15;
        n.y = n.baseY + Math.cos(n.phase * 0.7) * 3 + (pmouse.y - 0.5) * 10;

        // Mouse proximity activation
        const d = dist(mx, my, n.x, n.y);
        n.targetActivation = d < 200 ? 1 - d / 200 : 0;
        n.activation = lerp(n.activation, n.targetActivation, 0.08);
      }

      // Draw connections
      for (const conn of connections) {
        const a = nodes[conn.a];
        const b = nodes[conn.b];
        const avgAct = (a.activation + b.activation) / 2;
        const alpha = 0.03 + avgAct * 0.15;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.strokeStyle = `rgba(168,85,247,${alpha})`;
        c.lineWidth = 0.5 + avgAct;
        c.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const glow = n.activation;
        // Outer glow
        if (glow > 0.1) {
          c.beginPath();
          c.arc(n.x, n.y, n.size * 6, 0, Math.PI * 2);
          c.fillStyle = `rgba(192,132,252,${glow * 0.08})`;
          c.fill();
        }
        // Core
        c.beginPath();
        c.arc(n.x, n.y, n.size * (1 + glow * 0.5), 0, Math.PI * 2);
        const brightness = 40 + glow * 50;
        c.fillStyle = `hsla(270,70%,${brightness}%,${0.3 + glow * 0.7})`;
        c.fill();
      }

      // Spawn & update pulses
      pulseTimer++;
      const pulseInterval = worldSpeed > 1.5 ? 1 : 8;
      if (pulseTimer % pulseInterval === 0) spawnPulse();

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed * worldSpeed;
        if (p.progress >= 1) { pulses.splice(i, 1); continue; }
        p.x = lerp(p.x, p.tx, p.speed * 3 * worldSpeed);
        p.y = lerp(p.y, p.ty, p.speed * 3 * worldSpeed);

        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fillStyle = `rgba(216,180,254,${p.opacity * (1 - p.progress)})`;
        c.fill();

        // Trail
        c.beginPath();
        c.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        c.fillStyle = `rgba(192,132,252,${p.opacity * 0.15 * (1 - p.progress)})`;
        c.fill();
      }

      // Central haze
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 350);
      g.addColorStop(0, 'rgba(139,92,246,0.05)');
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      worldRaf = requestAnimationFrame(frame);
    }
    frame(0);
  }

  // ============================================================
  //  BRAND IDENTITY WORLD
  //  Floating shapes, typography fragments, mouse-driven reorganization
  // ============================================================
  function startBrandWorld(c, w, h) {
    const cx = w / 2, cy = h / 2;

    // Floating shapes
    const shapes = [];
    const shapeTypes = ['circle', 'rect', 'triangle', 'line', 'ring'];
    const colors = [
      'rgba(232,121,249,', 'rgba(192,132,252,', 'rgba(168,85,247,',
      'rgba(244,114,182,', 'rgba(216,180,254,'
    ];

    for (let i = 0; i < 50; i++) {
      shapes.push({
        type: shapeTypes[Math.floor(rand(0, shapeTypes.length))],
        x: rand(0, w), y: rand(0, h),
        homeX: rand(0, w), homeY: rand(0, h),
        size: rand(8, 50),
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.01, 0.01),
        color: colors[Math.floor(rand(0, colors.length))],
        opacity: rand(0.05, 0.25),
        phase: rand(0, Math.PI * 2),
        driftSpeed: rand(0.003, 0.01),
        mouseReact: rand(30, 120)
      });
    }

    // Text fragments
    const texts = ['A', 'AURALIS', 'Aa', 'Tt', '◆', '●', '▲', '—'];
    const textShapes = texts.map((txt, i) => ({
      text: txt,
      x: rand(w * 0.2, w * 0.8),
      y: rand(h * 0.2, h * 0.8),
      homeX: rand(w * 0.2, w * 0.8),
      homeY: rand(h * 0.2, h * 0.8),
      size: rand(12, 36),
      opacity: rand(0.06, 0.15),
      phase: rand(0, Math.PI * 2),
      driftSpeed: rand(0.004, 0.012)
    }));

    function frame() {
      c.clearRect(0, 0, w, h);
      worldSpeed = lerp(worldSpeed, 1.0, 0.03);

      pmouse.x = lerp(pmouse.x, pmouse.tx, 0.04);
      pmouse.y = lerp(pmouse.y, pmouse.ty, 0.04);

      const mx = pmouse.x * w;
      const my = pmouse.y * h;

      // Draw shapes
      for (const s of shapes) {
        s.phase += s.driftSpeed * worldSpeed;
        s.rotation += s.rotSpeed * worldSpeed;

        // Drift around home
        let targetX = s.homeX + Math.sin(s.phase) * 30;
        let targetY = s.homeY + Math.cos(s.phase * 0.8) * 20;

        // Mouse repulsion
        const d = dist(mx, my, s.x, s.y);
        if (d < s.mouseReact) {
          const angle = Math.atan2(s.y - my, s.x - mx);
          const force = (s.mouseReact - d) / s.mouseReact;
          targetX += Math.cos(angle) * force * 80;
          targetY += Math.sin(angle) * force * 80;
        }

        s.x = lerp(s.x, targetX, 0.03 * worldSpeed);
        s.y = lerp(s.y, targetY, 0.03 * worldSpeed);

        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.rotation);
        c.globalAlpha = s.opacity;

        const col = s.color + s.opacity + ')';

        switch (s.type) {
          case 'circle':
            c.beginPath();
            c.arc(0, 0, s.size, 0, Math.PI * 2);
            c.fillStyle = s.color + s.opacity + ')';
            c.fill();
            break;
          case 'rect':
            c.fillStyle = s.color + s.opacity + ')';
            c.fillRect(-s.size / 2, -s.size / 2, s.size, s.size * 0.7);
            break;
          case 'triangle':
            c.beginPath();
            c.moveTo(0, -s.size / 2);
            c.lineTo(s.size / 2, s.size / 2);
            c.lineTo(-s.size / 2, s.size / 2);
            c.closePath();
            c.fillStyle = s.color + s.opacity + ')';
            c.fill();
            break;
          case 'line':
            c.beginPath();
            c.moveTo(-s.size, 0);
            c.lineTo(s.size, 0);
            c.strokeStyle = s.color + (s.opacity * 2) + ')';
            c.lineWidth = 1.5;
            c.stroke();
            break;
          case 'ring':
            c.beginPath();
            c.arc(0, 0, s.size, 0, Math.PI * 2);
            c.strokeStyle = s.color + s.opacity + ')';
            c.lineWidth = 1.5;
            c.stroke();
            break;
        }
        c.restore();
      }

      // Draw text fragments
      c.globalAlpha = 1;
      for (const t of textShapes) {
        t.phase += t.driftSpeed * worldSpeed;
        let tx = t.homeX + Math.sin(t.phase) * 20;
        let ty = t.homeY + Math.cos(t.phase * 0.6) * 15;

        const d = dist(mx, my, t.x || tx, t.y || ty);
        if (d < 150) {
          const angle = Math.atan2((t.y || ty) - my, (t.x || tx) - mx);
          const force = (150 - d) / 150;
          tx += Math.cos(angle) * force * 60;
          ty += Math.sin(angle) * force * 60;
        }

        t.x = lerp(t.x || tx, tx, 0.04 * worldSpeed);
        t.y = lerp(t.y || ty, ty, 0.04 * worldSpeed);

        c.font = `${t.size}px 'Outfit', sans-serif`;
        c.fillStyle = `rgba(216,180,254,${t.opacity})`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(t.text, t.x, t.y);
      }

      // Center glow
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 300);
      g.addColorStop(0, 'rgba(232,121,249,0.04)');
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      worldRaf = requestAnimationFrame(frame);
    }
    frame();
  }

  // ============================================================
  //  CUSTOM DEVELOPMENT WORLD
  //  Futuristic city: grid, rising buildings, data highways, clouds
  // ============================================================
  function startDevWorld(c, w, h) {
    const cx = w / 2;
    const horizon = h * 0.5;
    const vanishY = h * 0.32;

    // Buildings
    const buildings = [];
    for (let i = 0; i < 40; i++) {
      const bx = rand(-w * 0.6, w * 0.6);
      const bz = rand(0.1, 1);
      buildings.push({
        x: bx,
        z: bz,
        width: rand(15, 50) * bz,
        targetHeight: rand(40, 200) * bz,
        height: 0,
        hue: rand(250, 290),
        opacity: rand(0.08, 0.2) * bz,
        built: false,
        delay: rand(0, 2000)
      });
    }
    buildings.sort((a, b) => a.z - b.z); // Draw far first

    // Data highway dots
    const dataDots = Array.from({ length: 60 }, () => ({
      x: rand(-w, w * 2),
      y: horizon,
      speed: rand(0.5, 2) * (Math.random() > 0.5 ? 1 : -1),
      size: rand(1, 3),
      opacity: rand(0.1, 0.4),
      lane: Math.floor(rand(0, 5))
    }));

    // Cloud particles
    const clouds = Array.from({ length: 20 }, () => ({
      x: rand(0, w),
      y: rand(vanishY - 80, vanishY + 20),
      width: rand(60, 200),
      height: rand(10, 30),
      opacity: rand(0.02, 0.06),
      speed: rand(0.05, 0.2)
    }));

    const startTime = performance.now();

    function project(bx, bz) {
      // Simple perspective projection
      const scale = bz;
      const screenX = cx + bx * scale;
      const screenY = lerp(vanishY, horizon, scale);
      return { sx: screenX, sy: screenY, scale };
    }

    function frame(time) {
      worldSpeed = lerp(worldSpeed, 1.0, 0.03);
      const elapsed = (time - startTime) * worldSpeed;
      c.clearRect(0, 0, w, h);

      pmouse.x = lerp(pmouse.x, pmouse.tx, 0.04);
      pmouse.y = lerp(pmouse.y, pmouse.ty, 0.04);

      const mx = pmouse.x * w;

      // Dark gradient sky
      const sky = c.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, 'rgba(5,2,15,1)');
      sky.addColorStop(1, 'rgba(15,8,30,1)');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, horizon);

      // Ground gradient
      const ground = c.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, 'rgba(15,8,30,1)');
      ground.addColorStop(1, 'rgba(5,2,10,1)');
      c.fillStyle = ground;
      c.fillRect(0, horizon, w, h - horizon);

      // Grid lines (perspective)
      c.strokeStyle = 'rgba(129,140,248,0.04)';
      c.lineWidth = 0.5;
      // Horizontal grid lines
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const y = lerp(horizon, h, t);
        const spread = lerp(0, w * 1.5, t);
        c.beginPath();
        c.moveTo(cx - spread, y);
        c.lineTo(cx + spread, y);
        c.stroke();
      }
      // Vertical grid lines (perspective)
      for (let i = -10; i <= 10; i++) {
        const baseX = i * 80;
        c.beginPath();
        c.moveTo(cx, vanishY);
        c.lineTo(cx + baseX * 1.5, h);
        c.stroke();
      }

      // Draw clouds
      for (const cl of clouds) {
        cl.x += cl.speed * worldSpeed;
        if (cl.x > w + cl.width) cl.x = -cl.width;
        c.fillStyle = `rgba(139,92,246,${cl.opacity})`;
        c.beginPath();
        c.ellipse(cl.x, cl.y, cl.width / 2, cl.height / 2, 0, 0, Math.PI * 2);
        c.fill();
      }

      // Draw buildings
      for (const b of buildings) {
        // Animate rise
        if (elapsed > b.delay && b.height < b.targetHeight) {
          b.height = lerp(b.height, b.targetHeight, 0.03 * worldSpeed);
        }
        if (b.height < 1) continue;

        const { sx, sy, scale } = project(b.x + (pmouse.x - 0.5) * 30, b.z);
        const bw = b.width;
        const bh = b.height;

        // Building body
        const grad = c.createLinearGradient(sx, sy - bh, sx, sy);
        grad.addColorStop(0, `hsla(${b.hue},60%,20%,${b.opacity})`);
        grad.addColorStop(1, `hsla(${b.hue},50%,10%,${b.opacity * 0.5})`);
        c.fillStyle = grad;
        c.fillRect(sx - bw / 2, sy - bh, bw, bh);

        // Building edge glow (top)
        c.fillStyle = `hsla(${b.hue},70%,60%,${b.opacity * 0.5})`;
        c.fillRect(sx - bw / 2, sy - bh, bw, 1);

        // Window dots
        const windowRows = Math.floor(bh / 12);
        const windowCols = Math.max(2, Math.floor(bw / 10));
        for (let r = 0; r < windowRows; r++) {
          for (let col = 0; col < windowCols; col++) {
            if (Math.random() > 0.6) {
              const wx = sx - bw / 2 + (col + 0.5) * (bw / windowCols);
              const wy = sy - bh + (r + 0.5) * 12;
              c.fillStyle = `hsla(${b.hue + 30},50%,70%,${rand(0.05, 0.15)})`;
              c.fillRect(wx - 1, wy - 1, 2, 2);
            }
          }
        }
      }

      // Data highway dots
      for (const dot of dataDots) {
        dot.x += dot.speed * worldSpeed;
        if (dot.x > w * 1.5) dot.x = -w * 0.5;
        if (dot.x < -w * 0.5) dot.x = w * 1.5;

        const laneY = horizon + 5 + dot.lane * 8;
        c.beginPath();
        c.arc(dot.x, laneY, dot.size, 0, Math.PI * 2);
        c.fillStyle = `rgba(110,231,183,${dot.opacity})`;
        c.fill();

        // Trail
        c.beginPath();
        c.moveTo(dot.x, laneY);
        c.lineTo(dot.x - dot.speed * 8 * worldSpeed, laneY);
        c.strokeStyle = `rgba(110,231,183,${dot.opacity * 0.3})`;
        c.lineWidth = dot.size * 0.8;
        c.stroke();
      }

      // Atmospheric glow at horizon
      const hGlow = c.createRadialGradient(cx, horizon, 0, cx, horizon, 400);
      hGlow.addColorStop(0, 'rgba(129,140,248,0.06)');
      hGlow.addColorStop(1, 'transparent');
      c.fillStyle = hGlow;
      c.fillRect(0, horizon - 200, w, 400);

      worldRaf = requestAnimationFrame(frame);
    }
    frame(performance.now());
  }

  // ============================================================
  //  FLOATING NAV HIGHLIGHT & SCROLL EFFECTS
  // ============================================================
  const hoverPill = document.getElementById('navHoverPill');
  const navLinks = document.querySelectorAll('.nav-link');
  const navLinksWrap = document.querySelector('.nav-links-wrap');
  const mainNav = document.getElementById('mainNav');

  if (hoverPill && navLinksWrap) {
    navLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        const linkRect = link.getBoundingClientRect();
        const wrapRect = navLinksWrap.getBoundingClientRect();
        
        hoverPill.style.width = linkRect.width + 'px';
        hoverPill.style.height = linkRect.height + 'px';
        hoverPill.style.left = (linkRect.left - wrapRect.left) + 'px';
        hoverPill.style.top = (linkRect.top - wrapRect.top) + 'px';
        hoverPill.style.opacity = '1';
      });
    });

    navLinksWrap.addEventListener('mouseleave', () => {
      hoverPill.style.opacity = '0';
    });
  }

  window.addEventListener('scroll', () => {
    if (mainNav) {
      if (window.pageYOffset > 50 || document.documentElement.scrollTop > 50) {
        mainNav.classList.add('nav-scrolled');
      } else {
        mainNav.classList.remove('nav-scrolled');
      }
    }
  }, { passive: true });

})();
