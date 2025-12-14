(() => {
  "use strict";

  const DEFAULT_SRC = "./happy-birthday-401919.mp3";

  const KEY_ENABLED = "bgmEnabled";
  const KEY_TIME = "bgmTime";

  function getAppConfig() {
    const cfg = window.APP_CONFIG;
    return (cfg && typeof cfg === "object") ? cfg : null;
  }

  function resolveMusicConfig() {
    const cfg = getAppConfig();
    const music = cfg && cfg.music && typeof cfg.music === "object" ? cfg.music : null;
    const src = (music && typeof music.src === "string" && music.src.trim()) ? music.src.trim() : DEFAULT_SRC;
    const volume = (music && typeof music.volume === "number") ? Math.max(0, Math.min(1, music.volume)) : 0.65;
    return { src, volume };
  }

  function getOrCreateAudio() {
    let audio = document.getElementById("bgm");
    if (audio && audio.tagName && audio.tagName.toLowerCase() === "audio") return audio;

    audio = document.createElement("audio");
    audio.id = "bgm";
    audio.preload = "auto";
    audio.loop = true;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    return audio;
  }

  function safeGetSession(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSetSession(key, val) {
    try { sessionStorage.setItem(key, val); } catch (e) {}
  }

  function safeSetEnabled() {
    safeSetSession(KEY_ENABLED, "1");
  }

  function readSavedTime() {
    const raw = safeGetSession(KEY_TIME);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  function saveTime(audio) {
    if (!audio || !Number.isFinite(audio.currentTime)) return;
    safeSetSession(KEY_TIME, String(audio.currentTime));
  }

  function tryPlay(audio) {
    if (!audio) return;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        // Autoplay can be blocked until a user gesture.
      });
    }
  }

  function setup() {
    const { src, volume } = resolveMusicConfig();

    const audio = getOrCreateAudio();
    if (!audio.src) audio.src = src;
    audio.volume = volume;

    const savedTime = readSavedTime();
    if (savedTime != null) {
      const applySavedTime = () => {
        try {
          if (Number.isFinite(audio.duration) && audio.duration > 1) {
            audio.currentTime = Math.min(Math.max(savedTime, 0), Math.max(0, audio.duration - 0.25));
          }
        } catch (e) {}
      };

      if (audio.readyState >= 1) {
        applySavedTime();
      } else {
        audio.addEventListener("loadedmetadata", applySavedTime, { once: true });
      }
    }

    audio.addEventListener("timeupdate", () => saveTime(audio), { passive: true });
    window.addEventListener("pagehide", () => saveTime(audio), { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveTime(audio);
    }, { passive: true });

    function startFromGesture() {
      safeSetEnabled();
      tryPlay(audio);
    }

    window.__BGM_START = startFromGesture;

    const enabled = safeGetSession(KEY_ENABLED) === "1";
    if (enabled) {
      tryPlay(audio);
    }

    // User gesture unlock
    window.addEventListener("pointerdown", startFromGesture, { once: true, passive: true });
    window.addEventListener("keydown", startFromGesture, { once: true, passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
