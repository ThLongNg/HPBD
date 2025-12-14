(() => {
    "use strict";

    const canvas = document.getElementById("c");
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const APP_CONFIG = (window.APP_CONFIG && typeof window.APP_CONFIG === "object") ? window.APP_CONFIG : {};

    const params = new URLSearchParams(window.location.search);
    const nameFromUrl = (params.get("name") || "").trim();

    const cfgTextLines = Array.isArray(APP_CONFIG.textLines) ? APP_CONFIG.textLines : null;
    const fallbackName = (cfgTextLines && typeof cfgTextLines[1] === "string" && cfgTextLines[1].trim()) ? cfgTextLines[1].trim() : "ChizNguyen";
    const displayName = nameFromUrl || fallbackName;
    const textLines = [
        (cfgTextLines && typeof cfgTextLines[0] === "string" && cfgTextLines[0].trim()) ? cfgTextLines[0].trim() : "HAPPY BIRTHDAY",
        displayName
    ];

    // Fixed date from config (do not use current date)
    const cfgDay = APP_CONFIG.date && typeof APP_CONFIG.date.day === "number" ? APP_CONFIG.date.day : 14;
    const cfgMonth = APP_CONFIG.date && typeof APP_CONFIG.date.month === "number" ? APP_CONFIG.date.month : 12;
    const birthDay = clamp(Math.floor(cfgDay), 1, 31);
    const birthMonth = clamp(Math.floor(cfgMonth), 1, 12);
    const bg = "#00000060";

    const state = {
        targets: [],
        targetIndex: 0,
        particles: [],
        heartBackdrop: [],
        heartFlow: [],
        bgHeartIcons: [],
        bgRain: [],
        cursorHearts: [],
        cursorHasPos: false,
        cursorLastX: 0,
        cursorLastY: 0,
        cursorLastSpawnTs: 0,
        ambientFlow: [],
        textMaskAlpha: null,
        textMaskW: 0,
        textMaskH: 0,
        textMaskThresh: 24,
        candleAnchors: [],
        sideBoxes: null,
        sideKanjiMasks: null,
        sideNumMasks: null,
        spawnPerFrame: 18,
        gap: 6,
        lastTs: 0,
        spawnedTotal: 0
    };

    const particleCfg = (APP_CONFIG.particles && typeof APP_CONFIG.particles === "object") ? APP_CONFIG.particles : {};
    const bgHeartCfg = (APP_CONFIG.backgroundHearts && typeof APP_CONFIG.backgroundHearts === "object") ? APP_CONFIG.backgroundHearts : {};
    const bgRainCfg = (APP_CONFIG.backgroundRain && typeof APP_CONFIG.backgroundRain === "object") ? APP_CONFIG.backgroundRain : {};
    const cursorHeartCfg = (APP_CONFIG.cursorHearts && typeof APP_CONFIG.cursorHearts === "object") ? APP_CONFIG.cursorHearts : {};

    const prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const isCoarsePointer = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

    const cursorHeartsEnabled = (cursorHeartCfg.enabled !== false) && !prefersReducedMotion;
    const cursorHeartMaxCountBase = typeof cursorHeartCfg.maxCount === "number" ? clamp(Math.floor(cursorHeartCfg.maxCount), 0, 500) : 140;
    const cursorHeartMaxCount = isCoarsePointer ? Math.min(cursorHeartMaxCountBase, 90) : cursorHeartMaxCountBase;
    const cursorHeartMinDistance = typeof cursorHeartCfg.minDistance === "number" ? clamp(cursorHeartCfg.minDistance, 0, 80) : 10; // CSS px
    const cursorHeartMinIntervalMsBase = typeof cursorHeartCfg.minIntervalMs === "number" ? clamp(cursorHeartCfg.minIntervalMs, 0, 250) : 12;
    const cursorHeartMinIntervalMs = isCoarsePointer ? Math.max(cursorHeartMinIntervalMsBase, 16) : cursorHeartMinIntervalMsBase;
    const cursorHeartAlpha = typeof cursorHeartCfg.alpha === "number" ? clamp(cursorHeartCfg.alpha, 0, 1) : 0.85;
    const cursorHeartSizeMin = typeof cursorHeartCfg.sizeMin === "number" ? clamp(cursorHeartCfg.sizeMin, 0.4, 24.0) : 1.0;
    const cursorHeartSizeMax = typeof cursorHeartCfg.sizeMax === "number" ? clamp(cursorHeartCfg.sizeMax, 0.4, 28.0) : 2.0;
    const cursorHeartFallSpeedMin = typeof cursorHeartCfg.fallSpeedMin === "number" ? clamp(cursorHeartCfg.fallSpeedMin, 10, 900) : 90; // CSS px/sec
    const cursorHeartFallSpeedMax = typeof cursorHeartCfg.fallSpeedMax === "number" ? clamp(cursorHeartCfg.fallSpeedMax, 10, 1200) : 180;
    const cursorHeartGravity = typeof cursorHeartCfg.gravity === "number" ? clamp(cursorHeartCfg.gravity, 0, 2400) : 320; // CSS px/sec^2
    const cursorHeartDriftX = typeof cursorHeartCfg.driftX === "number" ? clamp(cursorHeartCfg.driftX, 0, 360) : 40; // CSS px/sec
    const cursorHeartSpin = typeof cursorHeartCfg.spin === "number" ? clamp(cursorHeartCfg.spin, 0, 10) : 1.6; // rad/sec
    const cursorHeartLifeMs = typeof cursorHeartCfg.lifeMs === "number" ? clamp(cursorHeartCfg.lifeMs, 150, 8000) : 1600;
    const cursorHeartMaxFallDistance = typeof cursorHeartCfg.maxFallDistance === "number" ? clamp(cursorHeartCfg.maxFallDistance, 20, 800) : (isCoarsePointer ? 140 : 180); // CSS px

    const speedMul = typeof particleCfg.speedMultiplier === "number" ? clamp(particleCfg.speedMultiplier, 0.6, 2.0) : 1.0;

    const densityCfg = (particleCfg.density && typeof particleCfg.density === "object") ? particleCfg.density : {};
    const density = {
        cake: typeof densityCfg.cake === "number" ? densityCfg.cake : 1.0,
        cakeEdge: typeof densityCfg.cakeEdge === "number" ? densityCfg.cakeEdge : 1.0,
        cakeInterior: typeof densityCfg.cakeInterior === "number" ? densityCfg.cakeInterior : 1.0,
        textGreeting: typeof densityCfg.textGreeting === "number" ? densityCfg.textGreeting : 1.0,
        textName: typeof densityCfg.textName === "number" ? densityCfg.textName : 1.0,
        sideKanji: typeof densityCfg.sideKanji === "number" ? densityCfg.sideKanji : 1.0,
        sideNum: typeof densityCfg.sideNum === "number" ? densityCfg.sideNum : 1.0,
        flame: typeof densityCfg.flame === "number" ? densityCfg.flame : 1.0
    };

    function hash01(ix, iy, seed) {
        // Deterministic pseudo-random in [0,1)
        let h = (Math.imul(ix ^ seed, 374761393) + Math.imul(iy ^ (seed * 3), 668265263)) | 0;
        h = (h ^ (h >>> 13)) | 0;
        h = Math.imul(h, 1274126177) | 0;
        h = (h ^ (h >>> 16)) >>> 0;
        return (h & 0x00ffffff) / 0x01000000;
    }

    function keepByProb(gx, gy, keepProb, seed) {
        if (keepProb >= 1) return true;
        if (keepProb <= 0) return false;
        return hash01(gx, gy, seed) < keepProb;
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function shuffleInPlace(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function hexToRgb(hex) {
        const h = hex.replace("#", "").trim();
        const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        const n = parseInt(full, 16);
        return {
            r: (n >> 16) & 255,
            g: (n >> 8) & 255,
            b: n & 255
        };
    }

    function fract(v) {
        return v - Math.floor(v);
    }

    function smoothstep(edge0, edge1, x) {
        const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    function computeHeartBackdropTargets() {
        // Rasterize a big heart silhouette and sample points for a faint particle backdrop
        const off = document.createElement("canvas");
        off.width = width;
        off.height = height;
        const octx = off.getContext("2d");
        if (!octx) return [];

        octx.clearRect(0, 0, width, height);
        octx.fillStyle = "#ffffff";

        const cx = width / 2;
        const cy = height * 0.43;
        const s = Math.min(width, height) * 0.40;

        octx.save();
        octx.translate(cx, cy);
        octx.beginPath();
        // Heart silhouette (filled)
        octx.moveTo(0, s * 0.28);
        octx.bezierCurveTo(s * 0.60, -s * 0.18, s * 1.20, s * 0.28, 0, s * 1.06);
        octx.bezierCurveTo(-s * 1.20, s * 0.28, -s * 0.60, -s * 0.18, 0, s * 0.28);
        octx.closePath();
        octx.fill();
        octx.restore();

        const img = octx.getImageData(0, 0, width, height);
        const data = img.data;

        const pts = [];
        const gap = clamp(Math.floor(Math.min(width, height) / 170), 5, 10);
        for (let y = 0; y < height; y += gap) {
            for (let x = 0; x < width; x += gap) {
                const idx = (y * width + x) * 4;
                if (data[idx + 3] > 18) pts.push({ x, y });
            }
        }

        return pts;
    }

    function drawTinyHeartFilled(ctx2d, x, y, size, rot) {
        ctx2d.save();
        ctx2d.translate(x, y);
        ctx2d.rotate(rot);
        ctx2d.scale(size, size);
        ctx2d.beginPath();
        ctx2d.moveTo(0, 0.30);
        ctx2d.bezierCurveTo(0.55, -0.12, 1.08, 0.34, 0, 1.10);
        ctx2d.bezierCurveTo(-1.08, 0.34, -0.55, -0.12, 0, 0.30);
        ctx2d.closePath();
        ctx2d.fill();
        ctx2d.restore();
    }

    function spawnCursorHeart(x, y) {
        if (!cursorHeartsEnabled) return;
        if (cursorHeartMaxCount <= 0) return;

        while (state.cursorHearts.length >= cursorHeartMaxCount) {
            state.cursorHearts.shift();
        }

        const sizeLo = Math.min(cursorHeartSizeMin, cursorHeartSizeMax);
        const sizeHi = Math.max(cursorHeartSizeMin, cursorHeartSizeMax);
        const speedLo = Math.min(cursorHeartFallSpeedMin, cursorHeartFallSpeedMax);
        const speedHi = Math.max(cursorHeartFallSpeedMin, cursorHeartFallSpeedMax);

        state.cursorHearts.push({
            x,
            y,
            y0: y,
            vx: (Math.random() - 0.5) * cursorHeartDriftX * dpr,
            vy: (speedLo + Math.random() * Math.max(0, speedHi - speedLo)) * dpr,
            g: cursorHeartGravity * dpr,
            s: (sizeLo + Math.random() * Math.max(0, sizeHi - sizeLo)) * dpr,
            rot: (Math.random() - 0.5) * 0.8,
            omega: (Math.random() - 0.5) * cursorHeartSpin * 2,
            a: cursorHeartAlpha,
            ageMs: 0,
            lifeMs: cursorHeartLifeMs * (0.75 + Math.random() * 0.55)
        });
    }

    function isInsideFlameMask(candle, x, y, ts, seed) {
        // Simple flickering flame volume (ellipse-ish), centered above candle top
        const t = ts * 0.001;
        const flick = 0.76 + 0.24 * Math.sin(t * (7.4 + seed * 0.5) + candle.phase);
        const cx = candle.x;
        const cy = candle.y - candle.r * (1.10 + 0.25 * flick);
        const rx = candle.r * (1.20 + 0.25 * (1 - flick));
        const ry = candle.r * (2.55 + 0.70 * flick);

        const dx = (x - cx) / Math.max(0.001, rx);
        const dy = (y - cy) / Math.max(0.001, ry);
        return dx * dx + dy * dy <= 1;
    }

    function initBackgroundLayers() {
        // Background heart icons (thin, random positions)
        state.bgHeartIcons.length = 0;
        state.bgRain.length = 0;

        // legacy arrays kept empty
        state.heartBackdrop.length = 0;
        state.heartFlow.length = 0;
        state.ambientFlow.length = 0;

        const area = (width * height) / (dpr * dpr);

        // Background falling hearts (replaces the old rain-like streaks)
        const rainEnabled = bgRainCfg.enabled !== false;
        const rainCount = rainEnabled
            ? clamp((typeof bgRainCfg.count === "number" ? Math.floor(bgRainCfg.count) : Math.floor(area / 9000)), 0, 520)
            : 0;

        const rainAlphaMin = typeof bgRainCfg.alphaMin === "number" ? clamp(bgRainCfg.alphaMin, 0, 0.22) : 0.03;
        const rainAlphaMax = typeof bgRainCfg.alphaMax === "number" ? clamp(bgRainCfg.alphaMax, 0, 0.30) : 0.09;
        const rainLenMin = typeof bgRainCfg.lengthMin === "number" ? clamp(bgRainCfg.lengthMin, 10, 340) : 40;
        const rainLenMax = typeof bgRainCfg.lengthMax === "number" ? clamp(bgRainCfg.lengthMax, 10, 520) : 110;
        const rainSpeedMin = typeof bgRainCfg.speedMin === "number" ? clamp(bgRainCfg.speedMin, 40, 1600) : 260;
        const rainSpeedMax = typeof bgRainCfg.speedMax === "number" ? clamp(bgRainCfg.speedMax, 40, 2200) : 650;
        const rainWidthMin = typeof bgRainCfg.widthMin === "number" ? clamp(bgRainCfg.widthMin, 0.5, 4.0) : 0.8;
        const rainWidthMax = typeof bgRainCfg.widthMax === "number" ? clamp(bgRainCfg.widthMax, 0.5, 6.0) : 1.6;
        const rainAngleDeg = typeof bgRainCfg.angleDeg === "number" ? clamp(bgRainCfg.angleDeg, -35, 35) : 10;
        const rainAngle = (rainAngleDeg * Math.PI) / 180;
        const rainDxPerDy = Math.tan(rainAngle);

        // Map the old "streak length" config into a sensible heart size range.
        // Default lengthMin/Max (40..110) becomes ~6..15px hearts.
        const heartSizeMul = 0.14;

        for (let i = 0; i < rainCount; i++) {
            const lenLo = Math.min(rainLenMin, rainLenMax);
            const lenHi = Math.max(rainLenMin, rainLenMax);
            const spLo = Math.min(rainSpeedMin, rainSpeedMax);
            const spHi = Math.max(rainSpeedMin, rainSpeedMax);
            const wLo = Math.min(rainWidthMin, rainWidthMax);
            const wHi = Math.max(rainWidthMin, rainWidthMax);
            const aLo = Math.min(rainAlphaMin, rainAlphaMax);
            const aHi = Math.max(rainAlphaMin, rainAlphaMax);

            const s = (lenLo + Math.random() * Math.max(0, lenHi - lenLo)) * heartSizeMul * dpr;
            const vy = (spLo + Math.random() * Math.max(0, spHi - spLo)) * dpr;
            const vx = vy * rainDxPerDy;
            state.bgRain.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx,
                vy,
                s,
                rot: (Math.random() - 0.5) * 1.2,
                // Use the old line-width config range as a proxy for spin strength
                omega: (Math.random() - 0.5) * (0.9 + 0.9 * ((wLo + Math.random() * Math.max(0, wHi - wLo)) / Math.max(0.001, wHi))),
                a: aLo + Math.random() * Math.max(0, aHi - aLo)
            });
        }
        const heartIconsEnabled = bgHeartCfg.enabled !== false;
        const heartIconCount = heartIconsEnabled
            ? clamp((typeof bgHeartCfg.count === "number" ? Math.floor(bgHeartCfg.count) : Math.floor(area / 26000)), 0, 220)
            : 0;
        const flowCount = clamp(Math.floor(area / 14000), 60, 240);

        const aMin = typeof bgHeartCfg.alphaMin === "number" ? clamp(bgHeartCfg.alphaMin, 0, 0.08) : 0.006;
        const aMax = typeof bgHeartCfg.alphaMax === "number" ? clamp(bgHeartCfg.alphaMax, 0, 0.10) : 0.015;
        const alphaLo = Math.min(aMin, aMax);
        const alphaHi = Math.max(aMin, aMax);

        for (let i = 0; i < heartIconCount; i++) {
            state.bgHeartIcons.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vy: (2.5 + Math.random() * 6.0) * dpr,
                vx: (Math.random() - 0.5) * 3.0 * dpr,
                s: (0.9 + Math.random() * 1.7) * dpr,
                a: alphaLo + Math.random() * Math.max(0, alphaHi - alphaLo),
                rot: (Math.random() - 0.5) * 0.9,
                phase: Math.random() * Math.PI * 2
            });
        }

        // Ambient flow: faint dots rising from bottom across whole screen
        for (let i = 0; i < flowCount; i++) {
            state.ambientFlow.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vy: (10 + Math.random() * 26) * dpr,
                vx: (Math.random() - 0.5) * 10 * dpr,
                r: (0.18 + Math.random() * 0.55) * dpr,
                alpha: 0.010 + Math.random() * 0.020,
                phase: Math.random() * Math.PI * 2,
                rot: (Math.random() - 0.5) * 0.8
            });
        }
    }

    function drawCakeSilhouette(octx, centerX, cakeTopY, cakeW, cakeH) {
        // More recognizable cake silhouette (plate + 3 tiers + frosting + decorations + candles)
        const x = centerX - cakeW / 2;
        const y = cakeTopY;
        const layerH = cakeH / 3;

        // Plate/base
        const plateW = cakeW * 1.12;
        const plateH = layerH * 0.38;
        const plateY = y + cakeH + plateH * 0.05;
        octx.beginPath();
        octx.ellipse(centerX, plateY, plateW / 2, plateH, 0, 0, Math.PI * 2);
        octx.fill();
        // small plate foot
        octx.beginPath();
        octx.ellipse(centerX, plateY + plateH * 0.55, plateW * 0.18, plateH * 0.35, 0, 0, Math.PI * 2);
        octx.fill();

        // Tier 1 (bottom)
        const r1 = Math.max(10 * dpr, cakeW * 0.10);
        octx.beginPath();
        roundRect(octx, x, y + layerH * 2, cakeW, layerH, r1);
        octx.fill();
        // Scalloped frosting line on tier 1
        const scallops1 = 10;
        const s1y = y + layerH * 2 + layerH * 0.18;
        for (let i = 0; i < scallops1; i++) {
            const sx = x + (cakeW * (i + 0.5)) / scallops1;
            octx.beginPath();
            octx.arc(sx, s1y, cakeW * 0.035, Math.PI, 0);
            octx.fill();
        }

        // Tier 2 (middle)
        const tier2X = x + cakeW * 0.08;
        const tier2W = cakeW * 0.84;
        const r2 = Math.max(10 * dpr, tier2W * 0.10);
        octx.beginPath();
        roundRect(octx, tier2X, y + layerH * 1.05, tier2W, layerH, r2);
        octx.fill();
        // Drips on tier 2
        const dripCount = 9;
        const dripW = tier2W / dripCount;
        const dripTop = y + layerH * 1.05;
        const dripBase = dripTop + layerH * 0.40;
        for (let i = 0; i < dripCount; i++) {
            const dx = tier2X + i * dripW;
            const dripH = layerH * (0.12 + (i % 3) * 0.08);
            octx.beginPath();
            octx.arc(dx + dripW * 0.5, dripBase, dripW * 0.32, Math.PI, 0);
            octx.fill();
            octx.fillRect(dx + dripW * 0.18, dripTop, dripW * 0.64, dripH);
        }

        // Tier 3 (top)
        const tier3X = x + cakeW * 0.18;
        const tier3W = cakeW * 0.64;
        const r3 = Math.max(10 * dpr, tier3W * 0.12);
        octx.beginPath();
        roundRect(octx, tier3X, y + layerH * 0.15, tier3W, layerH, r3);
        octx.fill();
        // Top frosting wave
        const waveY = y + layerH * 0.15;
        const waveCount = 11;
        for (let i = 0; i < waveCount; i++) {
            const wx = tier3X + (tier3W * (i + 0.5)) / waveCount;
            octx.beginPath();
            octx.arc(wx, waveY + layerH * 0.05, tier3W * 0.06, Math.PI, 0);
            octx.fill();
        }

        // Decorations (cherries) on top
        const cherryR = tier3W * 0.05;
        const cherries = 5;
        for (let i = 0; i < cherries; i++) {
            const cx = centerX + (i - (cherries - 1) / 2) * (tier3W * 0.14);
            const cy = y + layerH * 0.10;
            octx.beginPath();
            octx.ellipse(cx, cy, cherryR, cherryR * 0.95, 0, 0, Math.PI * 2);
            octx.fill();
        }

        // Multiple candles
        const candleCount = 3;
        const candleW = cakeW * 0.035;
        const candleH = cakeH * 0.30;
        const candleBaseY = y + layerH * 0.15 - candleH * 0.62;
        for (let i = 0; i < candleCount; i++) {
            const offset = (i - (candleCount - 1) / 2) * (candleW * 2.2);
            const candleX = centerX + offset - candleW / 2;
            octx.beginPath();
            roundRect(octx, candleX, candleBaseY, candleW, candleH, candleW * 0.55);
            octx.fill();

            const flameR = candleW * 0.75;
            octx.beginPath();
            octx.ellipse(centerX + offset, candleBaseY - flameR * 0.35, flameR, flameR * 1.25, 0, 0, Math.PI * 2);
            octx.fill();
        }
    }

    function roundRect(ctx2d, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx2d.moveTo(x + rr, y);
        ctx2d.arcTo(x + w, y, x + w, y + h, rr);
        ctx2d.arcTo(x + w, y + h, x, y + h, rr);
        ctx2d.arcTo(x, y + h, x, y, rr);
        ctx2d.arcTo(x, y, x + w, y, rr);
        ctx2d.closePath();
    }

    function computeTargets() {
        // Offscreen canvas for rasterizing cake + text into target points
        const off = document.createElement("canvas");
        off.width = width;
        off.height = height;
        const octx = off.getContext("2d");
        if (!octx) return [];

        octx.clearRect(0, 0, width, height);

        const centerX = width / 2;

        // Draw cake silhouette (top half)
        octx.fillStyle = "#ffffff";
        const cakeW = clamp(Math.floor(Math.min(width, height) * 0.46), 220 * dpr, 560 * dpr);
        const cakeH = clamp(Math.floor(Math.min(width, height) * 0.30), 140 * dpr, 360 * dpr);
        const cakeTopY = clamp(Math.floor(height * 0.16), 40 * dpr, Math.floor(height * 0.28));
        const cakeBottomY = cakeTopY + cakeH;
        const cakeLayerH = cakeH / 3;
        drawCakeSilhouette(octx, centerX, cakeTopY, cakeW, cakeH);

        // Precompute candle anchors (used to tag flame particles)
        {
            const x = centerX - cakeW / 2;
            const y = cakeTopY;
            const layerH = cakeH / 3;
            const candleCount = 3;
            const candleW = cakeW * 0.035;
            const candleH = cakeH * 0.30;
            const candleBaseY = y + layerH * 0.15 - candleH * 0.62;

            state.candleAnchors.length = 0;
            for (let i = 0; i < candleCount; i++) {
                const offset = (i - (candleCount - 1) / 2) * (candleW * 2.2);
                const cx = centerX + offset;
                const cy = candleBaseY;
                state.candleAnchors.push({
                    x: cx,
                    y: cy,
                    r: Math.max(1.8 * dpr, candleW * 0.55),
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        // Draw text (lower half)
        const fontSize = clamp(Math.floor(Math.min(width, height) * 0.11), 34, 120);
        const nameSize = clamp(Math.floor(fontSize * 0.95), 30, 110);
        const lineGap = Math.floor(fontSize * 1.1);
        const totalH = (textLines.length - 1) * lineGap;

        octx.textAlign = "center";
        octx.textBaseline = "middle";
        octx.fillStyle = "#ffffff";

        const textCenterY = clamp(Math.floor(height * 0.72), Math.floor(height * 0.62), Math.floor(height * 0.82));
        const line1Y = textCenterY - totalH / 2;
        const line2Y = textCenterY - totalH / 2 + lineGap;
        // line 1
        octx.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText(textLines[0], centerX, line1Y);
        // line 2 (name)
        octx.font = `900 ${nameSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText(textLines[1], centerX, line2Y);

        // Side date texts (these sit around the cake area, so we tag them via bounding boxes)
        // On small/mobile screens the big numeric day/month can get clipped off-screen, so:
        // - reduce numeric scale on coarse pointers
        // - clamp X positions based on measured text widths
        const sideBig = clamp(Math.floor(Math.min(width, height) * 0.10), 26, 110);
        const sideNumMul = isCoarsePointer ? 1.65 : 2.15;
        const sideNumMax = isCoarsePointer ? 170 : 230;
        const sideNum = clamp(Math.floor(sideBig * sideNumMul), 24, sideNumMax);
        const sideTopY = clamp(Math.floor(height * 0.24), Math.floor(height * 0.18), Math.floor(height * 0.34));
        const sideGap = Math.floor(Math.max(sideBig * 1.10, sideNum * 0.95));

        // Measure widths for safe layout
        octx.font = `900 ${sideBig}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        const mKanji = octx.measureText("日");
        const mKanji2 = octx.measureText("月");
        octx.font = `900 ${sideNum}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        const mDay = octx.measureText(String(birthDay));
        const mMonth = octx.measureText(String(birthMonth));

        const leftW = Math.max(mKanji.width, mDay.width) + sideBig * 0.46;
        const rightW = Math.max(mKanji2.width, mMonth.width) + sideBig * 0.46;
        const boxH = sideGap + Math.max(sideBig, sideNum) * 0.95;

        const marginX = Math.max(12 * dpr, sideBig * 0.45);
        const midX = width / 2;

        let leftX = Math.floor(width * (isCoarsePointer ? 0.22 : 0.16));
        let rightX = Math.floor(width * (isCoarsePointer ? 0.78 : 0.84));

        leftX = clamp(leftX, Math.floor(leftW / 2 + marginX), Math.floor(midX - marginX));
        rightX = clamp(rightX, Math.floor(midX + marginX), Math.floor(width - rightW / 2 - marginX));

        // If the screen is extremely narrow, fall back to a symmetric layout.
        if (!(leftX < rightX)) {
            leftX = Math.floor(width * 0.26);
            rightX = Math.floor(width * 0.74);
        }

        // Left: 日 + day
        octx.font = `900 ${sideBig}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText("日", leftX, sideTopY);
        octx.font = `900 ${sideNum}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText(String(birthDay), leftX, sideTopY + sideGap);

        // Right: 月 + month
        octx.font = `900 ${sideBig}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText("月", rightX, sideTopY);
        octx.font = `900 ${sideNum}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
        octx.fillText(String(birthMonth), rightX, sideTopY + sideGap);

        const kanjiH = sideBig * 1.25;
        const numH = sideNum * 1.10;
        state.sideBoxes = {
            day: {
                minX: leftX - leftW / 2,
                maxX: leftX + leftW / 2,
                minY: sideTopY - sideBig * 0.65,
                maxY: sideTopY - sideBig * 0.65 + boxH
            },
            month: {
                minX: rightX - rightW / 2,
                maxX: rightX + rightW / 2,
                minY: sideTopY - sideBig * 0.65,
                maxY: sideTopY - sideBig * 0.65 + boxH
            },
            dayKanji: {
                minX: leftX - leftW / 2,
                maxX: leftX + leftW / 2,
                minY: sideTopY - kanjiH / 2,
                maxY: sideTopY + kanjiH / 2
            },
            dayNum: {
                minX: leftX - leftW / 2,
                maxX: leftX + leftW / 2,
                minY: (sideTopY + sideGap) - numH / 2,
                maxY: (sideTopY + sideGap) + numH / 2
            },
            monthKanji: {
                minX: rightX - rightW / 2,
                maxX: rightX + rightW / 2,
                minY: sideTopY - kanjiH / 2,
                maxY: sideTopY + kanjiH / 2
            },
            monthNum: {
                minX: rightX - rightW / 2,
                maxX: rightX + rightW / 2,
                minY: (sideTopY + sideGap) - numH / 2,
                maxY: (sideTopY + sideGap) + numH / 2
            }
        };

        // Build cropped alpha masks for side date glyphs so particles stay within outlines
        {
            const offSide = document.createElement("canvas");
            offSide.width = width;
            offSide.height = height;
            const kctx = offSide.getContext("2d");
            if (kctx) {
                kctx.clearRect(0, 0, width, height);
                kctx.textAlign = "center";
                kctx.textBaseline = "middle";
                kctx.fillStyle = "#ffffff";
                // Kanji
                kctx.font = `900 ${sideBig}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
                kctx.fillText("日", leftX, sideTopY);
                kctx.fillText("月", rightX, sideTopY);
                // Numbers
                kctx.font = `900 ${sideNum}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
                kctx.fillText(String(birthDay), leftX, sideTopY + sideGap);
                kctx.fillText(String(birthMonth), rightX, sideTopY + sideGap);

                const img = kctx.getImageData(0, 0, width, height).data;

                const cropMask = (box, thresh) => {
                    const minX = clamp(Math.floor(box.minX), 0, width);
                    const maxX = clamp(Math.ceil(box.maxX), 0, width);
                    const minY = clamp(Math.floor(box.minY), 0, height);
                    const maxY = clamp(Math.ceil(box.maxY), 0, height);
                    const w = Math.max(1, maxX - minX);
                    const h = Math.max(1, maxY - minY);
                    const alpha = new Uint8Array(w * h);
                    for (let yy = 0; yy < h; yy++) {
                        const sy = minY + yy;
                        for (let xx = 0; xx < w; xx++) {
                            const sx = minX + xx;
                            alpha[yy * w + xx] = img[(sy * width + sx) * 4 + 3];
                        }
                    }
                    return { ox: minX, oy: minY, w, h, alpha, thresh };
                };

                state.sideKanjiMasks = {
                    day: cropMask(state.sideBoxes.dayKanji, 24),
                    month: cropMask(state.sideBoxes.monthKanji, 24)
                };

                state.sideNumMasks = {
                    day: cropMask(state.sideBoxes.dayNum, 24),
                    month: cropMask(state.sideBoxes.monthNum, 24)
                };
            } else {
                state.sideKanjiMasks = null;
                state.sideNumMasks = null;
            }
        }

        // Build a text-only alpha mask so text particles can move freely inside glyphs
        {
            const offText = document.createElement("canvas");
            offText.width = width;
            offText.height = height;
            const tctx = offText.getContext("2d");
            if (tctx) {
                tctx.clearRect(0, 0, width, height);
                tctx.textAlign = "center";
                tctx.textBaseline = "middle";
                tctx.fillStyle = "#ffffff";

                tctx.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
                tctx.fillText(textLines[0], centerX, line1Y);
                tctx.font = `900 ${nameSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial`;
                tctx.fillText(textLines[1], centerX, line2Y);

                const tImg = tctx.getImageData(0, 0, width, height);
                const alphaOnly = new Uint8Array(width * height);
                for (let i = 0, p = 3; i < alphaOnly.length; i++, p += 4) {
                    alphaOnly[i] = tImg.data[p];
                }
                state.textMaskAlpha = alphaOnly;
                state.textMaskW = width;
                state.textMaskH = height;
            } else {
                state.textMaskAlpha = null;
                state.textMaskW = 0;
                state.textMaskH = 0;
            }
        }

        // Name bounding box for reliable tagging (helps stability/brightness tuning)
        const nameMetrics = octx.measureText(textLines[1]);
        const nameHalfW = Math.max(20 * dpr, (nameMetrics.width || 0) / 2);
        const nameHalfH = nameSize * 0.75;
        const nameMinX = centerX - nameHalfW;
        const nameMaxX = centerX + nameHalfW;
        const nameMinY = line2Y - nameHalfH;
        const nameMaxY = line2Y + nameHalfH;

        // Bounds for layered text drift (used after assembly)
        const greetHalfH = fontSize * 0.75;
        const greetMinY = line1Y - greetHalfH;
        const greetMaxY = line1Y + greetHalfH;
        state.textFlowBounds = {
            minY: Math.min(greetMinY, nameMinY) - 6 * dpr,
            maxY: Math.max(greetMaxY, nameMaxY) + 6 * dpr
        };
        state.textFlowLayers = 7;

        const img = octx.getImageData(0, 0, width, height);
        const data = img.data;
        const targets = [];
        const totals = { cake: 0, text: 0, flame: 0, sideDay: 0, sideMonth: 0 };

        // Sample pixels and store target points
        const gap = state.gap;
        for (let y = 0; y < height; y += gap) {
            for (let x = 0; x < width; x += gap) {
                const idx = (y * width + x) * 4;
                const a = data[idx + 3];
                if (a <= 20) continue;

                 // Side texts must take precedence (they overlap the cake region in y)
                if (state.sideBoxes) {
                    const gx = (x / gap) | 0;
                    const gy = (y / gap) | 0;

                    // Kanji gets more particles than the number
                    const bDayK = state.sideBoxes.dayKanji;
                    if (x >= bDayK.minX && x <= bDayK.maxX && y >= bDayK.minY && y <= bDayK.maxY) {
                        const keep = clamp(0.50 * density.sideKanji, 0, 1);
                        if (keepByProb(gx, gy, keep, 101)) {
                            targets.push({ x, y, group: "sideDay", sidePart: "kanji" });
                            totals.sideDay++;
                        }
                        continue;
                    }
                    const bDayN = state.sideBoxes.dayNum;
                    if (x >= bDayN.minX && x <= bDayN.maxX && y >= bDayN.minY && y <= bDayN.maxY) {
                        const keep = clamp((1 / 3) * density.sideNum, 0, 1);
                        if (keepByProb(gx, gy, keep, 102)) {
                            targets.push({ x, y, group: "sideDay", sidePart: "num" });
                            totals.sideDay++;
                        }
                        continue;
                    }

                    const bMonthK = state.sideBoxes.monthKanji;
                    if (x >= bMonthK.minX && x <= bMonthK.maxX && y >= bMonthK.minY && y <= bMonthK.maxY) {
                        const keep = clamp(0.50 * density.sideKanji, 0, 1);
                        if (keepByProb(gx, gy, keep, 103)) {
                            targets.push({ x, y, group: "sideMonth", sidePart: "kanji" });
                            totals.sideMonth++;
                        }
                        continue;
                    }
                    const bMonthN = state.sideBoxes.monthNum;
                    if (x >= bMonthN.minX && x <= bMonthN.maxX && y >= bMonthN.minY && y <= bMonthN.maxY) {
                        const keep = clamp((1 / 3) * density.sideNum, 0, 1);
                        if (keepByProb(gx, gy, keep, 104)) {
                            targets.push({ x, y, group: "sideMonth", sidePart: "num" });
                            totals.sideMonth++;
                        }
                        continue;
                    }
                }

                // Separate cake vs main text for coloring
                const isCake = y <= cakeBottomY + gap * 2;
                if (!isCake) {
                    const isName = x >= nameMinX && x <= nameMaxX && y >= nameMinY && y <= nameMaxY;
                    // Reduce density for text targets (keep name denser than greeting)
                    const gx = (x / gap) | 0;
                    const gy = (y / gap) | 0;
                    if (isName) {
                        const keep = clamp(0.90 * density.textName, 0, 1);
                        if (!keepByProb(gx, gy, keep, 201)) continue;
                    } else {
                        const keep = clamp(0.75 * density.textGreeting, 0, 1);
                        if (!keepByProb(gx, gy, keep, 202)) continue;
                    }
                    targets.push({ x, y, group: "text", textPart: isName ? "name" : "greeting" });
                    totals.text++;
                    continue;
                }

                // Tag candle flame region as its own particle group
                let flameIdx = -1;
                for (let c = 0; c < state.candleAnchors.length; c++) {
                    const ca = state.candleAnchors[c];
                    // Quick reject box + only above candle body
                    if (x < ca.x - ca.r * 2.4 || x > ca.x + ca.r * 2.4) continue;
                    if (y > ca.y + ca.r * 0.35 || y < ca.y - ca.r * 5.2) continue;
                    // Inside a static-ish flame volume (sampling stage only)
                    const cx = ca.x;
                    const cy = ca.y - ca.r * 1.25;
                    const rx = ca.r * 1.35;
                    const ry = ca.r * 2.90;
                    const dx = (x - cx) / Math.max(0.001, rx);
                    const dy = (y - cy) / Math.max(0.001, ry);
                    if (dx * dx + dy * dy <= 1) {
                        flameIdx = c;
                        break;
                    }
                }
                if (flameIdx >= 0) {
                    const gx = (x / gap) | 0;
                    const gy = (y / gap) | 0;
                    const keep = clamp(1.0 * density.flame, 0, 1);
                    if (keepByProb(gx, gy, keep, 301)) {
                        targets.push({ x, y, group: "flame", candle: flameIdx });
                        totals.flame++;
                    }
                } else {
                    // Cake tier by y position (bottom/middle/top); plate/base is a separate tier
                    let tier = 2;
                    if (y >= cakeBottomY - gap) tier = -1;
                    else if (y >= cakeTopY + cakeLayerH * 2) tier = 0;
                    else if (y >= cakeTopY + cakeLayerH * 1.05) tier = 1;

                    // Edge detection to keep a visible outline that moves less
                    const n = gap;
                    const aL = x - n >= 0 ? data[(y * width + (x - n)) * 4 + 3] : 0;
                    const aR = x + n < width ? data[(y * width + (x + n)) * 4 + 3] : 0;
                    const aU = y - n >= 0 ? data[((y - n) * width + x) * 4 + 3] : 0;
                    const aD = y + n < height ? data[((y + n) * width + x) * 4 + 3] : 0;
                    const edge = (aL <= 20 || aR <= 20 || aU <= 20 || aD <= 20);

                    // Reduce density for cake interior; keep edges for outline
                    {
                        const gx = (x / gap) | 0;
                        const gy = (y / gap) | 0;
                        const baseKeep = edge ? 1.0 : (2 / 3);
                        const mul = density.cake * (edge ? density.cakeEdge : density.cakeInterior);
                        const keep = clamp(baseKeep * mul, 0, 1);
                        if (!keepByProb(gx, gy, keep, edge ? 401 : 402)) continue;
                    }

                    targets.push({ x, y, group: "cake", tier, edge });
                    totals.cake++;
                }
            }
        }

        // No extra density pass for name (per request: reduce overall density)

        // (No extra density pass for side texts; the numbers are larger now)

        state.targetTotals = totals;
        return shuffleInPlace(targets);
    }

    function isInsideTextMask(x, y) {
        const a = state.textMaskAlpha;
        if (!a) return false;
        const w = state.textMaskW;
        const h = state.textMaskH;
        const xi = x | 0;
        const yi = y | 0;
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) return false;
        return a[yi * w + xi] >= state.textMaskThresh;
    }

    function isInsideSideKanjiMask(kind, x, y) {
        const m = state.sideKanjiMasks;
        if (!m) return false;
        const entry = m[kind];
        if (!entry) return false;

        const xi = x | 0;
        const yi = y | 0;
        if (xi < entry.ox || yi < entry.oy || xi >= entry.ox + entry.w || yi >= entry.oy + entry.h) return false;

        const lx = xi - entry.ox;
        const ly = yi - entry.oy;
        return entry.alpha[ly * entry.w + lx] >= entry.thresh;
    }

    function isInsideSideNumMask(kind, x, y) {
        const m = state.sideNumMasks;
        if (!m) return false;
        const entry = m[kind];
        if (!entry) return false;

        const xi = x | 0;
        const yi = y | 0;
        if (xi < entry.ox || yi < entry.oy || xi >= entry.ox + entry.w || yi >= entry.oy + entry.h) return false;

        const lx = xi - entry.ox;
        const ly = yi - entry.oy;
        return entry.alpha[ly * entry.w + lx] >= entry.thresh;
    }

    function reset() {
        state.particles.length = 0;
        state.targetIndex = 0;
        state.spawnedTotal = 0;
        state.arrivedByGroup = Object.create(null);
        state.cakeTextGateTs = 0;

        state.cursorHearts.length = 0;
        state.cursorHasPos = false;
        state.cursorLastSpawnTs = 0;

        // Tune density based on screen size
        const cfgGap = typeof particleCfg.targetGap === "number" ? Math.floor(particleCfg.targetGap) : NaN;
        const cfgSpawn = typeof particleCfg.spawnPerFrame === "number" ? Math.floor(particleCfg.spawnPerFrame) : NaN;
        // Editable from config
        state.gap = Number.isFinite(cfgGap) ? clamp(cfgGap, 2, 10) : clamp(Math.floor(Math.min(width, height) / 185), 3, 7);
        state.spawnPerFrame = Number.isFinite(cfgSpawn) ? clamp(cfgSpawn, 1, 240) : clamp(Math.floor(Math.min(width, height) / 28), 28, 120);
        state.targets = computeTargets();

        initBackgroundLayers();
    }

    function resize() {
        const cssW = Math.max(1, window.innerWidth);
        const cssH = Math.max(1, window.innerHeight);
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        width = canvas.width;
        height = canvas.height;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;

        reset();
    }

    function spawnParticleForTarget(target) {
        // Spawn position depends on group
        const isSideDay = target.group === "sideDay";
        const isSideMonth = target.group === "sideMonth";
        const isSide = isSideDay || isSideMonth;
        const isFlame = target.group === "flame";

        // Default: rotating "galaxy" disk near the bottom
        const baseCenterX = width / 2;
        const baseCenterY = height * 0.90;

        const idx = state.spawnedTotal++;
        const theta0 = (idx * 0.23) % (Math.PI * 2);
        // Wider/longer galaxy band
        const radius0 = (Math.random() ** 0.45) * Math.min(width, height) * 0.45;
        const orbitFlatten = 0.18;
        const tilt = (Math.random() - 0.5) * 0.55; // radians

        const ox0 = Math.cos(theta0) * radius0;
        const oy0 = Math.sin(theta0) * radius0 * orbitFlatten;
        let startX = baseCenterX + (ox0 * Math.cos(tilt) - oy0 * Math.sin(tilt));
        let startY = baseCenterY + (ox0 * Math.sin(tilt) + oy0 * Math.cos(tilt));

        // Side texts: day falls from top-left; month comes from the right
        if (isSideDay) {
            startX = (-40 + Math.random() * 120) * dpr;
            startY = (-60 + Math.random() * 140) * dpr;
        }
        if (isSideMonth) {
            startX = (width + 40 + Math.random() * 140) * dpr;
            startY = (-60 + Math.random() * 160) * dpr;
        }
        // Flames: start near the candle so the fire looks alive immediately
        if (isFlame) {
            const ci = target.candle | 0;
            const candle = state.candleAnchors[ci];
            if (candle) {
                startX = candle.x + (Math.random() - 0.5) * candle.r * 2.0;
                startY = candle.y - candle.r * (1.6 + Math.random() * 2.6);
            }
        }

        // Super small particles
        const size = (0.18 + Math.random() * 0.65) * dpr;
        const driftX = (Math.random() - 0.5) * 6 * dpr;
        // Slightly faster overall pacing (a bit quicker orbit + rise + assemble)
        const orbitDurationMs = isSide || isFlame ? 0 : (1900 + Math.random() * 900) / speedMul;
        const transitionMs = isSide || isFlame ? 1 : (3000 + Math.random() * 1500) / speedMul;
        const omega = (0.40 + Math.random() * 0.65) * speedMul * (Math.random() < 0.5 ? -1 : 1);
        const riseSpeed = isSide || isFlame ? 0 : (9 + Math.random() * 14) * dpr * speedMul; // px/sec upward

        // Base hue per particle (used with smooth global time + position coloring)
        const hueSeed = Math.random() * 360;
        const alpha = 0.55 + Math.random() * 0.35;

        state.particles.push({
            // "homing" position (we'll blend from orbit -> homing)
            x: startX,
            y: startY,
            tx: target.x,
            ty: target.y,
            arrived: false,
            wobbleSeed: Math.random() * Math.PI * 2,
            // homing speed (slightly faster)
            speed: (isSide ? (0.0055 + Math.random() * 0.0052) : (0.0075 + Math.random() * 0.0075)) * speedMul,

            // target category
            group: target.group || "text",
            tier: target.tier ?? 0,
            textPart: target.textPart || "greeting",
            candle: target.candle ?? -1,
            sidePart: target.sidePart || "",
            edge: !!target.edge,

            orbitMode: isSide || isFlame ? "none" : "galaxy",

            // orbit params
            cx: baseCenterX + (Math.random() - 0.5) * 20 * dpr,
            cy: baseCenterY + (Math.random() - 0.5) * 10 * dpr,
            theta: theta0,
            omega,
            r: radius0,
            flatten: orbitFlatten,
            tilt,
            orbitDurationMs,
            transitionMs,
            ageMs: 0,
            riseSpeed,
            driftX,

            phase: "orbit",

            // render
            size,
            hueSeed,
            alpha
        });
    }

    function tick(ts) {
        const dt = state.lastTs ? Math.min(32, ts - state.lastTs) : 16;
        state.lastTs = ts;

        // Background with slight fade for smoother trails
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;

        // Background falling hearts (under everything)
        if (state.bgRain.length) {
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(255, 140, 190, 1)";

            for (let i = 0; i < state.bgRain.length; i++) {
                const r = state.bgRain[i];
                r.y += (r.vy * dt) / 1000;
                r.x += (r.vx * dt) / 1000;
                r.rot += ((r.omega || 0) * dt) / 1000;

                const pad = (r.s || 8 * dpr) * 3;
                if (r.y > height + pad) {
                    r.y = -pad - Math.random() * height * 0.15;
                    r.x = Math.random() * width;
                }
                if (r.x < -pad) r.x = width + pad;
                if (r.x > width + pad) r.x = -pad;

                ctx.globalAlpha = r.a;
                drawTinyHeartFilled(ctx, r.x, r.y, Math.max(0.6 * dpr, r.s || 8 * dpr), r.rot || 0);
            }
            ctx.globalAlpha = 1;
        }

        // Thin random heart icons under everything
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 140, 190, 1)";
        for (let i = 0; i < state.bgHeartIcons.length; i++) {
            const h = state.bgHeartIcons[i];
            h.y -= (h.vy * dt) / 1000;
            h.x += (h.vx * dt) / 1000;
            h.phase += (dt / 1000) * 0.6;
            h.rot += (dt / 1000) * 0.06;

            if (h.y < -30 * dpr) {
                h.y = height + (10 + Math.random() * height * 0.25);
                h.x = Math.random() * width;
            }
            if (h.x < -30 * dpr) h.x = width + 30 * dpr;
            if (h.x > width + 30 * dpr) h.x = -30 * dpr;

            const tw = 0.85 + 0.15 * Math.sin(h.phase);
            ctx.globalAlpha = h.a * tw;
            drawTinyHeartFilled(ctx, h.x, h.y, h.s, h.rot);
        }
        ctx.globalAlpha = 1;

        // No heart-shaped background layers
        ctx.globalCompositeOperation = "lighter";

        // Ambient upward flow across the whole screen (very faint, as dots)
        ctx.fillStyle = "rgba(255, 160, 190, 1)";
        for (let i = 0; i < state.ambientFlow.length; i++) {
            const f = state.ambientFlow[i];
            f.y -= (f.vy * dt) / 1000;
            f.x += (f.vx * dt) / 1000;
            f.phase += (dt / 1000) * 0.9;
            const wob = Math.sin(f.phase) * 0.7 * dpr;
            if (f.y < -20 * dpr) {
                f.y = height + 20 * dpr;
                f.x = Math.random() * width;
            }
            if (f.x < -20 * dpr) f.x = width + 20 * dpr;
            if (f.x > width + 20 * dpr) f.x = -20 * dpr;

            f.rot += (dt / 1000) * 0.35;
            ctx.globalAlpha = f.alpha * 0.55;
            ctx.beginPath();
            ctx.arc(f.x + wob, f.y, Math.max(0.8 * dpr, f.r * 1.6), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Gradually spawn particles in random target order
        for (let i = 0; i < state.spawnPerFrame; i++) {
            if (state.targetIndex >= state.targets.length) break;
            spawnParticleForTarget(state.targets[state.targetIndex]);
            state.targetIndex++;
        }

        // Additive glow for particles
        ctx.globalCompositeOperation = "lighter";

        // Update + draw particles
        for (let i = 0; i < state.particles.length; i++) {
            const p = state.particles[i];

            p.ageMs += dt;

            let orbitInfluence = 0;
            let orbitX = p.x;
            let orbitY = p.y;

            if (p.orbitMode === "galaxy") {
                // Orbit influence: 1 during orbit, then eases to 0 during transition
                orbitInfluence = 1;
                if (p.ageMs > p.orbitDurationMs) {
                    const t = clamp((p.ageMs - p.orbitDurationMs) / p.transitionMs, 0, 1);
                    orbitInfluence = 1 - t;
                }

                // Orbit position (slows down as we transition out)
                const omegaNow = p.omega * (0.35 + 0.65 * orbitInfluence);
                p.theta += (omegaNow * dt) / 1000;
                const ox = Math.cos(p.theta) * p.r;
                const oy = Math.sin(p.theta) * p.r * p.flatten;
                const ct = Math.cos(p.tilt || 0);
                const st = Math.sin(p.tilt || 0);
                orbitX = p.cx + (ox * ct - oy * st);
                orbitY = p.cy + (ox * st + oy * ct);

                // Keep the "galaxy" near the bottom longer; only start rising after orbit phase ends
                if (p.ageMs > p.orbitDurationMs) {
                    p.cy -= (p.riseSpeed * dt) / 1000;
                }
            }

            // Snap into transition once, to avoid never-converging visuals
            if (p.phase === "orbit" && p.ageMs >= p.orbitDurationMs) {
                p.phase = "transition";
                // Start homing from the current orbit position (prevents jump + helps shape form)
                p.x = orbitX;
                p.y = orbitY;
            }

            // Homing update (hidden behind orbit until orbitInfluence fades)
            if (!p.arrived) {
                const dx = p.tx - p.x;
                const dy = p.ty - p.y;
                const isName = p.group === "text" && p.textPart === "name";
                const isText = p.group === "text";
                const isSide = p.group === "sideDay" || p.group === "sideMonth";
                const homingBoost = isSide ? 1.00 : (p.ageMs > p.orbitDurationMs ? (isName ? 1.20 : 1.05) : 0.75);
                p.x += (dx * p.speed * homingBoost) * (dt / 16);
                p.y += (dy * p.speed * homingBoost) * (dt / 16);

                // small float wobble
                const tt = ts * 0.001;
                const dist2 = dx * dx + dy * dy;
                const near = dist2 < (110 * dpr) * (110 * dpr);
                const wobbleAmpBase = near ? 0.010 * dpr : (p.ageMs > p.orbitDurationMs ? 0.020 * dpr : 0.050 * dpr);
                const wobbleAmp = isSide ? wobbleAmpBase * 0.40 : (isName ? wobbleAmpBase * 0.18 : (isText ? wobbleAmpBase * 0.55 : wobbleAmpBase));
                p.x += Math.sin(tt * 0.9 + p.wobbleSeed) * wobbleAmp;
                p.y += Math.cos(tt * 0.8 + p.wobbleSeed) * wobbleAmp;

                if ((dx * dx + dy * dy) < 12 * 12 * dpr * dpr && p.ageMs > p.orbitDurationMs) {
                    p.arrived = true;
                    // Track arrivals by group so we can gate text drift until cake has "moved" a bit
                    {
                        const g = p.group || "";
                        const prev = state.arrivedByGroup && typeof state.arrivedByGroup[g] === "number" ? state.arrivedByGroup[g] : 0;
                        if (!state.arrivedByGroup) state.arrivedByGroup = Object.create(null);
                        state.arrivedByGroup[g] = prev + 1;

                        // When ~75% (3/4) of cake particles have arrived, start allowing the text drift to ramp in
                        if (!state.cakeTextGateTs && g === "cake" && state.targetTotals && state.targetTotals.cake > 0) {
                            const ratio = state.arrivedByGroup.cake / state.targetTotals.cake;
                            if (ratio >= 0.75) state.cakeTextGateTs = ts;
                        }
                    }
                    // Text particles will later wander inside the glyph mask (not stick to a fixed edge point)
                    if (p.group === "text") {
                        const isName = p.textPart === "name";
                        p.arrivedTs = ts;
                        // de-sync retargeting so the text doesn't pulse in unison
                        p.wanderTs = ts - Math.random() * (isName ? 700 : 650);
                    }
                    if (p.group === "sideDay" || p.group === "sideMonth") {
                        p.arrivedOx = (Math.random() - 0.5) * 0.8 * dpr;
                        p.arrivedOy = (Math.random() - 0.5) * 0.8 * dpr;
                    }
                }
            } else {
                const tt = ts * 0.001;
                // Keep assembled text stable/readable
                const isName = p.group === "text" && p.textPart === "name";
                const isText = p.group === "text";
                if (isText) {
                    // Constrained motion: particles can move freely, but only INSIDE the letter shapes
                    if (typeof p.vx !== "number") {
                        p.vx = (Math.random() - 0.5) * 0.25 * dpr;
                        p.vy = (Math.random() - 0.5) * 0.25 * dpr;
                    }

                    // Assign each particle to a stable "flow layer" (band) so the drift looks layered, not like one blob
                    if (typeof p.flowLayer !== "number") {
                        const fb = state.textFlowBounds;
                        const layers = state.textFlowLayers || 6;
                        const minY = fb ? fb.minY : 0;
                        const maxY = fb ? fb.maxY : state.textMaskH || 1;
                        const span = Math.max(1, maxY - minY);
                        const yn = clamp((p.ty - minY) / span, 0, 0.999);
                        p.flowLayer = clamp(Math.floor(yn * layers), 0, layers - 1);
                        p.flowPhase = (p.flowLayer * 1.35) + p.wobbleSeed * 0.65;
                    }

                    // Each particle picks a nearby "wander" goal inside the glyph. This avoids a harsh, fixed outline.
                    if (typeof p.wanderX !== "number") {
                        p.wanderX = p.tx;
                        p.wanderY = p.ty;
                    }
                    if (typeof p.wanderTX !== "number") {
                        p.wanderTX = p.wanderX;
                        p.wanderTY = p.wanderY;
                    }
                    if (typeof p.wanderTs !== "number") {
                        p.wanderTs = ts;
                    }

                    // Layered drift center (different phase/speed per layer), revealed from TOP -> BOTTOM over time
                    const layer = p.flowLayer || 0;
                    const lphase = (typeof p.flowPhase === "number" ? p.flowPhase : p.wobbleSeed);

                    const gateTs = state.cakeTextGateTs || 0;
                    const tArr = ts - Math.max((p.arrivedTs || ts), gateTs || 0);
                    const delayPerLayer = (isName ? 150 : 165);
                    const rampMs = isName ? 950 : 900;
                    const startMs = layer * delayPerLayer;
                    let u = (tArr - startMs) / rampMs;
                    u = clamp(u, 0, 1);
                    const motionGain = u * u * (3 - 2 * u); // smoothstep

                    const f0 = 0.20 + layer * 0.018;
                    const f1 = 0.16 + layer * 0.014;
                    let driftX = Math.sin(tt * (Math.PI * 2) * f0 + lphase) * (isName ? 0.85 : 1.25) * dpr;
                    let driftY = Math.cos(tt * (Math.PI * 2) * f1 + lphase * 1.6) * (isName ? 0.28 : 0.40) * dpr;
                    driftX *= motionGain;
                    driftY *= motionGain;
                    // keep drift safely inside the mask
                    let baseX = p.tx + driftX;
                    let baseY = p.ty + driftY;
                    if (state.textMaskAlpha && !isInsideTextMask(baseX, baseY)) {
                        driftX *= 0.45;
                        driftY *= 0.45;
                        baseX = p.tx + driftX;
                        baseY = p.ty + driftY;
                        if (!isInsideTextMask(baseX, baseY)) {
                            baseX = p.tx;
                            baseY = p.ty;
                        }
                    }
                    const roamRBase = (isName ? 3.2 : 4.6) * dpr;
                    const roamR = roamRBase * (0.18 + 0.82 * motionGain);
                    const retargetMs = isName ? 1200 : 1100;

                    // Ease wander target to keep motion soft (no snapping)
                    const ease = isName ? 0.07 : 0.08;
                    p.wanderX = lerp(p.wanderX, p.wanderTX, ease);
                    p.wanderY = lerp(p.wanderY, p.wanderTY, ease);

                    // Keep the wander target valid
                    if (state.textMaskAlpha && !isInsideTextMask(p.wanderX, p.wanderY)) {
                        p.wanderX = baseX;
                        p.wanderY = baseY;
                        p.wanderTX = baseX;
                        p.wanderTY = baseY;
                        p.wanderTs = ts;
                    }
                    const effectiveRetargetMs = retargetMs + (1 - motionGain) * (isName ? 900 : 1000);
                    if (motionGain > 0.10 && (ts - p.wanderTs) > effectiveRetargetMs) {
                        let wx = baseX;
                        let wy = baseY;
                        for (let k = 0; k < 10; k++) {
                            const ang = Math.random() * (Math.PI * 2);
                            const rad = Math.random() * roamR;
                            const tx2 = baseX + Math.cos(ang) * rad;
                            const ty2 = baseY + Math.sin(ang) * rad;
                            if (!state.textMaskAlpha || isInsideTextMask(tx2, ty2)) {
                                wx = tx2;
                                wy = ty2;
                                break;
                            }
                        }
                        p.wanderTX = wx;
                        p.wanderTY = wy;
                        p.wanderTs = ts;
                    }

                    // Tiny deterministic "noise" acceleration (smooth, not random)
                    const acc = (isName ? 0.013 : 0.018) * dpr * (0.20 + 0.80 * motionGain);
                    const ax = Math.sin(tt * 0.75 + p.wobbleSeed) * acc;
                    const ay = Math.cos(tt * 0.68 + p.wobbleSeed * 1.3) * acc;

                    // Soft spring keeps the text readable but not rigid / not edge-locked
                    const spring = (isName ? 0.0012 : 0.0010) * (0.25 + 0.75 * motionGain);
                    p.vx += (p.wanderX - p.x) * spring + ax;
                    p.vy += (p.wanderY - p.y) * spring + ay;

                    // Damping
                    const damp = isName ? 0.94 : 0.935;
                    p.vx *= damp;
                    p.vy *= damp;

                    let nx = p.x + p.vx;
                    let ny = p.y + p.vy;

                    // Keep motion inside the text mask. If we step outside, bounce and pull back.
                    if (state.textMaskAlpha) {
                        if (!isInsideTextMask(nx, ny)) {
                            // bounce
                            p.vx *= -0.50;
                            p.vy *= -0.50;
                            nx = p.x + p.vx;
                            ny = p.y + p.vy;

                            // pull toward a safe interior point until inside
                            for (let k = 0; k < 3 && !isInsideTextMask(nx, ny); k++) {
                                nx = lerp(nx, baseX, 0.60);
                                ny = lerp(ny, baseY, 0.60);
                            }
                            if (!isInsideTextMask(nx, ny)) {
                                nx = baseX;
                                ny = baseY;
                            }

                            // Reset wander target inward to avoid edge-hugging
                            p.wanderX = baseX;
                            p.wanderY = baseY;
                            p.wanderTX = baseX;
                            p.wanderTY = baseY;
                            p.wanderTs = ts;
                        }
                    }

                    p.x = nx;
                    p.y = ny;
                } else if (p.group === "sideDay" || p.group === "sideMonth") {
                    // Side date texts: 日/月 constrained to glyph outline; numbers constrained to their own box
                    if (typeof p.vx !== "number") {
                        p.vx = (Math.random() - 0.5) * 0.20 * dpr;
                        p.vy = (Math.random() - 0.5) * 0.20 * dpr;
                    }
                    const anchorX = p.tx + (p.arrivedOx || 0);
                    const anchorY = p.ty + (p.arrivedOy || 0);
                    const acc = 0.018 * dpr;
                    p.vx += Math.sin(tt * 0.85 + p.wobbleSeed) * acc;
                    p.vy += Math.cos(tt * 0.80 + p.wobbleSeed * 1.2) * acc;
                    p.vx += (anchorX - p.x) * 0.0015;
                    p.vy += (anchorY - p.y) * 0.0015;
                    p.vx *= 0.94;
                    p.vy *= 0.94;
                    let nx = p.x + p.vx;
                    let ny = p.y + p.vy;

                    if (p.sidePart === "kanji") {
                        const kind = p.group === "sideDay" ? "day" : "month";
                        if (!isInsideSideKanjiMask(kind, nx, ny)) {
                            p.vx *= -0.55;
                            p.vy *= -0.55;
                            nx = p.x + p.vx;
                            ny = p.y + p.vy;

                            for (let k = 0; k < 3 && !isInsideSideKanjiMask(kind, nx, ny); k++) {
                                nx = lerp(nx, anchorX, 0.60);
                                ny = lerp(ny, anchorY, 0.60);
                            }
                            if (!isInsideSideKanjiMask(kind, nx, ny)) {
                                nx = anchorX;
                                ny = anchorY;
                            }
                        }
                    } else {
                        // Numbers: keep them inside the digit glyph outline (so the number stays readable).
                        // Fallback to bounding box if masks aren't available.
                        const kind = p.group === "sideDay" ? "day" : "month";
                        if (state.sideNumMasks) {
                            if (!isInsideSideNumMask(kind, nx, ny)) {
                                p.vx *= -0.55;
                                p.vy *= -0.55;
                                nx = p.x + p.vx;
                                ny = p.y + p.vy;

                                for (let k = 0; k < 3 && !isInsideSideNumMask(kind, nx, ny); k++) {
                                    nx = lerp(nx, anchorX, 0.60);
                                    ny = lerp(ny, anchorY, 0.60);
                                }
                                if (!isInsideSideNumMask(kind, nx, ny)) {
                                    nx = anchorX;
                                    ny = anchorY;
                                }
                            }
                        } else if (state.sideBoxes) {
                            const b = p.group === "sideDay" ? state.sideBoxes.dayNum : state.sideBoxes.monthNum;
                            if (nx < b.minX) {
                                nx = b.minX;
                                p.vx *= -0.55;
                            }
                            if (nx > b.maxX) {
                                nx = b.maxX;
                                p.vx *= -0.55;
                            }
                            if (ny < b.minY) {
                                ny = b.minY;
                                p.vy *= -0.55;
                            }
                            if (ny > b.maxY) {
                                ny = b.maxY;
                                p.vy *= -0.55;
                            }
                        }
                    }

                    p.x = nx;
                    p.y = ny;
                } else if (p.group === "flame") {
                    // Flame particles: free motion constrained to a flickering flame volume
                    const ci = p.candle | 0;
                    const candle = state.candleAnchors[ci];
                    if (candle) {
                        if (typeof p.vx !== "number") {
                            p.vx = (Math.random() - 0.5) * 0.38 * dpr;
                            p.vy = (Math.random() - 0.5) * 0.25 * dpr;
                        }

                        const acc = 0.055 * dpr;
                        const ax = Math.sin(tt * 1.85 + p.wobbleSeed) * acc;
                        const ay = -Math.abs(Math.cos(tt * 1.60 + p.wobbleSeed * 1.4)) * (acc * 0.95);

                        // keep density around its sampled flame target but allow lively motion
                        const spring = 0.0012;
                        p.vx += (p.tx - p.x) * spring + ax;
                        p.vy += (p.ty - p.y) * spring + ay;

                        p.vx *= 0.90;
                        p.vy *= 0.90;

                        let nx = p.x + p.vx;
                        let ny = p.y + p.vy;

                        if (!isInsideFlameMask(candle, nx, ny, ts, p.hueSeed)) {
                            p.vx *= -0.50;
                            p.vy *= -0.35;
                            nx = p.x + p.vx;
                            ny = p.y + p.vy;

                            // pull gently back toward flame center
                            const cx = candle.x;
                            const cy = candle.y - candle.r * 1.25;
                            nx = lerp(nx, cx, 0.35);
                            ny = lerp(ny, cy, 0.35);
                        }

                        p.x = nx;
                        p.y = ny;
                    }
                } else {
                    // Cake particles: move freely (velocity-based) but stay around their targets
                    if (p.group === "cake") {
                        if (typeof p.vx !== "number") {
                            p.vx = (Math.random() - 0.5) * 0.32 * dpr;
                            p.vy = (Math.random() - 0.5) * 0.32 * dpr;
                        }

                        const isPlate = (p.tier ?? 0) === -1;
                        const isEdge = !!p.edge;

                        // Target-orbit so cake layers visibly move after assembling
                        // - edge: small (keeps outline)
                        // - plate: medium
                        // - interior cake: larger (so you can clearly see motion)
                        const tier = p.tier ?? 0;
                        const tierBoost = tier === 0 ? 1.05 : tier === 1 ? 0.95 : 0.90;
                        const orbR = (isPlate ? 2.2 : (isEdge ? 1.6 : 6.2)) * dpr * tierBoost;
                        const orbSp = isPlate ? 0.95 : (isEdge ? 1.05 : 1.25);
                        const ang = tt * orbSp + p.wobbleSeed * 1.7;
                        const txo = Math.cos(ang) * orbR;
                        const tyo = Math.sin(ang * 1.07) * (orbR * 0.55);
                        const ttx = p.tx + txo;
                        const tty = p.ty + tyo;

                        // More chaotic motion (multi-frequency). Edge moves less to form a visible outline.
                        const accBase = isPlate ? 0.036 : (isEdge ? 0.038 : 0.052);
                        const acc = accBase * dpr;
                        const n1 = Math.sin(tt * 1.15 + p.wobbleSeed * 3.7);
                        const n2 = Math.sin(tt * 2.05 + p.wobbleSeed * 1.9);
                        const n3 = Math.cos(tt * 1.55 + p.wobbleSeed * 4.4);
                        const n4 = Math.cos(tt * 2.45 + p.wobbleSeed * 2.6);
                        const ax = (n1 + 0.55 * n2 - 0.35 * n4) * acc;
                        const ay = (n3 - 0.60 * n2 + 0.35 * n4) * acc;

                        const spring = isPlate ? 0.00115 : (isEdge ? 0.00095 : 0.00055);
                        p.vx += (ttx - p.x) * spring + ax;
                        p.vy += (tty - p.y) * spring + ay;

                        // occasional tiny "pop" to keep it lộn xộn but still cohesive (deterministic)
                        const pop = Math.sin(tt * 0.90 + p.wobbleSeed * 11.3);
                        if (!isEdge && !isPlate && pop > 0.985) {
                            p.vx += (Math.sin(p.wobbleSeed * 9.1) * 0.18) * dpr;
                            p.vy += (Math.cos(p.wobbleSeed * 7.7) * 0.18) * dpr;
                        }

                        const damp = isPlate ? 0.92 : (isEdge ? 0.93 : 0.89);
                        p.vx *= damp;
                        p.vy *= damp;

                        p.x += p.vx;
                        p.y += p.vy;

                        // Limit movement range so cake layers stay coherent (prevents drifting/scattering)
                        // Clamp around the original sampled target (p.tx/p.ty), not the orbit-shifted target.
                        const cdx = p.x - p.tx;
                        const cdy = p.y - p.ty;
                        const cdist = Math.hypot(cdx, cdy);
                        // allow a bit more than the orbit radius + some breathing room
                        const maxDist = orbR + (isPlate ? 2.6 : (isEdge ? 2.0 : 4.0)) * dpr;
                        if (cdist > maxDist) {
                            const s = maxDist / Math.max(0.001, cdist);
                            p.x = p.tx + cdx * s;
                            p.y = p.ty + cdy * s;

                            // remove outward velocity so it doesn't keep pushing past the clamp
                            const nx = cdx / Math.max(0.001, cdist);
                            const ny = cdy / Math.max(0.001, cdist);
                            const out = p.vx * nx + p.vy * ny;
                            if (out > 0) {
                                p.vx -= out * nx * 1.05;
                                p.vy -= out * ny * 1.05;
                            }
                            p.vx *= 0.92;
                            p.vy *= 0.92;
                        }
                    } else {
                        const amp = 0.0035 * dpr;
                        p.x += Math.sin(tt * 1.1 + p.wobbleSeed) * amp;
                        p.y += Math.cos(tt * 1.0 + p.wobbleSeed) * amp;
                    }
                }
            }

            // Display blend: orbit -> homing
            const drawX = lerp(p.x, orbitX, orbitInfluence);
            const drawY = lerp(p.y, orbitY, orbitInfluence);

            // Smooth color based on time + position (coherent, not random flashing)
            const nx = drawX / Math.max(1, width);
            const ny = drawY / Math.max(1, height);
            const timeHue = (ts * 0.014) % 360;
            const posHue = (nx * 140 + ny * 180) % 360;
            const isCake = p.group === "cake";
            const isFlame = p.group === "flame";
            const isSide = p.group === "sideDay" || p.group === "sideMonth";
            const isName = p.group === "text" && p.textPart === "name";
            const isGreeting = p.group === "text" && p.textPart === "greeting";

            // Cake layers have distinct palettes; text keeps the smooth spatial+time hue
            let hue = (p.hueSeed * 0.25 + timeHue + posHue) % 360;
            let sat = 92;
            if (isFlame) {
                // Warm flame palette (allow yellow/orange)
                const warm = 26 + 34 * (0.5 + 0.5 * Math.sin(ts * 0.006 + p.hueSeed));
                hue = warm;
                sat = 98;
            } else if (isCake) {
                const tier = p.tier ?? 0;
                const base = tier === 0 ? 205 : tier === 1 ? 285 : 340; // bottom/middle/top
                hue = (base + timeHue * 0.18 + posHue * 0.12) % 360;
                sat = 86;
            } else {
                // Avoid the yellow/green band for text (keeps it prettier/cleaner)
                if (hue >= 70 && hue <= 170) {
                    hue = (hue + 120) % 360;
                }
            }
            const ascent = clamp(1 - orbitInfluence, 0, 1);
            const yLift = clamp(1 - ny, 0, 1);
            const nameBoost = isName ? 0.30 : 0;
            const greetingBoost = isGreeting ? 0.14 : 0;
            const flameBoost = isFlame ? 0.35 : 0;
            const sideBoost = isSide ? 0.16 : 0;
            const brightness = clamp(0.22 + ascent * 0.65 + yLift * 0.18 + nameBoost + greetingBoost + flameBoost + sideBoost, 0, 1);
            const light = 32 + brightness * 34;
            const alpha = clamp(p.alpha * (0.25 + brightness * 0.95), 0, 1);

            // Draw a glowing point (old particle style)
            ctx.beginPath();
            ctx.fillStyle = `hsla(${hue.toFixed(2)}, ${sat}%, ${light.toFixed(2)}%, ${alpha.toFixed(3)})`;
            const r = isName ? p.size * 1.25 : (isGreeting ? p.size * 1.12 : p.size);
            ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
            ctx.fill();

            // extra soft outer glow
            ctx.globalAlpha = 0.08 + brightness * 0.12;
            ctx.beginPath();
            ctx.arc(drawX, drawY, r * 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Cursor heart trail (falling hearts spawned on pointer move)
        if (cursorHeartsEnabled && state.cursorHearts.length) {
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(255, 140, 190, 1)";

            for (let i = state.cursorHearts.length - 1; i >= 0; i--) {
                const h = state.cursorHearts[i];
                h.ageMs += dt;

                h.vy += (h.g * dt) / 1000;
                h.x += (h.vx * dt) / 1000;
                h.y += (h.vy * dt) / 1000;
                h.rot += (h.omega * dt) / 1000;

                // gentle damping so hearts drift softly instead of "dropping" hard
                const dragX = Math.pow(0.985, dt / 16);
                const dragY = Math.pow(0.992, dt / 16);
                h.vx *= dragX;
                h.vy *= dragY;

                const t = h.lifeMs > 0 ? clamp(h.ageMs / h.lifeMs, 0, 1) : 1;
                const fade = 1 - smoothstep(0.18, 1.0, t);
                ctx.globalAlpha = clamp(h.a * fade, 0, 1);
                drawTinyHeartFilled(ctx, h.x, h.y, h.s, h.rot);

                const fellTooFar = (h.y - h.y0) > (cursorHeartMaxFallDistance * dpr);
                if (h.ageMs >= h.lifeMs || fellTooFar) {
                    state.cursorHearts.splice(i, 1);
                }
            }
            ctx.globalAlpha = 1;
        }

        requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize, { passive: true });

    if (cursorHeartsEnabled) {
        const onPointerMove = (e) => {
            if (!e.isPrimary) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * dpr;
            const y = (e.clientY - rect.top) * dpr;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            if (x < 0 || y < 0 || x > width || y > height) return;

            const now = (typeof e.timeStamp === "number" && e.timeStamp > 0) ? e.timeStamp : performance.now();
            const minDistPx = cursorHeartMinDistance * dpr;

            if (!state.cursorHasPos) {
                state.cursorHasPos = true;
                state.cursorLastX = x;
                state.cursorLastY = y;
                state.cursorLastSpawnTs = now;
                spawnCursorHeart(x, y);
                return;
            }

            const dx = x - state.cursorLastX;
            const dy = y - state.cursorLastY;
            const dist2 = dx * dx + dy * dy;
            const canSpawnByDist = dist2 >= minDistPx * minDistPx;
            const canSpawnByTime = (now - state.cursorLastSpawnTs) >= cursorHeartMinIntervalMs;
            if (!canSpawnByDist || !canSpawnByTime) return;

            state.cursorLastX = x;
            state.cursorLastY = y;
            state.cursorLastSpawnTs = now;
            spawnCursorHeart(x, y);
        };

        const onPointerLeave = () => {
            state.cursorHasPos = false;
        };

        canvas.addEventListener("pointermove", onPointerMove, { passive: true });
        canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
        window.addEventListener("blur", onPointerLeave, { passive: true });
    }

    // Letter popup UI
    {
        const btn = document.getElementById("letterBtn");
        const overlay = document.getElementById("letterOverlay");
        const closeBtn = document.getElementById("letterClose");
        const titleEl = document.getElementById("letterTitle");
        const bodyEl = document.getElementById("letterBody");

        const letterCfg = (APP_CONFIG.letter && typeof APP_CONFIG.letter === "object") ? APP_CONFIG.letter : {};
        if (btn) btn.textContent = (typeof letterCfg.buttonLabel === "string" && letterCfg.buttonLabel.trim()) ? letterCfg.buttonLabel.trim() : "THƯ";
        if (titleEl) titleEl.textContent = (typeof letterCfg.title === "string") ? letterCfg.title : "";
        if (bodyEl) bodyEl.textContent = (typeof letterCfg.body === "string") ? letterCfg.body : "";

        const setOpen = (open) => {
            if (!overlay) return;
            overlay.classList.toggle("is-open", open);
            overlay.setAttribute("aria-hidden", open ? "false" : "true");
        };

        if (btn) btn.addEventListener("click", () => setOpen(true));
        if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));
        if (overlay) {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) setOpen(false);
            });
        }
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") setOpen(false);
        });
    }

    resize();
    requestAnimationFrame(tick);
})();