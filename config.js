// Edit this file to customize the animation.
// It is loaded before script.js and exposed as window.APP_CONFIG.

window.APP_CONFIG = {
  // Main text (2 lines)
  textLines: ["HAPPY BIRTHDAY", "ChizNguyen"],

  // Side date text (fixed; not based on current date)
  date: {
    day: 14,
    month: 12
  },

  // Particle density & pacing
  particles: {
    // Higher = fewer particles (sampling gap in px)
    targetGap: 4,
    // How many particles are spawned per frame while building
    spawnPerFrame: 190,
    // Overall speed multiplier (1.0 = default)
    speedMultiplier: 0.7,

    // Per-part density multipliers.
    // 1.0 = current default density
    // >1.0 = more particles for that part (up to a limit)
    // <1.0 = fewer particles for that part
    // Tip: keep targetGap reasonable (4-7), then fine-tune here.
    density: {
      // Cake
      cake: 1.5,
      cakeEdge: 1.0,
      cakeInterior: 1.0,

      // Main text
      textGreeting: 1.5,
      textName: 3.5,

      // Side date tex
      sideKanji: 1.5,
      sideNum: 1.9,

      // Candle flame particles
      flame: 1.0
    }
  },

  // Background heart icon layer (thin)
  backgroundHearts: {
    enabled: true,
    // Fewer = less dense
    count: 450,
    // Opacity range (keep small)
    alphaMin: 0.006,
    alphaMax: 0.015
  },

  // Background falling hearts (was rain-like streaks), separate from the particle cake/text
  backgroundRain: {
    enabled: true,
    // Higher = more streaks
    count: 100,
    // Opacity range
    alphaMin: 0.03,
    alphaMax: 0.09,
    // Streak length (px)
    lengthMin: 40,
    lengthMax: 110,
    // Falling speed (px/sec)
    speedMin: 200,
    speedMax: 400,
    // Line thickness (px)
    widthMin: 0.8,
    widthMax: 1.6,
    // Tilt angle (degrees). Positive = slant to the right as it falls
    angleDeg: 10
  },

  // Cursor effect: move mouse to spawn falling hearts
  cursorHearts: {
    enabled: true,
    // Max hearts kept in memory at once
    maxCount: 140,
    // Spawn control
    minDistance: 15, // px (mouse must move at least this far)
    minIntervalMs: 12, // ms
    // Visual
    alpha: 1.9,
    sizeMin: 10.6,
    sizeMax: 11.8,
    // Motion (in px/sec)
    fallSpeedMin: 8,
    fallSpeedMax: 11,
    gravity: 70, // px/sec^2
    driftX: 18, // side drift px/sec
    spin: 1.6, // rad/sec
    lifeMs: 900,
    // Prevent hearts from "falling deep"; they drift a bit then fade out
    maxFallDistance: 160 // px
  },

  // "Letter" popup content
  letter: {
    buttonLabel: "Lời nhắn của tớ",
    title: "Gửi chị Vanh",
    body: "Chúc mừng sinh nhật chị nhó! Chúc chị có một ngày thật trọn vẹn, ngập tràn niềm vui và hạnh phúc. Bước sang tuổi mới, mong chị mãi giữ được nét rạng rỡ, xinh đẹp và trẻ trung như tuổi đôi mươi nhé!\n\nFrom: chiznguyen71"
  }
};
