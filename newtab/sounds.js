/**
 * Neon Garage — procedural sound engine (Web Audio API)
 * Offline · no external audio files · soft / premium levels
 */
(() => {
  "use strict";

  const Sound = {
    ctx: null,
    master: null,
    sfxGain: null,
    ambGain: null,
    enabled: true,
    volume: 0.35,
    unlocked: false,
    idleNodes: null,
    ambNodes: null,
    ambEnv: null,
    headlightLatched: false
  };

  function ensure() {
    if (Sound.ctx) return Sound.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    Sound.ctx = new AC();
    Sound.master = Sound.ctx.createGain();
    Sound.sfxGain = Sound.ctx.createGain();
    Sound.ambGain = Sound.ctx.createGain();
    Sound.sfxGain.connect(Sound.master);
    Sound.ambGain.connect(Sound.master);
    Sound.master.connect(Sound.ctx.destination);
    applyGains();
    return Sound.ctx;
  }

  function applyGains() {
    if (!Sound.master) return;
    const v = Sound.enabled ? Sound.volume : 0;
    Sound.master.gain.setTargetAtTime(v, Sound.ctx.currentTime, 0.05);
    Sound.sfxGain.gain.value = 1;
    Sound.ambGain.gain.value = 0.45;
  }

  async function unlock() {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (_) { /* ignore */ }
    }
    Sound.unlocked = true;
  }

  function now() {
    return Sound.ctx ? Sound.ctx.currentTime : 0;
  }

  function envGain(peak, attack, sustain, release, dest) {
    const ctx = Sound.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const t = now();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.linearRampToValueAtTime(peak * 0.7, t + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + sustain + release);
    g.connect(dest || Sound.sfxGain);
    return g;
  }

  function tone(freq, type, peak, a, s, r, detune = 0) {
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = envGain(peak, a, s, r);
    osc.connect(g);
    osc.start();
    osc.stop(now() + a + s + r + 0.05);
  }

  function noiseBuffer(seconds = 0.4) {
    const ctx = Sound.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noiseBurst(peak, a, s, r, filterFreq = 1200, type = "bandpass", q = 1) {
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(a + s + r + 0.1);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    filt.Q.value = q;
    const g = envGain(peak, a, s, r);
    src.connect(filt);
    filt.connect(g);
    src.start();
  }

  /* ---------- One-shots ---------- */
  function playClick() {
    tone(1800, "square", 0.04, 0.005, 0.02, 0.04);
    tone(900, "triangle", 0.03, 0.005, 0.015, 0.03);
  }

  function playWhoosh() {
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.55);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(400, now());
    filt.frequency.exponentialRampToValueAtTime(2200, now() + 0.35);
    const g = envGain(0.12, 0.04, 0.18, 0.28);
    src.connect(filt);
    filt.connect(g);
    src.start();
  }

  function playEngineStart() {
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;
  
    const t = now();
  
    // =========================
    // MAIN HEAVY ENGINE START
    // =========================
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
  
    osc.frequency.setValueAtTime(38, t);
    osc.frequency.exponentialRampToValueAtTime(105, t + 0.7);
    osc.frequency.exponentialRampToValueAtTime(175, t + 1.7);
    osc.frequency.exponentialRampToValueAtTime(125, t + 2.7);
  
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(100, t);
    filt.frequency.exponentialRampToValueAtTime(850, t + 1.5);
    filt.frequency.exponentialRampToValueAtTime(1100, t + 2.5);
  
    const g = envGain(0.75, 0.12, 1.35, 0.9);
  
    osc.connect(filt);
    filt.connect(g);
  
    osc.start(t);
    osc.stop(t + 3.1);
  
    // =========================
    // DEEP ENGINE RUMBLE
    // =========================
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
  
    osc2.frequency.setValueAtTime(27, t);
    osc2.frequency.exponentialRampToValueAtTime(48, t + 0.8);
    osc2.frequency.exponentialRampToValueAtTime(68, t + 1.8);
    osc2.frequency.exponentialRampToValueAtTime(52, t + 2.8);
  
    const g2 = envGain(0.38, 0.15, 1.5, 0.9);
  
    osc2.connect(g2);
    g2.connect(ctx.destination);
  
    osc2.start(t);
    osc2.stop(t + 3.15);
  
    // Small ignition texture at the beginning only
    noiseBurst(
      0.20,
      0.03,
      0.35,
      0.6,
      420,
      "lowpass",
      0.7
    );
  }

  function playHeadlight() {
    tone(1400, "sine", 0.035, 0.004, 0.02, 0.05);
    noiseBurst(0.03, 0.002, 0.02, 0.04, 3000, "highpass", 0.5);
  }

  function playDiagBeep(index = 0) {
    const base = 660 + index * 40;
    tone(base, "sine", 0.05, 0.005, 0.04, 0.06);
  }

  function playDiagPass() {
    tone(523.25, "sine", 0.06, 0.01, 0.12, 0.25);
    tone(659.25, "sine", 0.05, 0.01, 0.14, 0.28);
    tone(783.99, "sine", 0.045, 0.01, 0.18, 0.35);
  }

  function playBlueprint() {
    tone(880, "sine", 0.045, 0.02, 0.15, 0.4);
    tone(1320, "triangle", 0.03, 0.03, 0.2, 0.45);
    noiseBurst(0.04, 0.05, 0.2, 0.4, 2400, "bandpass", 2);
  }

  function playSuccess() {
    tone(587.33, "sine", 0.06, 0.01, 0.1, 0.2);
    setTimeout(() => tone(880, "sine", 0.055, 0.01, 0.12, 0.28), 90);
    setTimeout(() => tone(1174.66, "triangle", 0.04, 0.01, 0.16, 0.35), 180);
  }

  function playPanel() {
    playClick();
    noiseBurst(0.025, 0.01, 0.05, 0.12, 900, "lowpass", 0.8);
  }

  /* ---------- Idle engine hum ---------- */
  function startIdle() {
    stopIdle();
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.value = 48;
    osc2.frequency.value = 96;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.07, now() + 0.4);
    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(g);
    g.connect(Sound.sfxGain);
    osc1.start();
    osc2.start();
    Sound.idleNodes = { osc1, osc2, g };
  }

  function stopIdle() {
    if (!Sound.idleNodes || !Sound.ctx) return;
    const { osc1, osc2, g } = Sound.idleNodes;
    try {
      g.gain.cancelScheduledValues(now());
      g.gain.linearRampToValueAtTime(0.0001, now() + 0.45);
      osc1.stop(now() + 0.5);
      osc2.stop(now() + 0.5);
    } catch (_) { /* ignore */ }
    Sound.idleNodes = null;
  }

  /* ---------- Environment ambience ---------- */
  function stopAmbience() {
    if (!Sound.ambNodes || !Sound.ctx) {
      Sound.ambNodes = null;
      Sound.ambEnv = null;
      return;
    }
    const nodes = Sound.ambNodes;
    try {
      if (nodes.gain) {
        nodes.gain.gain.cancelScheduledValues(now());
        nodes.gain.gain.linearRampToValueAtTime(0.0001, now() + 0.6);
      }
      (nodes.stopList || []).forEach((n) => {
        try {
          n.stop(now() + 0.65);
        } catch (_) { /* ignore */ }
      });
    } catch (_) { /* ignore */ }
    Sound.ambNodes = null;
    Sound.ambEnv = null;
  }

  function startAmbience(env) {
    if (Sound.ambEnv === env && Sound.ambNodes) return;
    stopAmbience();
    const ctx = ensure();
    if (!ctx || !Sound.enabled) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(Sound.ambGain);
    const stopList = [];
    const t = now();

    if (env === "rain") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2);
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1400;
      filt.Q.value = 0.6;
      src.connect(filt);
      filt.connect(gain);
      src.start();
      stopList.push(src);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.8);
    } else if (env === "desert") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2);
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 500;
      src.connect(filt);
      filt.connect(gain);
      src.start();
      stopList.push(src);
      gain.gain.linearRampToValueAtTime(0.28, t + 1);
    } else if (env === "space") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 82.5;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoG.gain.value = 8;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      osc.connect(gain);
      osc2.connect(gain);
      osc.start();
      osc2.start();
      lfo.start();
      stopList.push(osc, osc2, lfo);
      gain.gain.linearRampToValueAtTime(0.22, t + 1.2);
    } else if (env === "neon-city") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2);
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 700;
      src.connect(filt);
      filt.connect(gain);
      src.start();
      stopList.push(src);
      // Soft distant tone
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 110;
      const og = ctx.createGain();
      og.gain.value = 0.15;
      osc.connect(og);
      og.connect(gain);
      osc.start();
      stopList.push(osc);
      gain.gain.linearRampToValueAtTime(0.3, t + 1);
    } else {
      // midnight — quiet electrical hum
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 60;
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 120;
      osc.connect(gain);
      osc2.connect(gain);
      osc.start();
      osc2.start();
      stopList.push(osc, osc2);
      gain.gain.linearRampToValueAtTime(0.16, t + 1);
    }

    Sound.ambNodes = { gain, stopList };
    Sound.ambEnv = env;
  }

  function setEnabled(on) {
    Sound.enabled = !!on;
    applyGains();
    if (!Sound.enabled) {
      stopIdle();
      stopAmbience();
    }
  }

  function setVolume(v) {
    Sound.volume = Math.max(0, Math.min(1, Number(v) || 0));
    applyGains();
  }

  function play(name, arg) {
    if (!Sound.enabled) return;
    unlock();
    switch (name) {
      case "click":
        return playClick();
      case "panel":
        return playPanel();
      case "whoosh":
        return playWhoosh();
      case "engineStart":
        return playEngineStart();
      case "headlight":
        return playHeadlight();
      case "diagBeep":
        return playDiagBeep(arg || 0);
      case "diagPass":
        return playDiagPass();
      case "blueprint":
        return playBlueprint();
      case "success":
        return playSuccess();
      default:
        return playClick();
    }
  }

  window.NGSound = {
    unlock,
    play,
    startIdle,
    stopIdle,
    startAmbience,
    stopAmbience,
    setEnabled,
    setVolume,
    get enabled() {
      return Sound.enabled;
    },
    get volume() {
      return Sound.volume;
    }
  };
})();
