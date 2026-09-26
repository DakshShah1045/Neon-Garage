/**
 * Neon Garage — New Tab application
 * Modular vanilla JS · chrome.storage.local · offline-first
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------------
   * Constants & defaults
   * ----------------------------------------------------------------*/
  const STORAGE_KEY = "neonGarage_v1";
  const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const PAINT_MAP = {
    black: "#0a0a0c",
    silver: "#a8b0bc",
    white: "#e8ecef",
    blue: "#1a5cff",
    red: "#c41e3a"
  };

  const DIAG_CHECKS = [
    "ENGINE",
    "BRAKES",
    "BATTERY",
    "AERODYNAMICS",
    "TYRES",
    "ELECTRONICS"
  ];

  const ENV_WEATHER = {
    midnight: "midnight",
    "neon-city": "neon-city",
    space: "space",
    desert: "desert",
    rain: "rain"
  };

  const DEFAULT_STATE = {
    selectedCarId: "apex-x1",
    garage: ["apex-x1", "vortex-gt", "nova-r"],
    favoriteId: "apex-x1",
    unlockedHidden: false,
    environment: "midnight",
    customizations: {},
    lighting: { ambient: 1, spotlight: 1, autoTime: true },
    settings: {
      particles: true,
      weather: true,
      reducedMotion: false,
      hints: true,
      sound: true,
      ambience: true,
      volume: 0.35
    },
    developerMode: false,
    customLinks: []
  };

  /* ------------------------------------------------------------------
   * DOM refs
   * ----------------------------------------------------------------*/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const els = {
    body: document.body,
    clockTime: $("#clockTime"),
    clockDay: $("#clockDay"),
    clockDate: $("#clockDate"),
    carName: $("#carName"),
    carClass: $("#carClass"),
    statGrid: $("#statGrid"),
    carVisual: $("#carVisual"),
    carRotate: $("#carRotate"),
    carStage: $("#carStage"),
    carReflection: $("#carReflection"),
    heroGlow: $("#heroGlow"),
    btnStartEngine: $("#btnStartEngine"),
    btnPanel: $("#btnPanel"),
    btnClosePanel: $("#btnClosePanel"),
    controlPanel: $("#controlPanel"),
    panelBackdrop: $("#panelBackdrop"),
    carCollection: $("#carCollection"),
    profileName: $("#profileName"),
    profileCat: $("#profileCat"),
    profileDesc: $("#profileDesc"),
    profileFeatures: $("#profileFeatures"),
    weather: $("#weather"),
    weatherCanvas: $("#weatherCanvas"),
    particles: $("#particles"),
    envFx: $("#envFx"),
    scanOverlay: $("#scanOverlay"),
    blueprintOverlay: $("#blueprintOverlay"),
    bpLabels: $("#bpLabels"),
    diagPanel: $("#diagPanel"),
    diagList: $("#diagList"),
    diagResult: $("#diagResult"),
    toast: $("#toast"),
    logoBtn: $("#logoBtn"),
    interactionHint: $("#interactionHint"),
    customPaint: $("#customPaint"),
    accentColor: $("#accentColor"),
    lightIntensity: $("#lightIntensity"),
    ambientLight: $("#ambientLight"),
    spotLight: $("#spotLight"),
    
    // Custom Links feature
    customLinksContainer: $("#customLinksContainer"),
    btnAddLinkItem: $("#btnAddLinkItem"),
    linkModal: $("#linkModal"),
    lmName: $("#lmName"),
    lmUrl: $("#lmUrl"),
    btnCancelLink: $("#btnCancelLink"),
    btnSaveLink: $("#btnSaveLink")
  };

  /* ------------------------------------------------------------------
   * State
   * ----------------------------------------------------------------*/
  let state = structuredClone(DEFAULT_STATE);
  let catalog = Array.isArray(window.NG_CATALOG) ? window.NG_CATALOG : [];
  let engineBusy = false;
  let diagBusy = false;
  let logoClicks = 0;
  let logoTimer = null;
  let konami = [];
  const KONAMI_SEQ = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  /* Drag / parallax */
  let dragging = false;
  let lastX = 0;
  let rotY = 0;
  let particleRAF = null;
  let weatherRAF = null;
  let particles = [];
  let weatherDrops = [];
  let weatherDust = [];
  let weatherStars = [];
  let weatherSparks = [];
  let weatherResizeBound = false;

  /* ------------------------------------------------------------------
   * Storage helpers (chrome.storage.local with localStorage fallback)
   * ----------------------------------------------------------------*/
  const Storage = {
    async load() {
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          const data = await chrome.storage.local.get(STORAGE_KEY);
          return data[STORAGE_KEY] || null;
        }
      } catch (_) { /* ignore */ }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    },
    async save(payload) {
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          await chrome.storage.local.set({ [STORAGE_KEY]: payload });
          return;
        }
      } catch (_) { /* ignore */ }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (_) { /* ignore */ }
    }
  };

  function SFX() {
    return window.NGSound || null;
  }

  function sfx(name, arg) {
    const s = SFX();
    if (!s || !state.settings.sound) return;
    s.play(name, arg);
  }

  function syncSoundSettings() {
    const s = SFX();
    if (!s) return;
    s.setEnabled(!!state.settings.sound);
    s.setVolume(state.settings.volume ?? 0.35);
    if (state.settings.sound && state.settings.ambience) {
      s.startAmbience(state.environment);
    } else {
      s.stopAmbience();
    }
  }

  function carCustomization(carId) {
    if (!state.customizations[carId]) {
      state.customizations[carId] = {
        paint: "white",
        customPaint: "#e8ecef",
        wheels: "aero",
        lights: "standard",
        lightIntensity: 1,
        accent: "#3ecfff"
      };
    }
    // Force white if it was the previous default (black) so the user sees the update immediately
    if (state.customizations[carId].paint === "black" && Object.keys(state.customizations).length > 0) {
       // Optional: we can just leave it, but changing the default is requested. Let's just update it if they are on black.
       state.customizations[carId].paint = "white";
       state.customizations[carId].customPaint = "#e8ecef";
    }
    return state.customizations[carId];
  }

  async function persist() {
    await Storage.save(state);
  }

  /* ------------------------------------------------------------------
   * Car image assets — place PNGs in assets/cars/{id}.png
   * Falls back to a simple silhouette if a PNG is missing.
   * ----------------------------------------------------------------*/
  function carImageSrc(car) {
    const file = car.image || `${car.id}.png`;
    return `../assets/cars/${file}`;
  }

  function fallbackSilhouetteSVG(car) {
    const accent = car.accent || "#3ecfff";
    return `
      <svg class="car-fallback" viewBox="0 0 800 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path class="body-paint" d="M70 230 C120 210 160 175 230 165 L320 155 C380 120 470 110 560 130 L650 155 C700 165 740 195 750 230 L730 250 L90 250 Z"/>
        <path class="glass" d="M310 158 C370 128 470 122 545 138 L500 158 L340 165 Z" fill="#4a6a88" fill-opacity="0.45"/>
        <path class="accent-line" d="M140 220 L280 195 L520 185 L700 215" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>
        <ellipse class="headlight" cx="720" cy="210" rx="18" ry="8"/>
        <rect class="taillight" x="78" y="205" width="22" height="8" rx="2"/>
        <circle class="wheel-rim" cx="210" cy="250" r="38"/>
        <circle class="wheel-rim" cx="600" cy="250" r="38"/>
      </svg>`;
  }

  function carMarkup(car, forReflection = false) {
    const src = carImageSrc(car);
    const alt = forReflection ? "" : car.name;
    return `
      <div class="car-img-wrap">
        <img class="car-img" src="${src}" alt="${alt}" draggable="false" />
        <div class="paint-overlay" aria-hidden="true"></div>
        <div class="blueprint-scanlines" aria-hidden="true"></div>
      </div>
      <span class="light-fx headlight" aria-hidden="true"></span>
      <span class="light-fx taillight" aria-hidden="true"></span>
      <span class="wheel-badge" aria-hidden="true"></span>
      <span class="accent-strip" aria-hidden="true"></span>`;
  }

  function getCar(id) {
    return catalog.find((c) => c.id === id) || catalog[0];
  }

  function visibleCatalog() {
    return catalog.filter((c) => !c.hidden || state.unlockedHidden || state.garage.includes(c.id));
  }

  /* ------------------------------------------------------------------
   * Render helpers
   * ----------------------------------------------------------------*/
  function renderCarVisual(car) {
    els.carVisual.innerHTML = carMarkup(car, false);
    els.carReflection.innerHTML = carMarkup(car, true);

    const imgs = [els.carVisual.querySelector(".car-img"), els.carReflection.querySelector(".car-img")];
    imgs.forEach((img) => {
      if (!img) return;
      img.addEventListener(
        "error",
        () => {
          const wrap = img.closest(".car-img-wrap");
          if (wrap) wrap.innerHTML = fallbackSilhouetteSVG(car);
        },
        { once: true }
      );
      // Mask paint overlay to the PNG alpha once loaded
      img.addEventListener(
        "load",
        () => {
          const overlay = img.parentElement?.querySelector(".paint-overlay");
          const scan = img.parentElement?.querySelector(".blueprint-scanlines");
          if (overlay) {
            overlay.style.webkitMaskImage = `url("${img.src}")`;
            overlay.style.maskImage = `url("${img.src}")`;
            overlay.style.webkitMaskSize = "contain";
            overlay.style.maskSize = "contain";
            overlay.style.webkitMaskRepeat = "no-repeat";
            overlay.style.maskRepeat = "no-repeat";
            overlay.style.webkitMaskPosition = "center";
            overlay.style.maskPosition = "center";
          }
          if (scan) {
            scan.style.webkitMaskImage = `url("${img.src}")`;
            scan.style.maskImage = `url("${img.src}")`;
            scan.style.webkitMaskSize = "contain";
            scan.style.maskSize = "contain";
            scan.style.webkitMaskRepeat = "no-repeat";
            scan.style.maskRepeat = "no-repeat";
            scan.style.webkitMaskPosition = "center";
            scan.style.maskPosition = "center";
          }
        },
        { once: true }
      );
    });

    applyCustomization(car.id);
  }

  function applyCustomization(carId) {
    const cust = carCustomization(carId);
    const paint =
      cust.paint === "custom" ? cust.customPaint : PAINT_MAP[cust.paint] || cust.customPaint;
    document.documentElement.style.setProperty("--paint", paint);
    document.documentElement.style.setProperty("--accent", cust.accent);
    document.documentElement.style.setProperty("--light-intensity", cust.lightIntensity);
    els.carVisual.dataset.paint = cust.paint;
    els.carVisual.dataset.wheels = cust.wheels;
    els.carVisual.dataset.lights = cust.lights;

    const badge = els.carVisual.querySelector(".wheel-badge");
    if (badge) badge.textContent = String(cust.wheels || "aero").toUpperCase();

    els.accentColor.value = cust.accent;
    els.lightIntensity.value = cust.lightIntensity;
    if (cust.paint === "custom") els.customPaint.value = cust.customPaint;
    $$(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.paint === cust.paint));
    $$("[data-wheels]").forEach((b) => b.classList.toggle("active", b.dataset.wheels === cust.wheels));
    $$("#lightOptions [data-lights]").forEach((b) =>
      b.classList.toggle("active", b.dataset.lights === cust.lights)
    );
  }

  function renderStats(car) {
    const rows = [
      ["TOP SPEED", car.topSpeed],
      ["0–100", car.acceleration],
      ["POWER", car.power],
      ["TORQUE", car.torque],
      ["DRIVETRAIN", car.drivetrain],
      ["WEIGHT", car.weight],
      ["RANGE", car.range]
    ];
    els.statGrid.innerHTML = rows
      .map(
        ([k, v]) =>
          `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`
      )
      .join("");
  }

  function renderProfile(car) {
    els.carName.textContent = car.name;
    els.carClass.textContent = car.class;
    els.profileName.textContent = car.name;
    els.profileCat.textContent = car.category;
    els.profileDesc.textContent = car.description;
    els.profileFeatures.innerHTML = (car.features || [])
      .map((f) => `<li>${f}</li>`)
      .join("");
  }

  function renderCollection() {
    const garageCars = state.garage
      .map((id) => getCar(id))
      .filter(Boolean);

    els.carCollection.innerHTML = garageCars
      .map((car) => {
        const fav = state.favoriteId === car.id ? "favorite" : "";
        const active = state.selectedCarId === car.id ? "active" : "";
        return `
          <div class="car-card ${active} ${fav}" data-id="${car.id}">
            <div>
              <div class="cc-name">${car.name} <span class="cc-fav">★</span></div>
              <div class="cc-class">${car.class}</div>
            </div>
            <button type="button" class="cc-remove" data-remove="${car.id}" title="Remove" aria-label="Remove ${car.name}">✕</button>
          </div>`;
      })
      .join("");

    $$(".env-card").forEach((c) =>
      c.classList.toggle("active", c.dataset.env === state.environment)
    );
  }

  function setSystemStatus(online) {
    const map = {
      engine: online ? "ONLINE" : "STANDBY",
      battery: online ? "97%" : "98%",
      temp: online ? "WARM" : "NORMAL",
      traction: "ACTIVE",
      aero: online ? "DEPLOYED" : "READY"
    };
    $$(".sys-val").forEach((el) => {
      const key = el.dataset.sys;
      if (map[key]) {
        el.textContent = map[key];
        el.classList.toggle("online", online && (key === "engine" || key === "aero"));
        el.classList.toggle("warn", online && key === "temp");
      }
    });
  }

  function selectCar(id, { animate = true, silent = false } = {}) {
    const car = getCar(id);
    if (!car) return;
    if (!state.garage.includes(id) && !car.hidden) {
      state.garage.push(id);
    }
    const changed = state.selectedCarId !== id;
    state.selectedCarId = id;
    renderCarVisual(car);
    renderStats(car);
    renderProfile(car);
    renderCollection();
    setSystemStatus(false);
    els.body.dataset.engine = "off";
    els.btnStartEngine.classList.remove("active");
    if (animate) {
      els.carStage.classList.remove("zooming");
      void els.carStage.offsetWidth;
      els.carStage.classList.add("zooming");
    }
    if (changed && !silent) sfx("whoosh");
    // Subtle spotlight pulse via CSS variable nudge
    document.documentElement.style.setProperty("--spotlight", String(1.15));
    setTimeout(() => {
      document.documentElement.style.setProperty(
        "--spotlight",
        String(state.lighting.spotlight)
      );
    }, 500);
    persist();
  }

  /* ------------------------------------------------------------------
   * Environment / lighting / weather / clock
   * ----------------------------------------------------------------*/
  function applyEnvironment(env) {
    const changed = state.environment !== env;
    state.environment = env;
    els.body.dataset.env = env;
    updateWeather();
    $$(".env-card").forEach((c) => c.classList.toggle("active", c.dataset.env === env));
    // Restart ambient particles with env palette
    if (state.settings.particles) startParticles();
    if (changed) syncSoundSettings();
    persist();
  }

  function updateWeather() {
    const type = state.settings.weather ? ENV_WEATHER[state.environment] : null;
    els.weather.className = "weather" + (type ? ` ${type}` : "");
    startWeatherFX();
  }

  function updateTimeOfDay() {
    const h = new Date().getHours();
    let period = "night";
    if (h >= 6 && h < 17) period = "day";
    else if (h >= 17 && h < 20) period = "evening";
    els.body.dataset.time = period;
    if (state.lighting.autoTime) {
      const ambient = period === "day" ? 1.1 : period === "evening" ? 0.95 : 0.85;
      document.documentElement.style.setProperty("--ambient", String(ambient * state.lighting.ambient));
    } else {
      document.documentElement.style.setProperty("--ambient", String(state.lighting.ambient));
    }
  }

  function tickClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    els.clockTime.textContent = `${hh}:${mm}`;
    els.clockDay.textContent = DAYS[now.getDay()];
    els.clockDate.textContent = `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")}`;
    updateTimeOfDay();
  }

  function applyLighting() {
    document.documentElement.style.setProperty("--ambient", String(state.lighting.ambient));
    document.documentElement.style.setProperty("--spotlight", String(state.lighting.spotlight));
    els.ambientLight.value = state.lighting.ambient;
    els.spotLight.value = state.lighting.spotlight;
    updateTimeOfDay();
  }

  function applySettingsUI() {
    $("#setParticles").checked = state.settings.particles;
    $("#setWeather").checked = state.settings.weather;
    $("#setReducedMotion").checked = state.settings.reducedMotion;
    $("#setHints").checked = state.settings.hints;
    const setSound = $("#setSound");
    const setAmbience = $("#setAmbience");
    const setVolume = $("#setVolume");
    if (setSound) setSound.checked = state.settings.sound !== false;
    if (setAmbience) setAmbience.checked = state.settings.ambience !== false;
    if (setVolume) setVolume.value = state.settings.volume ?? 0.35;
    els.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
    els.body.classList.toggle("hide-hints", !state.settings.hints);
    updateWeather();
    if (state.settings.particles) startParticles();
    else stopParticles();
    syncSoundSettings();
  }

  /* ------------------------------------------------------------------
   * Particles — palette shifts per environment
   * ----------------------------------------------------------------*/
  function particlePalette() {
    switch (state.environment) {
      case "desert":
        return { r: 220, g: 180, b: 100, count: 42, speed: 0.35 };
      case "rain":
        return { r: 160, g: 190, b: 220, count: 20, speed: 0.15 };
      case "space":
        return { r: 180, g: 160, b: 255, count: 50, speed: 0.12 };
      case "neon-city":
        return { r: 255, g: 120, b: 180, count: 40, speed: 0.22 };
      default:
        return { r: 180, g: 220, b: 255, count: 36, speed: 0.18 };
    }
  }

  function startParticles() {
    stopParticles();
    if (!state.settings.particles || state.settings.reducedMotion) return;
    const canvas = els.particles;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    if (!canvas._resizeBound) {
      window.addEventListener("resize", resize, { passive: true });
      canvas._resizeBound = true;
    }
    const pal = particlePalette();
    particles = Array.from({ length: pal.count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      s: Math.random() * pal.speed + 0.04,
      a: Math.random() * 0.4 + 0.1,
      drift: (Math.random() - 0.5) * 0.35
    }));

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pNow = particlePalette();
      for (const p of particles) {
        p.y -= p.s;
        p.x += p.drift;
        if (p.y < -4) {
          p.y = canvas.height + 4;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -4) p.x = canvas.width + 4;
        if (p.x > canvas.width + 4) p.x = -4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${pNow.r}, ${pNow.g}, ${pNow.b}, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      particleRAF = requestAnimationFrame(loop);
    };
    particleRAF = requestAnimationFrame(loop);
  }

  function stopParticles() {
    if (particleRAF) cancelAnimationFrame(particleRAF);
    particleRAF = null;
    if (els.particles) {
      const ctx = els.particles.getContext("2d");
      ctx.clearRect(0, 0, els.particles.width, els.particles.height);
    }
  }

  /* ------------------------------------------------------------------
   * Weather canvas — continuous env-specific FX
   * ----------------------------------------------------------------*/
  function stopWeatherFX() {
    if (weatherRAF) cancelAnimationFrame(weatherRAF);
    weatherRAF = null;
    weatherDrops = [];
    weatherDust = [];
    weatherStars = [];
    weatherSparks = [];
    const canvas = els.weatherCanvas;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function startWeatherFX() {
    stopWeatherFX();
    const canvas = els.weatherCanvas;
    if (!canvas || !state.settings.weather || state.settings.reducedMotion) return;

    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    if (!weatherResizeBound) {
      window.addEventListener("resize", resize, { passive: true });
      weatherResizeBound = true;
    }

    const env = state.environment;
    const w = () => canvas.width;
    const h = () => canvas.height;

    if (env === "rain") {
      weatherDrops = Array.from({ length: 120 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h(),
        len: Math.random() * 14 + 8,
        speed: Math.random() * 8 + 6,
        opacity: Math.random() * 0.35 + 0.15,
        wind: Math.random() * 1.5 + 0.5
      }));
    } else if (env === "desert") {
      weatherDust = Array.from({ length: 90 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h() * 0.85 + h() * 0.08,
        r: Math.random() * 2.8 + 0.5,
        speed: Math.random() * 1.6 + 0.4,
        opacity: Math.random() * 0.35 + 0.12,
        bob: Math.random() * Math.PI * 2
      }));
    } else if (env === "space") {
      weatherStars = Array.from({ length: 110 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h() * 0.82,
        r: Math.random() * 1.8 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.05 + 0.015
      }));
      weatherSparks = Array.from({ length: 4 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h() * 0.5,
        vx: -(Math.random() * 6 + 4),
        vy: Math.random() * 3 + 2,
        life: 0,
        max: Math.random() * 40 + 30
      }));
    } else if (env === "neon-city") {
      weatherSparks = Array.from({ length: 36 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h() * 0.75 + h() * 0.08,
        r: Math.random() * 2.4 + 0.6,
        color: Math.random() > 0.5 ? "255,80,160" : "60,200,255",
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.07 + 0.025
      }));
    } else if (env === "midnight") {
      weatherDust = Array.from({ length: 28 }, () => ({
        x: Math.random() * w(),
        y: Math.random() * h(),
        r: Math.random() * 1.3 + 0.3,
        speed: Math.random() * 0.25 + 0.05,
        opacity: Math.random() * 0.3 + 0.08,
        bob: Math.random() * Math.PI * 2
      }));
    }

    const loop = () => {
      // Stop if env changed mid-loop
      if (els.body.dataset.env !== env) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (env === "rain") {
        for (const d of weatherDrops) {
          d.y += d.speed;
          d.x += d.wind;
          if (d.y > h()) {
            d.y = -d.len;
            d.x = Math.random() * w();
          }
          if (d.x > w()) d.x = 0;
          ctx.strokeStyle = `rgba(180, 210, 240, ${d.opacity})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.wind * 1.2, d.y + d.len);
          ctx.stroke();
        }
        // Soft mist near floor
        const mist = ctx.createLinearGradient(0, h() * 0.65, 0, h());
        mist.addColorStop(0, "rgba(100,140,180,0)");
        mist.addColorStop(1, "rgba(100,140,180,0.08)");
        ctx.fillStyle = mist;
        ctx.fillRect(0, h() * 0.65, w(), h() * 0.35);
      } else if (env === "desert") {
        for (const d of weatherDust) {
          d.x += d.speed;
          d.bob += 0.02;
          d.y += Math.sin(d.bob) * 0.15;
          if (d.x > w() + 4) {
            d.x = -4;
            d.y = Math.random() * h() * 0.85 + h() * 0.08;
          }
          ctx.beginPath();
          ctx.fillStyle = `rgba(210, 170, 90, ${d.opacity})`;
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Warm air wash across full room
        const wash = ctx.createRadialGradient(w() * 0.5, h() * 0.45, 40, w() * 0.5, h() * 0.5, w() * 0.55);
        wash.addColorStop(0, "rgba(255,180,80,0.07)");
        wash.addColorStop(1, "rgba(255,180,80,0)");
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w(), h());
      } else if (env === "space") {
        for (const s of weatherStars) {
          s.twinkle += s.speed;
          const a = 0.35 + Math.abs(Math.sin(s.twinkle)) * 0.65;
          ctx.beginPath();
          ctx.fillStyle = `rgba(220, 230, 255, ${a})`;
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const m of weatherSparks) {
          if (m.life <= 0 && Math.random() < 0.012) {
            m.x = w() * (0.3 + Math.random() * 0.65);
            m.y = Math.random() * h() * 0.45;
            m.vx = -(Math.random() * 6 + 4);
            m.vy = Math.random() * 3.5 + 1.5;
            m.life = m.max;
          }
          if (m.life > 0) {
            m.x += m.vx;
            m.y += m.vy;
            m.life -= 1;
            const a = Math.min(1, m.life / 12);
            ctx.strokeStyle = `rgba(200, 230, 255, ${a})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - m.vx * 2.5, m.y - m.vy * 2.5);
            ctx.stroke();
          }
        }
        // Soft cosmic wash around car
        const cosmic = ctx.createRadialGradient(w() * 0.5, h() * 0.5, 20, w() * 0.5, h() * 0.5, w() * 0.45);
        cosmic.addColorStop(0, "rgba(100,80,200,0.06)");
        cosmic.addColorStop(1, "rgba(100,80,200,0)");
        ctx.fillStyle = cosmic;
        ctx.fillRect(0, 0, w(), h());
      } else if (env === "neon-city") {
        for (const s of weatherSparks) {
          s.twinkle += s.speed;
          const a = 0.3 + Math.abs(Math.sin(s.twinkle)) * 0.6;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${s.color}, ${a})`;
          ctx.shadowColor = `rgba(${s.color}, 0.9)`;
          ctx.shadowBlur = 12;
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        // Side neon bloom around car
        const left = ctx.createRadialGradient(0, h() * 0.5, 0, 0, h() * 0.5, w() * 0.35);
        left.addColorStop(0, "rgba(255,40,120,0.1)");
        left.addColorStop(1, "rgba(255,40,120,0)");
        const right = ctx.createRadialGradient(w(), h() * 0.5, 0, w(), h() * 0.5, w() * 0.35);
        right.addColorStop(0, "rgba(40,200,255,0.1)");
        right.addColorStop(1, "rgba(40,200,255,0)");
        ctx.fillStyle = left;
        ctx.fillRect(0, 0, w(), h());
        ctx.fillStyle = right;
        ctx.fillRect(0, 0, w(), h());
      } else if (env === "midnight") {
        for (const d of weatherDust) {
          d.y -= d.speed;
          d.bob += 0.015;
          d.x += Math.sin(d.bob) * 0.2;
          if (d.y < -4) {
            d.y = h() + 4;
            d.x = Math.random() * w();
          }
          ctx.beginPath();
          ctx.fillStyle = `rgba(140, 180, 230, ${d.opacity})`;
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      weatherRAF = requestAnimationFrame(loop);
    };
    weatherRAF = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------
   * Engine startup sequence
   * ----------------------------------------------------------------*/
  async function startEngineSequence() {
    if (engineBusy) return;
    engineBusy = true;
    els.btnStartEngine.classList.add("active");
    els.body.dataset.engine = "on";
    els.carVisual.classList.add("headlights-on", "taillights-on");
    setSystemStatus(true);
    sfx("engineStart");
    showToast("SYSTEMS INITIALIZING");

    await wait(400);
    showToast("IGNITION SEQUENCE");
    SFX()?.startIdle();
    await wait(700);
    showToast("ENGINE ONLINE");
    await wait(1600);

    // Return to calm garage state
    els.body.dataset.engine = "off";
    els.btnStartEngine.classList.remove("active");
    els.carVisual.classList.remove("headlights-on", "taillights-on");
    setSystemStatus(false);
    SFX()?.stopIdle();
    showToast("GARAGE STANDBY");
    await wait(900);
    hideToast();
    engineBusy = false;
  }

  /* ------------------------------------------------------------------
   * Diagnostics
   * ----------------------------------------------------------------*/
  async function runDiagnostics() {
    if (diagBusy) return;
    diagBusy = true;
    els.diagPanel.hidden = false;
    els.diagList.innerHTML = "";
    els.diagResult.textContent = "";
    $(".diag-title").textContent = "SCANNING VEHICLE...";
    els.scanOverlay.hidden = false;
    els.carVisual.classList.add("headlights-on");

    for (let i = 0; i < DIAG_CHECKS.length; i++) {
      await wait(420);
      sfx("diagBeep", i);
      const li = document.createElement("li");
      li.className = "pass";
      li.innerHTML = `<span>${DIAG_CHECKS[i]}</span><span>PASS</span>`;
      els.diagList.appendChild(li);
    }

    await wait(350);
    $(".diag-title").textContent = "DIAGNOSTICS COMPLETE";
    els.diagResult.textContent = "ALL SYSTEMS NOMINAL";
    sfx("diagPass");
    showToast("ALL SYSTEMS NOMINAL");

    await wait(1800);
    els.scanOverlay.hidden = true;
    els.carVisual.classList.remove("headlights-on");
    els.diagPanel.hidden = true;
    hideToast();
    diagBusy = false;
  }

  /* ------------------------------------------------------------------
   * Blueprint mode
   * ----------------------------------------------------------------*/
  function toggleBlueprint(force) {
    const on = force !== undefined ? force : els.body.dataset.mode !== "blueprint";
    els.body.dataset.mode = on ? "blueprint" : "garage";
    els.blueprintOverlay.hidden = !on;
    if (on) {
      const car = getCar(state.selectedCarId);
      els.bpLabels.innerHTML = `
        <span style="top:12%;left:8%">WHEELBASE 2.72 m</span>
        <span style="top:18%;right:10%">LENGTH 4.68 m</span>
        <span style="bottom:28%;left:12%">CHASSIS · MONOCOQUE</span>
        <span style="bottom:22%;right:12%">WIDTH 2.05 m</span>
        <span style="top:42%;left:42%">${car.name}</span>
        <span style="bottom:35%;left:40%">${car.power} · ${car.torque}</span>
      `;
      sfx("blueprint");
      showToast("HOLOGRAPHIC BLUEPRINT");
      setTimeout(hideToast, 1200);
    }
  }

  /* ------------------------------------------------------------------
   * Custom shortcut helpers
   * ----------------------------------------------------------------*/
  function normalizeShortcut(item) {
    if (!item || typeof item !== "object") return null;
    const name = String(item.name || "").trim();
    const rawUrl = String(item.url || "").trim();
    if (!name || !rawUrl) return null;

    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);
      if (!parsed.protocol.startsWith("http")) return null;
      return {
        name,
        url: parsed.href,
        abbr: name.slice(0, 2).toUpperCase()
      };
    } catch (_) {
      return null;
    }
  }

  function bindNavButton(btn) {
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetUrl = btn.getAttribute("data-url");
      triggerNavRedirect(targetUrl);
    });
  }

  function triggerNavRedirect(targetUrl) {
    console.log("Navigating to:", targetUrl);
    if (!targetUrl) return;
    if (typeof sfx === "function") sfx("engineStart");

    

    const carVis = document.getElementById("carVisual");
    if (carVis) carVis.classList.add("headlights-on", "taillights-on");
    setTimeout(() => {
      document.body.classList.add("navigating");
    }, 1000);
    
    

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 3500);
  }

  function openShortcutModal() {
    if (!els.shortcutModal) return;
    els.shortcutModal.hidden = false;
    els.shortcutModal.setAttribute("aria-hidden", "false");
    els.shortcutName.value = "";
    els.shortcutUrl.value = "";
    requestAnimationFrame(() => els.shortcutName.focus());
  }

  function closeShortcutModal() {
    if (!els.shortcutModal) return;
    els.shortcutModal.hidden = true;
    els.shortcutModal.setAttribute("aria-hidden", "true");
    els.shortcutName.value = "";
    els.shortcutUrl.value = "";
  }

  function renderCustomShortcuts() {
    const grid = els.navGrid;
    if (!grid) return;

    const beforeAdd = grid.querySelector(".add-shortcut-btn");
    grid.querySelectorAll(".custom-nav-btn").forEach((el) => el.remove());

    const shortcuts = Array.isArray(state.shortcuts) ? state.shortcuts : [];
    shortcuts.filter(Boolean).forEach((shortcut) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-btn custom-nav-btn";
      btn.dataset.url = shortcut.url;
      btn.title = shortcut.name;

      const icon = document.createElement("span");
      icon.className = "nav-shortcut-letter";
      icon.textContent = shortcut.abbr || shortcut.name.slice(0, 1).toUpperCase();

      const label = document.createElement("span");
      label.textContent = shortcut.name.toUpperCase();

      btn.append(icon, label);
      bindNavButton(btn);
      if (beforeAdd) {
        grid.insertBefore(btn, beforeAdd);
      } else {
        grid.appendChild(btn);
      }
    });
  }

  async function saveShortcut() {
    const name = els.shortcutName.value.trim();
    const url = els.shortcutUrl.value.trim();
    if (!name || !url) {
      showToast("ENTER NAME AND URL");
      setTimeout(hideToast, 1200);
      return;
    }

    const normalized = normalizeShortcut({ name, url });
    if (!normalized) {
      showToast("USE A VALID HTTP URL");
      setTimeout(hideToast, 1400);
      return;
    }

    state.shortcuts = Array.isArray(state.shortcuts) ? state.shortcuts.map(normalizeShortcut).filter(Boolean) : [];
    state.shortcuts.push(normalized);
    await persist();
    renderCustomShortcuts();
    closeShortcutModal();
    showToast("SHORTCUT SAVED");
    setTimeout(hideToast, 1200);
  }

  /* ------------------------------------------------------------------
   * Panel / UI
   * ----------------------------------------------------------------*/
  function openPanel(open = true) {
    els.controlPanel.classList.toggle("open", open);
    els.controlPanel.setAttribute("aria-hidden", String(!open));
    els.panelBackdrop.hidden = !open;
    els.body.classList.toggle("customize-open", open);
  }

  function showView(name) {
    $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === name));
    $$(".panel-view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    if (name === "customize") els.body.classList.add("customize-open");
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
  }
  function hideToast() {
    els.toast.hidden = true;
  }
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ------------------------------------------------------------------
   * Easter eggs
   * ----------------------------------------------------------------*/
  function onLogoClick() {
    logoClicks += 1;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => {
      logoClicks = 0;
    }, 1600);
    if (logoClicks >= 5) {
      logoClicks = 0;
      state.developerMode = !state.developerMode;
      persist();
      if (state.developerMode) {
        showToast("DEVELOPER MODE ENABLED");
        document.documentElement.style.setProperty("--cyan", "#a0f0ff");
      } else {
        showToast("DEVELOPER MODE OFF");
        document.documentElement.style.setProperty("--cyan", "#3ecfff");
      }
      setTimeout(hideToast, 1400);
    }
  }

  function unlockPhantom() {
    if (state.unlockedHidden) return;
    state.unlockedHidden = true;
    if (!state.garage.includes("phantom-zero")) state.garage.push("phantom-zero");
    persist();
    selectCar("phantom-zero");
    sfx("success");
    showToast("HIDDEN PROTOTYPE UNLOCKED · PHANTOM ZERO");
    setTimeout(hideToast, 2200);
  }

  function secretLighting() {
    document.documentElement.style.setProperty("--accent", "#ff6bcb");
    els.carVisual.classList.add("headlights-on", "taillights-on");
    sfx("success");
    showToast("SECRET LIGHTING PROTOCOL");
    setTimeout(() => {
      applyCustomization(state.selectedCarId);
      els.carVisual.classList.remove("headlights-on", "taillights-on");
      hideToast();
    }, 2500);
  }

  /* ------------------------------------------------------------------
   * Interaction: drag rotate + parallax + lights hover
   * ----------------------------------------------------------------*/
  function setupCarInteraction() {
    const stage = els.carStage;

    stage.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rotY = Math.max(-28, Math.min(28, rotY + dx * 0.25));
      document.documentElement.style.setProperty("--car-rot", `${rotY}deg`);
    });
    const endDrag = () => {
      dragging = false;
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    // Parallax
    window.addEventListener(
      "mousemove",
      (e) => {
        if (state.settings.reducedMotion || dragging) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 16;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        document.documentElement.style.setProperty("--parallax-x", `${x}px`);
        document.documentElement.style.setProperty("--parallax-y", `${y}px`);
      },
      { passive: true }
    );

    // Headlight hover zones via mouse position on car
    stage.addEventListener("mousemove", (e) => {
      const rect = stage.getBoundingClientRect();
      const rel = (e.clientX - rect.left) / rect.width;
      if (rel > 0.72) els.carVisual.classList.add("headlights-on");
      else if (!engineBusy && els.body.dataset.engine !== "on")
        els.carVisual.classList.remove("headlights-on");
      if (rel < 0.28) els.carVisual.classList.add("taillights-on");
      else if (!engineBusy && els.body.dataset.engine !== "on")
        els.carVisual.classList.remove("taillights-on");
    });
    stage.addEventListener("mouseleave", () => {
      if (!engineBusy && els.body.dataset.engine !== "on") {
        els.carVisual.classList.remove("headlights-on", "taillights-on");
      }
    });
  }

  /* ------------------------------------------------------------------
   * Custom Links Rendering
   * ----------------------------------------------------------------*/
  function renderCustomLinks() {
    if (!els.customLinksContainer) return;
    els.customLinksContainer.innerHTML = "";
    (state.customLinks || []).forEach((link, idx) => {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.title = link.name;
      btn.setAttribute("data-url", link.url);
      btn.innerHTML = `
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>${link.name.substring(0, 10).toUpperCase()}</span>
      `;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        triggerNavRedirect(link.url);
      });
      els.customLinksContainer.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
   * Event bindings
   * ----------------------------------------------------------------*/
  function bindEvents() {
    // Custom Link Modal Handlers
    els.btnAddLinkItem?.addEventListener("click", () => {
      els.lmName.value = "";
      els.lmUrl.value = "";
      els.linkModal.hidden = false;
      els.lmName.focus();
    });
    
    els.btnCancelLink?.addEventListener("click", () => {
      els.linkModal.hidden = true;
    });

    els.btnSaveLink?.addEventListener("click", () => {
      let name = els.lmName.value.trim();
      let url = els.lmUrl.value.trim();
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      
      state.customLinks.push({ name, url });
      persist();
      renderCustomLinks();
      els.linkModal.hidden = true;
      showToast(name.toUpperCase() + " LINK ADDED");
      setTimeout(hideToast, 1500);
    });

    // Navigation Action (hardcoded buttons)
    const navBtns = document.querySelectorAll('.nav-grid > .nav-btn[data-url]');
    navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetUrl = btn.getAttribute('data-url');
        triggerNavRedirect(targetUrl);
      });
    });

    els.btnPanel.addEventListener("click", () => openPanel(true));
    els.btnClosePanel.addEventListener("click", () => openPanel(false));
    els.panelBackdrop.addEventListener("click", () => openPanel(false));
    els.btnStartEngine.addEventListener("click", startEngineSequence);
    els.logoBtn.addEventListener("click", onLogoClick);

    $$(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });

    els.carCollection.addEventListener("click", (e) => {
      const remove = e.target.closest("[data-remove]");
      if (remove) {
        e.stopPropagation();
        const id = remove.dataset.remove;
        if (state.garage.length <= 1) {
          showToast("KEEP AT LEAST ONE VEHICLE");
          setTimeout(hideToast, 1200);
          return;
        }
        state.garage = state.garage.filter((x) => x !== id);
        if (state.favoriteId === id) state.favoriteId = state.garage[0];
        if (state.selectedCarId === id) selectCar(state.garage[0]);
        else {
          persist();
          renderCollection();
        }
        return;
      }
      const card = e.target.closest(".car-card");
      if (card) selectCar(card.dataset.id);
    });

    $("#btnFavorite").addEventListener("click", () => {
      state.favoriteId = state.selectedCarId;
      persist();
      renderCollection();
      sfx("success");
      showToast("FAVORITE SET");
      setTimeout(hideToast, 1000);
    });

    $("#btnAddCar").addEventListener("click", () => {
      const available = visibleCatalog().filter((c) => !state.garage.includes(c.id));
      if (!available.length) {
        // Cycle: offer adding a duplicate presentation by selecting next not selected
        showToast("GARAGE FULL · ALL UNITS STORED");
        setTimeout(hideToast, 1400);
        return;
      }
      const next = available[0];
      state.garage.push(next.id);
      selectCar(next.id);
      sfx("success");
      showToast(`${next.name.toUpperCase()} ADDED`);
      setTimeout(hideToast, 1200);
    });

    // Paint
    $$(".swatch").forEach((s) => {
      s.addEventListener("click", () => {
        const cust = carCustomization(state.selectedCarId);
        cust.paint = s.dataset.paint;
        applyCustomization(state.selectedCarId);
        persist();
      });
    });
    els.customPaint.addEventListener("input", () => {
      const cust = carCustomization(state.selectedCarId);
      cust.paint = "custom";
      cust.customPaint = els.customPaint.value;
      applyCustomization(state.selectedCarId);
      persist();
    });

    $$("#wheelOptions [data-wheels]").forEach((b) => {
      b.addEventListener("click", () => {
        carCustomization(state.selectedCarId).wheels = b.dataset.wheels;
        applyCustomization(state.selectedCarId);
        persist();
      });
    });
    $$("#lightOptions [data-lights]").forEach((b) => {
      b.addEventListener("click", () => {
        carCustomization(state.selectedCarId).lights = b.dataset.lights;
        applyCustomization(state.selectedCarId);
        persist();
      });
    });
    els.lightIntensity.addEventListener("input", () => {
      carCustomization(state.selectedCarId).lightIntensity = Number(els.lightIntensity.value);
      applyCustomization(state.selectedCarId);
      persist();
    });
    els.accentColor.addEventListener("input", () => {
      carCustomization(state.selectedCarId).accent = els.accentColor.value;
      applyCustomization(state.selectedCarId);
      persist();
    });

    $$(".env-card").forEach((card) => {
      card.addEventListener("click", () => applyEnvironment(card.dataset.env));
    });

    $("#btnRunDiag").addEventListener("click", () => {
      openPanel(false);
      runDiagnostics();
    });
    $("#btnBlueprint").addEventListener("click", () => {
      toggleBlueprint();
      openPanel(false);
    });

    els.ambientLight.addEventListener("input", () => {
      state.lighting.ambient = Number(els.ambientLight.value);
      state.lighting.autoTime = false;
      applyLighting();
      persist();
    });
    els.spotLight.addEventListener("input", () => {
      state.lighting.spotlight = Number(els.spotLight.value);
      applyLighting();
      persist();
    });
    $("#btnAutoTime").addEventListener("click", () => {
      state.lighting.autoTime = true;
      applyLighting();
      persist();
      showToast("LIGHTING SYNCED TO LOCAL TIME");
      setTimeout(hideToast, 1200);
    });

    $("#setParticles").addEventListener("change", (e) => {
      state.settings.particles = e.target.checked;
      applySettingsUI();
      persist();
    });
    $("#setWeather").addEventListener("change", (e) => {
      state.settings.weather = e.target.checked;
      applySettingsUI();
      persist();
    });
    $("#setReducedMotion").addEventListener("change", (e) => {
      state.settings.reducedMotion = e.target.checked;
      applySettingsUI();
      persist();
    });
    $("#setHints").addEventListener("change", (e) => {
      state.settings.hints = e.target.checked;
      applySettingsUI();
      persist();
    });
    $("#setSound")?.addEventListener("change", (e) => {
      state.settings.sound = e.target.checked;
      syncSoundSettings();
      persist();
    });
    $("#setAmbience")?.addEventListener("change", (e) => {
      state.settings.ambience = e.target.checked;
      syncSoundSettings();
      persist();
    });
    $("#setVolume")?.addEventListener("input", (e) => {
      state.settings.volume = Number(e.target.value);
      syncSoundSettings();
      persist();
    });
    $("#btnReset").addEventListener("click", async () => {
      state = structuredClone(DEFAULT_STATE);
      await persist();
      bootstrapUI();
      showToast("GARAGE DATA RESET");
      setTimeout(hideToast, 1200);
    });

    // Konami + secret keys
    window.addEventListener("keydown", (e) => {
      konami.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (konami.length > KONAMI_SEQ.length) konami.shift();
      if (KONAMI_SEQ.every((k, i) => konami[i] === k)) {
        konami = [];
        unlockPhantom();
      }
      if (e.key === "Escape") {
        openPanel(false);
        if (els.body.dataset.mode === "blueprint") toggleBlueprint(false);
      }
      // Secret lighting: Shift+L
      if (e.shiftKey && e.key.toLowerCase() === "l") secretLighting();
      // Dev HUD flash: Shift+D when developer mode
      if (state.developerMode && e.shiftKey && e.key.toLowerCase() === "d") {
        showToast("DEV TELEMETRY · FPS NOMINAL · STORAGE OK");
        setTimeout(hideToast, 1600);
      }
    });
  }

  /* ------------------------------------------------------------------
   * Init
   * ----------------------------------------------------------------*/
  function bootstrapUI() {
    applyEnvironment(state.environment);
    applyLighting();
    applySettingsUI();
    selectCar(state.selectedCarId, { animate: true, silent: true });
    renderCustomLinks();
    tickClock();
  }

  async function init() {
    const saved = await Storage.load();
    if (saved) state = { ...structuredClone(DEFAULT_STATE), ...saved, settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) }, lighting: { ...DEFAULT_STATE.lighting, ...(saved.lighting || {}) } };
    state.customizations = state.customizations || {};
    if (!catalog.length) {
      console.warn("Neon Garage: catalog missing");
    }
    bindEvents();
    setupCarInteraction();
    bootstrapUI();
    setInterval(tickClock, 1000 * 20);

    const unlockAudio = () => {
      SFX()?.unlock();
      syncSoundSettings();
    };
    ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
      window.addEventListener(evt, unlockAudio, { once: true, passive: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
