(function () {
  const { CONFIG, Audio, City } = window.NFC_CITY;

  const canvas = document.getElementById("city-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ui = {
    intro: document.getElementById("intro-overlay"),
    introTag: document.getElementById("intro-tag"),
    introTitle: document.getElementById("intro-title"),
    introSubtitle: document.getElementById("intro-subtitle"),
    introStartBtn: document.getElementById("intro-start-btn"),
    introAudioCheck: document.getElementById("intro-audio-check"),
    dots: document.getElementById("hud-zone-dots"),
    count: document.getElementById("hud-zone-count"),
    zonePill: document.getElementById("hud-zone-pill"),
    zoneName: document.getElementById("hud-zone-name"),
    speedVal: document.getElementById("hud-speed-val"),
    audioBtn: document.getElementById("audio-toggle"),
    audioIcon: document.getElementById("audio-icon"),
    lightsBtn: document.getElementById("btn-lights"),
    lightsIcon: document.getElementById("lights-icon"),
    lightsLabel: document.getElementById("lights-label"),
    panel: document.getElementById("zone-panel"),
    panelBadge: document.getElementById("panel-badge"),
    panelTitle: document.getElementById("panel-title"),
    panelBody: document.getElementById("panel-body"),
    panelClose: document.getElementById("panel-close"),
    toast: document.getElementById("hud-toast"),
    secretBar: document.getElementById("secret-track-bar"),
    secretToggle: document.getElementById("secret-track-toggle"),
    secretVol: document.getElementById("secret-track-vol"),
    secretTitle: document.getElementById("secret-track-title"),
    secretLink: document.getElementById("secret-track-link"),
    joyPad: document.getElementById("joystick-pad"),
    joyKnob: document.getElementById("joystick-knob"),
    boostBtn: document.getElementById("btn-boost"),
    hornBtn: document.getElementById("btn-horn")
  };

  ui.introTag.textContent = CONFIG.brand.tag;
  ui.introTitle.textContent = CONFIG.brand.title;
  ui.introSubtitle.textContent = CONFIG.brand.subtitle;
  ui.introStartBtn.textContent = CONFIG.brand.startButton;

  const state = {
    started: false,
    activeZone: "home",
    dismissedZone: null,
    explored: { about: false, vibes: false, contact: false, setup: false, secret: false },
    aboutFile: "bio.md",
    setupTab: CONFIG.districts.setup.tabs[0].id,
    carId: "sedan",
    secretUnlocked: false
  };

  // Привязываем звуки столкновений, грома, пешеходов, кота и ответного гудка
  City.setCallbacks({
    onCollision: (intensity, hitCar) => {
      Audio.playCrash(intensity);
      if (hitCar && intensity > 0.35) {
        setTimeout(() => Audio.playHorn(0.88 + Math.random() * 0.2), 200);
      }
    },
    onThunder: () => {
      Audio.playThunder();
    },
    onHornReply: (pitch) => {
      Audio.playHorn(pitch);
    },
    onPedBump: () => {
      Audio.playBumpPed();
    },
    onCatMeow: () => {
      Audio.playMeow();
      showToast("🐈 Meow! Ginger cat under the CAFE awning");
    }
  });

  // ==================== RESIZE / DPR ====================
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let lastDpr = 1;
  let lastRawDpr = window.devicePixelRatio || 1;
  let dprDowngraded = false;
  let dprPerfCap = vw * vh > 900000 ? 1.25 : 1.5;
  let needsResize = false;

  function resize() {
    needsResize = false;
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    lastRawDpr = window.devicePixelRatio || 1;
    if (!dprDowngraded) {
      dprPerfCap = vw * vh > 900000 ? 1.25 : 1.5;
    } else {
      dprPerfCap = 1.0;
    }
    const dpr = Math.min(lastRawDpr, dprPerfCap);
    lastDpr = dpr;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
  }

  const queueResize = () => {
    needsResize = true;
  };
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(queueResize).observe(canvas);
  }
  window.addEventListener("resize", queueResize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", queueResize);
  resize();

  // ==================== INPUT ====================
  const keys = { up: false, down: false, left: false, right: false, boost: false };
  const joy = { active: false, x: 0, y: 0, pointerId: null };
  let touchBoost = false;

  const KEY_MAP = {
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
    ShiftLeft: "boost", ShiftRight: "boost"
  };

  function honkAndPing() {
    City.triggerHorn();
    Audio.playHorn(1);
  }

  function syncLightsBtn() {
    const mode = City.getHeadlightMode();
    const iconMap = { low: "💡", high: "🔆", off: "🌑" };
    const labelMap = { low: "Low", high: "High", off: "Off" };
    ui.lightsIcon.textContent = iconMap[mode] || "💡";
    ui.lightsLabel.textContent = labelMap[mode] || "Low";
    ui.lightsBtn.classList.toggle("on", mode !== "off");
  }

  function switchLights() {
    const mode = City.cycleHeadlights();
    Audio.playLightClick();
    syncLightsBtn();
    const toastMap = {
      low: "💡 Low beam headlights",
      high: "🔆 High beam headlights",
      off: "🌑 Headlights off"
    };
    showToast(toastMap[mode] || "💡 Headlights");
  }

  window.addEventListener("keydown", (e) => {
    if (!state.started) return;
    if (e.code === "Escape" && !e.repeat && !ui.panel.classList.contains("hidden")) {
      clearInterval(pixelInterval);
      state.dismissedZone = state.activeZone;
      ui.panel.classList.add("hidden");
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) honkAndPing();
      return;
    }
    if (e.code === "KeyL" && !e.repeat) {
      e.preventDefault();
      switchLights();
      return;
    }
    const k = KEY_MAP[e.code];
    if (k) {
      e.preventDefault();
      keys[k] = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    const k = KEY_MAP[e.code];
    if (k) keys[k] = false;
  });

  window.addEventListener("blur", () => {
    keys.up = keys.down = keys.left = keys.right = keys.boost = false;
    touchBoost = false;
    ui.boostBtn.classList.remove("active");
    releaseJoy();
  });

  let joyRect = null;
  function updateJoystick(clientX, clientY) {
    const rect = joyRect || ui.joyPad.getBoundingClientRect();
    const maxR = rect.width * 0.36;
    if (maxR <= 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joy.x = dx / maxR;
    joy.y = dy / maxR;
    ui.joyKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }

  ui.joyPad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    joy.active = true;
    joy.pointerId = e.pointerId;
    joyRect = ui.joyPad.getBoundingClientRect();
    ui.joyPad.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  ui.joyPad.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  });
  function releaseJoy(e) {
    if (e && e.pointerId !== undefined && joy.pointerId !== null && e.pointerId !== joy.pointerId) return;
    joy.active = false;
    joy.pointerId = null;
    joyRect = null;
    joy.x = 0;
    joy.y = 0;
    ui.joyKnob.style.transform = "translate(0px, 0px)";
  }
  ui.joyPad.addEventListener("pointerup", releaseJoy);
  ui.joyPad.addEventListener("pointercancel", releaseJoy);

  ui.boostBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touchBoost = true;
    ui.boostBtn.classList.add("active");
  });
  const boostOff = () => {
    touchBoost = false;
    ui.boostBtn.classList.remove("active");
  };
  ui.boostBtn.addEventListener("pointerup", boostOff);
  ui.boostBtn.addEventListener("pointercancel", boostOff);
  ui.boostBtn.addEventListener("pointerleave", boostOff);

  ui.hornBtn.addEventListener("click", () => {
    honkAndPing();
    ui.hornBtn.blur();
    showToast("📯 Beep! Undiscovered districts pinged");
  });

  const SecretTrack = (function () {
    const cfg = CONFIG.districts.secret.track || {};
    let audioEl = null;
    let ytPlayer = null;
    let ytLoading = false;
    let ytReady = false;
    let mode = "none";
    let playing = false;
    let vol = Math.round((cfg.volume ?? 0.22) * 100);

    ui.secretVol.value = String(vol);
    if (cfg.title) ui.secretTitle.textContent = `♪ ${cfg.title}`;
    if (cfg.youtubeUrl) ui.secretLink.href = cfg.youtubeUrl;

    function syncBar() {
      ui.secretToggle.textContent = playing ? "⏸" : "▶";
    }

    function applyVolume() {
      if (audioEl) audioEl.volume = Math.max(0, Math.min(1, vol / 100));
      if (ytPlayer && ytReady && typeof ytPlayer.setVolume === "function") {
        ytPlayer.setVolume(vol);
      }
    }

    function loadYouTubeFallback() {
      if (mode === "local" || ytPlayer || ytLoading || !cfg.youtubeId) return;
      ytLoading = true;
      mode = "yt";

      const prevReady = window.onYouTubeIframeAPIReady;
      const createPlayer = () => {
        if (!window.YT || !window.YT.Player || ytPlayer) return;
        ytPlayer = new window.YT.Player("yt-secret-host", {
          height: "1",
          width: "1",
          videoId: cfg.youtubeId,
          playerVars: {
            autoplay: playing ? 1 : 0,
            loop: 1,
            playlist: cfg.youtubeId,
            controls: 0,
            playsinline: 1,
            ...(window.location.protocol.startsWith("http") ? { origin: window.location.origin } : {})
          },
          events: {
            onReady: (ev) => {
              ytReady = true;
              ev.target.setVolume(vol);
              if (playing) ev.target.playVideo();
              else ev.target.pauseVideo();
            },
            onStateChange: (ev) => {
              if (ev.data === 0 && playing) ev.target.playVideo();
            },
            onError: () => {}
          }
        });
      };

      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevReady === "function") prevReady();
        createPlayer();
      };

      if (window.YT && window.YT.Player) {
        createPlayer();
      } else if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        s.onerror = () => {
          ytLoading = false;
          mode = "none";
        };
        document.head.appendChild(s);
      }
    }

    function start() {
      ui.secretBar.classList.remove("hidden");
      playing = true;
      Audio.setMusicDucked(true);
      syncBar();
      if (state.activeZone === "vibes") renderZonePanel();

      if (mode === "local" && audioEl) {
        applyVolume();
        audioEl.play().catch(() => {});
        return;
      }
      if (mode === "yt" && ytPlayer && ytReady) {
        applyVolume();
        ytPlayer.playVideo();
        return;
      }

      if (cfg.localSrc && mode === "none") {
        mode = "probing";
        audioEl = document.createElement("audio");
        audioEl.src = cfg.localSrc;
        audioEl.loop = true;
        audioEl.preload = "auto";
        audioEl.volume = Math.max(0, Math.min(1, vol / 100));
        audioEl.addEventListener("canplay", () => {
          mode = "local";
          if (playing) audioEl.play().catch(() => {});
        }, { once: true });
        audioEl.addEventListener("error", () => {
          audioEl = null;
          if (mode === "probing") {
            mode = "none";
            loadYouTubeFallback();
          }
        }, { once: true });
        audioEl.load();
        audioEl.play().catch(() => {});
      } else if (mode === "none") {
        loadYouTubeFallback();
      }
    }

    function pause() {
      playing = false;
      Audio.setMusicDucked(false);
      syncBar();
      if (state.activeZone === "vibes") renderZonePanel();
      if (audioEl) audioEl.pause();
      if (ytPlayer && ytReady && typeof ytPlayer.pauseVideo === "function") {
        ytPlayer.pauseVideo();
      }
    }

    function toggle() {
      if (playing) pause();
      else start();
    }

    function setVolume(v) {
      vol = Math.max(0, Math.min(100, Number(v) || 0));
      applyVolume();
    }

    ui.secretToggle.addEventListener("click", () => {
      toggle();
      ui.secretToggle.blur();
    });
    ui.secretVol.addEventListener("input", (e) => setVolume(e.target.value));
    ui.secretVol.addEventListener("change", () => ui.secretVol.blur());

    return { start, pause, toggle, isPlaying: () => playing };
  })();

  // ==================== TOAST & AUDIO ====================
  let toastTimer = null;
  function showToast(msg, durationMs = 2500) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), durationMs);
  }

  function syncAudioBtn() {
    const on = Audio.isEnabled();
    ui.audioIcon.textContent = on ? "🔊" : "🔇";
    ui.audioBtn.classList.toggle("on", on);
  }

  ui.audioBtn.addEventListener("click", () => {
    Audio.toggle();
    syncAudioBtn();
    lastShelter = -1;
    lastTrain = -1;
    ui.audioBtn.blur();
    if (state.activeZone === "vibes") renderZonePanel();
  });

  ui.lightsBtn.addEventListener("click", () => {
    switchLights();
    ui.lightsBtn.blur();
  });
  syncLightsBtn();

  ui.zonePill.addEventListener("click", () => {
    ui.zonePill.blur();
    if (state.activeZone !== "home") {
      state.dismissedZone = null;
      renderZonePanel();
    }
  });

  ui.panelClose.addEventListener("click", () => {
    clearInterval(pixelInterval);
    state.dismissedZone = state.activeZone;
    ui.panel.classList.add("hidden");
    ui.panelClose.blur();
  });

  ui.introStartBtn.addEventListener("click", () => {
    state.started = true;
    ui.intro.classList.add("hidden");
    if (ui.introAudioCheck.checked) {
      Audio.start();
      Audio.playIgnition();
      syncAudioBtn();
      lastShelter = -1;
      lastTrain = -1;
    }
  });

  // ==================== DISTRICT PANEL ====================
  let pixelInterval = null;
  function startPixelShimmer() {
    clearInterval(pixelInterval);
    const grid = document.getElementById("portrait-shimmer");
    if (!grid) return;
    pixelInterval = setInterval(() => {
      const cells = grid.children;
      if (!cells.length) return;
      for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * cells.length);
        cells[idx].style.backgroundColor = `rgba(216, 164, 92, ${(Math.random() * 0.25).toFixed(2)})`;
        setTimeout(() => {
          if (cells[idx]) cells[idx].style.backgroundColor = "transparent";
        }, 420);
      }
    }, 420);
  }

  let lastRenderedZone = null;
  function renderZonePanel() {
    clearInterval(pixelInterval);
    const zId = state.activeZone;
    if (zId === "home" || state.dismissedZone === zId) {
      ui.panel.classList.add("hidden");
      return;
    }

    const d = CONFIG.districts[zId];
    if (!d) return;

    if (zId !== lastRenderedZone) {
      ui.panelBody.scrollTop = 0;
      lastRenderedZone = zId;
    }

    ui.panel.style.setProperty("--accent", d.color);
    ui.panelBadge.textContent = d.badge;
    ui.panelTitle.textContent = d.title;
    ui.panel.classList.remove("hidden");

    if (zId === "about") {
      const filesHtml = Object.keys(d.files).map((fn) => `
        <button type="button" data-file="${fn}" class="exp-file-btn ${state.aboutFile === fn ? "active" : ""}">📄 ${fn}</button>
      `).join("");
      const cellsHtml = Array.from({ length: 16 }, () => `<div class="pixel-cell"></div>`).join("");
      const activeText = (d.files[state.aboutFile] || Object.values(d.files)[0] || "").replace(/\n/g, "<br>");

      ui.panelBody.innerHTML = `
        <div class="about-top">
          <div class="pixel-portrait">
            <span class="pixel-portrait-initials">${d.initials}</span>
            <div id="portrait-shimmer" class="pixel-shimmer-grid">${cellsHtml}</div>
          </div>
          <div>
            <div style="font-weight:800; font-size:15px;">${d.name}</div>
            <div style="font-family:var(--font-mono); font-size:11px; color:var(--muted); margin-top:2px;">${d.tagline}</div>
          </div>
        </div>
        <div class="explorer-box">
          <div class="explorer-bar">
            <span class="exp-dot" style="background:#be7a63"></span>
            <span class="exp-dot" style="background:#d8a45c"></span>
            <span class="exp-dot" style="background:#6d9481"></span>
            <span>${state.aboutFile}</span>
          </div>
          <div class="explorer-grid">
            <div class="explorer-files">${filesHtml}</div>
            <div class="explorer-content">${activeText}</div>
          </div>
        </div>
      `;
      ui.panelBody.querySelectorAll("[data-file]").forEach((btn) => {
        btn.onclick = () => { state.aboutFile = btn.dataset.file; renderZonePanel(); };
      });
      startPixelShimmer();
    } else if (zId === "vibes") {
      const cur = Audio.getPreset();
      const tracksHtml = d.tracks.map((t) => {
        const playing = Audio.isEnabled() && cur === t.preset && (!SecretTrack.isPlaying() || t.preset === "rain_only");
        return `
          <div class="track-card ${playing ? "active" : ""}" data-preset="${t.preset}">
            <div class="track-meta">
              <span class="track-title">${t.title}</span>
              <span class="track-sub">${t.bpm} · ${t.genre}</span>
            </div>
            <button type="button" class="track-play-btn">${playing ? "■ Stop" : "▶ Play"}</button>
          </div>
        `;
      }).join("");
      const likesHtml = d.likes.map((l) => `<span class="mini-tag">${l}</span>`).join("");

      ui.panelBody.innerHTML = `
        <p style="color:var(--muted)">${d.description}</p>
        ${tracksHtml}
        <div class="tag-row">${likesHtml}</div>
      `;
      ui.panelBody.querySelectorAll("[data-preset]").forEach((card) => {
        card.onclick = () => {
          const p = card.dataset.preset;
          const cardActive = Audio.isEnabled() && Audio.getPreset() === p && (!SecretTrack.isPlaying() || p === "rain_only");
          if (cardActive) {
            Audio.stop();
          } else {
            if (p !== "rain_only" && SecretTrack.isPlaying()) SecretTrack.pause();
            Audio.setPreset(p);
            if (p === "rain_only" && SecretTrack.isPlaying()) Audio.setMusicDucked(true);
          }
          lastShelter = -1;
          lastTrain = -1;
          syncAudioBtn();
          renderZonePanel();
        };
      });
    } else if (zId === "contact") {
      const linksHtml = d.links.map((lk) => {
        if (lk.url) {
          return `<a class="contact-btn" href="${lk.url}" target="_blank" rel="noopener noreferrer"><span>${lk.label}</span><span class="contact-handle">${lk.handle} ↗</span></a>`;
        }
        return `<button type="button" class="contact-btn" data-copy="${lk.copyValue}"><span>${lk.label}</span><span class="contact-handle">${lk.handle}</span></button>`;
      }).join("");
      ui.panelBody.innerHTML = `
        <p style="color:var(--muted)">${d.description}</p>
        <div class="contact-grid">${linksHtml}</div>
      `;
      ui.panelBody.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.onclick = () => {
          const val = btn.dataset.copy;
          if (navigator.clipboard) navigator.clipboard.writeText(val).catch(() => {});
          showToast(`Copied: ${val}`);
        };
      });
    } else if (zId === "setup") {
      const tabsHtml = d.tabs.map((t) => `
        <button type="button" class="setup-tab-btn ${state.setupTab === t.id ? "active" : ""}" data-stab="${t.id}">${t.label}</button>
      `).join("");
      const activeTab = d.tabs.find((t) => t.id === state.setupTab) || d.tabs[0];
      const itemsHtml = activeTab.items.map((it) => `
        <div class="setup-item">
          <div class="setup-item-k">${it.k}</div>
          <div class="setup-item-v">${it.v}</div>
        </div>
      `).join("");

      ui.panelBody.innerHTML = `
        <div class="setup-tabs">${tabsHtml}</div>
        <div class="setup-items">${itemsHtml}</div>
      `;
      ui.panelBody.querySelectorAll("[data-stab]").forEach((btn) => {
        btn.onclick = () => { state.setupTab = btn.dataset.stab; renderZonePanel(); };
      });
    } else if (zId === "secret") {
      ui.panelBody.innerHTML = `
        <p>${d.description}</p>
        <div style="padding:8px 10px; border:1px solid #e6c27a; background:rgba(230,194,122,0.12); font-family:var(--font-mono); font-size:11.5px;">
          ${d.reward}
        </div>
        <p style="color:var(--muted); font-size:12px;">${d.note}</p>
      `;
    } else if (zId === "garage") {
      const carsHtml = d.cars.map((c) => {
        const active = state.carId === c.id;
        return `
          <button type="button" class="car-choice-btn ${active ? "active" : ""}" data-car="${c.id}">
            <div class="car-choice-head">
              <span class="car-choice-swatch" style="background:${c.color}"></span>
              <span class="car-choice-name">${c.name}${active ? " ✓" : ""}</span>
            </div>
            <div class="car-choice-desc">${c.desc}</div>
            <div class="car-choice-stats">SPD ${Math.round(c.maxSpd * 0.36)} · MASS ${c.mass}x</div>
          </button>
        `;
      }).join("");
      ui.panelBody.innerHTML = `
        <p style="color:var(--muted)">${d.description}</p>
        <div class="garage-grid">${carsHtml}</div>
        <p style="color:var(--muted); font-size:11.5px;">${d.note}</p>
      `;
      ui.panelBody.querySelectorAll("[data-car]").forEach((btn) => {
        btn.onclick = () => {
          const spec = d.cars.find((c) => c.id === btn.dataset.car);
          if (!spec) return;
          state.carId = spec.id;
          City.setPlayerCar(spec);
          Audio.playLightClick();
          showToast(`🚗 Selected car: ${spec.name}`);
          renderZonePanel();
        };
      });
    }
  }

  // ==================== HUD UPDATE ====================
  const HUD_ORDER = ["about", "vibes", "contact", "setup"];
  let lastActiveZone = null;
  let lastSecretUnlocked = null;
  let lastExploredSecret = null;
  let lastExploredMask = -1;
  let lastSpeedText = "";
  let lastShelter = -1;
  let lastTrain = -1;

  function updateHud() {
    const exp = state.explored;
    const exploredMask =
      (exp.about ? 1 : 0) |
      (exp.vibes ? 2 : 0) |
      (exp.contact ? 4 : 0) |
      (exp.setup ? 8 : 0);

    if (
      state.activeZone !== lastActiveZone ||
      state.secretUnlocked !== lastSecretUnlocked ||
      exp.secret !== lastExploredSecret ||
      exploredMask !== lastExploredMask
    ) {
      lastActiveZone = state.activeZone;
      lastSecretUnlocked = state.secretUnlocked;
      lastExploredSecret = exp.secret;
      lastExploredMask = exploredMask;

      let count = 0;
      let dotsHtml = "";
      for (let i = 0; i < 4; i++) {
        const id = HUD_ORDER[i];
        const color = City.ZONES[id].color;
        const done = exp[id];
        if (done) count++;
        dotsHtml += `<span class="zone-dot ${done ? "visited" : ""}" style="background:${done ? color : "transparent"}; border-color:${done ? color : ""}"></span>`;
      }
      const mark = exp.secret ? " ★" : state.secretUnlocked ? " ✦" : "";
      ui.count.textContent = `${count}/4` + mark;
      ui.dots.innerHTML = dotsHtml;

      if (state.activeZone === "home") {
        ui.zoneName.textContent = "PLAZA // 00";
        ui.zonePill.style.setProperty("--accent", "#d4a35d");
      } else {
        const d = CONFIG.districts[state.activeZone];
        ui.zoneName.textContent = d.pill;
        ui.zonePill.style.setProperty("--accent", d.color);
      }
    }

    const spdText = String(Math.round(City.player.speed * 0.36));
    if (spdText !== lastSpeedText) {
      lastSpeedText = spdText;
      ui.speedVal.textContent = spdText;
    }
  }

  // ==================== MAIN LOOP ====================
  const frameInput = { x: 0, y: 0, boost: false };
  let last = performance.now();
  let prevFrameNow = last;
  let avgFrameMs = 16.6;
  let slowFrames = 0;

  function frame(now) {
    const frameMs = now - prevFrameNow;
    prevFrameNow = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (state.started && !dprDowngraded && dprPerfCap > 1.0 && frameMs > 0 && frameMs < 120) {
      avgFrameMs = avgFrameMs * 0.92 + frameMs * 0.08;
      if (avgFrameMs > 20) {
        slowFrames++;
        if (slowFrames >= 40) {
          dprDowngraded = true;
          dprPerfCap = 1.0;
          needsResize = true;
        }
      } else {
        slowFrames = 0;
      }
    }

    let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (joy.active && Math.hypot(joy.x, joy.y) > 0.1) {
      ix = joy.x;
      iy = joy.y;
    }

    frameInput.x = ix;
    frameInput.y = iy;
    frameInput.boost = keys.boost || touchBoost;

    let zone = City.update(dt, frameInput, now);
    if (zone === "secret" && !state.secretUnlocked) zone = "home";
    const atm = City.getAtmosphere();
    if (Math.abs(atm.shelterLevel - lastShelter) > 0.015) {
      lastShelter = atm.shelterLevel;
      Audio.setShelterLevel(atm.shelterLevel);
    }
    if (Math.abs(atm.trainProximity - lastTrain) > 0.015) {
      lastTrain = atm.trainProximity;
      Audio.setTrainProximity(atm.trainProximity);
    }

    if (zone !== state.activeZone) {
      state.activeZone = zone;
      if (zone !== "home") {
        const firstVisit = zone in state.explored && !state.explored[zone];
        if (zone in state.explored) state.explored[zone] = true;
        if (zone === "secret") {
          City.setOverdrive(true);
          if (firstVisit) {
            showToast("★ SECRET UNLOCKED! Playing Lil Peep — ghost girl", 4000);
            SecretTrack.start();
          }
        }
        const allFour = ["about", "vibes", "contact", "setup"].every((id) => state.explored[id]);
        if (allFour && !state.secretUnlocked) {
          state.secretUnlocked = true;
          City.setSecretUnlocked(true);
          Audio.playZoneEnter(true);
          showToast("★ All 4 districts discovered! The SECRET lit up in the northeast (press Space)", 4500);
        } else {
          Audio.playZoneEnter(zone === "secret");
        }
        if (state.dismissedZone !== zone) state.dismissedZone = null;
      } else {
        state.dismissedZone = null;
      }
      renderZonePanel();
    }

    if (needsResize || (window.devicePixelRatio || 1) !== lastRawDpr) resize();

    City.render(ctx, vw, vh, now, state.explored);
    updateHud();
    requestAnimationFrame(frame);
  }

  updateHud();
  requestAnimationFrame(frame);
})();
