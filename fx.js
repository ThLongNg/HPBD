(() => {
  "use strict";

  const prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (prefersReducedMotion) return;

  const cfg = (window.APP_CONFIG && typeof window.APP_CONFIG === "object") ? window.APP_CONFIG : {};
  const rainCfg = (cfg.backgroundRain && typeof cfg.backgroundRain === "object") ? cfg.backgroundRain : {};
  const cursorCfg = (cfg.cursorHearts && typeof cfg.cursorHearts === "object") ? cfg.cursorHearts : {};

  const rainEnabled = rainCfg.enabled !== false;
  const cursorEnabled = cursorCfg.enabled !== false;

  const canvas = document.getElementById("fx") || (() => {
    const c = document.createElement("canvas");
    c.id = "fx";
    c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    return c;
  })();

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function resize() {
    w = Math.max(1, Math.floor(window.innerWidth));
    h = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawHeartFilled(x, y, size, rot, rgba) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size, size);
    ctx.fillStyle = rgba;
    ctx.beginPath();
    ctx.moveTo(0, 0.30);
    ctx.bezierCurveTo(0.55, -0.12, 1.08, 0.34, 0, 1.10);
    ctx.bezierCurveTo(-1.08, 0.34, -0.55, -0.12, 0, 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ----- Background rain (soft streak-hearts) -----
  const rain = [];
  const rainCount = rainEnabled ? clamp(Math.floor(rainCfg.count ?? 70), 0, 600) : 0;
  const rainAlphaMin = clamp(Number(rainCfg.alphaMin ?? 0.03), 0, 1);
  const rainAlphaMax = clamp(Number(rainCfg.alphaMax ?? 0.09), 0, 1);
  const rainLenMin = clamp(Number(rainCfg.lengthMin ?? 40), 5, 240);
  const rainLenMax = clamp(Number(rainCfg.lengthMax ?? 110), 5, 360);
  const rainSpeedMin = clamp(Number(rainCfg.speedMin ?? 200), 10, 2000);
  const rainSpeedMax = clamp(Number(rainCfg.speedMax ?? 400), 10, 2400);
  const rainWidthMin = clamp(Number(rainCfg.widthMin ?? 0.8), 0.4, 4);
  const rainWidthMax = clamp(Number(rainCfg.widthMax ?? 1.6), 0.4, 6);
  const rainAngleDeg = clamp(Number(rainCfg.angleDeg ?? 10), -65, 65);
  const rainAngle = (rainAngleDeg * Math.PI) / 180;

  const rainColors = [
    [255, 170, 220],
    [190, 175, 255]
  ];

  function spawnRain(drop, initial) {
    drop.x = rand(0, w);
    drop.y = initial ? rand(0, h) : -rand(20, h * 0.25);
    drop.len = rand(rainLenMin, rainLenMax);
    drop.width = rand(rainWidthMin, rainWidthMax);
    drop.speed = rand(rainSpeedMin, rainSpeedMax);
    drop.alpha = rand(rainAlphaMin, rainAlphaMax);
    const c = rainColors[(Math.random() * rainColors.length) | 0];
    drop.r = c[0];
    drop.g = c[1];
    drop.b = c[2];
  }

  for (let i = 0; i < rainCount; i++) {
    const drop = {};
    spawnRain(drop, true);
    rain.push(drop);
  }

  function updateRain(dt) {
    if (!rainEnabled || rain.length === 0) return;

    const vx = Math.sin(rainAngle) * 0.35;
    const vy = Math.cos(rainAngle);

    for (const d of rain) {
      d.x += (d.speed * vx) * dt;
      d.y += (d.speed * vy) * dt;

      if (d.y > h + d.len + 30 || d.x < -100 || d.x > w + 100) {
        spawnRain(d, false);
      }
    }
  }

  function drawRain() {
    if (!rainEnabled || rain.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";

    const dx = Math.sin(rainAngle);
    const dy = Math.cos(rainAngle);

    for (const d of rain) {
      ctx.strokeStyle = `rgba(${d.r}, ${d.g}, ${d.b}, ${d.alpha})`;
      ctx.lineWidth = d.width;
      const x2 = d.x - dx * d.len;
      const y2 = d.y - dy * d.len;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // tiny heart head
      const a = d.alpha * 1.15;
      drawHeartFilled(d.x, d.y, d.width * 2.0, rainAngle, `rgba(${d.r}, ${d.g}, ${d.b}, ${clamp(a, 0, 1)})`);
    }

    ctx.restore();
  }

  // ----- Cursor hearts -----
  const cursorHearts = [];
  const maxCount = clamp(Math.floor(cursorCfg.maxCount ?? 120), 0, 600);
  const minDistance = clamp(Number(cursorCfg.minDistance ?? 12), 0, 80);
  const minIntervalMs = clamp(Number(cursorCfg.minIntervalMs ?? 12), 0, 250);
  const baseAlpha = clamp(Number(cursorCfg.alpha ?? 0.85), 0, 1);
  const sizeMin = clamp(Number(cursorCfg.sizeMin ?? 1.0), 0.4, 28);
  const sizeMax = clamp(Number(cursorCfg.sizeMax ?? 2.0), 0.4, 32);
  const fallSpeedMin = clamp(Number(cursorCfg.fallSpeedMin ?? 90), 10, 1200);
  const fallSpeedMax = clamp(Number(cursorCfg.fallSpeedMax ?? 180), 10, 1600);
  const gravity = clamp(Number(cursorCfg.gravity ?? 320), 0, 2400);
  const driftX = clamp(Number(cursorCfg.driftX ?? 40), 0, 420);
  const spin = clamp(Number(cursorCfg.spin ?? 1.6), 0, 12);
  const lifeMs = clamp(Number(cursorCfg.lifeMs ?? 1600), 150, 8000);
  const maxFallDistance = clamp(Number(cursorCfg.maxFallDistance ?? 180), 20, 900);

  let lastX = 0;
  let lastY = 0;
  let hasPos = false;
  let lastSpawn = 0;

  function spawnCursorHeart(x, y) {
    if (!cursorEnabled || maxCount <= 0) return;

    const now = performance.now();
    if (now - lastSpawn < minIntervalMs) return;

    if (hasPos) {
      const dx = x - lastX;
      const dy = y - lastY;
      if (Math.hypot(dx, dy) < minDistance) return;
    }

    lastSpawn = now;
    lastX = x;
    lastY = y;
    hasPos = true;

    const size = rand(sizeMin, sizeMax);
    const c = rainColors[(Math.random() * rainColors.length) | 0];

    cursorHearts.push({
      x,
      y,
      x0: x,
      y0: y,
      vx: rand(-driftX, driftX),
      vy: rand(fallSpeedMin, fallSpeedMax),
      g: gravity,
      size,
      rot: rand(0, Math.PI * 2),
      spin: rand(-spin, spin),
      a: baseAlpha,
      r: c[0],
      gC: c[1],
      b: c[2],
      born: now,
      life: lifeMs
    });

    if (cursorHearts.length > maxCount) cursorHearts.splice(0, cursorHearts.length - maxCount);
  }

  function updateCursorHearts(dt) {
    if (!cursorEnabled || cursorHearts.length === 0) return;
    const now = performance.now();

    for (let i = cursorHearts.length - 1; i >= 0; i--) {
      const p = cursorHearts[i];
      const age = now - p.born;
      const t = clamp(age / p.life, 0, 1);

      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;

      const fallDist = p.y - p.y0;
      const fadeByFall = 1 - clamp(fallDist / maxFallDistance, 0, 1);
      const fadeByLife = 1 - t;
      const a = p.a * Math.min(fadeByFall, fadeByLife);
      p._a = a;

      if (t >= 1 || a <= 0.001) {
        cursorHearts.splice(i, 1);
      }
    }
  }

  function drawCursorHearts() {
    if (!cursorEnabled || cursorHearts.length === 0) return;

    for (const p of cursorHearts) {
      const a = clamp(p._a ?? p.a, 0, 1);
      drawHeartFilled(p.x, p.y, p.size, p.rot, `rgba(${p.r}, ${p.gC}, ${p.b}, ${a})`);
    }
  }

  function onPointerMove(e) {
    // Use client coords; canvas is full screen
    spawnCursorHeart(e.clientX, e.clientY);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // ----- Main loop -----
  let lastTs = performance.now();

  function frame(ts) {
    const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
    lastTs = ts;

    ctx.clearRect(0, 0, w, h);

    updateRain(dt);
    drawRain();

    updateCursorHearts(dt);
    drawCursorHearts();

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(frame);
})();
