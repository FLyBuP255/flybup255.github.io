window.NFC_CITY = window.NFC_CITY || {};

/**
 * Процедурный Web Audio API движок:
 * - Реалистичный многослойный шум дождя + порывы ветра + далёкий гром
 * - 3 спокойных пресета (rain_only, lofi_piano, night_ambient)
 * - Реалистичный гудок авто, лёгкий звук запуска и столкновения
 */
window.NFC_CITY.Audio = (function () {
  let ctx = null;
  let master = null;
  let rainGain = null;
  let musicGain = null;
  let trainGain = null;
  let noiseBuf = null;
  let rainBedSrc = null;
  let rainHissSrc = null;
  let rainLp = null;
  let rainHissBp = null;
  let rainHissGain = null;
  let trainSrc = null;
  let trainFilter = null;
  let lfoOsc = null;
  let enabled = false;
  let musicDucked = false;
  let preset = "lofi_piano";
  let step = 0;
  let nextStepTime = 0;
  let timerId = null;

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);

    rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainGain.connect(master);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.42;
    musicGain.connect(master);

    trainGain = ctx.createGain();
    trainGain.gain.value = 0.0;
    trainGain.connect(master);

    // 3-секундный буфер естественного розового/коричневого шума для дождя
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 0.65));
    }
    return ctx;
  }

  function startRainBed() {
    if (!ctx || rainBedSrc) return;

    // Слой 1: мягкий ровный стук дождя по асфальту и крыше
    rainBedSrc = ctx.createBufferSource();
    rainBedSrc.buffer = noiseBuf;
    rainBedSrc.loop = true;
    rainLp = ctx.createBiquadFilter();
    rainLp.type = "lowpass";
    rainLp.frequency.value = 720;
    const g1 = ctx.createGain();
    g1.gain.value = 0.55;
    rainBedSrc.connect(rainLp);
    rainLp.connect(g1);
    g1.connect(rainGain);
    rainBedSrc.start();

    // Слой 2: мелкая водяная взвесь с плавной модуляцией ветром
    rainHissSrc = ctx.createBufferSource();
    rainHissSrc.buffer = noiseBuf;
    rainHissSrc.loop = true;
    rainHissBp = ctx.createBiquadFilter();
    rainHissBp.type = "bandpass";
    rainHissBp.frequency.value = 2600;
    rainHissBp.Q.value = 0.7;
    rainHissGain = ctx.createGain();
    rainHissGain.gain.value = 0.14;

    lfoOsc = ctx.createOscillator();
    lfoOsc.frequency.value = 0.14;
    const lfoAmp = ctx.createGain();
    lfoAmp.gain.value = 0.05;
    lfoOsc.connect(lfoAmp);
    lfoAmp.connect(rainHissGain.gain);
    lfoOsc.start();

    rainHissSrc.connect(rainHissBp);
    rainHissBp.connect(rainHissGain);
    rainHissGain.connect(rainGain);
    rainHissSrc.start();

    // Слой 3: приглушённый низкочастотный гул пригородного поезда на эстакаде
    trainSrc = ctx.createBufferSource();
    trainSrc.buffer = noiseBuf;
    trainSrc.loop = true;
    trainFilter = ctx.createBiquadFilter();
    trainFilter.type = "lowpass";
    trainFilter.frequency.value = 115;
    trainSrc.connect(trainFilter);
    trainFilter.connect(trainGain);
    trainSrc.start();
  }

  function rhodesNote(t, freq, dur, vol, dest = musicGain) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 2, t);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1250, t);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc1.connect(filt);
    osc2.connect(g2);
    g2.connect(filt);
    filt.connect(g);
    g.connect(dest || musicGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  function waterPlink(t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 900 + Math.random() * 900;
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.05);
    g.gain.setValueAtTime(0.022, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07);
    osc.connect(g);
    g.connect(rainGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  function scheduleStep(s, t) {
    if (!ctx || !enabled) return;

    if (preset === "rain_only") {
      if (Math.random() < 0.35) waterPlink(t + Math.random() * 0.15);
      return;
    }

    if (musicDucked) return;

    if (preset === "lofi_piano") {
      // Спокойная прогрессия септаккордов (~70 BPM): Fmaj7 -> Em7 -> Dm7 -> Cmaj7
      const chords = [
        [174.61, 220.0, 261.63, 329.63],
        [164.81, 196.0, 246.94, 293.66],
        [146.83, 174.61, 220.0, 261.63],
        [130.81, 164.81, 196.0, 246.94]
      ];
      const bar = Math.floor(s / 4);
      const beat = s % 4;
      const chord = chords[bar];
      if (beat === 0) {
        chord.forEach((f, idx) => rhodesNote(t + idx * 0.035, f, 2.3, 0.095));
      } else if (beat === 2 && Math.random() < 0.7) {
        rhodesNote(t, chord[2] * 2, 0.9, 0.045);
      } else if (beat === 3 && Math.random() < 0.5) {
        rhodesNote(t, chord[3] * 2, 0.65, 0.035);
      }
      return;
    }

    if (preset === "night_ambient") {
      const pads = [
        [130.81, 196.0, 293.66],
        [110.0, 164.81, 246.94]
      ];
      if (s % 8 === 0) {
        const p = pads[(s / 8) % pads.length];
        p.forEach((f) => rhodesNote(t, f, 3.8, 0.065));
      }
    }
  }

  function tickScheduler() {
    if (!ctx || !enabled) return;
    if (nextStepTime < ctx.currentTime - 0.5) {
      nextStepTime = ctx.currentTime + 0.05;
    }
    while (nextStepTime < ctx.currentTime + 0.25) {
      scheduleStep(step, nextStepTime);
      step = (step + 1) % 16;
      nextStepTime += 0.42; // спокойный шаг ~71 BPM
    }
    timerId = setTimeout(tickScheduler, 80);
  }

  function start() {
    const c = ensureContext();
    if (!c) return false;
    if (c.state === "suspended") c.resume().catch(() => {});
    startRainBed();
    rainGain.gain.setTargetAtTime(0.48, c.currentTime, 0.25);
    musicGain.gain.setTargetAtTime(musicDucked || preset === "rain_only" ? 0 : 0.42, c.currentTime, 0.15);
    enabled = true;
    step = 0;
    nextStepTime = c.currentTime + 0.05;
    clearTimeout(timerId);
    tickScheduler();
    return true;
  }

  function stop() {
    enabled = false;
    clearTimeout(timerId);
    if (ctx) {
      if (rainGain) rainGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.12);
      if (musicGain) musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.12);
      if (trainGain) trainGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.12);
    }
  }

  function toggle() {
    if (enabled) stop();
    else start();
    return enabled;
  }

  function setPreset(name) {
    if (name) preset = name;
    musicDucked = false;
    if (ctx && musicGain) {
      musicGain.gain.setTargetAtTime(preset === "rain_only" ? 0 : 0.42, ctx.currentTime, 0.18);
    }
    if (!enabled) start();
  }

  function setMusicDucked(val) {
    musicDucked = Boolean(val);
    if (!ctx || !musicGain) return;
    const target = !enabled || musicDucked || preset === "rain_only" ? 0 : 0.42;
    musicGain.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
  }

  function getPreset() {
    return preset;
  }

  function isEnabled() {
    return enabled;
  }

  function playIgnition() {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(58, t);
    osc.frequency.linearRampToValueAtTime(92, t + 0.22);
    osc.frequency.linearRampToValueAtTime(64, t + 0.5);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.58);
  }

  function playHorn(pitch = 1) {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    [392 * pitch, 493.88 * pitch].forEach((freq) => {
      const osc = c.createOscillator();
      const filt = c.createBiquadFilter();
      const g = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      filt.type = "lowpass";
      filt.frequency.value = 1400;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.015);
      g.gain.setValueAtTime(0.12, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(filt);
      filt.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  function playCrash(intensity = 0.6) {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const power = Math.max(0.25, Math.min(1, intensity));

    // Низкий удар кузова
    const osc = c.createOscillator();
    const g1 = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.16);
    g1.gain.setValueAtTime(0.4 * power, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g1);
    g1.connect(master);
    osc.start(t);
    osc.stop(t + 0.2);

    // Короткий хруст металла / брызг
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1350;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.25 * power, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(bp);
    bp.connect(g2);
    g2.connect(master);
    src.start(t);
    src.stop(t + 0.16);
  }

  function playThunder() {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(135, t);
    lp.frequency.exponentialRampToValueAtTime(48, t + 2.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 2.6);
  }

  function playZoneEnter(isSecret) {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const notes = isSecret ? [392, 493.88, 587.33, 783.99] : [440, 554.37];
    notes.forEach((f, idx) => rhodesNote(t + idx * 0.08, f, 0.7, 0.055, master));
  }

  function setShelterLevel(val) {
    if (!ctx || !rainLp || !rainHissGain) return;
    const s = Math.max(0, Math.min(1, val || 0));
    const t = ctx.currentTime;
    rainLp.frequency.setTargetAtTime(720 - s * 485, t, 0.18);
    rainHissGain.gain.setTargetAtTime(0.14 * (1 - s * 0.72), t, 0.18);
  }

  function setTrainProximity(val) {
    if (!ctx || !trainGain || !trainFilter) return;
    const p = enabled ? Math.max(0, Math.min(1, val || 0)) : 0;
    const t = ctx.currentTime;
    trainGain.gain.setTargetAtTime(p * 0.24, t, 0.14);
    trainFilter.frequency.setTargetAtTime(95 + p * 95, t, 0.14);
  }

  function playLightClick() {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.032);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  function playMeow() {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const filt = c.createBiquadFilter();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(510, t);
    osc.frequency.linearRampToValueAtTime(710, t + 0.11);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.34);
    filt.type = "lowpass";
    filt.frequency.value = 1800;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc.connect(filt);
    filt.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  function playBumpPed() {
    if (!enabled) return;
    const c = ensureContext();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(54, t + 0.11);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.14);

    // Мягкий плеск лужи при толчке
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 950;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.09, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(bp);
    bp.connect(g2);
    g2.connect(master);
    src.start(t);
    src.stop(t + 0.12);
  }

  return {
    start,
    stop,
    toggle,
    setPreset,
    getPreset,
    isEnabled,
    playIgnition,
    playHorn,
    playCrash,
    playThunder,
    playZoneEnter,
    setShelterLevel,
    setTrainProximity,
    setMusicDucked,
    playLightClick,
    playMeow,
    playBumpPed
  };
})();
