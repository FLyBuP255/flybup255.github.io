window.NFC_CITY = window.NFC_CITY || {};

/**
 * 2.5D Дождливый город:
 * - Реалистичный многослойный дождь, лужи с отражениями, брызги из-под колёс, редкий далёкий гром
 * - Тёплые живые окна в зданиях, пар из люков/труб, деревья, пешеходы с зонтами, стайки птиц
 * - 10 машин в спокойных цветах с физикой столкновений (импульс, занос, искры, аварийка, гудок)
 */
window.NFC_CITY.City = (function () {
  const WORLD_LIMIT = 1240;
  const RING_COORD = 500;
  const AVE_WIDTH = 112;
  const RING_WIDTH = 76;

  const ZONES = {
    about:   { id: "about",   x: 0,    y: -860, r: 92, color: "#d4a35d", label: "ABOUT" },
    vibes:   { id: "vibes",   x: -860, y: 0,    r: 92, color: "#a87278", label: "VIBES" },
    contact: { id: "contact", x: 0,    y: 860,  r: 92, color: "#7c8c6e", label: "CONTACT" },
    setup:   { id: "setup",   x: 860,  y: 0,    r: 92, color: "#b87c5d", label: "SETUP" },
    secret:  { id: "secret",  x: 830,  y: -830, r: 82, color: "#e8c782", label: "QUIET LIGHTHOUSE" },
    garage:  { id: "garage",  x: 380,  y: 380,  r: 52, color: "#a89d90", label: "GARAGE" }
  };
  const ZONE_LIST = Object.values(ZONES);

  function makeGlowCanvas(radius, stops) {
    const size = radius * 2;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const gctx = c.getContext("2d");
    const g = gctx.createRadialGradient(radius, radius, 1, radius, radius, radius);
    for (const [off, col] of stops) g.addColorStop(off, col);
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, size, size);
    return c;
  }

  function makeHeadlightSprite({ beamLen, spread, lampSep, coreRgb, midRgb, outerRgb, intensity, isHigh }) {
    const W = beamLen + 40;
    const H = Math.ceil((spread + lampSep + 32) * 2);
    const ox = 14;
    const cy = H / 2;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const gctx = c.getContext("2d");

    // Слой 1: объёмное рассеяние в дождевой дымке (5 перекрывающихся скруглённых вееров)
    const mistSpreadF = [1.18, 1.0, 0.85, 0.71, 0.58];
    const mistAlphas = [0.045, 0.065, 0.085, 0.11, 0.14];
    for (let i = 0; i < 5; i++) {
      const reach = beamLen * (1 - i * 0.04);
      const endX = ox + reach * 0.92;
      const ctrlX = ox + reach * 1.04;
      const halfS = spread * mistSpreadF[i];
      const neck = lampSep + 4.5 - i * 0.4;
      const a = mistAlphas[i] * intensity;
      const g = gctx.createLinearGradient(ox, cy, ox + reach, cy);
      g.addColorStop(0, `rgba(${outerRgb}, ${(a * 0.75).toFixed(4)})`);
      g.addColorStop(0.18, `rgba(${outerRgb}, ${a.toFixed(4)})`);
      g.addColorStop(0.58, `rgba(${outerRgb}, ${(a * 0.36).toFixed(4)})`);
      g.addColorStop(1, `rgba(${outerRgb}, 0)`);
      gctx.fillStyle = g;
      gctx.beginPath();
      gctx.moveTo(ox, cy - neck);
      gctx.lineTo(endX, cy - halfS);
      gctx.quadraticCurveTo(ctrlX, cy, endX, cy + halfS);
      gctx.lineTo(ox, cy + neck);
      gctx.closePath();
      gctx.fill();
    }

    // Слой 2: два раздельных луча левой и правой фары с лёгким асимметричным раскрытием и перекрытием в центре
    const coneFactors = [1.0, 0.74, 0.5, 0.28];
    const coneReach = [0.96, 0.9, 0.82, 0.72];
    const coneAlphas = [0.09, 0.11, 0.14, 0.18];
    const sides = lampSep > 0 ? [-1, 1] : [0];
    for (let s = 0; s < sides.length; s++) {
      const side = sides[s];
      const ly = cy + side * lampSep;
      for (let j = 0; j < 4; j++) {
        const f = coneFactors[j];
        const reach = beamLen * coneReach[j];
        const endX = ox + reach * 0.92;
        const ctrlX = ox + reach * 1.04;
        const yOuter = side === 0 ? cy - spread * f : ly + side * spread * 0.62 * f;
        const yInner = side === 0 ? cy + spread * f : ly + side * -spread * 0.14 * f;
        const yTop = Math.min(yOuter, yInner);
        const yBot = Math.max(yOuter, yInner);
        const a = coneAlphas[j] * intensity;
        const g = gctx.createLinearGradient(ox, ly, ox + reach, ly);
        g.addColorStop(0, `rgba(${midRgb}, ${a.toFixed(4)})`);
        g.addColorStop(0.24, `rgba(${midRgb}, ${(a * 0.75).toFixed(4)})`);
        g.addColorStop(0.65, `rgba(${outerRgb}, ${(a * 0.24).toFixed(4)})`);
        g.addColorStop(1, `rgba(${outerRgb}, 0)`);
        gctx.fillStyle = g;
        gctx.beginPath();
        gctx.moveTo(ox, ly - 2.2);
        gctx.lineTo(endX, yTop);
        gctx.quadraticCurveTo(ctrlX, (yTop + yBot) * 0.5, endX, yBot);
        gctx.lineTo(ox, ly + 2.2);
        gctx.closePath();
        gctx.fill();
      }
    }

    // Слой 3: ближние яркие пятна перед лампами + вытянутое центральное пятно на мокром асфальте
    for (let s = 0; s < sides.length; s++) {
      const side = sides[s];
      const rx = lampSep > 0 ? 34 : 28;
      const ry = lampSep > 0 ? 10 : 8;
      gctx.save();
      gctx.translate(ox + 18, cy + side * lampSep);
      gctx.scale(rx / ry, 1);
      const rg = gctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      rg.addColorStop(0, `rgba(${coreRgb}, ${Math.min(0.65, 0.42 * intensity).toFixed(3)})`);
      rg.addColorStop(0.5, `rgba(${midRgb}, ${(0.14 * intensity).toFixed(3)})`);
      rg.addColorStop(1, `rgba(${midRgb}, 0)`);
      gctx.fillStyle = rg;
      gctx.beginPath();
      gctx.arc(0, 0, ry, 0, Math.PI * 2);
      gctx.fill();
      gctx.restore();
    }

    const cw = beamLen * (isHigh ? 0.34 : 0.26);
    const ch = spread * (isHigh ? 0.36 : 0.3);
    gctx.save();
    gctx.translate(ox + beamLen * (isHigh ? 0.42 : 0.34), cy);
    gctx.scale(cw / ch, 1);
    const cg = gctx.createRadialGradient(0, 0, 0, 0, 0, ch);
    cg.addColorStop(0, `rgba(${midRgb}, ${((isHigh ? 0.2 : 0.12) * intensity).toFixed(3)})`);
    cg.addColorStop(1, `rgba(${midRgb}, 0)`);
    gctx.fillStyle = cg;
    gctx.beginPath();
    gctx.arc(0, 0, ch, 0, Math.PI * 2);
    gctx.fill();
    gctx.restore();

    // Слой 4: чистая отсечка сзади линии фар, чтобы засветка не заходила на капот
    gctx.globalCompositeOperation = "destination-out";
    const cutG = gctx.createLinearGradient(ox - 4, 0, ox + 1, 0);
    cutG.addColorStop(0, "rgba(0, 0, 0, 1)");
    cutG.addColorStop(1, "rgba(0, 0, 0, 0)");
    gctx.fillStyle = cutG;
    gctx.fillRect(0, 0, ox + 1, H);
    gctx.globalCompositeOperation = "source-over";
    return c;
  }

  const WIN_RGB = ["244, 225, 188", "232, 198, 139", "217, 159, 98", "201, 186, 158", "162, 174, 196"];
  const SPILL_PAD = 56;
  const SPILL_SCALE = 0.5;

  function makeWindowFanSprite(rgb) {
    const W = 96;
    const H = 72;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const sctx = c.getContext("2d");

    // Wide soft ambient scatter from window opening at (48, 0) along +Y
    sctx.save();
    sctx.translate(48, 4);
    sctx.scale(1.38, 0.95);
    const g1 = sctx.createRadialGradient(0, 0, 0, 0, 0, 32);
    g1.addColorStop(0, `rgba(${rgb}, 0.24)`);
    g1.addColorStop(0.45, `rgba(${rgb}, 0.10)`);
    g1.addColorStop(1, `rgba(${rgb}, 0)`);
    sctx.fillStyle = g1;
    sctx.beginPath();
    sctx.arc(0, 0, 32, 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();

    // Focused warm window fan pool onto nearby sidewalk
    sctx.save();
    sctx.translate(48, 12);
    sctx.scale(1.12, 0.82);
    const g2 = sctx.createRadialGradient(0, 0, 0, 0, 0, 24);
    g2.addColorStop(0, `rgba(${rgb}, 0.34)`);
    g2.addColorStop(0.5, `rgba(${rgb}, 0.14)`);
    g2.addColorStop(1, `rgba(${rgb}, 0)`);
    sctx.fillStyle = g2;
    sctx.beginPath();
    sctx.arc(0, 0, 24, 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();

    // Wet rain-slick reflection streak outward across pavement
    sctx.save();
    sctx.translate(48, 22);
    sctx.scale(0.56, 1.45);
    const g3 = sctx.createRadialGradient(0, 0, 0, 0, 0, 31);
    g3.addColorStop(0, `rgba(${rgb}, 0.18)`);
    g3.addColorStop(0.55, `rgba(${rgb}, 0.07)`);
    g3.addColorStop(1, `rgba(${rgb}, 0)`);
    sctx.fillStyle = g3;
    sctx.beginPath();
    sctx.arc(0, 0, 31, 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();

    return c;
  }

  const WIN_FAN_SPRITES = WIN_RGB.map(makeWindowFanSprite);

  const BEAM_PLAYER_LOW = makeHeadlightSprite({
    beamLen: 185, spread: 44, lampSep: 5.2,
    coreRgb: "255, 246, 224", midRgb: "245, 220, 168", outerRgb: "212, 178, 124",
    intensity: 0.92, isHigh: false
  });
  const BEAM_PLAYER_HIGH = makeHeadlightSprite({
    beamLen: 285, spread: 58, lampSep: 5.2,
    coreRgb: "255, 251, 240", midRgb: "248, 229, 190", outerRgb: "216, 190, 143",
    intensity: 1.18, isHigh: true
  });
  const BEAM_PLAYER_GOLD_LOW = makeHeadlightSprite({
    beamLen: 195, spread: 46, lampSep: 5.2,
    coreRgb: "255, 244, 196", midRgb: "242, 200, 104", outerRgb: "201, 146, 56",
    intensity: 1.0, isHigh: false
  });
  const BEAM_PLAYER_GOLD_HIGH = makeHeadlightSprite({
    beamLen: 295, spread: 60, lampSep: 5.2,
    coreRgb: "255, 247, 212", midRgb: "247, 208, 116", outerRgb: "212, 154, 58",
    intensity: 1.24, isHigh: true
  });
  const BEAM_NPC_LOW = makeHeadlightSprite({
    beamLen: 108, spread: 28, lampSep: 4.8,
    coreRgb: "255, 244, 216", midRgb: "242, 214, 162", outerRgb: "204, 172, 120",
    intensity: 0.72, isHigh: false
  });
  const BEAM_NPC_HIGH = makeHeadlightSprite({
    beamLen: 162, spread: 36, lampSep: 4.8,
    coreRgb: "255, 249, 232", midRgb: "246, 224, 178", outerRgb: "212, 184, 134",
    intensity: 0.95, isHigh: true
  });
  const BEAM_BUS_LOW = makeHeadlightSprite({
    beamLen: 122, spread: 34, lampSep: 6.4,
    coreRgb: "255, 244, 216", midRgb: "242, 214, 162", outerRgb: "204, 172, 120",
    intensity: 0.78, isHigh: false
  });
  const BEAM_BUS_HIGH = makeHeadlightSprite({
    beamLen: 175, spread: 42, lampSep: 6.4,
    coreRgb: "255, 249, 232", midRgb: "246, 224, 178", outerRgb: "212, 184, 134",
    intensity: 1.0, isHigh: true
  });
  const BEAM_SCOOTER = makeHeadlightSprite({
    beamLen: 82, spread: 18, lampSep: 0,
    coreRgb: "255, 246, 220", midRgb: "244, 220, 172", outerRgb: "208, 178, 126",
    intensity: 0.78, isHigh: false
  });

  const GLOW_LENS_LOW = makeGlowCanvas(11, [[0, "rgba(255, 245, 218, 0.55)"], [0.45, "rgba(248, 225, 176, 0.22)"], [1, "rgba(248, 225, 176, 0)"]]);
  const GLOW_LENS_HIGH = makeGlowCanvas(16, [[0, "rgba(255, 250, 235, 0.75)"], [0.45, "rgba(250, 230, 184, 0.28)"], [1, "rgba(250, 230, 184, 0)"]]);
  const GLOW_LENS_GOLD = makeGlowCanvas(15, [[0, "rgba(255, 242, 186, 0.72)"], [0.45, "rgba(242, 198, 102, 0.28)"], [1, "rgba(242, 198, 102, 0)"]]);
  const GLOW_TAIL_DIM = makeGlowCanvas(10, [[0, "rgba(190, 56, 54, 0.24)"], [1, "rgba(190, 56, 54, 0)"]]);
  const GLOW_TAIL_BRAKE = makeGlowCanvas(18, [[0, "rgba(245, 78, 72, 0.44)"], [0.5, "rgba(230, 60, 56, 0.14)"], [1, "rgba(230, 60, 56, 0)"]]);
  const GLOW_BLINK = makeGlowCanvas(8, [[0, "rgba(245, 166, 56, 0.36)"], [1, "rgba(245, 166, 56, 0)"]]);
  const GLOW_LANTERN = makeGlowCanvas(24, [[0, "rgba(244, 198, 118, 0.45)"], [1, "rgba(244, 198, 118, 0)"]]);

  const GLOW_LAMP = makeGlowCanvas(68, [[0, "rgba(240, 198, 128, 0.23)"], [1, "rgba(240, 198, 128, 0)"]]);
  const GLOW_GARAGE = makeGlowCanvas(68, [[0, "rgba(228, 186, 118, 0.25)"], [1, "rgba(228, 186, 118, 0)"]]);
  const GLOW_SECRET = makeGlowCanvas(115, [
    [0, "rgba(238, 198, 128, 0.24)"],
    [0.55, "rgba(218, 168, 94, 0.08)"],
    [1, "rgba(218, 168, 94, 0)"]
  ]);
  const GLOW_LH_LANTERN = makeGlowCanvas(46, [
    [0, "rgba(255, 244, 212, 0.65)"],
    [0.38, "rgba(244, 202, 128, 0.24)"],
    [0.72, "rgba(218, 166, 92, 0.07)"],
    [1, "rgba(218, 166, 92, 0)"]
  ]);
  const GLOW_LH_BOLLARD = makeGlowCanvas(18, [
    [0, "rgba(244, 202, 130, 0.36)"],
    [0.55, "rgba(218, 166, 92, 0.11)"],
    [1, "rgba(218, 166, 92, 0)"]
  ]);
  const GLOW_LH_RED = makeGlowCanvas(12, [
    [0, "rgba(218, 92, 82, 0.58)"],
    [0.5, "rgba(185, 68, 62, 0.16)"],
    [1, "rgba(185, 68, 62, 0)"]
  ]);

  const LH_COLLISION_R = 20;
  const LH_COLLISION_RSQ = LH_COLLISION_R * LH_COLLISION_R;
  const SECRET_BOLLARDS = [[-61, -61], [61, -61], [61, 61], [-61, 61]];

  function makeSecretPlazaSprite() {
    const size = 220;
    const cx = 110;
    const cy = 110;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const sctx = c.getContext("2d");

    // Мягкая внешняя тень дворика и мокрая гранитная терраса
    const outerG = sctx.createRadialGradient(cx, cy, 72, cx, cy, 104);
    outerG.addColorStop(0, "rgba(10, 8, 9, 0.56)");
    outerG.addColorStop(1, "rgba(10, 8, 9, 0)");
    sctx.fillStyle = outerG;
    sctx.beginPath();
    sctx.arc(cx, cy, 104, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = "#211d1f";
    sctx.beginPath();
    sctx.arc(cx, cy, 96, 0, Math.PI * 2);
    sctx.fill();
    sctx.strokeStyle = "rgba(218, 200, 174, 0.16)";
    sctx.lineWidth = 1.2;
    sctx.stroke();

    // Концентрические кольца брусчатки и радиальные швы единым путём
    const cobbleRadii = [92, 74, 54, 34];
    sctx.strokeStyle = "rgba(14, 12, 13, 0.52)";
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let i = 0; i < cobbleRadii.length; i++) {
      const rr = cobbleRadii[i];
      sctx.moveTo(cx + rr, cy);
      sctx.arc(cx, cy, rr, 0, Math.PI * 2);
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      sctx.moveTo(cx + ca * 34, cy + sa * 34);
      sctx.lineTo(cx + ca * 92, cy + sa * 92);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.14;
      const ca = Math.cos(a), sa = Math.sin(a);
      sctx.moveTo(cx + ca * 21, cy + sa * 21);
      sctx.lineTo(cx + ca * 34, cy + sa * 34);
    }
    sctx.stroke();

    // Латунная роза ветров на мокрой плитке
    sctx.strokeStyle = "rgba(212, 176, 118, 0.22)";
    sctx.lineWidth = 1.1;
    sctx.beginPath();
    sctx.arc(cx, cy, 74, 0, Math.PI * 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rIn = k % 2 === 0 ? 60 : 66;
      sctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      sctx.lineTo(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
    }
    sctx.stroke();

    // Контактная тень цоколя (ЮВ) + восьмиугольная ступенька + каменное кольцо башни
    sctx.fillStyle = "rgba(8, 7, 8, 0.45)";
    sctx.beginPath();
    sctx.arc(cx + 5, cy + 4, 28, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = "#2d2728";
    sctx.strokeStyle = "rgba(220, 198, 166, 0.24)";
    sctx.lineWidth = 1.1;
    sctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const px = cx + Math.cos(a) * 28;
      const py = cy + Math.sin(a) * 28;
      if (k === 0) sctx.moveTo(px, py);
      else sctx.lineTo(px, py);
    }
    sctx.closePath();
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = "#373031";
    sctx.beginPath();
    sctx.arc(cx, cy, 21, 0, Math.PI * 2);
    sctx.fill();
    sctx.strokeStyle = "rgba(232, 212, 178, 0.22)";
    sctx.stroke();

    // 4 невысоких гранитных столбика по краям площадки
    for (let i = 0; i < SECRET_BOLLARDS.length; i++) {
      const bx = cx + SECRET_BOLLARDS[i][0];
      const by = cy + SECRET_BOLLARDS[i][1];
      sctx.fillStyle = "rgba(6, 5, 6, 0.48)";
      sctx.beginPath();
      sctx.arc(bx + 1.5, by + 1.5, 4.4, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = "#2f2829";
      sctx.beginPath();
      sctx.arc(bx, by, 4.1, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = "#8c7349";
      sctx.beginPath();
      sctx.arc(bx, by, 1.8, 0, Math.PI * 2);
      sctx.fill();
    }

    return c;
  }

  function makeLighthouseBeamSprite() {
    const W = 420;
    const H = 176;
    const ox = 18;
    const cy = 88;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const gctx = c.getContext("2d");

    const layers = [
      { spread: 76, len: 385, alpha: 0.08, rgb: "228, 186, 114" },
      { spread: 54, len: 365, alpha: 0.11, rgb: "238, 200, 132" },
      { spread: 36, len: 345, alpha: 0.14, rgb: "248, 218, 158" },
      { spread: 22, len: 305, alpha: 0.17, rgb: "255, 236, 188" },
      { spread: 11, len: 240, alpha: 0.20, rgb: "255, 246, 218" }
    ];
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const endX = ox + L.len * 0.92;
      const ctrlX = ox + L.len * 1.04;
      const neck = 3.2 + (4 - i) * 1.1;
      const g = gctx.createLinearGradient(ox, cy, ox + L.len, cy);
      g.addColorStop(0, `rgba(${L.rgb}, ${(L.alpha * 0.85).toFixed(4)})`);
      g.addColorStop(0.14, `rgba(${L.rgb}, ${L.alpha.toFixed(4)})`);
      g.addColorStop(0.55, `rgba(${L.rgb}, ${(L.alpha * 0.32).toFixed(4)})`);
      g.addColorStop(1, `rgba(${L.rgb}, 0)`);
      gctx.fillStyle = g;
      gctx.beginPath();
      gctx.moveTo(ox, cy - neck);
      gctx.lineTo(endX, cy - L.spread);
      gctx.quadraticCurveTo(ctrlX, cy, endX, cy + L.spread);
      gctx.lineTo(ox, cy + neck);
      gctx.closePath();
      gctx.fill();
    }

    // Яркое выходное пятно на линзе Френеля
    gctx.save();
    gctx.translate(ox + 4, cy);
    gctx.scale(22 / 9, 1);
    const rg = gctx.createRadialGradient(0, 0, 0, 0, 0, 9);
    rg.addColorStop(0, "rgba(255, 246, 222, 0.38)");
    rg.addColorStop(0.5, "rgba(244, 206, 134, 0.14)");
    rg.addColorStop(1, "rgba(244, 206, 134, 0)");
    gctx.fillStyle = rg;
    gctx.beginPath();
    gctx.arc(0, 0, 9, 0, Math.PI * 2);
    gctx.fill();
    gctx.restore();

    // Чистый срез позади центра линзы, чтобы встречные лучи не перекрывались в центре
    gctx.globalCompositeOperation = "destination-out";
    const cutG = gctx.createLinearGradient(ox - 4, 0, ox + 2, 0);
    cutG.addColorStop(0, "rgba(0, 0, 0, 1)");
    cutG.addColorStop(1, "rgba(0, 0, 0, 0)");
    gctx.fillStyle = cutG;
    gctx.fillRect(0, 0, ox + 2, H);
    gctx.globalCompositeOperation = "source-over";
    return c;
  }

  const SECRET_PLAZA_SPRITE = makeSecretPlazaSprite();
  const BEAM_LIGHTHOUSE = makeLighthouseBeamSprite();
  const GLOW_TL = {
    red:    makeGlowCanvas(26, [[0, "rgba(181, 84, 82, 0.27)"],  [1, "rgba(181, 84, 82, 0)"]]),
    yellow: makeGlowCanvas(26, [[0, "rgba(207, 160, 84, 0.27)"], [1, "rgba(207, 160, 84, 0)"]]),
    green:  makeGlowCanvas(26, [[0, "rgba(114, 143, 104, 0.27)"], [1, "rgba(114, 143, 104, 0)"]])
  };

  const GLOW_TREE_WARM = makeGlowCanvas(24, [
    [0, "rgba(238, 194, 122, 0.25)"],
    [0.52, "rgba(218, 166, 90, 0.09)"],
    [1, "rgba(218, 166, 90, 0)"]
  ]);
  const GLOW_BEAM_BOUNCE = makeGlowCanvas(34, [
    [0, "rgba(255, 240, 206, 0.34)"],
    [0.45, "rgba(240, 204, 146, 0.13)"],
    [1, "rgba(240, 204, 146, 0)"]
  ]);
  const GLOW_BEAM_BOUNCE_GOLD = makeGlowCanvas(34, [
    [0, "rgba(255, 236, 174, 0.40)"],
    [0.45, "rgba(238, 186, 92, 0.15)"],
    [1, "rgba(238, 186, 92, 0)"]
  ]);
  const GLOW_WIN_HALO = makeGlowCanvas(18, [
    [0, "rgba(248, 214, 152, 0.22)"],
    [0.46, "rgba(232, 182, 108, 0.08)"],
    [1, "rgba(232, 182, 108, 0)"]
  ]);
  const GLOW_WIN_HALO_COOL = makeGlowCanvas(18, [
    [0, "rgba(186, 198, 216, 0.16)"],
    [0.46, "rgba(156, 168, 188, 0.055)"],
    [1, "rgba(156, 168, 188, 0)"]
  ]);

  const rayAngles = new Float32Array(64);
  const rayWorldX = new Float32Array(64);
  const rayWorldY = new Float32Array(64);
  const candBldgs = [];
  const candCircX = new Float32Array(32);
  const candCircY = new Float32Array(32);
  const candCircR = new Float32Array(32);
  const candCircRSq = new Float32Array(32);
  let candCircCount = 0;
  const candTrunks = [];
  const rayHitOut = { count: 0, sumX: 0, sumY: 0, minT: 0, occluded: false };

  function pushTanRays(a, da, eps, halfAng, count) {
    const lo = -halfAng + 0.001;
    const hi = halfAng - 0.001;
    const t0 = a - da - eps;
    const t1 = a - da + eps;
    const t2 = a + da - eps;
    const t3 = a + da + eps;
    if (count < 63 && t0 > lo && t0 < hi) rayAngles[count++] = t0;
    if (count < 63 && t1 > lo && t1 < hi) rayAngles[count++] = t1;
    if (count < 63 && t2 > lo && t2 < hi) rayAngles[count++] = t2;
    if (count < 63 && t3 > lo && t3 < hi) rayAngles[count++] = t3;
    return count;
  }

  function rayAABB(ox, oy, invX, invY, b, maxT) {
    const t1 = (b.x - ox) * invX;
    const t2 = (b.x2 - ox) * invX;
    const t3 = (b.y - oy) * invY;
    const t4 = (b.y2 - oy) * invY;
    const tminX = t1 < t2 ? t1 : t2;
    const tmaxX = t1 > t2 ? t1 : t2;
    const tminY = t3 < t4 ? t3 : t4;
    const tmaxY = t3 > t4 ? t3 : t4;
    const tEnter = tminX > tminY ? tminX : tminY;
    const tExit = tmaxX < tmaxY ? tmaxX : tmaxY;
    if (tExit < 0 || tEnter > tExit || tEnter >= maxT) return maxT;
    return tEnter > 0 ? tEnter : 0;
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, rSq, maxT) {
    const fx = ox - cx;
    const fy = oy - cy;
    const c = fx * fx + fy * fy - rSq;
    if (c <= 0) return 0;
    const proj = -(fx * dx + fy * dy);
    if (proj <= 0) return maxT;
    const disc = proj * proj - c;
    if (disc < 0) return maxT;
    const t = proj - Math.sqrt(disc);
    return t < maxT ? (t > 0 ? t : 0) : maxT;
  }

  function castSmoothFan(ox, oy, cosB, sinB, halfAng, tanHalf, baseCount, maxReach, includeTrunks, hitOut) {
    let count = 0;
    const step = baseCount > 1 ? (halfAng * 2) / (baseCount - 1) : 0;
    for (let i = 0; i < baseCount; i++) {
      rayAngles[count++] = -halfAng + step * i;
    }

    const px = -sinB;
    const py = cosB;
    const reachSq = maxReach * maxReach;
    const limLo = -halfAng + 0.002;
    const limHi = halfAng - 0.002;

    // Точные лучи на углы зданий для плавной тени без ступенек
    for (let bi = 0; bi < candBldgs.length && count < 60; bi++) {
      const b = candBldgs[bi];
      for (let ci = 0; ci < 4 && count < 60; ci++) {
        const cx = (ci & 1) ? b.x2 : b.x;
        const cy = (ci & 2) ? b.y2 : b.y;
        const dxW = cx - ox;
        const dyW = cy - oy;
        const lx = dxW * cosB + dyW * sinB;
        if (lx <= 0) continue;
        const ly = dxW * px + dyW * py;
        const absLy = ly < 0 ? -ly : ly;
        if (absLy >= lx * tanHalf || lx * lx + ly * ly >= reachSq) continue;
        const a = Math.atan2(ly, lx);
        if (a > limLo && a < limHi) {
          if (count < 63) rayAngles[count++] = a - 0.0025;
          if (count < 63) rayAngles[count++] = a + 0.0025;
        }
      }
    }

    // Точные касательные лучи на плоские окружности машин и сегментов автобуса
    for (let ci = 0; ci < candCircCount && count < 60; ci++) {
      const r = candCircR[ci];
      const rSq = candCircRSq[ci];
      const maxR = maxReach + r;
      const dxW = candCircX[ci] - ox;
      const dyW = candCircY[ci] - oy;
      const lx = dxW * cosB + dyW * sinB;
      if (lx <= -r) continue;
      const ly = dxW * px + dyW * py;
      const absLy = ly < 0 ? -ly : ly;
      if (absLy >= (lx > 0 ? lx : 0) * tanHalf + r * 1.35) continue;
      const dSq = lx * lx + ly * ly;
      if (dSq > rSq && dSq < maxR * maxR) {
        const a = Math.atan2(ly, lx);
        const da = Math.asin(Math.min(0.99, r / Math.sqrt(dSq)));
        count = pushTanRays(a, da, 0.003, halfAng, count);
      }
    }

    // Точные касательные и центральный луч на стволы деревьев (чтобы тонкий ствол не мерцал)
    if (includeTrunks) {
      for (let ti = 0; ti < candTrunks.length && count < 60; ti++) {
        const tr = candTrunks[ti];
        const r = tr.trunkR;
        const rSq = tr.trunkRSq;
        const dxW = tr.x - ox;
        const dyW = tr.y - oy;
        const lx = dxW * cosB + dyW * sinB;
        if (lx <= -r) continue;
        const ly = dxW * px + dyW * py;
        const absLy = ly < 0 ? -ly : ly;
        if (absLy >= (lx > 0 ? lx : 0) * tanHalf + r * 1.35) continue;
        const dSq = lx * lx + ly * ly;
        const maxR = maxReach + r;
        if (dSq > rSq && dSq < maxR * maxR) {
          const a = Math.atan2(ly, lx);
          const da = Math.asin(Math.min(0.99, r / Math.sqrt(dSq)));
          if (count < 63 && a > limLo && a < limHi) rayAngles[count++] = a;
          count = pushTanRays(a, da, 0.002, halfAng, count);
        }
      }
    }

    // Сортировка вставками на месте и сжатие почти совпадающих углов
    for (let i = 1; i < count; i++) {
      const v = rayAngles[i];
      let j = i - 1;
      while (j >= 0 && rayAngles[j] > v) {
        rayAngles[j + 1] = rayAngles[j];
        j--;
      }
      rayAngles[j + 1] = v;
    }

    const lastAng = rayAngles[count - 1];
    let uniq = 0;
    for (let i = 0; i < count; i++) {
      const a = rayAngles[i];
      if (uniq === 0 || a - rayAngles[uniq - 1] >= 0.0004) {
        rayAngles[uniq++] = a;
      }
    }
    if (uniq > 1 && rayAngles[uniq - 1] < lastAng) {
      rayAngles[uniq - 1] = lastAng;
    }

    let hitCount = 0;
    let sumX = 0;
    let sumY = 0;
    let minT = maxReach;
    let occluded = false;
    const hitLimit = maxReach * 0.94;
    const occEps = maxReach - 0.5;

    for (let k = 0; k < uniq; k++) {
      const a = rayAngles[k];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const dx = ca * cosB - sa * sinB;
      const dy = ca * sinB + sa * cosB;
      const invX = Math.abs(dx) > 1e-7 ? 1 / dx : (dx >= 0 ? 1e8 : -1e8);
      const invY = Math.abs(dy) > 1e-7 ? 1 / dy : (dy >= 0 ? 1e8 : -1e8);
      let bestT = maxReach;
      let hitSolid = false;

      for (let bi = 0; bi < candBldgs.length; bi++) {
        const t = rayAABB(ox, oy, invX, invY, candBldgs[bi], bestT);
        if (t < bestT) { bestT = t; hitSolid = true; }
      }
      for (let ci = 0; ci < candCircCount; ci++) {
        const t = rayCircle(ox, oy, dx, dy, candCircX[ci], candCircY[ci], candCircRSq[ci], bestT);
        if (t < bestT) { bestT = t; hitSolid = true; }
      }
      if (includeTrunks) {
        for (let ti = 0; ti < candTrunks.length; ti++) {
          const tr = candTrunks[ti];
          const t = rayCircle(ox, oy, dx, dy, tr.x, tr.y, tr.trunkRSq, bestT);
          if (t < bestT) { bestT = t; hitSolid = false; }
        }
      }

      const hx = ox + dx * bestT;
      const hy = oy + dy * bestT;
      rayWorldX[k] = hx;
      rayWorldY[k] = hy;
      if (bestT < occEps) occluded = true;
      if (hitSolid && bestT < hitLimit) {
        hitCount++;
        sumX += hx;
        sumY += hy;
        if (bestT < minT) minT = bestT;
      }
    }

    hitOut.count = hitCount;
    hitOut.sumX = sumX;
    hitOut.sumY = sumY;
    hitOut.minT = minT;
    hitOut.occluded = occluded;
    return uniq;
  }

  function makeTreeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawLeafRosette(gctx, cx, cy, size, leafCount, angleOffset, color, rng, alpha = 1) {
    gctx.save();
    if (alpha < 1) gctx.globalAlpha = alpha;
    gctx.fillStyle = color;
    gctx.translate(cx, cy);
    for (let i = 0; i < leafCount; i++) {
      const a = angleOffset + (i / leafCount) * Math.PI * 2 + (rng() - 0.5) * 0.52;
      const len = size * (0.76 + rng() * 0.42);
      const wid = len * (0.3 + rng() * 0.14);
      const r0 = size * (0.04 + rng() * 0.14);
      gctx.save();
      gctx.rotate(a);
      gctx.beginPath();
      gctx.moveTo(r0, 0);
      gctx.quadraticCurveTo(r0 + len * 0.46, -wid, r0 + len, 0);
      gctx.quadraticCurveTo(r0 + len * 0.46, wid, r0, 0);
      gctx.closePath();
      gctx.fill();
      gctx.restore();
    }
    gctx.restore();
  }

  function makeTreeSprites(spec) {
    const rng = makeTreeRng(spec.seed);

    // 1. Запечённая мягкая тень, приствольная почва, гранитное кольцо, корни и опавшие листья (64x64 в мире @ ~1.69x)
    const gc = document.createElement("canvas");
    gc.width = 108;
    gc.height = 108;
    const gctx = gc.getContext("2d");
    const gScale = 108 / 64;
    gctx.scale(gScale, gScale);
    const gx = 32, gy = 32;

    const shX = gx + 3.8;
    const shY = gy + 4.8;
    const shGrad = gctx.createRadialGradient(shX, shY, 2, shX, shY, 22.5);
    shGrad.addColorStop(0, "rgba(0, 0, 0, 0.42)");
    shGrad.addColorStop(0.55, "rgba(0, 0, 0, 0.20)");
    shGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    gctx.fillStyle = shGrad;
    gctx.beginPath();
    gctx.arc(shX, shY, 22.5, 0, Math.PI * 2);
    gctx.fill();

    const soilGrad = gctx.createRadialGradient(gx, gy, 1, gx, gy, 10.6);
    soilGrad.addColorStop(0, "#171413");
    soilGrad.addColorStop(0.62, "#1d1816");
    soilGrad.addColorStop(0.88, "rgba(28, 23, 21, 0.72)");
    soilGrad.addColorStop(1, "rgba(24, 20, 18, 0)");
    gctx.fillStyle = soilGrad;
    gctx.beginPath();
    gctx.arc(gx, gy, 10.6, 0, Math.PI * 2);
    gctx.fill();

    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2;
      const d = 1.8 + rng() * 6.8;
      gctx.fillStyle = rng() < 0.5 ? "rgba(44, 34, 29, 0.55)" : "rgba(18, 15, 14, 0.6)";
      gctx.beginPath();
      gctx.arc(gx + Math.cos(a) * d, gy + Math.sin(a) * d, 0.45 + rng() * 0.65, 0, Math.PI * 2);
      gctx.fill();
    }

    gctx.strokeStyle = "rgba(12, 10, 11, 0.6)";
    gctx.lineWidth = 1.8;
    gctx.beginPath();
    gctx.arc(gx, gy, 9.7, 0, Math.PI * 2);
    gctx.stroke();

    gctx.strokeStyle = "rgba(196, 184, 170, 0.16)";
    gctx.lineWidth = 1.1;
    gctx.beginPath();
    gctx.arc(gx, gy, 9.1, 0, Math.PI * 2);
    gctx.stroke();

    gctx.strokeStyle = "rgba(16, 14, 15, 0.72)";
    gctx.lineWidth = 1.0;
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI * 0.5) + (rng() - 0.5) * 0.25;
      gctx.beginPath();
      gctx.moveTo(gx + Math.cos(a) * 8.1, gy + Math.sin(a) * 8.1);
      gctx.lineTo(gx + Math.cos(a) * 10.3, gy + Math.sin(a) * 10.3);
      gctx.stroke();
    }

    const rootCount = 5;
    for (let i = 0; i < rootCount; i++) {
      const a = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.55;
      const len = 5.4 + rng() * 2.8;
      const midA = a + (rng() - 0.5) * 0.4;
      const mx = gx + Math.cos(midA) * (len * 0.52);
      const my = gy + Math.sin(midA) * (len * 0.52);
      const ex = gx + Math.cos(a) * len;
      const ey = gy + Math.sin(a) * len;

      gctx.lineCap = "round";
      gctx.strokeStyle = "#251c17";
      gctx.lineWidth = 2.0;
      gctx.beginPath();
      gctx.moveTo(gx + Math.cos(a) * 1.4, gy + Math.sin(a) * 1.4);
      gctx.quadraticCurveTo(mx, my, ex, ey);
      gctx.stroke();

      gctx.strokeStyle = "rgba(64, 50, 42, 0.65)";
      gctx.lineWidth = 0.75;
      gctx.beginPath();
      gctx.moveTo(gx + Math.cos(a) * 1.6 - 0.4, gy + Math.sin(a) * 1.6 - 0.4);
      gctx.quadraticCurveTo(mx - 0.35, my - 0.35, ex - 0.2, ey - 0.2);
      gctx.stroke();
    }

    const fallenCount = 11 + Math.floor(rng() * 4);
    for (let i = 0; i < fallenCount; i++) {
      const a = rng() * Math.PI * 2;
      const d = 7.5 + rng() * 15.5;
      const fx = gx + Math.cos(a) * d;
      const fy = gy + Math.sin(a) * d;
      const col = spec.fallen[Math.floor(rng() * spec.fallen.length)];
      drawLeafRosette(gctx, fx, fy, 1.3 + rng() * 1.0, 2, rng() * Math.PI * 2, col, rng, 0.28 + rng() * 0.2);
    }

    // 2. Нижний ярус кроны с ветвями в просветах и резной листвой (68x68 в мире @ ~1.7x)
    const lc = document.createElement("canvas");
    lc.width = 116;
    lc.height = 116;
    const lctx = lc.getContext("2d");
    const lScale = 116 / 68;
    lctx.scale(lScale, lScale);
    const lx = 34, ly = 34;

    const boughCount = 8 + Math.floor(rng() * 2);
    const boughs = [];
    for (let i = 0; i < boughCount; i++) {
      const a = (i / boughCount) * Math.PI * 2 + (rng() - 0.5) * 0.28;
      const dist = (i % 2 === 0 ? 13.4 : 10.4) + rng() * 3.8;
      boughs.push({
        a,
        dist,
        x: lx + Math.cos(a) * dist,
        y: ly + Math.sin(a) * dist,
        size: 5.0 + rng() * 2.2
      });
    }

    // Глубокая тень под кроной (со смещением на юго-восток)
    for (let i = 0; i < boughs.length; i++) {
      const b = boughs[i];
      drawLeafRosette(lctx, b.x + 1.4, b.y + 1.6, b.size * 1.12, 6, b.a + rng() * 0.4, spec.deep, rng, 0.96);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4 + rng() * 0.4;
      const d = 5 + rng() * 4;
      drawLeafRosette(lctx, lx + Math.cos(a) * d + 1.0, ly + Math.sin(a) * d + 1.2, 6.0 + rng() * 1.4, 6, rng() * Math.PI, spec.deep, rng);
    }

    // Кривые ветви тёмной коры, проглядывающие сквозь листву
    const branchCount = 5;
    for (let i = 0; i < branchCount; i++) {
      const b = boughs[Math.floor((i * boughCount) / branchCount)];
      const bendA = b.a + (rng() - 0.5) * 0.45;
      const midR = b.dist * 0.56;
      const mx = lx + Math.cos(bendA) * midR;
      const my = ly + Math.sin(bendA) * midR;
      const ex = lx + Math.cos(b.a) * (b.dist * 0.96);
      const ey = ly + Math.sin(b.a) * (b.dist * 0.96);

      lctx.lineCap = "round";
      lctx.strokeStyle = "#221a16";
      lctx.lineWidth = 2.2;
      lctx.beginPath();
      lctx.moveTo(lx, ly);
      lctx.quadraticCurveTo(mx, my, ex, ey);
      lctx.stroke();

      // Развилка на конце ветви
      const forkA = b.a + (i % 2 === 0 ? 0.55 : -0.55) + (rng() - 0.5) * 0.22;
      const fx = mx + Math.cos(forkA) * (5.0 + rng() * 2.8);
      const fy = my + Math.sin(forkA) * (5.0 + rng() * 2.8);
      lctx.lineWidth = 1.4;
      lctx.beginPath();
      lctx.moveTo(mx, my);
      lctx.lineTo(fx, fy);
      lctx.stroke();

      lctx.strokeStyle = "rgba(62, 49, 40, 0.72)";
      lctx.lineWidth = 0.75;
      lctx.beginPath();
      lctx.moveTo(lx - 0.5, ly - 0.5);
      lctx.quadraticCurveTo(mx - 0.5, my - 0.5, ex - 0.35, ey - 0.35);
      lctx.stroke();
    }

    // Основной объём нижних веток (оставляем узкие просветы к ветвям)
    for (let i = 0; i < boughs.length; i++) {
      const b = boughs[i];
      drawLeafRosette(lctx, b.x, b.y, b.size * 0.96, 6, rng() * Math.PI, spec.dark, rng);
      const subA = b.a + (rng() - 0.5) * 0.5;
      const subD = b.dist * (0.58 + rng() * 0.24);
      drawLeafRosette(lctx, lx + Math.cos(subA) * subD, ly + Math.sin(subA) * subD, b.size * 0.8, 5, rng() * Math.PI, spec.dark, rng);
    }
    for (let i = 0; i < boughs.length; i++) {
      const b = boughs[i];
      const nwBias = Math.cos(b.a + 2.35);
      drawLeafRosette(lctx, b.x - 0.8, b.y - 0.9, b.size * 0.82, 5, b.a + rng() * 0.6, spec.mid, rng, 0.92);
      if (nwBias > 0.12) {
        drawLeafRosette(lctx, b.x - 1.4, b.y - 1.5, b.size * 0.58, 4, rng() * Math.PI, spec.lit, rng, 0.85);
      }
    }

    // Запечённое объёмное самозатенение NW->SE без потери прозрачных краёв
    lctx.save();
    lctx.globalCompositeOperation = "source-atop";
    const lao = lctx.createRadialGradient(lx - 7, ly - 7, 2, lx + 3, ly + 3, 30);
    lao.addColorStop(0, "rgba(232, 224, 210, 0.06)");
    lao.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    lao.addColorStop(1, "rgba(8, 7, 9, 0.34)");
    lctx.fillStyle = lao;
    lctx.fillRect(0, 0, 68, 68);
    lctx.restore();

    // 3. Верхняя пышная макушка с влажным дождевым блеском (58x58 в мире @ ~1.72x)
    const uc = document.createElement("canvas");
    uc.width = 100;
    uc.height = 100;
    const uctx = uc.getContext("2d");
    const uScale = 100 / 58;
    uctx.scale(uScale, uScale);
    const ux = 29, uy = 29;

    const subCrowns = [
      { x: ux - 1.4, y: uy - 1.6, r: 5.8, a: rng() * Math.PI }
    ];
    const crownLobes = 5 + Math.floor(rng() * 2);
    for (let i = 0; i < crownLobes; i++) {
      const a = (i / crownLobes) * Math.PI * 2 + (rng() - 0.5) * 0.34;
      const d = 8.4 + rng() * 4.8;
      subCrowns.push({
        x: ux + Math.cos(a) * d,
        y: uy + Math.sin(a) * d,
        r: 4.5 + rng() * 1.9,
        a
      });
    }

    for (let i = 0; i < subCrowns.length; i++) {
      const s = subCrowns[i];
      drawLeafRosette(uctx, s.x + 1.2, s.y + 1.5, s.r * 1.06, 6, s.a, spec.deep, rng, 0.9);
      drawLeafRosette(uctx, s.x + 0.5, s.y + 0.6, s.r * 0.98, 6, s.a + 0.4, spec.dark, rng);
    }
    for (let i = 0; i < subCrowns.length; i++) {
      const s = subCrowns[i];
      drawLeafRosette(uctx, s.x - 0.3, s.y - 0.4, s.r * 0.88, 5, rng() * Math.PI, spec.mid, rng);
      drawLeafRosette(uctx, s.x - 1.0, s.y - 1.1, s.r * 0.72, 5, rng() * Math.PI, spec.lit, rng, 0.94);
      if (s.x <= ux + 4 || s.y <= uy + 4) {
        drawLeafRosette(uctx, s.x - 1.5, s.y - 1.6, s.r * 0.52, 4, rng() * Math.PI, spec.rim, rng, 0.84);
      }
    }

    uctx.save();
    uctx.globalCompositeOperation = "source-atop";
    const uao = uctx.createRadialGradient(ux - 6, uy - 6, 2, ux + 3, uy + 3, 25);
    uao.addColorStop(0, "rgba(242, 232, 214, 0.08)");
    uao.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    uao.addColorStop(1, "rgba(8, 7, 9, 0.24)");
    uctx.fillStyle = uao;
    uctx.fillRect(0, 0, 58, 58);
    uctx.restore();

    // Тонкие влажные блики ночного дождя на северо-западных верхних листьях
    for (let i = 0; i < 20; i++) {
      const s = subCrowns[Math.floor(rng() * subCrowns.length)];
      if (s.x > ux + 7 && s.y > uy + 7) continue;
      const a = -Math.PI * 0.75 + (rng() - 0.5) * 1.6;
      const d = rng() * (s.r * 0.85);
      const sx = s.x - 0.9 + Math.cos(a) * d;
      const sy = s.y - 1.0 + Math.sin(a) * d;
      uctx.fillStyle = `rgba(238, 229, 214, ${(0.15 + rng() * 0.12).toFixed(2)})`;
      uctx.beginPath();
      uctx.ellipse(sx, sy, 0.9 + rng() * 0.7, 0.42 + rng() * 0.25, a + 0.5, 0, Math.PI * 2);
      uctx.fill();
    }

    return { ground: gc, lower: lc, upper: uc };
  }

  const TREE_SPRITES = [
    // 0: Дождливый парковый клён (хвойно-оливковый)
    makeTreeSprites({
      seed: 101,
      deep: "#162118", dark: "#203021", mid: "#2c422c", lit: "#3c5739", rim: "#526e4a",
      fallen: ["#2d3b28", "#47412b", "#3a2e25"]
    }),
    // 1: Осенняя плёночная охра-олива
    makeTreeSprites({
      seed: 203,
      deep: "#231d16", dark: "#382d1f", mid: "#574429", lit: "#785c35", rim: "#967546",
      fallen: ["#5c4528", "#7a5b32", "#453322"]
    }),
    // 2: Северный кипарис-шалфей
    makeTreeSprites({
      seed: 307,
      deep: "#15201c", dark: "#1e302a", mid: "#2a4339", lit: "#3a594b", rim: "#507361",
      fallen: ["#273831", "#3b4737", "#322b26"]
    }),
    // 3: Пыльный бордовый клён
    makeTreeSprites({
      seed: 409,
      deep: "#221619", dark: "#362026", mid: "#4e2d35", lit: "#693c45", rim: "#85505a",
      fallen: ["#522e36", "#6b3e46", "#3b2429"]
    }),
    // 4: Второй силуэт хвойно-оливкового клёна
    makeTreeSprites({
      seed: 509,
      deep: "#162118", dark: "#203021", mid: "#2c422c", lit: "#3c5739", rim: "#526e4a",
      fallen: ["#2d3b28", "#47412b", "#3a2e25"]
    }),
    // 5: Второй силуэт осенней охры
    makeTreeSprites({
      seed: 617,
      deep: "#231d16", dark: "#382d1f", mid: "#574429", lit: "#785c35", rim: "#967546",
      fallen: ["#5c4528", "#7a5b32", "#453322"]
    })
  ];

  // Четыре перекрёстка кольца с рабочими светофорами и переходами
  const INTERSECTIONS = [
    { x: 0,    y: -RING_COORD, ewStop: 72, nsStop: 56 },
    { x: 0,    y:  RING_COORD, ewStop: 72, nsStop: 56 },
    { x: -RING_COORD, y: 0,    ewStop: 56, nsStop: 72 },
    { x:  RING_COORD, y: 0,    ewStop: 56, nsStop: 72 }
  ];

  const SIG_NS_G = { ns: "green", ew: "red" };
  const SIG_NS_Y = { ns: "yellow", ew: "red" };
  const SIG_EW_G = { ns: "red", ew: "green" };
  const SIG_EW_Y = { ns: "red", ew: "yellow" };

  function getSignalState(now) {
    const t = ((now || 0) * 0.001) % 11.0;
    if (t < 4.6) return SIG_NS_G;
    if (t < 5.5) return SIG_NS_Y;
    if (t < 10.1) return SIG_EW_G;
    return SIG_EW_Y;
  }

  const WIN_COLORS = ["#f4e1bc", "#e8c68b", "#d99f62", "#c9ba9e", "#9e9fa8"];

  function makeWindows(cols, rows, hasStorefront) {
    const list = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isGroundShop = hasStorefront && r === 0;
        const colorIdx = isGroundShop
          ? (Math.random() < 0.5 ? 0 : 1)
          : Math.floor(Math.random() * WIN_COLORS.length);
        const color = WIN_COLORS[colorIdx];
        const lit = isGroundShop ? Math.random() < 0.85 : Math.random() < 0.5;
        list.push({
          lit,
          alpha: lit ? 1 : 0,
          colorIdx,
          color,
          tv: !isGroundShop && colorIdx === 4,
          curtain: isGroundShop ? 0 : [0, 0, 0.32, 0.52][Math.floor(Math.random() * 4)],
          timer: 4 + Math.random() * 18
        });
      }
    }
    return { cols, rows, list };
  }

  // Здания в плёночной ночной гамме (тёплый графит, пыльная охра, бордо и олива)
  const BUILDINGS = [
    // NW
    { x: -415, y: -415, w: 185, h: 165, height: 150, roof: "#282325", trim: "#9e9285", style: "tower", sign: "404" },
    { x: -200, y: -415, w: 112, h: 155, height: 118, roof: "#242120", trim: "#a87278", style: "vents" },
    { x: -415, y: -215, w: 145, h: 115, height: 78,  roof: "#2b2523", trim: "#d4a35d", style: "helipad", sign: "CAFE" },
    { x: -235, y: -220, w: 145, h: 120, height: 92,  roof: "#2b2426", trim: "#a87278", style: "vents", sign: "CINEMA" },
    { x: -275, y: -1010, w: 145, h: 175, height: 158, roof: "#262123", trim: "#d4a35d", style: "tower", sign: "HOTEL" },
    { x: -275, y: -775, w: 125, h: 130, height: 104, roof: "#292422", trim: "#9e9285", style: "vents" },

    // NE (оставлен свободный угол для секретного маяка!)
    { x: 105,  y: -415, w: 145, h: 135, height: 132, roof: "#282325", trim: "#d4a35d", style: "tower", sign: "BOOKS" },
    { x: 280,  y: -415, w: 135, h: 185, height: 98,  roof: "#2c2224", trim: "#b87c5d", style: "vents", sign: "BAR" },
    { x: 105,  y: -245, w: 140, h: 135, height: 86,  roof: "#252221", trim: "#a87278", style: "helipad" },
    { x: 275,  y: -200, w: 135, h: 95,  height: 76,  roof: "#242621", trim: "#7c8c6e", style: "vents" },
    { x: 125,  y: -1000, w: 145, h: 165, height: 160, roof: "#272223", trim: "#d4a35d", style: "tower", sign: "24H" },
    { x: 125,  y: -780, w: 130, h: 125, height: 96,  roof: "#292423", trim: "#9e9285", style: "vents" },

    // SW
    { x: -415, y: 105,  w: 175, h: 130, height: 92,  roof: "#262425", trim: "#a87278", style: "fan", sign: "METRO" },
    { x: -415, y: 270,  w: 150, h: 140, height: 112, roof: "#2b2324", trim: "#b87c5d", style: "tower" },
    { x: -210, y: 115,  w: 120, h: 155, height: 126, roof: "#242621", trim: "#7c8c6e", style: "vents" },
    { x: -230, y: 295,  w: 135, h: 115, height: 86,  roof: "#2a2523", trim: "#d4a35d", style: "helipad", sign: "BAKERY" },
    { x: -1010, y: -290, w: 180, h: 135, height: 96, roof: "#272325", trim: "#a87278", style: "fan", sign: "LOUNGE" },
    { x: -1010, y: 145,  w: 185, h: 140, height: 100, roof: "#282422", trim: "#a87278", style: "fan" },

    // SE (юго-восточный угол двора 315..445 оставлен открытым под GARAGE)
    { x: 105,  y: 105,  w: 155, h: 140, height: 118, roof: "#2b2324", trim: "#b87c5d", style: "tower", sign: "STUDIO" },
    { x: 290,  y: 105,  w: 125, h: 175, height: 92,  roof: "#242621", trim: "#7c8c6e", style: "vents" },
    { x: 110,  y: 280,  w: 165, h: 135, height: 100, roof: "#272324", trim: "#a87278", style: "helipad" },
    { x: 760,  y: -305, w: 175, h: 125, height: 84,  roof: "#2a2324", trim: "#b87c5d", style: "vents", sign: "TECH" },
    { x: 760,  y: 175,  w: 175, h: 125, height: 84,  roof: "#282324", trim: "#b87c5d", style: "vents" },
    { x: 125,  y: 675,  w: 150, h: 125, height: 86,  roof: "#232621", trim: "#7c8c6e", style: "tower", sign: "PORT" },
    { x: -285, y: 675,  w: 150, h: 125, height: 90,  roof: "#242622", trim: "#7c8c6e", style: "vents" }
  ].map((b) => {
    const storefront = Boolean(b.sign && b.sign !== "404");
    const windows = makeWindows(Math.max(3, Math.floor(b.w / 28)), Math.max(3, Math.floor(b.height / 26)), storefront);
    return {
      ...b,
      x2: b.x + b.w,
      y2: b.y + b.h,
      cx: b.x + b.w * 0.5,
      cy: b.y + b.h * 0.5,
      hw: b.w * 0.5,
      hh: b.h * 0.5,
      _distSq: 0,
      storefront,
      windows,
      spillW: b.w + SPILL_PAD * 2,
      spillH: b.h + SPILL_PAD * 2,
      spillCanvas: null,
      spillCtx: null,
      spillDirty: true,
      spillCooldown: 0,
      hasSpill: false
    };
  });

  // Входы в заведения и здания (люди заходят и выходят отсюда)
  const DOORS = [
    { id: "cafe",   x: -270, y: -142, sx: -248, sy: -142, heading: Math.PI },
    { id: "books",  x: 105,  y: -348, sx: 78,   sy: -348, heading: 0 },
    { id: "metro",  x: -326, y: 105,  sx: -326, sy: 80,   heading: Math.PI / 2 },
    { id: "studio", x: 105,  y: 175,  sx: 78,   sy: 175,  heading: 0 },
    { id: "bakery", x: -95,  y: 350,  sx: -74,  sy: 350,  heading: Math.PI },
    { id: "cinema", x: -162, y: -100, sx: -162, sy: -74,  heading: -Math.PI / 2 },
    { id: "bar",    x: 415,  y: -325, sx: 444,  sy: -325, heading: Math.PI },
    { id: "hotel",  x: -130, y: -920, sx: -78,  sy: -920, heading: Math.PI }
  ];
  const METRO_DOOR = DOORS[2];

  // Предвычисленный массив фонарей на широких тротуарах (не пересоздаётся каждый кадр)
  const STREETLAMP_PTS = [
    [-78, -260], [78, -260], [-78, 260], [78, 260],
    [-260, -78], [260, -78], [-260, 78], [260, 78],
    [-78, -680], [78, -680], [-78, 680], [78, 680],
    [-680, -78], [680, -78], [-680, 78], [680, 78],
    [-556, -380], [556, 380], [-380, 556], [380, -556]
  ];

  // Лужи на асфальте
  const PUDDLES = [
    { x: -18, y: -180, rx: 32, ry: 17, rot: 0.2 },
    { x: 22,  y: 220,  rx: 28, ry: 15, rot: -0.3 },
    { x: -285, y: 16,  rx: 38, ry: 16, rot: 0.1 },
    { x: 290,  y: -14, rx: 34, ry: 18, rot: -0.2 },
    { x: 485,  y: -250, rx: 24, ry: 34, rot: 0.15 },
    { x: -485, y: 250, rx: 26, ry: 36, rot: -0.1 },
    { x: 18,  y: -700, rx: 30, ry: 19, rot: 0.25 },
    { x: -700, y: -15, rx: 35, ry: 16, rot: -0.15 },
    { x: 700,  y: 22,  rx: 30, ry: 18, rot: 0.18 },
    { x: -14,  y: 720, rx: 34, ry: 20, rot: -0.12 },
    { x: 770,  y: -740, rx: 32, ry: 22, rot: 0.3 }
  ];

  // Деревья в скверах, вдоль бульваров кольца и набережной (вынесены за широкие тротуары)
  const TREE_RAW = [
    // Существующие 13 позиций с увеличенными реалистичными кронами (r: 20..23)
    { x: -98,  y: -775, r: 21, variant: 0 }, { x: 98,   y: -775, r: 22, variant: 2 },
    { x: -98,  y: -945, r: 22, variant: 1 }, { x: 98,   y: -945, r: 20, variant: 4 },
    { x: -175, y: 962,  r: 22, variant: 0 }, { x: 175,  y: 962,  r: 23, variant: 2 },
    { x: -340, y: 962,  r: 21, variant: 1 }, { x: 340,  y: 962,  r: 22, variant: 3 },
    { x: 715,  y: -905, r: 23, variant: 2 }, { x: 930,  y: -885, r: 22, variant: 5 },
    { x: 920,  y: -715, r: 21, variant: 4 }, { x: -598, y: -135, r: 22, variant: 0 },
    { x: 598,  y: 135,  r: 23, variant: 2 },
    // Бульварные аллеи вокруг кольцевой и набережной (+17 мест, видны и в центре)
    { x: -598, y: 135,  r: 22, variant: 1 }, { x: 598,  y: -135, r: 21, variant: 4 },
    { x: -598, y: -285, r: 21, variant: 2 }, { x: 598,  y: -285, r: 22, variant: 3 },
    { x: -598, y: 285,  r: 22, variant: 4 }, { x: 598,  y: 285,  r: 21, variant: 5 },
    { x: -340, y: -598, r: 22, variant: 0 }, { x: 340,  y: 598,  r: 22, variant: 2 },
    { x: -340, y: 598,  r: 21, variant: 3 }, { x: 340,  y: -598, r: 22, variant: 1 },
    { x: -102, y: 608,  r: 21, variant: 2 }, { x: 102,  y: 608,  r: 22, variant: 4 },
    { x: -102, y: -608, r: 21, variant: 3 }, { x: 102,  y: -608, r: 22, variant: 0 },
    { x: -510, y: 962,  r: 21, variant: 2 }, { x: 510,  y: 962,  r: 22, variant: 4 },
    { x: 755,  y: -725, r: 20, variant: 3 }
  ];

  const TREE_WARM_SOURCES = [...STREETLAMP_PTS, [ZONES.secret.x, ZONES.secret.y]];
  const TREES = TREE_RAW.map((t) => {
    let bestD = Infinity;
    let bestDx = 0;
    let bestDy = 0;
    for (let i = 0; i < TREE_WARM_SOURCES.length; i++) {
      const lx = TREE_WARM_SOURCES[i][0];
      const ly = TREE_WARM_SOURCES[i][1];
      const dx = lx - t.x;
      const dy = ly - t.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        bestDx = dx;
        bestDy = dy;
      }
    }
    const warmA = bestD < 175 ? (1 - bestD / 175) * 0.85 : 0;
    const invD = bestD > 0.001 ? 1 / bestD : 0;
    const scale = t.r / 22;
    const trunkR = t.r * 0.17;
    return {
      x: t.x,
      y: t.y,
      r: t.r,
      trunkR,
      trunkRSq: trunkR * trunkR,
      gSize: scale * 64,
      gHalf: scale * 32,
      lSize: scale * 68,
      lHalf: scale * 34,
      uSize: scale * 58,
      uHalf: scale * 29,
      w0: t.r * 0.13,
      w1: t.r * 0.068,
      k1: t.r * 1.55 * 0.00125,
      k2: t.r * 2.75 * 0.00125,
      wSize: t.r * 1.9,
      wHalf: t.r * 0.95,
      warmOffX: bestDx * invD * t.r * 0.42,
      warmOffY: bestDy * invD * t.r * 0.42,
      _distSq: 0,
      variant: t.variant,
      rot: Math.sin(t.x * 0.13 + t.y * 0.07) * 0.36,
      phase: t.x * 0.037 + t.y * 0.023,
      warmDx: bestDx * invD,
      warmDy: bestDy * invD,
      warmA
    };
  });

  // 10 машин трафика в тёплых плёночных оттенках с разными габаритами и массами
  const CAR_SPECS = [
    { type: "sedan", color: "#764449", len: 28, wid: 16, mass: 1.35 },
    { type: "taxi",  color: "#c89b4f", len: 27, wid: 15, mass: 1.3 },
    { type: "hatch", color: "#5c6652", len: 24, wid: 15, mass: 1.05 },
    { type: "van",   color: "#7a6252", len: 33, wid: 17, mass: 1.85 },
    { type: "sedan", color: "#4f494b", len: 28, wid: 16, mass: 1.35 },
    { type: "hatch", color: "#664e58", len: 24, wid: 15, mass: 1.05 },
    { type: "sedan", color: "#9b8f80", len: 28, wid: 16, mass: 1.35 },
    { type: "van",   color: "#54614d", len: 33, wid: 17, mass: 1.85 },
    { type: "taxi",  color: "#c89b4f", len: 27, wid: 15, mass: 1.3 },
    { type: "sedan", color: "#6e6865", len: 28, wid: 16, mass: 1.35 }
  ];

  // Кольцо (±500) и сквозные проспекты с правой полосой
  function spawnTraffic() {
    const rCW = RING_COORD + 18;
    const rCCW = RING_COORD - 18;
    const configs = [
      // Кольцевая дорога по часовой стрелке (правая полоса +18 от центра дороги)
      { route: "ring_cw", x: rCW,  y: -320, dir: 0, speed: 70 },
      { route: "ring_cw", x: rCW,  y: 220,  dir: 0, speed: 68 },
      { route: "ring_cw", x: 190,  y: rCW,  dir: 1, speed: 72 },
      { route: "ring_cw", x: -rCW, y: 280,  dir: 2, speed: 68 },
      { route: "ring_cw", x: -rCW, y: -240, dir: 2, speed: 65 },
      { route: "ring_cw", x: -190, y: -rCW, dir: 3, speed: 71 },
      // Встречное движение по внутренней полосе кольца
      { route: "ring_ccw", x: -rCCW, y: -140, dir: 0, speed: 64 },
      { route: "ring_ccw", x: rCCW,  y: 140,  dir: 2, speed: 66 },
      // Главные проспекты (вверх-вниз и влево-вправо, смещены с запасом от центра (0, 0))
      { route: "ns", x: 32,   y: -620, dir: 0, speed: 74 },
      { route: "ew", x: -640, y: 32,   dir: 3, speed: 72 }
    ];
    return configs.map((c, idx) => {
      const spec = CAR_SPECS[idx % CAR_SPECS.length];
      const ang = c.dir === 0 ? Math.PI / 2 : c.dir === 1 ? Math.PI : c.dir === 2 ? -Math.PI / 2 : 0;
      return {
        ...c,
        ...spec,
        baseSpeed: 68 + Math.random() * 44,
        speedPhase: Math.random() * Math.PI * 2,
        speedAmp: 7 + Math.random() * 12,
        laneBias: (Math.random() - 0.5) * 7,
        yellowRunner: idx % 4 === 0,
        turnCooldown: 0,
        blinkTimer: 0,
        blockTimer: 0,
        honkCooldown: 0,
        vx: 0,
        vy: 0,
        angle: ang,
        angVel: 0,
        radius: 15,
        stunTimer: 0,
        hazardTimer: 0,
        flashTimer: 0,
        flashCooldown: 0,
        braking: false,
        blinkDir: 0,
        prevTrackWheels: null,
        lastTrackX: c.x,
        lastTrackY: c.y
      };
    });
  }

  const traffic = spawnTraffic();

  // Пешеходы: заходят/выходят в двери домов, ждут и садятся/выходят из автобуса у METRO
  const UMBRELLA_COLORS = ["#7a4449", "#5d6b56", "#a88754", "#665058", "#8a6854", "#544e4f"];
  const UMBRELLA_SPRITE_MAP = Object.create(null);
  for (let u = 0; u < UMBRELLA_COLORS.length; u++) {
    const col = UMBRELLA_COLORS[u];
    const uc = document.createElement("canvas");
    uc.width = 28;
    uc.height = 28;
    const uctx = uc.getContext("2d");
    uctx.scale(1.4, 1.4);
    uctx.translate(10, 10);
    const R = 8.4;

    uctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      const vx = Math.cos(a) * R;
      const vy = Math.sin(a) * R;
      if (i === 0) uctx.moveTo(vx, vy);
      else uctx.lineTo(vx, vy);
    }
    uctx.closePath();
    uctx.fillStyle = col;
    uctx.fill();

    uctx.beginPath();
    uctx.moveTo(0, 0);
    for (let i = 0; i <= 4; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      uctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    uctx.closePath();
    uctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    uctx.fill();

    uctx.strokeStyle = "rgba(18, 22, 28, 0.55)";
    uctx.lineWidth = 0.7;
    uctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      uctx.moveTo(0, 0);
      uctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    uctx.stroke();

    uctx.strokeStyle = "rgba(232, 240, 250, 0.35)";
    uctx.lineWidth = 1;
    uctx.beginPath();
    uctx.arc(0, 0, R * 0.76, -Math.PI * 0.85, -Math.PI * 0.2);
    uctx.stroke();

    uctx.fillStyle = "#cfc6b4";
    uctx.beginPath();
    uctx.arc(0, 0, 1.1, 0, Math.PI * 2);
    uctx.fill();
    UMBRELLA_SPRITE_MAP[col] = uc;
  }
  const COAT_COLORS = ["#332b29", "#3d352e", "#2f362c", "#422f33", "#4d4642", "#635443"];

  function makePed(cfg) {
    return {
      state: "active", // "active" | "knocked" | "getup" | "entering" | "inside" | "exiting" | "boarding" | "onBus" | "alighting"
      opacity: 1,
      targetDoor: null,
      insideTimer: 0,
      doorCooldown: 4 + Math.random() * 14,
      boardDelay: 0,
      alightTarget: null,
      vx: 0,
      vy: 0,
      fallAngle: cfg.heading || 0,
      spin: 0,
      lieTimer: 0,
      getupTimer: 0,
      alertTimer: 0,
      pauseTimer: 0,
      hurryTimer: 0,
      stepEchoTimer: Math.random() * 0.6,
      laneOffset: cfg.laneOffset || 0,
      homeX: cfg.x,
      homeY: cfg.y,
      homeHeading: cfg.heading || 0,
      hadUmb: cfg.hasUmb,
      ...cfg
    };
  }

  const pedestrians = [];
  for (let i = 0; i < 17; i++) {
    const loop = [
      { minX: -446, maxX: -72, minY: -446, maxY: -72 },
      { minX: 72,   maxX: 446, minY: -446, maxY: -72 },
      { minX: -446, maxX: -72, minY: 72,   maxY: 446 },
      { minX: 72,   maxX: 446, minY: 72,   maxY: 446 }
    ][i % 4];
    const side = i % 4;
    const frac = 0.25 + ((i * 0.29) % 0.55);
    const x = side === 0 ? loop.minX : side === 2 ? loop.maxX : loop.minX + (loop.maxX - loop.minX) * frac;
    const y = side === 1 ? loop.minY : side === 3 ? loop.maxY : loop.minY + (loop.maxY - loop.minY) * frac;
    const isPair = i % 6 === 1;
    const kind = i % 5 === 0 ? "hood" : "umbrella";
    const heading = side === 0 ? Math.PI / 2 : side === 1 ? 0 : side === 2 ? -Math.PI / 2 : Math.PI;
    const spd = kind === "hood" ? 31 + (i % 4) * 3 : 21 + (i % 4) * 3;
    const umbCol = UMBRELLA_COLORS[i % UMBRELLA_COLORS.length];
    const coat1 = COAT_COLORS[i % COAT_COLORS.length];

    pedestrians.push(makePed({
      kind,
      loop,
      side,
      x,
      y,
      heading,
      speed: spd,
      coat: coat1,
      umbrella: umbCol,
      hasUmb: kind !== "hood",
      gait: i * 1.3,
      laneOffset: isPair ? -4.5 : 0
    }));
    if (isPair) {
      pedestrians.push(makePed({
        kind: "hood",
        loop,
        side,
        x: x + 8,
        y: y + 6,
        heading,
        speed: spd,
        coat: COAT_COLORS[(i + 2) % COAT_COLORS.length],
        umbrella: null,
        hasUmb: false,
        gait: i * 1.3 + 0.8,
        laneOffset: 4.5
      }));
    }
  }

  // Пешеходы на зебрах перекрёстков (ждут зелёный сигнал и переходят дорогу)
  [
    { x: -64, y: -548, ax: -64, ay: -548, bx: 64, by: -548, axis: "ew", dirToB: true, i: 1 },
    { x: 64,  y:  548, ax: -64, ay:  548, bx: 64, by:  548, axis: "ew", dirToB: false, i: 2 },
    { x: -548, y: -64, ax: -548, ay: -64, bx: -548, by: 64, axis: "ns", dirToB: true, i: 3 },
    { x: 548,  y:  64, ax: 548,  ay: -64, bx: 548,  by: 64, axis: "ns", dirToB: false, i: 4 }
  ].forEach((cw) => {
    const hdg = cw.axis === "ew" ? (cw.dirToB ? 0 : Math.PI) : (cw.dirToB ? Math.PI / 2 : -Math.PI / 2);
    pedestrians.push(makePed({
      kind: "crosswalk",
      cw,
      x: cw.x,
      y: cw.y,
      heading: hdg,
      speed: 30,
      coat: COAT_COLORS[(cw.i + 1) % COAT_COLORS.length],
      umbrella: UMBRELLA_COLORS[(cw.i + 2) % UMBRELLA_COLORS.length],
      hasUmb: cw.i % 2 === 1,
      gait: cw.i * 1.1
    }));
  });

  // Стоящие под навесами CAFE, у BOOKS, ожидающие автобус на METRO и едущие внутри автобуса
  const swLoop = { minX: -446, maxX: -72, minY: 72, maxY: 446 };
  pedestrians.push(
    makePed({ kind: "stand", x: -259, y: -130, heading: Math.PI, coat: COAT_COLORS[1], umbrella: UMBRELLA_COLORS[0], hasUmb: false, gait: 0 }),
    makePed({ kind: "stand", x: 96,   y: -318, heading: Math.PI, coat: COAT_COLORS[0], umbrella: UMBRELLA_COLORS[2], hasUmb: false, gait: 0 }),
    makePed({ kind: "busWait", x: -344, y: 78, heading: -Math.PI / 2, speed: 24, coat: COAT_COLORS[2], umbrella: UMBRELLA_COLORS[1], hasUmb: false, loop: swLoop, side: 1, gait: 0 }),
    makePed({ kind: "busWait", x: -326, y: 78, heading: -Math.PI / 2, speed: 24, coat: COAT_COLORS[5], umbrella: UMBRELLA_COLORS[2], hasUmb: true,  loop: swLoop, side: 1, gait: 0 }),
    makePed({ kind: "busWait", x: -308, y: 78, heading: -Math.PI / 2, speed: 24, coat: COAT_COLORS[3], umbrella: UMBRELLA_COLORS[4], hasUmb: false, loop: swLoop, side: 1, gait: 0 }),
    makePed({ kind: "busWait", state: "onBus", opacity: 0, x: -560, y: 35, homeX: -344, homeY: 78, heading: Math.PI / 2, speed: 24, coat: COAT_COLORS[4], umbrella: UMBRELLA_COLORS[3], hasUmb: true, loop: swLoop, side: 1, gait: 0 }),
    makePed({ kind: "busWait", state: "onBus", opacity: 0, x: -560, y: 35, homeX: -326, homeY: 78, heading: Math.PI / 2, speed: 24, coat: COAT_COLORS[1], umbrella: UMBRELLA_COLORS[0], hasUmb: false, loop: swLoop, side: 1, gait: 0 })
  );

  // Стайки птиц (взлетают при сигнале или приближении машины)
  const birds = [];
  const birdSpots = [
    { x: -30, y: -810 }, { x: 40, y: -890 },
    { x: -10, y: 920 },  { x: 805, y: -805 },
    { x: -285, y: -290 }, { x: 215, y: 215 }
  ];
  birdSpots.forEach((spot, si) => {
    for (let j = 0; j < 4; j++) {
      const hx = spot.x + (Math.random() - 0.5) * 45;
      const hy = spot.y + (Math.random() - 0.5) * 45;
      birds.push({
        homeX: hx,
        homeY: hy,
        x: hx,
        y: hy,
        vx: 0,
        vy: 0,
        flying: false,
        flightTimer: 0,
        flapPhase: (si + j) * 0.9
      });
    }
  });

  // Падающие капли (3 слоя глубины)
  const rainLayers = [
    Array.from({ length: 85 }, () => ({ x: Math.random(), y: Math.random(), len: 10, spd: 0.72, alpha: 0.14 })),
    Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), len: 16, spd: 1.05, alpha: 0.24 })),
    Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), len: 24, spd: 1.45, alpha: 0.34 }))
  ];
  const RAIN_STROKES = ["rgba(222, 212, 198, 0.14)", "rgba(222, 212, 198, 0.24)", "rgba(222, 212, 198, 0.34)"];
  const RAIN_WIDTHS = [1, 1, 1.4];
  const ripples = [];
  const sprays = [];
  const sparks = [];
  const hornWaves = [];
  const tireMarks = [];
  const npcTireMarks = [];
  const droppedUmbrellas = [];

  // 16 мягких дождевых капель на внешних краях экрана (центр обзора всегда чистый)
  const glassDrops = Array.from({ length: 16 }, (_, idx) => {
    const edge = idx % 2 === 0 ? "left" : "right";
    const u = edge === "left" ? 0.015 + Math.random() * 0.095 : 0.89 + Math.random() * 0.095;
    return {
      edge,
      u,
      v: Math.random(),
      r: 2.2 + Math.random() * 2.6,
      vy: 0.025 + Math.random() * 0.045,
      wigglePhase: Math.random() * Math.PI * 2,
      alpha: 0.16 + Math.random() * 0.16
    };
  });

  // Живые сценки: рыжий кот под навесом CAFE, рыбак на пирсе, автобус METRO и курьер на скутере
  const cat = {
    homeX: -261,
    homeY: -172,
    x: -261,
    y: -172,
    vx: 0,
    vy: 0,
    angle: 0.25,
    tailPhase: 0,
    dartTimer: 0,
    meowCooldown: 0
  };
  const fisherman = { x: -34, y: 1092, bobPhase: 0 };
  const bus = {
    route: "ew",
    x: -560,
    y: 35,
    vx: 0,
    vy: 0,
    dir: 3,
    angle: 0,
    angVel: 0,
    speed: 60,
    len: 54,
    wid: 20,
    mass: 3.1,
    radius: 19,
    color: "#4d574c",
    stunTimer: 0,
    hazardTimer: 0,
    flashTimer: 0,
    flashCooldown: 0,
    braking: false,
    waitTimer: 0,
    alightDone: false,
    stopCooldown: 0,
    blinkDir: 0,
    prevTrackWheels: null,
    lastTrackX: -560,
    lastTrackY: 35
  };
  const scooter = {
    route: "ring_cw",
    x: RING_COORD + 26,
    y: -70,
    vx: 0,
    vy: 0,
    dir: 0,
    angle: Math.PI / 2,
    angVel: 0,
    speed: 104,
    len: 16,
    wid: 8,
    mass: 0.45,
    radius: 9,
    color: "#785c4e",
    stunTimer: 0,
    hazardTimer: 0,
    flashTimer: 0,
    flashCooldown: 0,
    braking: false,
    weavePhase: 0,
    blinkDir: 0,
    prevTrackWheels: null,
    lastTrackX: RING_COORD + 26,
    lastTrackY: -70
  };
  const allVehicles = [...traffic, bus, scooter];

  let commuterY = -1250;
  let wind = -0.14;
  let lightningAlpha = 0;
  let nextLightning = 12;
  let camShake = 0;
  let overdrive = false;
  let secretUnlocked = false;
  let headlightMode = "low"; // "low" | "high" | "off"
  let beamPitch = 0;
  let beamPitchVel = 0;
  let beamSteer = 0;
  let headlightJolt = 0;
  let prevPlayerSpeed = 0;
  let smoothLongAccel = 0;
  let beamPower = 1;
  let beamHighMix = 0;
  let lastDt = 0.016;
  const playerBounce = { x: 0, y: 0, alpha: 0, size: 56 };
  let shelterLevel = 0;
  let trainProximity = 0;
  let playerBlink = 0;
  let wetTires = 0;
  let lastTrackX = 0;
  let lastTrackY = 0;

  let playerSpec = {
    id: "sedan",
    name: "Night Sedan",
    len: 28,
    wid: 16,
    mass: 1.25,
    maxSpd: 268,
    accel: 345,
    color: "#6e6865",
    taxi: false,
    radius: 15
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    angVel: 0,
    speed: 0,
    mass: playerSpec.mass,
    radius: playerSpec.radius,
    drifting: false,
    braking: false
  };
  let autopilot = [];

  let callbacks = {
    onCollision: null,
    onThunder: null,
    onHornReply: null,
    onPedBump: null,
    onCatMeow: null
  };

  function setCallbacks(cbs) {
    callbacks = { ...callbacks, ...cbs };
  }

  function setOverdrive(val) {
    overdrive = Boolean(val);
  }

  function setSecretUnlocked(val) {
    secretUnlocked = Boolean(val);
  }

  function cycleHeadlights() {
    headlightMode = headlightMode === "low" ? "high" : headlightMode === "high" ? "off" : "low";
    return headlightMode;
  }

  function getHeadlightMode() {
    return headlightMode;
  }

  function setPlayerCar(spec) {
    if (!spec) return;
    playerSpec = {
      ...playerSpec,
      ...spec,
      radius: Math.max(13, Math.round(((spec.len || 28) + (spec.wid || 16)) * 0.34))
    };
    player.mass = playerSpec.mass;
    player.radius = playerSpec.radius;
  }

  function getAtmosphere() {
    return { shelterLevel, trainProximity };
  }

  function triggerHorn() {
    if (hornWaves.length >= 8) hornWaves.shift();
    hornWaves.push({ x: player.x, y: player.y, r: 18, alpha: 0.85 });

    // Вспугнуть ближайших птиц
    for (const b of birds) {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 270 && !b.flying) {
        const ang = Math.atan2(b.y - player.y, b.x - player.x) + (Math.random() - 0.5) * 0.8;
        b.flying = true;
        b.flightTimer = 3.5 + Math.random() * 2;
        b.vx = Math.cos(ang) * (85 + Math.random() * 45);
        b.vy = Math.sin(ang) * (85 + Math.random() * 45);
      }
    }

    // Кот под навесом CAFE может мяукнуть и отбежать чуть глубже под козырёк
    if (Math.hypot(cat.x - player.x, cat.y - player.y) < 195 && cat.meowCooldown <= 0) {
      cat.meowCooldown = 2.0;
      cat.dartTimer = 1.5;
      cat.vy = (cat.y > -120 ? -1 : 1) * 42;
      cat.vx = -22;
      if (callbacks.onCatMeow) callbacks.onCatMeow();
    }

    // Ближайшая машина может коротко моргнуть и бибикнуть в ответ
    for (const t of traffic) {
      const dist = Math.hypot(t.x - player.x, t.y - player.y);
      if (dist < 165) {
        t.flashTimer = 0.6;
        if (callbacks.onHornReply) {
          setTimeout(() => callbacks.onHornReply(0.92 + Math.random() * 0.16), 240);
        }
        break;
      }
    }
  }

  function setAutopilot(targetId) {
    if (targetId === "home") {
      autopilot = buildWaypoints(player.x, player.y, 0, 0);
      return;
    }
    const z = ZONES[targetId];
    if (!z) return;
    autopilot = buildWaypoints(player.x, player.y, z.x, z.y, targetId);
  }

  function buildWaypoints(sx, sy, tx, ty, targetId) {
    const pts = [];
    const inGaragePocket = sx > 305 && sx < 455 && sy > 305 && sy < 455;

    if (inGaragePocket && targetId !== "garage") {
      pts.push({ x: 380, y: RING_COORD });
      pts.push({ x: 0, y: RING_COORD });
      pts.push({ x: 0, y: 0 });
    } else {
      const nearV = Math.abs(sx) < 62;
      const nearH = Math.abs(sy) < 62;
      if (!nearV && !nearH) {
        if (Math.abs(sx - RING_COORD) < 88 || Math.abs(sx + RING_COORD) < 88) pts.push({ x: sx, y: 0 });
        else if (Math.abs(sy - RING_COORD) < 88 || Math.abs(sy + RING_COORD) < 88) pts.push({ x: 0, y: sy });
        else pts.push({ x: 0, y: sy });
        pts.push({ x: 0, y: 0 });
      } else if ((Math.abs(tx) > 62 && Math.abs(sy) > 62) || (Math.abs(ty) > 62 && Math.abs(sx) > 62)) {
        pts.push({ x: 0, y: 0 });
      }
    }

    if (targetId === "garage") {
      if (!inGaragePocket) {
        pts.push({ x: 0, y: RING_COORD });
        pts.push({ x: 380, y: RING_COORD });
      }
      pts.push({ x: 380, y: 380 });
      return pts;
    }

    if (targetId === "secret") {
      pts.push({ x: 0, y: -RING_COORD });
      pts.push({ x: RING_COORD, y: -RING_COORD });
      pts.push({ x: tx - 46, y: ty + 46 });
      return pts;
    }

    pts.push({ x: tx, y: ty });
    return pts;
  }

  function clearAutopilot() {
    autopilot = [];
  }

  function spawnImpactFX(cx, cy, count, includeSparks) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 140;
      if (includeSparks && i % 2 === 0) {
        if (sparks.length < 80) {
          sparks.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1 });
        }
      } else if (sprays.length < 120) {
        sprays.push({ x: cx, y: cy, vx: Math.cos(ang) * spd * 0.6, vy: Math.sin(ang) * spd * 0.6, life: 1, r: 3, gold: false });
      }
    }
  }

  function collideEntityWithBuildings(ent) {
    const r = ent.radius;
    if (ent.x < -WORLD_LIMIT) { ent.x = -WORLD_LIMIT; ent.vx = Math.abs(ent.vx) * 0.35; }
    if (ent.x > WORLD_LIMIT)  { ent.x = WORLD_LIMIT;  ent.vx = -Math.abs(ent.vx) * 0.35; }
    if (ent.y < -WORLD_LIMIT) { ent.y = -WORLD_LIMIT; ent.vy = Math.abs(ent.vy) * 0.35; }
    if (ent.y > WORLD_LIMIT)  { ent.y = WORLD_LIMIT;  ent.vy = -Math.abs(ent.vy) * 0.35; }

    // Набережная южного канала и пирс (проезд только по пирсу |x| <= 36, кромка воды y = 1082)
    if (ent.y > 995) {
      if (ent.y <= 1028 && Math.abs(ent.x) > 36) {
        ent.y = 995;
        if (ent.vy > 0) ent.vy *= -0.35;
      } else {
        if (ent.y > 1082) {
          ent.y = 1082;
          if (ent.vy > 0) ent.vy *= -0.35;
        }
        if (ent.x < -34) { ent.x = -34; if (ent.vx < 0) ent.vx *= -0.35; }
        if (ent.x > 34)  { ent.x = 34;  if (ent.vx > 0) ent.vx *= -0.35; }
      }
    }

    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i];
      if (ent.x + r < b.x || ent.x - r > b.x2 || ent.y + r < b.y || ent.y - r > b.y2) continue;
      const cx = Math.max(b.x, Math.min(ent.x, b.x2));
      const cy = Math.max(b.y, Math.min(ent.y, b.y2));
      const dx = ent.x - cx;
      const dy = ent.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < r * r) {
        let nx, ny, pen;
        if (distSq === 0) {
          const dL = ent.x - b.x, dR = b.x2 - ent.x;
          const dT = ent.y - b.y, dB = b.y2 - ent.y;
          const m = Math.min(dL, dR, dT, dB);
          if (m === dL) { nx = -1; ny = 0; pen = dL + r; }
          else if (m === dR) { nx = 1; ny = 0; pen = dR + r; }
          else if (m === dT) { nx = 0; ny = -1; pen = dT + r; }
          else { nx = 0; ny = 1; pen = dB + r; }
        } else {
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          ny = dy / dist;
          pen = r - dist;
        }
        ent.x += nx * pen;
        ent.y += ny * pen;

        const vn = ent.vx * nx + ent.vy * ny;
        if (vn < 0) {
          ent.vx -= 1.35 * vn * nx;
          ent.vy -= 1.35 * vn * ny;
          if (ent === player && Math.abs(vn) > 105) {
            const intensity = Math.min(1, Math.abs(vn) / 280);
            camShake = Math.max(camShake, intensity * 6);
            headlightJolt = Math.max(headlightJolt, Math.min(1, intensity * 1.15));
            spawnImpactFX(cx, cy, 8, true);
            if (callbacks.onCollision) callbacks.onCollision(intensity * 0.75, false);
          }
        }
      }
    }

    // Цоколь 2.5D маяка в тихом сквере (830, -830)
    const lhDx = ent.x - ZONES.secret.x;
    const lhDy = ent.y - ZONES.secret.y;
    const lhMinD = r + LH_COLLISION_R;
    const lhDistSq = lhDx * lhDx + lhDy * lhDy;
    if (lhDistSq < lhMinD * lhMinD) {
      const hasLen = lhDistSq > 1e-6;
      const lhDist = hasLen ? Math.sqrt(lhDistSq) : 0.001;
      const nx = hasLen ? lhDx / lhDist : -0.707;
      const ny = hasLen ? lhDy / lhDist : 0.707;
      const pen = lhMinD - lhDist;
      ent.x += nx * pen;
      ent.y += ny * pen;
      const vn = ent.vx * nx + ent.vy * ny;
      if (vn < 0) {
        ent.vx -= 1.35 * vn * nx;
        ent.vy -= 1.35 * vn * ny;
        if (ent === player && Math.abs(vn) > 105) {
          const intensity = Math.min(1, Math.abs(vn) / 280);
          camShake = Math.max(camShake, intensity * 6);
          headlightJolt = Math.max(headlightJolt, Math.min(1, intensity * 1.15));
          spawnImpactFX(ZONES.secret.x + nx * LH_COLLISION_R, ZONES.secret.y + ny * LH_COLLISION_R, 8, true);
          if (callbacks.onCollision) callbacks.onCollision(intensity * 0.75, false);
        }
      }
    }
  }

  function resolveCarCollisions() {
    for (const t of allVehicles) {
      const dx = player.x - t.x;
      const dy = player.y - t.y;
      const minD = player.radius + t.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minD * minD) {
        let nx, ny, dist;
        if (distSq < 1e-6) {
          nx = 1; ny = 0; dist = 0.001;
        } else {
          dist = Math.sqrt(distSq);
          nx = dx / dist;
          ny = dy / dist;
        }
        const overlap = minD - dist;
        const invM1 = 1 / player.mass;
        const invM2 = 1 / t.mass;
        const totalInvM = invM1 + invM2;

        player.x += nx * overlap * (invM1 / totalInvM);
        player.y += ny * overlap * (invM1 / totalInvM);
        t.x -= nx * overlap * (invM2 / totalInvM);
        t.y -= ny * overlap * (invM2 / totalInvM);

        const rvx = player.vx - t.vx;
        const rvy = player.vy - t.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const restitution = 0.58;
          const j = (-(1 + restitution) * velAlongNormal) / totalInvM;
          player.vx += j * invM1 * nx;
          player.vy += j * invM1 * ny;
          t.vx -= j * invM2 * nx;
          t.vy -= j * invM2 * ny;

          const tx = -ny;
          const ty = nx;
          const tangentVel = rvx * tx + rvy * ty;
          player.angVel += tangentVel * 0.015;
          t.angVel -= tangentVel * 0.024;

          const impact = Math.min(1, Math.abs(velAlongNormal) / 260);
          if (impact > 0.14) {
            headlightJolt = Math.max(headlightJolt, Math.min(1, impact * 1.15));
          }
          if (impact > 0.12) {
            camShake = Math.max(camShake, impact * 8.5);
            const mx = (player.x + t.x) / 2;
            const my = (player.y + t.y) / 2;
            spawnImpactFX(mx, my, 12, true);
            const wasStunned = t.stunTimer > 0.3;
            t.stunTimer = 2.6;
            t.hazardTimer = 4.2;
            if (!wasStunned && callbacks.onCollision) {
              callbacks.onCollision(impact, true);
            }
          }
        }
      }
    }

    for (let i = 0; i < allVehicles.length; i++) {
      for (let k = i + 1; k < allVehicles.length; k++) {
        const a = allVehicles[i], b = allVehicles[k];
        const dx = a.x - b.x, dy = a.y - b.y;
        const minD = a.radius + b.radius;
        const dSq = dx * dx + dy * dy;
        if (dSq < minD * minD) {
          let nx, ny, d;
          if (dSq < 1e-6) {
            nx = 1; ny = 0; d = 0.001;
          } else {
            d = Math.sqrt(dSq);
            nx = dx / d; ny = dy / d;
          }
          const ov = (minD - d) * 0.5;
          a.x += nx * ov; a.y += ny * ov;
          b.x -= nx * ov; b.y -= ny * ov;
          const rvx = a.vx - b.vx, rvy = a.vy - b.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const j = -(1.4 * vn) / (1 / a.mass + 1 / b.mass);
            a.vx += (j / a.mass) * nx; a.vy += (j / a.mass) * ny;
            b.vx -= (j / b.mass) * nx; b.vy -= (j / b.mass) * ny;
          }
        }
      }
    }
  }

  function isRedLightAhead(v, sig) {
    const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
    const isEW = Math.abs(fx) > Math.abs(fy);
    const axisState = isEW ? sig.ew : sig.ns;
    if (axisState === "green" || (v.yellowRunner && axisState === "yellow")) return false;

    for (const inter of INTERSECTIONS) {
      const dx = inter.x - v.x;
      const dy = inter.y - v.y;
      const along = dx * fx + dy * fy;
      const lat = Math.abs(dx * -fy + dy * fx);
      if (lat > 52) continue;
      const stopOff = isEW ? inter.ewStop : inter.nsStop;
      if (along > stopOff && along < stopOff + 48) {
        return true;
      }
    }
    return false;
  }

  const TURN_JUNCTIONS = [
    {
      ix: 0, iy: 0,
      opts: [
        { route: "ns", dir: 0, ang: Math.PI / 2 },
        { route: "ns", dir: 2, ang: -Math.PI / 2 },
        { route: "ew", dir: 3, ang: 0 },
        { route: "ew", dir: 1, ang: Math.PI }
      ]
    },
    {
      ix: 0, iy: -RING_COORD,
      opts: [
        { route: "ns", dir: 0, ang: Math.PI / 2 },
        { route: "ns", dir: 2, ang: -Math.PI / 2 },
        { route: "ring_cw", dir: 3, ang: 0 },
        { route: "ring_ccw", dir: 1, ang: Math.PI }
      ]
    },
    {
      ix: 0, iy: RING_COORD,
      opts: [
        { route: "ns", dir: 0, ang: Math.PI / 2 },
        { route: "ns", dir: 2, ang: -Math.PI / 2 },
        { route: "ring_cw", dir: 1, ang: Math.PI },
        { route: "ring_ccw", dir: 3, ang: 0 }
      ]
    },
    {
      ix: -RING_COORD, iy: 0,
      opts: [
        { route: "ew", dir: 3, ang: 0 },
        { route: "ew", dir: 1, ang: Math.PI },
        { route: "ring_cw", dir: 2, ang: -Math.PI / 2 },
        { route: "ring_ccw", dir: 0, ang: Math.PI / 2 }
      ]
    },
    {
      ix: RING_COORD, iy: 0,
      opts: [
        { route: "ew", dir: 3, ang: 0 },
        { route: "ew", dir: 1, ang: Math.PI },
        { route: "ring_cw", dir: 0, ang: Math.PI / 2 },
        { route: "ring_ccw", dir: 2, ang: -Math.PI / 2 }
      ]
    }
  ];

  function maybeTurnAtIntersection(t) {
    if (t.turnCooldown > 0) return;
    for (const j of TURN_JUNCTIONS) {
      if (Math.abs(t.x - j.ix) < 42 && Math.abs(t.y - j.iy) < 42) {
        const cand = j.opts.filter((o) => Math.cos(o.ang - t.angle) > -0.5);
        if (!cand.length) return;
        const straight = cand.find((o) => Math.cos(o.ang - t.angle) > 0.7);
        let pick;
        if (straight && Math.random() < 0.4) {
          pick = straight;
        } else {
          pick = cand[Math.floor(Math.random() * cand.length)];
        }
        let diff = pick.ang - t.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.route = pick.route;
        t.dir = pick.dir;
        t.turnCooldown = 2.8;
        if (Math.abs(diff) > 0.4) {
          t.blinkTimer = 1.1;
          t.blinkDir = diff > 0 ? 1 : -1;
        }
        return;
      }
    }
  }

  function recordNpcTrack(t) {
    const vSpd = Math.hypot(t.vx, t.vy);
    if (vSpd > 28) {
      if (Math.hypot(t.x - t.lastTrackX, t.y - t.lastTrackY) > 12) {
        const fxV = Math.cos(t.angle), fyV = Math.sin(t.angle);
        const rxV = -fyV, ryV = fxV;
        const rear = (t.len || 28) * 0.34;
        const halfT = (t.wid || 16) * 0.34;
        const curW = t === scooter
          ? { lx: t.x - fxV * rear, ly: t.y - fyV * rear, rx: t.x - fxV * rear, ry: t.y - fyV * rear }
          : {
              lx: t.x - fxV * rear + rxV * halfT, ly: t.y - fyV * rear + ryV * halfT,
              rx: t.x - fxV * rear - rxV * halfT, ry: t.y - fyV * rear - ryV * halfT
            };
        if (t.prevTrackWheels && Math.hypot(curW.lx - t.prevTrackWheels.lx, curW.ly - t.prevTrackWheels.ly) < 30) {
          npcTireMarks.push({
            x1l: t.prevTrackWheels.lx, y1l: t.prevTrackWheels.ly, x2l: curW.lx, y2l: curW.ly,
            x1r: t.prevTrackWheels.rx, y1r: t.prevTrackWheels.ry, x2r: curW.rx, y2r: curW.ry,
            single: t === scooter,
            life: 1
          });
          if (npcTireMarks.length > 320) npcTireMarks.shift();
        }
        t.prevTrackWheels = curW;
        t.lastTrackX = t.x;
        t.lastTrackY = t.y;
      }
    } else if (vSpd <= 20) {
      t.prevTrackWheels = null;
    }
  }

  function isObstacleAhead(t, fx, fy, ox, oy, otherAng, distLimit, isPl) {
    const dx = ox - t.x, dy = oy - t.y;
    const proj = dx * fx + dy * fy;
    if (proj <= 12 || proj >= distLimit) return false;
    const lat = Math.abs(dx * -fy + dy * fx);
    const isOncoming = !isPl && (fx * Math.cos(otherAng) + fy * Math.sin(otherAng) < -0.5);
    const latLimit = isPl ? Math.max(20, t.radius + player.radius - 3) : isOncoming ? 11 : 17;
    return lat < latLimit;
  }

  function updateTraffic(dt, now) {
    const sig = getSignalState(now);
    const pfx = Math.cos(player.angle), pfy = Math.sin(player.angle);

    for (let i = npcTireMarks.length - 1; i >= 0; i--) {
      npcTireMarks[i].life -= dt * 0.46;
      if (npcTireMarks[i].life <= 0) npcTireMarks.splice(i, 1);
    }

    for (const t of allVehicles) {
      if (t.hazardTimer > 0) t.hazardTimer -= dt;
      if (t.flashTimer > 0) t.flashTimer -= dt;
      if (t.flashCooldown > 0) t.flashCooldown -= dt;
      if (t.stopCooldown > 0) t.stopCooldown -= dt;
      if (t.turnCooldown > 0) t.turnCooldown -= dt;
      if (t.honkCooldown > 0) t.honkCooldown -= dt;
      if (t.blinkTimer > 0) t.blinkTimer -= dt;

      if (t.stunTimer > 0) {
        t.stunTimer -= dt;
        if (t === bus && t.waitTimer > 0) t.waitTimer = 0;
        t.vx *= Math.pow(0.12, dt);
        t.vy *= Math.pow(0.12, dt);
        t.angVel *= Math.pow(0.05, dt);
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.angle += t.angVel * dt;
        t.braking = true;
        t.blinkDir = 0;
        collideEntityWithBuildings(t);
        recordNpcTrack(t);
        continue;
      }

      // Автобус останавливается на остановке METRO (~5.2 с с аварийкой: высадка и посадка)
      if (t === bus) {
        if (t.waitTimer > 0) {
          t.waitTimer -= dt;
          t.vx *= Math.pow(0.04, dt);
          t.vy *= Math.pow(0.04, dt);
          t.braking = true;
          t.hazardTimer = 0.25;

          if (!t.alightDone && t.waitTimer < 4.2) {
            t.alightDone = true;
            let k = 0;
            for (const p of pedestrians) {
              if (p.state === "onBus") {
                p.state = "alighting";
                p.opacity = 0.25;
                p.x = t.x - 10 - k * 6;
                p.y = t.y + 11;
                p.heading = Math.PI / 2;
                p.alightTarget = { x: -326 + (k - 1) * 10, y: 80 };
                if (p.hadUmb) p.hasUmb = true;
                if (++k >= 3) break;
              }
            }
          }

          // Перед отправлением пассажиры на посадке заходят в салон
          if (t.waitTimer <= 0.15) {
            for (const p of pedestrians) {
              if (p.state === "boarding") {
                const bx = p.x - (t.x + 12), by = p.y - (t.y + 11);
                if (bx * bx + by * by < 38 * 38) {
                  p.state = "onBus";
                  p.opacity = 0;
                  p.hasUmb = false;
                }
              }
            }
          }
          recordNpcTrack(t);
          continue;
        }
        if (t.dir === 3 && Math.abs(t.x - (-326)) < 16 && t.stopCooldown <= 0) {
          t.waitTimer = 5.2;
          t.stopCooldown = 22.0;
          t.hazardTimer = 5.2;
          t.alightDone = false;
          t.braking = true;

          let onBusCount = 0;
          for (const p of pedestrians) {
            if (p.state === "onBus") onBusCount++;
          }
          let bIdx = 0;
          for (const p of pedestrians) {
            if (onBusCount + bIdx < 5 && bIdx < 3 && p.kind === "busWait" && p.state === "active") {
              const bx = p.x + 326, by = p.y - 78;
              if (bx * bx + by * by < 42 * 42) {
                p.state = "boarding";
                p.boardDelay = bIdx * 0.45;
                bIdx++;
              }
            }
          }
          recordNpcTrack(t);
          continue;
        }
      }

      // Хаотичные решения на перекрёстках для обычных машин трафика
      if (t !== bus && t !== scooter) {
        maybeTurnAtIntersection(t);
      }

      let desiredAng = t.angle;
      const isCar = t !== bus && t !== scooter;
      let targetSpeed = isCar
        ? t.baseSpeed + Math.sin(now * 0.0011 + t.speedPhase) * t.speedAmp
        : t.speed;

      // Моргание дальним от встречного транспорта, если у игрока включён дальний свет
      const fx = Math.cos(t.angle), fy = Math.sin(t.angle);
      if (headlightMode === "high" && t !== scooter && t.flashCooldown <= 0) {
        const pdx = player.x - t.x, pdy = player.y - t.y;
        const pDistSq = pdx * pdx + pdy * pdy;
        if (pDistSq < 230 * 230 && fx * pfx + fy * pfy < -0.62 && (pdx * fx + pdy * fy) > 15) {
          t.flashTimer = 0.45;
          t.flashCooldown = 3.5;
        }
      }

      // Остановка перед светофором и впередиидущим транспортом
      const redLight = isRedLightAhead(t, sig);
      let obstacleAhead = redLight;
      if (!obstacleAhead) {
        const pLim = t === bus ? 92 : 76;
        if (isObstacleAhead(t, fx, fy, player.x, player.y, player.angle, pLim, true)) {
          obstacleAhead = true;
        } else {
          const oLim = t === bus ? 86 : 74;
          for (let oi = 0; oi < allVehicles.length; oi++) {
            const other = allVehicles[oi];
            if (other !== t && isObstacleAhead(t, fx, fy, other.x, other.y, other.angle, oLim, false)) {
              obstacleAhead = true;
              break;
            }
          }
        }
      }
      t.braking = obstacleAhead;
      if (obstacleAhead) targetSpeed = 0;

      // Нетерпеливое моргание и сигнал, если затор перед машиной не из-за светофора
      if (isCar && obstacleAhead && !redLight) {
        t.blockTimer = (t.blockTimer || 0) + dt;
        if (t.blockTimer > 2.6 && (t.honkCooldown || 0) <= 0) {
          t.flashTimer = 0.4;
          t.blockTimer = 0;
          t.honkCooldown = 6.0;
          const hdx = t.x - player.x, hdy = t.y - player.y;
          if (callbacks.onHornReply && hdx * hdx + hdy * hdy < 210 * 210) {
            callbacks.onHornReply(0.88 + Math.random() * 0.24);
          }
        }
      } else if (isCar) {
        t.blockTimer = 0;
      }

      if ((t.blinkTimer || 0) <= 0) t.blinkDir = 0;
      const laneWobble = isCar ? Math.sin(now * 0.0008 + t.speedPhase) * 3.5 + (t.laneBias || 0) * 0.5 : 0;

      if (t.route === "ring_cw") {
        const baseR = t === scooter ? RING_COORD + 26 : RING_COORD + 18;
        const weave = t === scooter ? Math.sin((t.weavePhase += dt * 1.9)) * 4.5 : laneWobble;
        const R = baseR + weave;
        if (t.dir === 0) {
          desiredAng = Math.PI / 2;
          t.x += (R - t.x) * dt * 2.5;
          if (R - t.y < 65) t.blinkDir = 1;
          if (t.y >= R) { t.y = R; t.dir = 1; }
        } else if (t.dir === 1) {
          desiredAng = Math.PI;
          t.y += (R - t.y) * dt * 2.5;
          if (t.x + R < 65) t.blinkDir = 1;
          if (t.x <= -R) { t.x = -R; t.dir = 2; }
        } else if (t.dir === 2) {
          desiredAng = -Math.PI / 2;
          t.x += (-R - t.x) * dt * 2.5;
          if (t.y + R < 65) t.blinkDir = 1;
          if (t.y <= -R) { t.y = -R; t.dir = 3; }
        } else {
          desiredAng = 0;
          t.y += (-R - t.y) * dt * 2.5;
          if (R - t.x < 65) t.blinkDir = 1;
          if (t.x >= R) { t.x = R; t.dir = 0; }
        }
      } else if (t.route === "ring_ccw") {
        const R = RING_COORD - 18 + laneWobble;
        if (t.dir === 0) {
          desiredAng = Math.PI / 2;
          t.x += (-R - t.x) * dt * 2.5;
          if (R - t.y < 65) t.blinkDir = -1;
          if (t.y >= R) { t.y = R; t.dir = 3; }
        } else if (t.dir === 3) {
          desiredAng = 0;
          t.y += (R - t.y) * dt * 2.5;
          if (R - t.x < 65) t.blinkDir = -1;
          if (t.x >= R) { t.x = R; t.dir = 2; }
        } else if (t.dir === 2) {
          desiredAng = -Math.PI / 2;
          t.x += (R - t.x) * dt * 2.5;
          if (t.y + R < 65) t.blinkDir = -1;
          if (t.y <= -R) { t.y = -R; t.dir = 1; }
        } else {
          desiredAng = Math.PI;
          t.y += (-R - t.y) * dt * 2.5;
          if (t.x + R < 65) t.blinkDir = -1;
          if (t.x <= -R) { t.x = -R; t.dir = 0; }
        }
      } else if (t.route === "ns") {
        const laneX = 32 + laneWobble;
        if (t.dir === 0) { desiredAng = Math.PI / 2; t.x += (laneX - t.x) * dt * 2.5; if (t.y > 940) t.dir = 2; }
        else { desiredAng = -Math.PI / 2; t.x += (-laneX - t.x) * dt * 2.5; if (t.y < -940) t.dir = 0; }
      } else if (t.route === "ew") {
        const laneY = (t === bus ? 35 : 32) + laneWobble;
        if (t.dir === 3) { desiredAng = 0; t.y += (laneY - t.y) * dt * 2.5; if (t.x > 940) t.dir = 1; }
        else { desiredAng = Math.PI; t.y += (-laneY - t.y) * dt * 2.5; if (t.x < -940) t.dir = 3; }
      }

      let diff = desiredAng - t.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.angle += diff * Math.min(1, dt * 8);

      const curVx = Math.cos(t.angle) * targetSpeed;
      const curVy = Math.sin(t.angle) * targetSpeed;
      t.vx += (curVx - t.vx) * Math.min(1, dt * 4);
      t.vy += (curVy - t.vy) * Math.min(1, dt * 4);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      collideEntityWithBuildings(t);
      recordNpcTrack(t);
    }
  }

  function collidePedWithWorld(p) {
    const r = 6;
    if (p.x < -WORLD_LIMIT + 10) { p.x = -WORLD_LIMIT + 10; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x > WORLD_LIMIT - 10)  { p.x = WORLD_LIMIT - 10;  p.vx = -Math.abs(p.vx) * 0.3; }
    if (p.y < -WORLD_LIMIT + 10) { p.y = -WORLD_LIMIT + 10; p.vy = Math.abs(p.vy) * 0.3; }
    if (p.y > 995) {
      if (p.y <= 1028 && Math.abs(p.x) > 36) {
        p.y = 995;
        p.vy = -Math.abs(p.vy) * 0.3;
      } else {
        if (p.y > 1082) { p.y = 1082; p.vy = -Math.abs(p.vy) * 0.3; }
        if (p.x < -34) { p.x = -34; p.vx = Math.abs(p.vx) * 0.3; }
        if (p.x > 34)  { p.x = 34;  p.vx = -Math.abs(p.vx) * 0.3; }
      }
    }
    for (const b of BUILDINGS) {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      const dx = p.x - cx, dy = p.y - cy;
      const dSq = dx * dx + dy * dy;
      if (dSq < r * r) {
        let nx, ny, pen;
        if (dSq === 0) {
          const dL = p.x - b.x, dR = b.x + b.w - p.x;
          const dT = p.y - b.y, dB = b.y + b.h - p.y;
          const m = Math.min(dL, dR, dT, dB);
          if (m === dL) { nx = -1; ny = 0; pen = dL + r; }
          else if (m === dR) { nx = 1; ny = 0; pen = dR + r; }
          else if (m === dT) { nx = 0; ny = -1; pen = dT + r; }
          else { nx = 0; ny = 1; pen = dB + r; }
        } else {
          const d = Math.sqrt(dSq);
          nx = dx / d;
          ny = dy / d;
          pen = r - d;
        }
        p.x += nx * pen;
        p.y += ny * pen;
      }
    }
  }

  function knockPedestrian(p, srcX, srcY, srcVx, srcVy, srcSpd) {
    if (p.state === "knocked") {
      // Мягко подталкиваем уже лежащего пешехода, ограничивая скорость отталкивания
      const dx = p.x - srcX, dy = p.y - srcY;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      p.x += nx * 2;
      p.y += ny * 2;
      p.vx += nx * 65 + srcVx * 0.25;
      p.vy += ny * 65 + srcVy * 0.25;
      const maxSlide = 240;
      const nSpd = Math.hypot(p.vx, p.vy);
      if (nSpd > maxSlide) {
        p.vx = (p.vx / nSpd) * maxSlide;
        p.vy = (p.vy / nSpd) * maxSlide;
      }
      return;
    }
    const dx = p.x - srcX, dy = p.y - srcY;
    const d = Math.hypot(dx, dy) || 1;
    const bx = dx / d + (srcVx / (srcSpd || 1)) * 0.75;
    const by = dy / d + (srcVy / (srcSpd || 1)) * 0.75;
    const bLen = Math.hypot(bx, by) || 1;
    const dirX = bx / bLen, dirY = by / bLen;
    const launchSpd = Math.min(240, 72 + srcSpd * 0.68);

    p.state = "knocked";
    p.vx = dirX * launchSpd;
    p.vy = dirY * launchSpd;
    p.fallAngle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.6;
    p.spin = (Math.random() < 0.5 ? -1 : 1) * (4.2 + Math.random() * 4.5);
    p.lieTimer = 4.2 + Math.random() * 0.7;

    // Отлетающий зонт на мокрый асфальт
    if (p.hasUmb && p.umbrella) {
      p.hasUmb = false;
      droppedUmbrellas.push({
        x: p.x,
        y: p.y,
        vx: dirX * (launchSpd * 0.8) + (Math.random() - 0.5) * 55,
        vy: dirY * (launchSpd * 0.8) + (Math.random() - 0.5) * 55,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() < 0.5 ? -1 : 1) * 7.5,
        color: p.umbrella,
        owner: p
      });
    }

    // Брызги воды из лужи (никакой крови)
    for (let k = 0; k < 6; k++) {
      if (sprays.length >= 120) break;
      const a = Math.random() * Math.PI * 2;
      const s = 35 + Math.random() * 70;
      sprays.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9, r: 2.8, gold: false });
    }
    if (ripples.length < 90) ripples.push({ x: p.x, y: p.y, r: 3, alpha: 0.45 });
    camShake = Math.max(camShake, 1.8);
    if (callbacks.onPedBump) callbacks.onPedBump();
  }

  function resolvePedestrianCollisions() {
    const hitR = player.radius * 0.68 + 6;
    for (const p of pedestrians) {
      if (p.state === "inside" || p.state === "onBus") continue;
      if (player.speed > 35) {
        const dx = p.x - player.x, dy = p.y - player.y;
        if (dx * dx + dy * dy < hitR * hitR) {
          p.opacity = 1;
          p.targetDoor = null;
          knockPedestrian(p, player.x, player.y, player.vx, player.vy, player.speed);
          continue;
        }
      }
      for (const v of allVehicles) {
        if (v.stunTimer <= 0) continue;
        const spd = Math.hypot(v.vx, v.vy);
        if (spd > 48) {
          const hr = v.radius * 0.68 + 6;
          const dx = p.x - v.x, dy = p.y - v.y;
          if (dx * dx + dy * dy < hr * hr) {
            p.opacity = 1;
            p.targetDoor = null;
            knockPedestrian(p, v.x, v.y, v.vx, v.vy, spd);
            break;
          }
        }
      }
    }
  }

  function updateLivingCity(dt, now) {
    const sig = getSignalState(now);
    const alphaStep = Math.min(1, dt * 3.4);

    // Плавное затухание и включение окон в домах + пометка карт засвета на тротуарах
    for (let bi = 0; bi < BUILDINGS.length; bi++) {
      const b = BUILDINGS[bi];
      if (b.spillCooldown > 0) b.spillCooldown -= dt;
      const wList = b.windows.list;
      const cols = b.windows.cols;
      const spillLimit = Math.min(wList.length, cols * 2);
      let groundChanged = false;
      let spillSettled = false;
      for (let wi = 0; wi < wList.length; wi++) {
        const w = wList[wi];
        w.timer -= dt;
        if (w.timer <= 0) {
          w.timer = 6 + Math.random() * 20;
          if (Math.random() < 0.32) w.lit = !w.lit;
        }
        const target = w.lit ? 1 : 0;
        if (w.alpha !== target) {
          const diff = target - w.alpha;
          if (Math.abs(diff) < 0.006) {
            w.alpha = target;
            if (wi < spillLimit) spillSettled = true;
          } else {
            w.alpha += diff * alphaStep;
          }
          if (wi < spillLimit) groundChanged = true;
        }
      }
      if (groundChanged) {
        b.spillDirty = true;
        if (spillSettled) b.spillCooldown = 0;
      }
    }

    // Физика отлетевших зонтиков
    if (droppedUmbrellas.length) {
      const umbLinDamp = Math.pow(0.04, dt);
      const umbSpinDamp = Math.pow(0.06, dt);
      for (let i = 0; i < droppedUmbrellas.length; i++) {
        const u = droppedUmbrellas[i];
        u.vx *= umbLinDamp;
        u.vy *= umbLinDamp;
        u.spin *= umbSpinDamp;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        u.angle += u.spin * dt;
      }
    }

    // Проверка столкновений машин с пешеходами + жизненный цикл GTA2-физики
    resolvePedestrianCollisions();

    // Предрасчёт конуса фар игрока для реакции пешеходов и птиц
    const beamActive = headlightMode !== "off" && (player.speed > 20 || headlightMode === "high");
    const beamFx = beamActive ? Math.cos(player.angle) : 0;
    const beamFy = beamActive ? Math.sin(player.angle) : 0;
    const beamRange = headlightMode === "high" ? 245 : 160;
    const beamRangeSq = beamRange * beamRange;

    for (const p of pedestrians) {
      if (p.alertTimer > 0) p.alertTimer = Math.max(0, p.alertTimer - dt);
      if (p.doorCooldown > 0) p.doorCooldown = Math.max(0, p.doorCooldown - dt);
      if (p.hurryTimer > 0) p.hurryTimer = Math.max(0, p.hurryTimer - dt);

      if (p.state === "inside") {
        p.insideTimer -= dt;
        if (p.insideTimer <= 0 && p.targetDoor) {
          p.state = "exiting";
          p.x = p.targetDoor.x;
          p.y = p.targetDoor.y;
          p.opacity = 0.1;
          p.hasUmb = false;
        }
        continue;
      }

      if (p.state === "onBus") {
        p.x = bus.x;
        p.y = bus.y;
        continue;
      }

      if (p.state === "entering" && p.targetDoor) {
        const dx = p.targetDoor.x - p.x, dy = p.targetDoor.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) p.hasUmb = false;
        if (dist < 4) {
          p.state = "inside";
          p.insideTimer = 4 + Math.random() * 7;
          p.opacity = 0;
          continue;
        }
        p.x += (dx / dist) * 28 * dt;
        p.y += (dy / dist) * 28 * dt;
        p.heading = Math.atan2(dy, dx);
        p.gait += dt * 9.5;
        p.opacity = Math.max(0, Math.min(1, dist / 22));
        continue;
      }

      if (p.state === "exiting" && p.targetDoor) {
        const dx = p.targetDoor.sx - p.x, dy = p.targetDoor.sy - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12 && p.hadUmb) p.hasUmb = true;
        if (dist < 4) {
          p.opacity = 1;
          p.doorCooldown = 16 + Math.random() * 14;
          const exitedDoor = p.targetDoor;
          p.targetDoor = null;
          if (exitedDoor.id === "metro") {
            const slots = [-344, -326, -308];
            let freeSlot = null;
            for (let s = 0; s < slots.length; s++) {
              const sx = slots[s];
              let occupied = false;
              for (const other of pedestrians) {
                if (
                  other !== p &&
                  other.kind === "busWait" &&
                  (other.state === "active" || other.state === "boarding") &&
                  Math.abs(other.homeX - sx) < 6
                ) {
                  occupied = true;
                  break;
                }
              }
              if (!occupied) {
                freeSlot = sx;
                break;
              }
            }
            if (freeSlot !== null) {
              p.kind = "busWait";
              p.homeX = freeSlot;
              p.homeY = 78;
              p.homeHeading = -Math.PI / 2;
              p.state = "active";
              continue;
            }
          }
          if (p.kind === "busWait") p.kind = p.hadUmb ? "umbrella" : "hood";
          p.state = "active";
          continue;
        }
        p.x += (dx / dist) * 28 * dt;
        p.y += (dy / dist) * 28 * dt;
        p.heading = Math.atan2(dy, dx);
        p.gait += dt * 9.5;
        p.opacity = Math.max(0.1, Math.min(1, 1 - dist / 24));
        continue;
      }

      if (p.state === "boarding") {
        if (bus.waitTimer <= 0) {
          const bdx = p.x - bus.x, bdy = p.y - bus.y;
          if (bdx * bdx + bdy * bdy < 1296) {
            p.state = "onBus";
            p.opacity = 0;
            p.hasUmb = false;
          } else {
            p.state = "active";
            p.opacity = 1;
            if (p.hadUmb) p.hasUmb = true;
          }
          continue;
        }
        if (p.boardDelay > 0) {
          p.boardDelay -= dt;
          continue;
        }
        const bx = bus.x + 12, by = bus.y + 11;
        const dx = bx - p.x, dy = by - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 14) p.hasUmb = false;
        if (dist < 7) {
          p.state = "onBus";
          p.opacity = 0;
          p.hasUmb = false;
          continue;
        }
        p.x += (dx / dist) * 32 * dt;
        p.y += (dy / dist) * 32 * dt;
        p.heading = Math.atan2(dy, dx);
        p.gait += dt * 10;
        p.opacity = Math.max(0.15, Math.min(1, dist / 26));
        continue;
      }

      if (p.state === "alighting" && p.alightTarget) {
        const dx = p.alightTarget.x - p.x, dy = p.alightTarget.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) {
          p.opacity = 1;
          p.state = "entering";
          p.targetDoor = METRO_DOOR;
          p.alightTarget = null;
          continue;
        }
        p.x += (dx / dist) * 30 * dt;
        p.y += (dy / dist) * 30 * dt;
        p.heading = Math.atan2(dy, dx);
        p.gait += dt * 9.5;
        p.opacity = Math.max(0.25, Math.min(1, 1 - dist / 46));
        continue;
      }

      if (p.state === "knocked") {
        p.vx *= Math.pow(0.025, dt);
        p.vy *= Math.pow(0.025, dt);
        p.spin *= Math.pow(0.05, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.fallAngle += p.spin * dt;
        collidePedWithWorld(p);
        p.lieTimer -= dt;
        if (p.lieTimer <= 0) {
          p.state = "getup";
          p.getupTimer = 0.85;
        }
        continue;
      }

      if (p.state === "getup") {
        p.getupTimer -= dt;
        if (p.getupTimer <= 0) {
          p.state = "active";
          p.opacity = 1;
          p.alertTimer = 2.0;
          p.hurryTimer = 2.2;
          if (p.hadUmb) {
            p.hasUmb = true;
            const uiIdx = droppedUmbrellas.findIndex((u) => u.owner === p);
            if (uiIdx >= 0) droppedUmbrellas.splice(uiIdx, 1);
          }
        }
        continue;
      }

      if (p.kind === "stand" || p.kind === "busWait") {
        const dx = p.homeX - p.x, dy = p.homeY - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          p.x += (dx / d) * Math.min(d, 26 * dt);
          p.y += (dy / d) * Math.min(d, 26 * dt);
          p.heading = Math.atan2(dy, dx);
          p.gait += dt * 7;
        } else {
          p.heading = p.homeHeading;
          p.gait += dt * 1.4;
        }
        continue;
      }

      if (beamActive && p.kind !== "stand" && p.kind !== "busWait") {
        const pdx = p.x - player.x, pdy = p.y - player.y;
        const pDistSq = pdx * pdx + pdy * pdy;
        if (pDistSq < beamRangeSq) {
          const proj = pdx * beamFx + pdy * beamFy;
          if (proj > 16 && proj < beamRange && Math.abs(pdx * -beamFy + pdy * beamFx) < 20 + proj * 0.24) {
            p.hurryTimer = Math.max(p.hurryTimer, 0.85);
          }
        }
      }

      if (p.kind === "crosswalk") {
        const cw = p.cw;
        const tx = cw.dirToB ? cw.bx : cw.ax;
        const ty = cw.dirToB ? cw.by : cw.ay;
        const curDx = p.x - tx, curDy = p.y - ty;
        const curAtEnd = curDx * curDx + curDy * curDy < 25;
        const onCurb = cw.axis === "ew" ? Math.abs(p.x) > 58 : Math.abs(p.y) > 58;
        const greenForPed = cw.axis === "ew" ? sig.ew === "green" : sig.ns === "green";

        if (curAtEnd) {
          cw.dirToB = !cw.dirToB;
          p.pauseTimer = 1.2;
          continue;
        }
        if (p.pauseTimer > 0) {
          p.pauseTimer -= dt;
          continue;
        }
        if (onCurb && !greenForPed) {
          p.gait += dt * 0.4;
          continue;
        }
        const dx = tx - p.x, dy = ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepSpd = p.hurryTimer > 0 ? p.speed * 1.4 : p.speed;
        p.x += (dx / dist) * Math.min(dist, stepSpd * dt);
        p.y += (dy / dist) * Math.min(dist, stepSpd * dt);
        p.heading = Math.atan2(dy, dx);
        p.gait += dt * stepSpd * 0.34;
        continue;
      }

      // Случайный заход в открытую дверь кафе/магазина/метро по пути вдоль тротуара
      if (p.doorCooldown <= 0 && p.hurryTimer <= 0) {
        for (let di = 0; di < DOORS.length; di++) {
          const d = DOORS[di];
          const ddx = p.x - d.sx, ddy = p.y - d.sy;
          if (ddx * ddx + ddy * ddy < 900) {
            p.doorCooldown = 18;
            if (Math.random() < 0.38) {
              p.state = "entering";
              p.targetDoor = d;
            }
            break;
          }
        }
        if (p.state === "entering") continue;
      }

      let nearMovingCar = false;
      {
        const pdx = p.x - player.x, pdy = p.y - player.y;
        if (player.speed > 28 && pdx * pdx + pdy * pdy < 58 * 58) nearMovingCar = true;
      }
      if (!nearMovingCar) {
        for (let ti = 0; ti < allVehicles.length; ti++) {
          const t = allVehicles[ti];
          const vdx = p.x - t.x, vdy = p.y - t.y;
          if (vdx * vdx + vdy * vdy < 50 * 50) { nearMovingCar = true; break; }
        }
      }
      if (nearMovingCar) p.hurryTimer = 1.6;

      if (p.pauseTimer > 0) {
        p.pauseTimer -= dt;
        continue;
      }

      const spd = nearMovingCar ? 4 : p.hurryTimer > 0 ? p.speed * 1.45 : p.speed;
      const lp0 = p.loop;
      const off = p.laneOffset || 0;
      const lpMinX = lp0.minX - off;
      const lpMaxX = lp0.maxX + off;
      const lpMinY = lp0.minY - off;
      const lpMaxY = lp0.maxY + off;
      const oldX = p.x, oldY = p.y;
      if (p.side === 0) {
        p.x += (lpMinX - p.x) * Math.min(1, dt * 4);
        p.y += spd * dt;
        if (p.y >= lpMaxY) { p.y = lpMaxY; p.side = 1; if (Math.random() < 0.25) p.pauseTimer = 2 + Math.random() * 2; }
      } else if (p.side === 1) {
        p.y += (lpMaxY - p.y) * Math.min(1, dt * 4);
        p.x += spd * dt;
        if (p.x >= lpMaxX) { p.x = lpMaxX; p.side = 2; if (Math.random() < 0.25) p.pauseTimer = 2 + Math.random() * 2; }
      } else if (p.side === 2) {
        p.x += (lpMaxX - p.x) * Math.min(1, dt * 4);
        p.y -= spd * dt;
        if (p.y <= lpMinY) { p.y = lpMinY; p.side = 3; if (Math.random() < 0.25) p.pauseTimer = 2 + Math.random() * 2; }
      } else {
        p.y += (lpMinY - p.y) * Math.min(1, dt * 4);
        p.x -= spd * dt;
        if (p.x <= lpMinX) { p.x = lpMinX; p.side = 0; if (Math.random() < 0.25) p.pauseTimer = 2 + Math.random() * 2; }
      }

      const mdx = p.x - oldX, mdy = p.y - oldY;
      if (mdx * mdx + mdy * mdy > 0.0001) {
        const wantAng = Math.atan2(mdy, mdx);
        let diff = wantAng - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += diff * Math.min(1, dt * 8);
        p.gait += dt * (spd * 0.34);
        p.stepEchoTimer -= dt;
        if (p.stepEchoTimer <= 0) {
          p.stepEchoTimer = 0.55 + Math.random() * 0.4;
          if (ripples.length < 90) ripples.push({ x: p.x, y: p.y, r: 1.5, alpha: 0.22 });
        }
      }
    }

    // Рыжий кот под навесом CAFE
    cat.tailPhase += dt * (cat.dartTimer > 0 ? 11 : 3.2);
    if (cat.meowCooldown > 0) cat.meowCooldown -= dt;
    if (cat.dartTimer > 0) {
      cat.dartTimer -= dt;
      cat.x += cat.vx * dt;
      cat.y += cat.vy * dt;
      cat.vx *= Math.pow(0.15, dt);
      cat.vy *= Math.pow(0.15, dt);
      cat.x = Math.max(-268, Math.min(-253, cat.x));
      cat.y = Math.max(-190, Math.min(-150, cat.y));
    } else {
      const cdx = cat.x - player.x, cdy = cat.y - player.y;
      if (player.speed > 42 && cat.meowCooldown <= 0 && cdx * cdx + cdy * cdy < 62 * 62) {
        cat.meowCooldown = 2.5;
        cat.dartTimer = 1.4;
        cat.vy = (cat.y > player.y ? 1 : -1) * 38;
        if (callbacks.onCatMeow) callbacks.onCatMeow();
      } else {
        const dx = cat.homeX - cat.x, dy = cat.homeY - cat.y;
        cat.x += dx * dt * 1.6;
        cat.y += dy * dt * 1.6;
        if (dx * dx + dy * dy > 2.25) cat.angle = Math.atan2(dy, dx);
        else cat.angle += (0.25 - cat.angle) * dt * 2;
      }
    }

    // Рыбак с поплавком на южном пирсе
    fisherman.bobPhase += dt * 2.6;

    // Птицы (взлетают от близости машины или резкого дальнего света фар)
    for (let bi = 0; bi < birds.length; bi++) {
      const b = birds[bi];
      b.flapPhase += dt * (b.flying ? 16 : 2);
      if (!b.flying) {
        const bdx = b.x - player.x, bdy = b.y - player.y;
        const dSq = bdx * bdx + bdy * bdy;
        let flush = player.speed > 55 && dSq < 85 * 85;
        if (!flush && beamActive && headlightMode === "high" && dSq < 150 * 150) {
          const proj = bdx * beamFx + bdy * beamFy;
          if (proj > 12 && proj < 150 && Math.abs(bdx * -beamFy + bdy * beamFx) < 26 + proj * 0.22) {
            flush = true;
          }
        }
        if (flush) {
          const ang = Math.atan2(bdy, bdx);
          b.flying = true;
          b.flightTimer = 3.2 + Math.random() * 1.5;
          b.vx = Math.cos(ang) * 95;
          b.vy = Math.sin(ang) * 95;
        }
      } else {
        b.flightTimer -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.flightTimer <= 0) {
          const dx = b.homeX - b.x;
          const dy = b.homeY - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 10) {
            b.flying = false;
            b.vx = 0;
            b.vy = 0;
          } else {
            b.vx += ((dx / dist) * 75 - b.vx) * dt * 2.5;
            b.vy += ((dy / dist) * 75 - b.vy) * dt * 2.5;
          }
        }
      }
    }

    // Поезд на эстакаде + пространственная слышимость
    commuterY += 145 * dt;
    if (commuterY > 1800) commuterY = -1800;
    const trainDist = Math.hypot(player.x - (-675), player.y - (commuterY - 84));
    const targetTrain = Math.pow(Math.max(0, 1 - trainDist / 520), 1.6);
    trainProximity += (targetTrain - trainProximity) * Math.min(1, dt * 4);

    // Акустическое укрытие (гараж, навес кафе, остановка метро)
    let targetShelter = 0;
    const gdx = player.x - ZONES.garage.x, gdy = player.y - ZONES.garage.y;
    const cdx = player.x + 261, cdy = player.y + 172;
    const mdx = player.x + 326, mdy = player.y - 78;
    if (gdx * gdx + gdy * gdy < 3025) targetShelter = 0.92;
    else if (cdx * cdx + cdy * cdy < 2916) targetShelter = 0.65;
    else if (mdx * mdx + mdy * mdy < 2304) targetShelter = 0.55;
    shelterLevel += (targetShelter - shelterLevel) * Math.min(1, dt * 4.5);

    // Реалистичный дождь + капли по краям объектива + ветер + далёкая зарница
    wind = -0.13 + Math.sin(now * 0.0004) * 0.05;
    for (const layer of rainLayers) {
      for (const d of layer) {
        d.x += wind * d.spd * dt;
        d.y += 1.25 * d.spd * dt;
        if (d.y > 1) { d.y = 0; d.x = Math.random(); }
        if (d.x < 0) d.x += 1;
        if (d.x > 1) d.x -= 1;
      }
    }
    for (const gd of glassDrops) {
      gd.wigglePhase += dt * 3.1;
      gd.v += gd.vy * dt;
      if (gd.v > 1.03) {
        gd.v = -0.02;
        gd.u = gd.edge === "left" ? 0.015 + Math.random() * 0.095 : 0.89 + Math.random() * 0.095;
      }
    }

    if (ripples.length < 90 && Math.random() < dt * 16) {
      ripples.push({
        x: player.x + (Math.random() - 0.5) * 1360,
        y: player.y + (Math.random() - 0.5) * 1040,
        r: 1.5,
        alpha: 0.38
      });
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 30 * dt;
      rp.alpha -= 0.6 * dt;
      if (rp.alpha <= 0) {
        ripples[i] = ripples[ripples.length - 1];
        ripples.pop();
      }
    }

    nextLightning -= dt;
    if (nextLightning <= 0) {
      nextLightning = 20 + Math.random() * 14;
      lightningAlpha = 0.14;
      if (callbacks.onThunder) {
        setTimeout(() => callbacks.onThunder(), 450);
      }
    }
    if (lightningAlpha > 0) lightningAlpha = Math.max(0, lightningAlpha - dt * 0.45);
  }

  let prevTrackWheels = null;

  function update(dt, input, now) {
    lastDt = Math.max(0.001, Math.min(0.05, dt));
    const ix = input.x;
    const iy = input.y;
    const mag = Math.hypot(ix, iy);
    playerBlink = 0;
    let steerDiff = 0;

    if (mag > 0.08) {
      clearAutopilot();
      const targetAngle = Math.atan2(iy, ix);
      let diff = targetAngle - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steerDiff = diff;
      player.angle += diff * (1 - Math.exp(-9.5 * dt));
      if (Math.abs(diff) > 0.16) playerBlink = diff > 0 ? 1 : -1;

      const baseMax = playerSpec.maxSpd || 268;
      const baseAcc = playerSpec.accel || 345;
      const maxSpd = input.boost ? baseMax * 1.38 : baseMax;
      const accel = input.boost ? baseAcc * 2.0 : baseAcc * 1.4;
      const fx = Math.cos(player.angle);
      const fy = Math.sin(player.angle);
      player.vx += fx * accel * Math.min(1, mag) * dt;
      player.vy += fy * accel * Math.min(1, mag) * dt;

      const spd = Math.hypot(player.vx, player.vy);
      if (spd > maxSpd) {
        player.vx = (player.vx / spd) * maxSpd;
        player.vy = (player.vy / spd) * maxSpd;
      }
      player.drifting = input.boost || Math.abs(diff) > 0.55;
      player.braking = false;
    } else if (autopilot.length > 0) {
      const wp = autopilot[0];
      const dx = wp.x - player.x;
      const dy = wp.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        autopilot.shift();
        if (autopilot.length === 0) {
          player.vx *= 0.25;
          player.vy *= 0.25;
        }
      } else {
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - player.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        steerDiff = diff;
        player.angle += diff * (1 - Math.exp(-10 * dt));
        if (Math.abs(diff) > 0.18) playerBlink = diff > 0 ? 1 : -1;
        const autoSpd = Math.min(250, Math.max(115, dist * 2.1));
        player.vx += (Math.cos(player.angle) * autoSpd - player.vx) * Math.min(1, dt * 6);
        player.vy += (Math.sin(player.angle) * autoSpd - player.vy) * Math.min(1, dt * 6);
      }
      player.drifting = false;
      player.braking = false;
    } else {
      player.vx *= Math.pow(0.04, dt);
      player.vy *= Math.pow(0.04, dt);
      player.drifting = false;
      player.braking = player.speed > 18;
    }

    // Плавная физика подвески, розжига и поворота фар (не зависит от FPS)
    const curSpd = Math.hypot(player.vx, player.vy);
    const rawAccel = dt > 0.0005 ? (curSpd - prevPlayerSpeed) / dt : 0;
    prevPlayerSpeed = curSpd;
    smoothLongAccel += (rawAccel - smoothLongAccel) * (1 - Math.exp(-8 * dt));
    const boostBias = (mag > 0.08 && input.boost) ? 0.35 : 0;
    const targetPitch = Math.max(-0.95, Math.min(1.05, smoothLongAccel / 320 + boostBias));
    beamPitchVel += (targetPitch - beamPitch) * 20 * dt;
    beamPitchVel *= Math.exp(-8.2 * dt);
    beamPitch = Math.max(-1.1, Math.min(1.15, beamPitch + beamPitchVel * dt));

    const steerTarget = mag > 0.08 ? Math.max(-0.075, Math.min(0.075, steerDiff * 0.14)) : 0;
    beamSteer += (steerTarget - beamSteer) * (1 - Math.exp(-5.5 * dt));

    const wantPower = headlightMode === "off" ? 0 : 1;
    beamPower += (wantPower - beamPower) * (1 - Math.exp(-12 * dt));
    if (beamPower < 0.004 && wantPower === 0) beamPower = 0;
    if (beamPower > 0.996 && wantPower === 1) beamPower = 1;

    if (headlightMode !== "off") {
      const wantHigh = headlightMode === "high" ? 1 : 0;
      beamHighMix += (wantHigh - beamHighMix) * (1 - Math.exp(-9 * dt));
      if (Math.abs(wantHigh - beamHighMix) < 0.004) beamHighMix = wantHigh;
    }
    if (headlightJolt > 0) {
      headlightJolt *= Math.exp(-3.4 * dt);
      if (headlightJolt < 0.008) headlightJolt = 0;
    }

    // Гасим угловую скорость после столкновений
    player.angle += player.angVel * dt;
    player.angVel *= Math.pow(0.02, dt);

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.speed = Math.hypot(player.vx, player.vy);

    resolveCarCollisions();
    collideEntityWithBuildings(player);
    updateTraffic(dt, now);
    updateLivingCity(dt, now);

    // Мокрые следы шин после луж и заносов
    if (wetTires > 0) wetTires = Math.max(0, wetTires - dt);
    for (const p of PUDDLES) {
      const dx = (player.x - p.x) / p.rx;
      const dy = (player.y - p.y) / p.ry;
      if (dx * dx + dy * dy < 1.2) {
        wetTires = 3.8;
        break;
      }
    }
    if (player.drifting) wetTires = Math.max(wetTires, 1.4);

    if ((wetTires > 0 || player.drifting) && player.speed > 42) {
      if (Math.hypot(player.x - lastTrackX, player.y - lastTrackY) > 9) {
        const fx = Math.cos(player.angle), fy = Math.sin(player.angle);
        const rx = -fy, ry = fx;
        const rearOff = playerSpec.len * 0.34;
        const halfTrack = playerSpec.wid * 0.34;
        const curW = {
          lx: player.x - fx * rearOff + rx * halfTrack,
          ly: player.y - fy * rearOff + ry * halfTrack,
          rx: player.x - fx * rearOff - rx * halfTrack,
          ry: player.y - fy * rearOff - ry * halfTrack
        };
        if (prevTrackWheels && Math.hypot(curW.lx - prevTrackWheels.lx, curW.ly - prevTrackWheels.ly) < 28) {
          tireMarks.push({
            x1l: prevTrackWheels.lx, y1l: prevTrackWheels.ly, x2l: curW.lx, y2l: curW.ly,
            x1r: prevTrackWheels.rx, y1r: prevTrackWheels.ry, x2r: curW.rx, y2r: curW.ry,
            life: 1,
            drift: player.drifting
          });
          if (tireMarks.length > 240) tireMarks.shift();
        }
        prevTrackWheels = curW;
        lastTrackX = player.x;
        lastTrackY = player.y;
      }
    } else {
      prevTrackWheels = null;
    }
    for (let i = tireMarks.length - 1; i >= 0; i--) {
      tireMarks[i].life -= dt * 0.22;
      if (tireMarks[i].life <= 0) tireMarks.splice(i, 1);
    }

    // Брызги воды из-под колёс
    if (player.speed > 55 && sprays.length < 120 && Math.random() < dt * 28) {
      sprays.push({
        x: player.x - Math.cos(player.angle) * 12 + (Math.random() - 0.5) * 10,
        y: player.y - Math.sin(player.angle) * 12 + (Math.random() - 0.5) * 10,
        vx: -player.vx * 0.12 + (Math.random() - 0.5) * 24,
        vy: -player.vy * 0.12 + (Math.random() - 0.5) * 24,
        life: 1,
        r: player.drifting || overdrive ? 4 : 2.6,
        gold: overdrive
      });
    }
    for (let i = sprays.length - 1; i >= 0; i--) {
      const sp = sprays[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt * 2.2;
      if (sp.life <= 0) {
        sprays[i] = sprays[sprays.length - 1];
        sprays.pop();
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sk = sparks[i];
      sk.x += sk.vx * dt;
      sk.y += sk.vy * dt;
      sk.life -= dt * 3.5;
      if (sk.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
      }
    }
    for (let i = hornWaves.length - 1; i >= 0; i--) {
      hornWaves[i].r += 340 * dt;
      hornWaves[i].alpha -= dt * 0.9;
      if (hornWaves[i].alpha <= 0) hornWaves.splice(i, 1);
    }

    if (camShake > 0) camShake = Math.max(0, camShake - dt * 22);

    let currentZone = "home";
    for (let i = 0; i < ZONE_LIST.length; i++) {
      const z = ZONE_LIST[i];
      if (z.id === "secret" && !secretUnlocked) continue;
      const dx = player.x - z.x, dy = player.y - z.y;
      if (dx * dx + dy * dy < z.r * z.r) {
        currentZone = z.id;
        break;
      }
    }
    return currentZone;
  }

  const rippleB = [[], [], []];
  const sprayB = [[], [], []];
  const sprayGoldB = [[], [], []];
  const sparkB = [[], []];
  const RIPPLE_COLS = ["rgba(190, 178, 162, 0.10)", "rgba(190, 178, 162, 0.22)", "rgba(190, 178, 162, 0.36)"];
  const SPRAY_COLS = ["rgba(196, 184, 168, 0.08)", "rgba(196, 184, 168, 0.19)", "rgba(196, 184, 168, 0.31)"];
  const SPRAY_GOLD_COLS = ["rgba(232, 199, 130, 0.10)", "rgba(232, 199, 130, 0.24)", "rgba(232, 199, 130, 0.40)"];
  const SPARK_COLS = ["rgba(245, 194, 108, 0.35)", "rgba(245, 194, 108, 0.85)"];
  const MAIN_ZONE_IDS = ["about", "vibes", "contact", "setup"];
  const TL_COLORS = { red: "#b55452", yellow: "#cfa054", green: "#728f68" };
  const viewObj = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  // Переиспользуемые слоты видимого транспорта (ноль аллокаций на кадр)
  const vehSlots = Array.from({ length: 16 }, () => ({
    x: 0, y: 0, angle: 0, cosA: 1, sinA: 0, len: 28, wid: 16, radius: 15,
    occlR: 8.64, occlRSq: 74.65, onScreen: true, color: "#6e6865",
    isPlayer: false, isBus: false, isScooter: false, taxi: false,
    braking: false, hazards: false, highBeam: false, goldLights: false,
    lightMode: "low", blinkDir: 0, blinkOn: false
  }));
  const visVehicles = [];

  function pushVehSlot(idx, x, y, angle, len, wid, radius, color, isPlayer, isBus, isScooter, taxi, braking, hazards, highBeam, goldLights, lightMode, blinkDir, blinkOn) {
    const s = vehSlots[idx];
    s.x = x; s.y = y; s.angle = angle;
    s.cosA = Math.cos(angle); s.sinA = Math.sin(angle);
    s.len = len; s.wid = wid; s.radius = radius;
    const occlR = isBus ? 10.488 : isScooter ? 7 : wid * 0.54;
    s.occlR = occlR;
    s.occlRSq = occlR * occlR;
    const pad = len * 0.65 + 24;
    s.onScreen = x + pad >= viewObj.minX && x - pad <= viewObj.maxX && y + pad >= viewObj.minY && y - pad <= viewObj.maxY;
    s.color = color;
    s.isPlayer = isPlayer; s.isBus = isBus; s.isScooter = isScooter; s.taxi = taxi;
    s.braking = braking; s.hazards = hazards; s.highBeam = highBeam; s.goldLights = goldLights;
    s.lightMode = lightMode; s.blinkDir = blinkDir; s.blinkOn = blinkOn;
    visVehicles.push(s);
  }

  function render(ctx, width, height, now, explored) {
    ctx.fillStyle = "#151314";
    ctx.fillRect(0, 0, width, height);

    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    const zoom = Math.max(0.62, Math.min(5, Math.max(minSide / 800, maxSide / 1360)));
    const worldW = width / zoom;
    const worldH = height / zoom;
    const shakeX = camShake > 0 ? (Math.random() - 0.5) * camShake : 0;
    const shakeY = camShake > 0 ? (Math.random() - 0.5) * camShake : 0;
    const camCenterX = player.x + shakeX;
    const camCenterY = player.y + shakeY;
    const camX = camCenterX - worldW / 2;
    const camY = camCenterY - worldH / 2;
    const view = viewObj;
    view.minX = camX - 110;
    view.maxX = camX + worldW + 110;
    view.minY = camY - 110;
    view.maxY = camY + worldH + 110;

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // 1. Спокойная архитектурная сетка на тёплой мокрой земле
    const step = 48;
    const gx0 = Math.floor((camX - 48) / step) * step;
    const gy0 = Math.floor((camY - 48) / step) * step;
    ctx.strokeStyle = "rgba(238, 222, 198, 0.032)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = gx0; x < camX + worldW + 48; x += step) {
      ctx.moveTo(x, camY - 48); ctx.lineTo(x, camY + worldH + 48);
    }
    for (let y = gy0; y < camY + worldH + 48; y += step) {
      ctx.moveTo(camX - 48, y); ctx.lineTo(camX + worldW + 48, y);
    }
    ctx.stroke();

    // 2. Южный канал с лодкой и рыбаком на пирсе (рисуем только если в кадре)
    if (view.maxY >= 940) {
      drawHarborCanal(ctx, now, view);
      drawFisherman(ctx, now);
    }

    // 3. Тихий дворик маяка на уровне земли (открывается после 4/4 районов)
    const allFour = Boolean(explored.about && explored.vibes && explored.contact && explored.setup);
    if (view.maxX >= ZONES.secret.x - 135 && view.minX <= ZONES.secret.x + 135 && view.maxY >= ZONES.secret.y - 135 && view.minY <= ZONES.secret.y + 135) {
      drawSecretGround(ctx, now, allFour, explored.secret);
    }

    // 4. Мокрый асфальт, широкие тротуары и пешеходные зебры
    drawRoadsAndSidewalks(ctx, view);

    // 5. Лужи с тёплыми отражениями и следы шин, приствольные ямы и тени деревьев
    drawPuddles(ctx, view);
    drawTireTracks(ctx, view);
    drawTreeGrounds(ctx, now, view);

    // 6. Площадки районов, гараж, двери домов, навес CAFE и остановка METRO
    drawPlazas(ctx, now, explored, view);

    // 7. Свет из окон, уличные фонари и светофоры на кольце
    drawWindowSpills(ctx, view);
    drawStreetlamps(ctx, view);
    drawTrafficLights(ctx, now, view);

    // 8. Брызги, искры, волны гудка и рябь от дождя (батчинг по альфе)
    rippleB[0].length = rippleB[1].length = rippleB[2].length = 0;
    for (let i = 0; i < ripples.length; i++) {
      const rp = ripples[i];
      if (rp.x < view.minX || rp.x > view.maxX || rp.y < view.minY || rp.y > view.maxY) continue;
      const b = rp.alpha < 0.14 ? 0 : rp.alpha < 0.28 ? 1 : 2;
      rippleB[b].push(rp);
    }
    ctx.lineWidth = 1;
    for (let b = 0; b < 3; b++) {
      const arr = rippleB[b];
      if (!arr.length) continue;
      ctx.strokeStyle = RIPPLE_COLS[b];
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const rp = arr[i];
        ctx.moveTo(rp.x + rp.r, rp.y);
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    sprayB[0].length = sprayB[1].length = sprayB[2].length = 0;
    sprayGoldB[0].length = sprayGoldB[1].length = sprayGoldB[2].length = 0;
    for (let i = 0; i < sprays.length; i++) {
      const sp = sprays[i];
      if (sp.x < view.minX || sp.x > view.maxX || sp.y < view.minY || sp.y > view.maxY) continue;
      const b = sp.life < 0.34 ? 0 : sp.life < 0.67 ? 1 : 2;
      if (sp.gold) sprayGoldB[b].push(sp);
      else sprayB[b].push(sp);
    }
    for (let b = 0; b < 3; b++) {
      const arr = sprayB[b];
      if (arr.length) {
        ctx.fillStyle = SPRAY_COLS[b];
        ctx.beginPath();
        for (let i = 0; i < arr.length; i++) {
          const sp = arr[i];
          ctx.moveTo(sp.x + sp.r, sp.y);
          ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      const garr = sprayGoldB[b];
      if (garr.length) {
        ctx.fillStyle = SPRAY_GOLD_COLS[b];
        ctx.beginPath();
        for (let i = 0; i < garr.length; i++) {
          const sp = garr[i];
          ctx.moveTo(sp.x + sp.r, sp.y);
          ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    sparkB[0].length = sparkB[1].length = 0;
    for (let i = 0; i < sparks.length; i++) {
      const sk = sparks[i];
      if (sk.x < view.minX || sk.x > view.maxX || sk.y < view.minY || sk.y > view.maxY) continue;
      sparkB[sk.life < 0.5 ? 0 : 1].push(sk);
    }
    for (let b = 0; b < 2; b++) {
      const arr = sparkB[b];
      if (!arr.length) continue;
      ctx.fillStyle = SPARK_COLS[b];
      for (let i = 0; i < arr.length; i++) {
        const sk = arr[i];
        ctx.fillRect(sk.x - 1.5, sk.y - 1.5, 3, 3);
      }
    }
    drawHornWaves(ctx, explored);

    // 9. Отлетевшие зонты, кот под навесом и пешеходы (с физикой GTA2 и живой посадкой)
    drawDroppedUmbrellas(ctx, view);
    drawCat(ctx, now, view);
    drawPedestrians(ctx, now, view);

    // 10-11. Весь видимый транспорт тремя батч-проходами (свет фары -> кузов -> ореолы ламп)
    visVehicles.length = 0;
    const carPad = 210;
    const hzPhase = Math.floor(now / 260) % 2 === 0;
    const blPhase300 = Math.floor(now / 300) % 2 === 0;
    const blPhase280 = Math.floor(now / 280) % 2 === 0;
    let si = 0;

    for (let i = 0; i < traffic.length; i++) {
      const t = traffic[i];
      if (t.x < view.minX - carPad || t.x > view.maxX + carPad || t.y < view.minY - carPad || t.y > view.maxY + carPad) continue;
      const hz = t.hazardTimer > 0 && hzPhase;
      const hb = t.flashTimer > 0;
      const bl = !hz && t.blinkDir !== 0 && blPhase300;
      pushVehSlot(si++, t.x, t.y, t.angle, t.len, t.wid, t.radius, t.color, false, false, false, t.type === "taxi", t.braking, hz, hb, false, hb ? "high" : "low", t.blinkDir, bl);
    }
    if (bus.x >= view.minX - carPad && bus.x <= view.maxX + carPad && bus.y >= view.minY - carPad && bus.y <= view.maxY + carPad) {
      const hz = bus.hazardTimer > 0 && hzPhase;
      const hb = bus.flashTimer > 0;
      const bl = !hz && bus.blinkDir !== 0 && blPhase300;
      pushVehSlot(si++, bus.x, bus.y, bus.angle, bus.len, bus.wid, bus.radius, bus.color, false, true, false, false, bus.braking, hz, hb, false, hb ? "high" : "low", bus.blinkDir, bl);
    }
    if (scooter.x >= view.minX - carPad && scooter.x <= view.maxX + carPad && scooter.y >= view.minY - carPad && scooter.y <= view.maxY + carPad) {
      const bl = scooter.blinkDir !== 0 && blPhase280;
      pushVehSlot(si++, scooter.x, scooter.y, scooter.angle, scooter.len, scooter.wid, scooter.radius, scooter.color, false, false, true, false, scooter.braking, false, false, false, "low", scooter.blinkDir, bl);
    }
    pushVehSlot(
      si++,
      player.x, player.y, player.angle, playerSpec.len, playerSpec.wid, player.radius,
      overdrive ? "#b58d52" : playerSpec.color,
      true, false, false, playerSpec.taxi,
      player.drifting || player.braking, false,
      headlightMode === "high", overdrive, headlightMode,
      playerBlink, playerBlink !== 0 && blPhase300
    );

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < visVehicles.length; i++) {
      const v = visVehicles[i];
      if (v.isScooter || v.lightMode !== "off" || (v.onScreen && v.braking) || (v.isPlayer && (beamPower > 0.004 || playerBounce.alpha > 0.008))) {
        drawVehicleLights(ctx, v, now, view);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < visVehicles.length; i++) {
      const v = visVehicles[i];
      if (v.onScreen) drawVehicleBody(ctx, v);
    }

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < visVehicles.length; i++) {
      const v = visVehicles[i];
      if (v.onScreen) drawVehicleHalos(ctx, v);
    }
    ctx.globalCompositeOperation = "source-over";

    // 12. 2.5D Параллакс-здания с живым светом из окон и теплом на тротуаре
    draw25DBuildings(ctx, camCenterX, camCenterY, now, view);

    // 13. Деревья 2.5D, покачивающиеся под дождём и ветром
    drawTrees(ctx, camCenterX, camCenterY, now, view);

    // 13.5. 2.5D Маяк и объёмный вращающийся луч света на северо-востоке
    drawSecretLighthouse(ctx, camCenterX, camCenterY, now, allFour, explored.secret, view);

    // 14. Ночная электричка на западной эстакаде
    if (view.minX <= -620 && view.maxX >= -730) {
      drawCommuterTrain(ctx);
    }

    // 16. Стайки птиц (сидят или летят над крышами)
    drawBirds(ctx, view);

    ctx.restore();

    // 17. Реалистичный многослойный дождь + капли по краям экрана + зарница
    if (lightningAlpha > 0) {
      ctx.fillStyle = `rgba(235, 220, 195, ${lightningAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
    const windX = wind * 24;
    for (let li = 0; li < rainLayers.length; li++) {
      const layer = rainLayers[li];
      ctx.strokeStyle = RAIN_STROKES[li];
      ctx.lineWidth = RAIN_WIDTHS[li];
      ctx.beginPath();
      for (let i = 0; i < layer.length; i++) {
        const d = layer[i];
        const rx = d.x * width;
        const ry = d.y * height;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + windX, ry + d.len);
      }
      ctx.stroke();
    }
    drawGlassDrops(ctx, width, height);
  }

  function drawHarborCanal(ctx, now, view) {
    ctx.save();
    ctx.fillStyle = "#141215";
    ctx.fillRect(-2400, 1020, 4800, 1400);

    // Мягкие плёночные отражения фонарей на воде
    const startX = Math.max(-2200, Math.floor(view.minX / 110) * 110);
    const endX = Math.min(2200, view.maxX + 110);
    for (let i = startX; i <= endX; i += 110) {
      const wave = Math.sin(now * 0.002 + i * 0.1) * 4;
      ctx.fillStyle = "rgba(212, 163, 93, 0.13)";
      ctx.fillRect(i + wave, 1060, 36, 3);
      ctx.fillStyle = "rgba(168, 114, 120, 0.11)";
      ctx.fillRect(i - wave + 20, 1100, 26, 2);
    }

    // Гранитная набережная
    ctx.strokeStyle = "#4d4542";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2400, 1020);
    ctx.lineTo(2400, 1020);
    ctx.stroke();

    // Деревянный пирс
    ctx.fillStyle = "#2b2524";
    ctx.fillRect(-52, 1000, 104, 125);
    ctx.strokeStyle = "#7c8c6e";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-52, 1000, 104, 125);

    // Небольшая покачивающаяся лодка у пирса с тёплым фонарём
    const bobY = 1083 + Math.sin(now * 0.0022) * 3;
    ctx.fillStyle = "#46352d";
    ctx.beginPath();
    ctx.ellipse(86, bobY, 22, 9, 0.08 * Math.sin(now * 0.0015), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4dca8";
    ctx.beginPath();
    ctx.arc(92, bobY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSecretGround(ctx, now, unlocked, discovered) {
    const sx = ZONES.secret.x, sy = ZONES.secret.y;
    ctx.drawImage(SECRET_PLAZA_SPRITE, sx - 110, sy - 110);

    if (unlocked) {
      const beamAng = now * 0.00052;
      const bCos = Math.cos(beamAng) * 76;
      const bSin = Math.sin(beamAng) * 76;

      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(GLOW_SECRET, sx - 115, sy - 115);
      for (let i = 0; i < SECRET_BOLLARDS.length; i++) {
        const bp = SECRET_BOLLARDS[i];
        ctx.drawImage(GLOW_LH_BOLLARD, sx + bp[0] - 18, sy + bp[1] - 18);
      }
      ctx.globalAlpha = discovered ? 0.28 : 0.22;
      ctx.drawImage(GLOW_SECRET, sx + bCos - 88, sy + bSin - 88, 176, 176);
      ctx.drawImage(GLOW_SECRET, sx - bCos - 88, sy - bSin - 88, 176, 176);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Тонкое вращающееся латунное кольцо компаса на брусчатке
      const ringAng = now * 0.00045;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ringAng);
      ctx.strokeStyle = discovered ? "rgba(232, 199, 130, 0.52)" : "rgba(212, 174, 108, 0.42)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a0 = k * Math.PI * 0.5 + 0.14;
        const a1 = (k + 1) * Math.PI * 0.5 - 0.14;
        ctx.moveTo(Math.cos(a0) * 74, Math.sin(a0) * 74);
        ctx.arc(0, 0, 74, a0, a1);
      }
      ctx.stroke();
      ctx.fillStyle = discovered ? "#ebd094" : "#d2ad68";
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI * 0.5;
        const px = Math.cos(a) * 74, py = Math.sin(a) * 74;
        ctx.moveTo(px + 2.2, py);
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    ctx.font = "bold 9.5px monospace";
    ctx.textAlign = "center";
    if (unlocked) {
      ctx.fillStyle = discovered ? "#ebd094" : "rgba(235, 208, 148, 0.90)";
      ctx.fillText(discovered ? "★ QUIET LIGHTHOUSE" : "★ LIGHTHOUSE OPEN", sx, sy + 64);
    } else {
      ctx.fillStyle = "rgba(150, 158, 168, 0.62)";
      ctx.fillText("🔒 UNLOCK 4/4 ZONES", sx, sy + 64);
    }
  }

  function drawCylinderSeg(ctx, ax, ay, rA, bx, by, rB, fill, strokeColor) {
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    const dr = rA - rB;
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (d <= Math.abs(dr) + 0.4) {
      const rMax = rA > rB ? rA : rB;
      const cx = rA > rB ? ax : bx;
      const cy = rA > rB ? ay : by;
      ctx.arc(cx, cy, rMax, 0, Math.PI * 2);
    } else {
      const baseAng = Math.atan2(dy, dx);
      const cPhi = Math.max(-0.999, Math.min(0.999, dr / d));
      const phi = Math.acos(cPhi);
      ctx.arc(ax, ay, rA, baseAng + phi, baseAng - phi + Math.PI * 2, false);
      ctx.arc(bx, by, rB, baseAng - phi, baseAng + phi, false);
      ctx.closePath();
    }
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawSecretLighthouse(ctx, camX, camY, now, unlocked, discovered, view) {
    const sx = ZONES.secret.x, sy = ZONES.secret.y;
    const pad = unlocked ? 440 : 170;
    if (sx + pad < view.minX || sx - pad > view.maxX || sy + pad < view.minY || sy - pad > view.maxY) return;

    const ux = sx - camX;
    const uy = sy - camY;
    const xB0 = sx + ux * (56 * 0.00125),  yB0 = sy + uy * (56 * 0.00125);
    const xB1 = sx + ux * (90 * 0.00125),  yB1 = sy + uy * (90 * 0.00125);
    const x1  = sx + ux * (104 * 0.00125), y1  = sy + uy * (104 * 0.00125);
    const x2  = sx + ux * (154 * 0.00125), y2  = sy + uy * (154 * 0.00125);
    const xRl = sx + ux * (165 * 0.00125), yRl = sy + uy * (165 * 0.00125);
    const x3b = sx + ux * (156 * 0.00125), y3b = sy + uy * (156 * 0.00125);
    const x3m = sx + ux * (174 * 0.00125), y3m = sy + uy * (174 * 0.00125);
    const x3t = sx + ux * (190 * 0.00125), y3t = sy + uy * (190 * 0.00125);
    const x4  = sx + ux * (224 * 0.00125), y4  = sy + uy * (224 * 0.00125);

    // 1. Мягкая тень башни на ЮВ по брусчатке
    ctx.strokeStyle = "rgba(8, 7, 8, 0.34)";
    ctx.lineCap = "round";
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy + 5);
    ctx.lineTo(sx + 40, sy + 30);
    ctx.stroke();

    // 2. Каменный ствол маяка + выветренная светло-каменная полоса + верхний карниз
    drawCylinderSeg(ctx, sx, sy, 20, x1, y1, 16.5, "#2a2426", "rgba(214, 198, 174, 0.14)");
    drawCylinderSeg(ctx, xB0, yB0, 18.1, xB1, yB1, 17.0, "#4d433e", "rgba(222, 204, 178, 0.14)");
    drawCylinderSeg(ctx, x1, y1, 16.5, x2, y2, 15.0, "#30292b", "rgba(218, 200, 176, 0.14)");

    // Арочное окошко винтовой лестницы на ЮЗ стороне башни
    const xWin = sx + ux * (72 * 0.00125) - 11.2;
    const yWin = sy + uy * (72 * 0.00125) + 11.2;
    ctx.fillStyle = unlocked ? "#f2cb85" : "#151214";
    ctx.beginPath();
    ctx.ellipse(xWin, yWin, 2.3, 3.6, -0.78, 0, Math.PI * 2);
    ctx.fill();

    // 3. Выступающая круглая галерея балкона + кованые перила
    ctx.fillStyle = "#332b2d";
    ctx.strokeStyle = unlocked ? "#b89054" : "#686260";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x2, y2, 20.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(214, 198, 176, 0.34)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(x2 + ca * 20.5, y2 + sa * 20.5);
      ctx.lineTo(xRl + ca * 22.5, yRl + sa * 22.5);
    }
    ctx.stroke();

    ctx.strokeStyle = unlocked ? "rgba(216, 176, 108, 0.62)" : "rgba(130, 134, 140, 0.42)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(xRl, yRl, 22.5, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Стеклянная камера фонаря с линзой Френеля + переплёт
    const lanternFill = unlocked ? "#f5dfa9" : "#191d24";
    const lanternEdge = unlocked ? "rgba(255, 240, 196, 0.72)" : "rgba(130, 142, 158, 0.25)";
    drawCylinderSeg(ctx, x3b, y3b, 12.2, x3t, y3t, 12.2, lanternFill, lanternEdge);

    ctx.strokeStyle = "rgba(28, 22, 18, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const ox = Math.cos(a) * 12.2, oy = Math.sin(a) * 12.2;
      ctx.moveTo(x3b + ox, y3b + oy);
      ctx.lineTo(x3t + ox, y3t + oy);
    }
    ctx.stroke();

    // 5. Два противоположных объёмных луча маяка (выходят прямо из камеры линзы)
    const beamAng = now * 0.00052;
    if (unlocked) {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(GLOW_LH_LANTERN, x3m - 46, y3m - 46);
      ctx.globalAlpha = discovered ? 0.92 : 0.78;
      for (let side = 0; side < 2; side++) {
        ctx.save();
        ctx.translate(x3m, y3m);
        ctx.rotate(beamAng + side * Math.PI);
        ctx.drawImage(BEAM_LIGHTHOUSE, -18, -88);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // 6. Конический медный купол + граневый блик + латунный шпиль (перекрывают центр лучей)
    drawCylinderSeg(ctx, x3t, y3t, 14.8, x4, y4, 1.8, "#343d37", "#8c7a58");
    drawCylinderSeg(ctx, x3t + 1.5, y3t - 1.2, 9.6, x4, y4, 1.4, "rgba(116, 134, 118, 0.22)", null);

    ctx.fillStyle = unlocked ? "#e6c27a" : "#786d60";
    ctx.beginPath();
    ctx.arc(x4, y4, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 7. Заградительный огонёк на спящем маяке или тёплый блик на активном
    if (unlocked) {
      ctx.fillStyle = "#fff5d8";
      ctx.beginPath();
      ctx.arc(x4, y4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulse = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(now * 0.0032));
      ctx.globalAlpha = pulse;
      ctx.drawImage(GLOW_LH_RED, x4 - 12, y4 - 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pulse > 0.6 ? "#e87062" : "#7a3834";
      ctx.beginPath();
      ctx.arc(x4, y4, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoadsAndSidewalks(ctx, view) {
    const sw = 30;
    const rOuter = RING_COORD + RING_WIDTH / 2;
    const rInner = RING_COORD - RING_WIDTH / 2;
    const roadHalf = AVE_WIDTH / 2;
    const nsVisible = view.maxX >= -roadHalf - sw - 2 && view.minX <= roadHalf + sw + 2;
    const ewVisible = view.maxY >= -roadHalf - sw - 2 && view.minY <= roadHalf + sw + 2;
    const rMinY = Math.max(-1950, view.minY - 40);
    const rMaxY = Math.min(1020, view.maxY + 40);
    const rMinX = Math.max(-1950, view.minX - 40);
    const rMaxX = Math.min(1950, view.maxX + 40);
    const ringMinX = Math.max(-rOuter - sw, view.minX - 40);
    const ringMaxX = Math.min(rOuter + sw, view.maxX + 40);
    const ringMinY = Math.max(-rOuter - sw, view.minY - 40);
    const ringMaxY = Math.min(rOuter + sw, view.maxY + 40);

    // Широкие тротуары (30px) по краям проспектов и кольца (отсечены по экрану)
    ctx.fillStyle = "#252122";
    if (nsVisible && rMaxY > rMinY) ctx.fillRect(-roadHalf - sw, rMinY, AVE_WIDTH + sw * 2, rMaxY - rMinY);
    if (ewVisible && rMaxX > rMinX) ctx.fillRect(rMinX, -roadHalf - sw, rMaxX - rMinX, AVE_WIDTH + sw * 2);
    if (ringMaxX > ringMinX) {
      if (view.maxY >= -rOuter - sw && view.minY <= -rInner + sw) ctx.fillRect(ringMinX, -rOuter - sw, ringMaxX - ringMinX, RING_WIDTH + sw * 2);
      if (view.maxY >= rInner - sw && view.minY <= rOuter + sw) ctx.fillRect(ringMinX, rInner - sw, ringMaxX - ringMinX, RING_WIDTH + sw * 2);
    }
    if (ringMaxY > ringMinY) {
      if (view.maxX >= -rOuter - sw && view.minX <= -rInner + sw) ctx.fillRect(-rOuter - sw, ringMinY, RING_WIDTH + sw * 2, ringMaxY - ringMinY);
      if (view.maxX >= rInner - sw && view.minX <= rOuter + sw) ctx.fillRect(rInner - sw, ringMinY, RING_WIDTH + sw * 2, ringMaxY - ringMinY);
    }

    // Мокрый тёпло-графитовый асфальт
    const ringAsphMinX = Math.max(-rOuter, view.minX - 40);
    const ringAsphMaxX = Math.min(rOuter, view.maxX + 40);
    const ringAsphMinY = Math.max(-rOuter, view.minY - 40);
    const ringAsphMaxY = Math.min(rOuter, view.maxY + 40);
    ctx.fillStyle = "#1a1718";
    if (nsVisible && rMaxY > rMinY) ctx.fillRect(-roadHalf, rMinY, AVE_WIDTH, rMaxY - rMinY);
    if (ewVisible && rMaxX > rMinX) ctx.fillRect(rMinX, -roadHalf, rMaxX - rMinX, AVE_WIDTH);
    if (ringAsphMaxX > ringAsphMinX) {
      if (view.maxY >= -rOuter && view.minY <= -rInner) ctx.fillRect(ringAsphMinX, -rOuter, ringAsphMaxX - ringAsphMinX, RING_WIDTH);
      if (view.maxY >= rInner && view.minY <= rOuter) ctx.fillRect(ringAsphMinX, rInner, ringAsphMaxX - ringAsphMinX, RING_WIDTH);
    }
    if (ringAsphMaxY > ringAsphMinY) {
      if (view.maxX >= -rOuter && view.minX <= -rInner) ctx.fillRect(-rOuter, ringAsphMinY, RING_WIDTH, ringAsphMaxY - ringAsphMinY);
      if (view.maxX >= rInner && view.minX <= rOuter) ctx.fillRect(rInner, ringAsphMinY, RING_WIDTH, ringAsphMaxY - ringAsphMinY);
    }

    // Чёткие кромки бордюров между асфальтом и широкими тротуарами
    ctx.strokeStyle = "rgba(235, 222, 200, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (nsVisible && rMaxY > rMinY) {
      ctx.moveTo(-roadHalf, rMinY); ctx.lineTo(-roadHalf, rMaxY);
      ctx.moveTo(roadHalf, rMinY);  ctx.lineTo(roadHalf, rMaxY);
    }
    if (ewVisible && rMaxX > rMinX) {
      ctx.moveTo(rMinX, -roadHalf); ctx.lineTo(rMaxX, -roadHalf);
      ctx.moveTo(rMinX, roadHalf);  ctx.lineTo(rMaxX, roadHalf);
    }
    ctx.stroke();
    if (view.maxX >= -rOuter && view.minX <= rOuter && view.maxY >= -rOuter && view.minY <= rOuter) {
      ctx.strokeRect(-rOuter, -rOuter, rOuter * 2, rOuter * 2);
      if (view.maxX >= -rInner && view.minX <= rInner && view.maxY >= -rInner && view.minY <= rInner) {
        ctx.strokeRect(-rInner, -rInner, rInner * 2, rInner * 2);
      }
    }

    // Ненавязчивая приглушённая разметка полос (с шагом кратным периоду 30px)
    ctx.strokeStyle = "rgba(218, 185, 130, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 16]);
    ctx.beginPath();
    if (view.minX <= 4 && view.maxX >= -4) {
      if (view.maxY >= -1900 && view.minY <= -80) {
        const s = -1900 + Math.max(0, Math.floor((view.minY - 30 + 1900) / 30)) * 30;
        const e = Math.min(-80, view.maxY + 30);
        if (s < e) { ctx.moveTo(0, s); ctx.lineTo(0, e); }
      }
      if (view.maxY >= 80 && view.minY <= 995) {
        const s = 80 + Math.max(0, Math.floor((view.minY - 30 - 80) / 30)) * 30;
        const e = Math.min(995, view.maxY + 30);
        if (s < e) { ctx.moveTo(0, s); ctx.lineTo(0, e); }
      }
    }
    if (view.minY <= 4 && view.maxY >= -4) {
      if (view.maxX >= -1900 && view.minX <= -80) {
        const s = -1900 + Math.max(0, Math.floor((view.minX - 30 + 1900) / 30)) * 30;
        const e = Math.min(-80, view.maxX + 30);
        if (s < e) { ctx.moveTo(s, 0); ctx.lineTo(e, 0); }
      }
      if (view.maxX >= 80 && view.minX <= 1900) {
        const s = 80 + Math.max(0, Math.floor((view.minX - 30 - 80) / 30)) * 30;
        const e = Math.min(1900, view.maxX + 30);
        if (s < e) { ctx.moveTo(s, 0); ctx.lineTo(e, 0); }
      }
    }
    ctx.stroke();

    // Деликатные полосы границы города на окраинах проспектов (WORLD_LIMIT)
    const limN = nsVisible && view.minY <= -WORLD_LIMIT + 4 && view.maxY >= -WORLD_LIMIT - 4;
    const limW = ewVisible && view.minX <= -WORLD_LIMIT + 4 && view.maxX >= -WORLD_LIMIT - 4;
    const limE = ewVisible && view.minX <= WORLD_LIMIT + 4 && view.maxX >= WORLD_LIMIT - 4;
    if (limN || limW || limE) {
      ctx.strokeStyle = "rgba(212, 163, 93, 0.26)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      if (limN) { ctx.moveTo(-roadHalf, -WORLD_LIMIT); ctx.lineTo(roadHalf, -WORLD_LIMIT); }
      if (limW) { ctx.moveTo(-WORLD_LIMIT, -roadHalf); ctx.lineTo(-WORLD_LIMIT, roadHalf); }
      if (limE) { ctx.moveTo(WORLD_LIMIT, -roadHalf);  ctx.lineTo(WORLD_LIMIT, roadHalf); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Пешеходные переходы (зебры) и стоп-линии на 4 перекрёстках кольца
    ctx.fillStyle = "rgba(232, 220, 202, 0.24)";
    for (const inter of INTERSECTIONS) {
      if (inter.x + 90 < view.minX || inter.x - 90 > view.maxX || inter.y + 90 < view.minY || inter.y - 90 > view.maxY) continue;
      const roadW = inter.x === 0 ? 50 : 32;
      const roadH = inter.y === 0 ? 50 : 32;
      for (const s of [-1, 1]) {
        const py = inter.y + s * (inter.nsStop - 10);
        for (let sx = -roadW + 4; sx <= roadW - 8; sx += 10) {
          ctx.fillRect(inter.x + sx, py - 8, 5, 16);
        }
        const px = inter.x + s * (inter.ewStop - 10);
        for (let sy = -roadH + 4; sy <= roadH - 8; sy += 10) {
          ctx.fillRect(px - 8, inter.y + sy, 16, 5);
        }
      }
    }

    // Подписи у перекрёстка и указатель заезда в гараж (вне полос зебры)
    if (view.minX <= 190 && view.maxX >= -190 && view.minY <= 150 && view.maxY >= -140) {
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(238, 224, 204, 0.45)";
      ctx.fillText("↑ ABOUT", 0, -112);
      ctx.fillText("↓ CONTACT", 0, 122);
      ctx.fillText("← VIBES", -134, 4);
      ctx.fillText("SETUP →", 134, 4);
    }
    if (view.minX <= 430 && view.maxX >= -10 && view.minY <= 500 && view.maxY >= 400) {
      ctx.font = "bold 9.5px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(210, 194, 174, 0.48)";
      ctx.fillText("GARAGE ↘", 42, 424);
      ctx.fillText("↑ GARAGE", 380, 482);
    }
  }

  function drawPuddles(ctx, view) {
    const lightsOn = beamPower > 0.004;
    const maxDist = 220 + 90 * beamHighMix;
    const beamAng = player.angle + beamSteer;
    const fx = Math.cos(beamAng);
    const fy = Math.sin(beamAng);
    const beamTint = overdrive ? "#f8d488" : "#f4e0b8";
    const strengthMult = (0.16 + 0.08 * beamHighMix) * beamPower;

    for (let i = 0; i < PUDDLES.length; i++) {
      const p = PUDDLES[i];
      if (p.x + 50 < view.minX || p.x - 50 > view.maxX || p.y + 50 < view.minY || p.y - 50 > view.maxY) continue;

      let beamAlpha = 0;
      if (lightsOn) {
        const dx = p.x - player.x, dy = p.y - player.y;
        const along = dx * fx + dy * fy;
        if (along > -12 && along < maxDist) {
          const dAlong = Math.max(0, along);
          const halfCone = 42 + dAlong * 0.32;
          const lat = Math.abs(dx * -fy + dy * fx);
          if (lat < halfCone) {
            beamAlpha = (1 - dAlong / maxDist) * (1 - lat / halfCone) * strengthMult;
          }
        }
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = "rgba(34, 28, 30, 0.74)";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Лёгкий плёночный отблеск неба/фонарей на кромке лужи
      ctx.strokeStyle = "rgba(214, 196, 172, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (beamAlpha > 0.005) {
        ctx.globalAlpha = beamAlpha;
        ctx.fillStyle = beamTint;
        ctx.beginPath();
        ctx.ellipse(-p.rx * 0.15, -p.ry * 0.12, p.rx * 0.58, p.ry * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  const npcTrackB = [[], [], [], []];
  const pNormTrackB = [[], [], [], []];
  const pDriftTrackB = [[], [], [], []];
  const npcTrackCols = ["rgba(7, 10, 14, 0.03)", "rgba(7, 10, 14, 0.08)", "rgba(7, 10, 14, 0.14)", "rgba(7, 10, 14, 0.20)"];
  const pNormTrackCols = ["rgba(7, 10, 14, 0.05)", "rgba(7, 10, 14, 0.13)", "rgba(7, 10, 14, 0.22)", "rgba(7, 10, 14, 0.31)"];
  const pDriftTrackCols = ["rgba(7, 10, 14, 0.08)", "rgba(7, 10, 14, 0.20)", "rgba(7, 10, 14, 0.34)", "rgba(7, 10, 14, 0.48)"];

  function drawTrackBuckets(ctx, buckets, cols, lineWidth, allowSingle) {
    ctx.lineWidth = lineWidth;
    for (let b = 0; b < 4; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      ctx.strokeStyle = cols[b];
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        ctx.moveTo(m.x1l, m.y1l);
        ctx.lineTo(m.x2l, m.y2l);
        if (!allowSingle || !m.single) {
          ctx.moveTo(m.x1r, m.y1r);
          ctx.lineTo(m.x2r, m.y2r);
        }
      }
      ctx.stroke();
    }
  }

  function drawTireTracks(ctx, view) {
    if (!tireMarks.length && !npcTireMarks.length) return;
    for (let b = 0; b < 4; b++) {
      npcTrackB[b].length = 0;
      pNormTrackB[b].length = 0;
      pDriftTrackB[b].length = 0;
    }

    for (let i = 0; i < npcTireMarks.length; i++) {
      const m = npcTireMarks[i];
      if (m.x1l < view.minX && m.x2l < view.minX) continue;
      if (m.x1l > view.maxX && m.x2l > view.maxX) continue;
      if (m.y1l < view.minY && m.y2l < view.minY) continue;
      if (m.y1l > view.maxY && m.y2l > view.maxY) continue;
      const bi = Math.min(3, Math.max(0, (m.life * 3.99) | 0));
      npcTrackB[bi].push(m);
    }
    for (let i = 0; i < tireMarks.length; i++) {
      const m = tireMarks[i];
      if (m.x1l < view.minX && m.x2l < view.minX) continue;
      if (m.x1l > view.maxX && m.x2l > view.maxX) continue;
      if (m.y1l < view.minY && m.y2l < view.minY) continue;
      if (m.y1l > view.maxY && m.y2l > view.maxY) continue;
      const bi = Math.min(3, Math.max(0, (m.life * 3.99) | 0));
      if (m.drift) pDriftTrackB[bi].push(m);
      else pNormTrackB[bi].push(m);
    }

    ctx.save();
    ctx.lineCap = "round";
    drawTrackBuckets(ctx, npcTrackB, npcTrackCols, 1.05, true);
    drawTrackBuckets(ctx, pNormTrackB, pNormTrackCols, 1.7, false);
    drawTrackBuckets(ctx, pDriftTrackB, pDriftTrackCols, 2.4, false);
    ctx.restore();
  }

  function drawPlazas(ctx, now, explored, view) {
    // Центр города
    if (view.minX <= 70 && view.maxX >= -70 && view.minY <= 70 && view.maxY >= -70) {
      ctx.save();
      ctx.strokeStyle = "rgba(216, 164, 92, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 64, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#d8a45c";
      ctx.fillText("PLAZA // 00", 0, 4);
      ctx.restore();
    }

    for (let i = 0; i < MAIN_ZONE_IDS.length; i++) {
      const k = MAIN_ZONE_IDS[i];
      const z = ZONES[k];
      const pad = 72;
      if (z.x + pad < view.minX || z.x - pad > view.maxX || z.y + pad < view.minY || z.y - pad > view.maxY) continue;
      const done = explored[k];
      ctx.save();
      ctx.fillStyle = "rgba(22, 26, 35, 0.78)";
      ctx.fillRect(z.x - pad, z.y - pad, pad * 2, pad * 2);

      ctx.strokeStyle = z.color;
      ctx.lineWidth = done ? 2.2 : 1.5;
      const b = 18;
      ctx.beginPath();
      ctx.moveTo(z.x - pad, z.y - pad + b); ctx.lineTo(z.x - pad, z.y - pad); ctx.lineTo(z.x - pad + b, z.y - pad);
      ctx.moveTo(z.x + pad - b, z.y - pad); ctx.lineTo(z.x + pad, z.y - pad); ctx.lineTo(z.x + pad, z.y - pad + b);
      ctx.moveTo(z.x - pad, z.y + pad - b); ctx.lineTo(z.x - pad, z.y + pad); ctx.lineTo(z.x - pad + b, z.y + pad);
      ctx.moveTo(z.x + pad - b, z.y + pad); ctx.lineTo(z.x + pad, z.y + pad); ctx.lineTo(z.x + pad, z.y + pad - b);
      ctx.stroke();

      ctx.fillStyle = "#ebe6dc";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(z.label + (done ? " ✓" : ""), z.x, z.y + 4);
      ctx.restore();
    }

    // Площадка гаража во внутреннем дворе SE
    const gz = ZONES.garage;
    if (gz.x + 75 >= view.minX && gz.x - 75 <= view.maxX && gz.y + 75 >= view.minY && gz.y - 75 <= view.maxY) {
      ctx.save();
      ctx.fillStyle = "rgba(33, 28, 29, 0.88)";
      ctx.fillRect(gz.x - 44, gz.y - 44, 88, 88);
      ctx.fillStyle = "#1c1819";
      ctx.fillRect(gz.x - 16, gz.y - 24, 32, 48);
      ctx.drawImage(GLOW_GARAGE, gz.x - 68, gz.y - 68);
      ctx.strokeStyle = "rgba(168, 157, 144, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(gz.x - 44, gz.y - 44, 88, 88);
      ctx.fillStyle = "#e0c898";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GARAGE", gz.x, gz.y - 29);
      ctx.restore();
    }

    // Светлые коврики перед входами в дома (показывают живые двери)
    ctx.fillStyle = "rgba(244, 212, 152, 0.28)";
    ctx.strokeStyle = "rgba(212, 163, 93, 0.45)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < DOORS.length; i++) {
      const d = DOORS[i];
      if (d.x + 8 < view.minX || d.x - 8 > view.maxX || d.y + 8 < view.minY || d.y - 8 > view.maxY) continue;
      ctx.fillRect(d.x - 6, d.y - 6, 12, 12);
      ctx.strokeRect(d.x - 6, d.y - 6, 12, 12);
    }

    // Сухой полосатый навес CAFE и тёплый сухой островок на тротуаре
    if (view.minX <= -248 && view.maxX >= -272 && view.minY <= -126 && view.maxY >= -196) {
      ctx.save();
      ctx.fillStyle = "rgba(38, 32, 27, 0.65)";
      ctx.fillRect(-270, -194, 20, 66);
      for (let sy = -194; sy < -128; sy += 8) {
        ctx.fillStyle = Math.floor(sy / 8) % 2 === 0 ? "rgba(176, 98, 76, 0.72)" : "rgba(226, 205, 174, 0.64)";
        ctx.fillRect(-270, sy, 18, 7);
      }
      ctx.strokeStyle = "rgba(235, 222, 200, 0.22)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-270, -194, 18, 66);
      ctx.restore();
    }

    // Стеклянная автобусная остановка METRO (на широкой набережной у METRO)
    if (view.minX <= -295 && view.maxX >= -357 && view.minY <= 88 && view.maxY >= 48) {
      ctx.save();
      ctx.fillStyle = "rgba(36, 30, 32, 0.78)";
      ctx.fillRect(-355, 66, 58, 20);
      ctx.strokeStyle = "rgba(168, 114, 120, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-355, 66, 58, 20);
      ctx.fillStyle = "rgba(232, 198, 138, 0.44)";
      ctx.fillRect(-335, 71, 18, 4);
      ctx.fillStyle = "rgba(229, 218, 200, 0.52)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("BUS STOP", -326, 60);
      ctx.restore();
    }
  }

  function drawSignalHead(ctx, hx, hy, col, glow) {
    ctx.drawImage(glow, hx - 26, hy - 26);
    ctx.fillStyle = "#1c1819";
    ctx.beginPath();
    ctx.arc(hx, hy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrafficLights(ctx, now, view) {
    const sig = getSignalState(now);
    const nsCol = TL_COLORS[sig.ns];
    const ewCol = TL_COLORS[sig.ew];
    const nsGlow = GLOW_TL[sig.ns];
    const ewGlow = GLOW_TL[sig.ew];

    for (const inter of INTERSECTIONS) {
      if (inter.x + 110 < view.minX || inter.x - 110 > view.maxX || inter.y + 110 < view.minY || inter.y - 110 > view.maxY) continue;
      const ox = inter.ewStop + 4;
      const oy = inter.nsStop + 4;
      drawSignalHead(ctx, inter.x + ox, inter.y - oy, nsCol, nsGlow);
      drawSignalHead(ctx, inter.x - ox, inter.y + oy, nsCol, nsGlow);
      drawSignalHead(ctx, inter.x - ox, inter.y - oy, ewCol, ewGlow);
      drawSignalHead(ctx, inter.x + ox, inter.y + oy, ewCol, ewGlow);
    }
  }

  function drawStreetlamps(ctx, view) {
    let anyLamp = false;
    for (let i = 0; i < STREETLAMP_PTS.length; i++) {
      const lx = STREETLAMP_PTS[i][0], ly = STREETLAMP_PTS[i][1];
      if (lx + 75 < view.minX || lx - 75 > view.maxX || ly + 75 < view.minY || ly - 75 > view.maxY) continue;
      ctx.drawImage(GLOW_LAMP, lx - 68, ly - 68);
      anyLamp = true;
    }
    if (!anyLamp) return;
    ctx.fillStyle = "#f5dbb0";
    ctx.beginPath();
    for (let i = 0; i < STREETLAMP_PTS.length; i++) {
      const lx = STREETLAMP_PTS[i][0], ly = STREETLAMP_PTS[i][1];
      if (lx + 75 < view.minX || lx - 75 > view.maxX || ly + 75 < view.minY || ly - 75 > view.maxY) continue;
      ctx.moveTo(lx + 2.5, ly);
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawHornWaves(ctx, explored) {
    const allFour = Boolean(explored.about && explored.vibes && explored.contact && explored.setup);
    for (const h of hornWaves) {
      ctx.strokeStyle = `rgba(216, 164, 92, ${h.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.stroke();

      if (h.alpha > 0.2) {
        for (let i = 0; i < ZONE_LIST.length; i++) {
          const z = ZONE_LIST[i];
          if (z.id === "garage" || explored[z.id] || (z.id === "secret" && !allFour)) continue;
          const ang = Math.atan2(z.y - player.y, z.x - player.x);
          const mx = player.x + Math.cos(ang) * 76;
          const my = player.y + Math.sin(ang) * 76;
          ctx.fillStyle = z.color;
          ctx.beginPath();
          ctx.arc(mx, my, z.id === "secret" ? 5.2 : 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPerson(ctx, x, y, heading, gait, coatColor, hasHood, hasUmb, umbColor, scale) {
    ctx.save();
    ctx.translate(x, y);
    if (scale) ctx.scale(scale, scale);

    // Контактная тень на мокром тротуаре
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(2, 2.5, 6.5, 5, heading, 0, Math.PI * 2);
    ctx.fill();

    // Шагающие ноги/ботинки вдоль направления движения
    ctx.save();
    ctx.rotate(heading);
    const stride = Math.sin(gait) * 3.1;
    ctx.fillStyle = "#12151b";
    ctx.beginPath();
    ctx.ellipse(stride + 1, -2.1, 2.4, 1.3, 0, 0, Math.PI * 2);
    ctx.ellipse(-stride + 1, 2.1, 2.4, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Плечи и куртка/плащ с лёгким покачиванием корпуса
    ctx.rotate(Math.sin(gait) * 0.08);
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 227, 218, 0.22)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Воротник / плечевой шов и голова или капюшон
    if (!hasUmb) {
      ctx.fillStyle = hasHood ? coatColor : "#231e1b";
      ctx.beginPath();
      ctx.arc(0.8, 0, hasHood ? 3.1 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (hasHood) {
        ctx.strokeStyle = "rgba(210, 224, 240, 0.28)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0.6, 0, 2.8, -1.3, 1.3);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 8-клинный предзапечённый зонт, слегка наклонённый против ветра
    if (hasUmb) {
      const umbImg = UMBRELLA_SPRITE_MAP[umbColor];
      if (umbImg) {
        ctx.drawImage(umbImg, wind * 10 - 10, -11.5, 20, 20);
      }
    }

    ctx.restore();
  }

  function drawKnockedPerson(ctx, p, riseProgress) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const scale = 1 - riseProgress * 0.25;
    ctx.rotate(p.fallAngle);
    ctx.scale(scale, 1);

    // Тень под лежащим человеком
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.beginPath();
    ctx.ellipse(1, 2, 9.5, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ноги (в стороны)
    ctx.fillStyle = "#161a22";
    ctx.beginPath();
    ctx.ellipse(-6.5, -1.6, 3.2, 1.4, 0.22, 0, Math.PI * 2);
    ctx.ellipse(-6.5, 1.6, 3.2, 1.4, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Вытянутые руки
    ctx.strokeStyle = p.coat;
    ctx.lineWidth = 2.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(2, -3); ctx.lineTo(5.5, -5.5);
    ctx.moveTo(2, 3);  ctx.lineTo(5.5, 5.5);
    ctx.stroke();

    // Туловище в плаще на мокром асфальте
    ctx.fillStyle = p.coat;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 227, 218, 0.22)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Голова / капюшон
    ctx.fillStyle = p.kind === "hood" ? p.coat : "#231e1b";
    ctx.beginPath();
    ctx.arc(5.5, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDroppedUmbrellas(ctx, view) {
    for (const u of droppedUmbrellas) {
      if (u.x < view.minX || u.x > view.maxX || u.y < view.minY || u.y > view.maxY) continue;
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(u.angle);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(1.5, 1.5, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.8, 4.2, 0, -0.4, Math.PI * 1.45);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(220, 228, 238, 0.4)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCat(ctx, now, view) {
    if (cat.x < view.minX || cat.x > view.maxX || cat.y < view.minY || cat.y > view.maxY) return;
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.rotate(cat.angle);

    // Плавный виляющий хвост
    const wag = Math.sin(cat.tailPhase) * 2.2;
    ctx.strokeStyle = "#cf8246";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3.5, 0);
    ctx.quadraticCurveTo(-6.5, wag * 0.7, -8.5, wag);
    ctx.stroke();

    // Рыжее тельце
    ctx.fillStyle = "#d48544";
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.8, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Голова и ушки
    ctx.fillStyle = "#de9252";
    ctx.beginPath();
    ctx.arc(3.5, 0, 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8682f";
    ctx.beginPath();
    ctx.moveTo(3.2, -1.6); ctx.lineTo(4.6, -2.5); ctx.lineTo(4.5, -0.8);
    ctx.moveTo(3.2, 1.6);  ctx.lineTo(4.6, 2.5);  ctx.lineTo(4.5, 0.8);
    ctx.fill();
    ctx.restore();

    if (cat.meowCooldown > 1.0 && Math.floor(now / 150) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = "#ebd094";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("meow", cat.x, cat.y - 8);
      ctx.restore();
    }
  }

  function drawFisherman(ctx, now) {
    const f = fisherman;
    // Рыбак у кромки пирса
    drawPerson(ctx, f.x, f.y, Math.PI * 0.65, Math.sin(now * 0.001) * 0.1, "#384a3d", true, false, null, 1.02);

    ctx.save();
    // Ведро и тёплый фонарик на досках пирса
    ctx.fillStyle = "#485461";
    ctx.beginPath();
    ctx.arc(f.x + 10, f.y - 3, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(GLOW_LANTERN, f.x + 12 - 24, f.y + 6 - 24);
    ctx.fillStyle = "#f5d48e";
    ctx.beginPath();
    ctx.arc(f.x + 12, f.y + 6, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Удочка над водой и покачивающийся поплавок
    const tipX = f.x - 16;
    const tipY = f.y + 24;
    const bobX = tipX - 5 + Math.sin(f.bobPhase * 0.7) * 1.2;
    const bobY = tipY + 12 + Math.sin(f.bobPhase) * 1.8;

    ctx.strokeStyle = "#8a7a62";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(f.x - 2, f.y + 3);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(210, 224, 240, 0.45)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Кружок ряби и поплавок на воде
    ctx.strokeStyle = "rgba(170, 196, 220, 0.32)";
    ctx.beginPath();
    ctx.arc(bobX, bobY, 3 + Math.sin(f.bobPhase) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#d96b52";
    ctx.beginPath();
    ctx.arc(bobX, bobY, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPedestrians(ctx, now, view) {
    for (const p of pedestrians) {
      if (p.state === "inside" || p.state === "onBus") continue;
      if (p.x < view.minX || p.x > view.maxX || p.y < view.minY || p.y > view.maxY) continue;
      if (p.opacity < 0.99) ctx.globalAlpha = Math.max(0.05, p.opacity);
      if (p.state === "knocked") {
        drawKnockedPerson(ctx, p, 0);
      } else if (p.state === "getup") {
        const prog = 1 - Math.max(0, Math.min(1, p.getupTimer / 0.85));
        if (prog < 0.6) {
          drawKnockedPerson(ctx, p, prog / 0.6);
        } else {
          drawPerson(ctx, p.x, p.y, p.heading, p.gait, p.coat, !p.hasUmb, p.hasUmb, p.umbrella, 0.82 + 0.18 * ((prog - 0.6) / 0.4));
        }
      } else if (p.kind === "stand" || p.kind === "busWait") {
        drawPerson(ctx, p.x, p.y, p.heading, Math.sin(now * 0.001) * 0.15, p.coat, !p.hasUmb, p.hasUmb, p.umbrella, 1);
      } else {
        drawPerson(ctx, p.x, p.y, p.heading, p.gait, p.coat, p.kind === "hood" && !p.hasUmb, p.hasUmb, p.umbrella, 1);
      }
      if (p.opacity < 0.99) ctx.globalAlpha = 1;

      if (p.alertTimer > 0) {
        ctx.save();
        ctx.fillStyle = "#edd194";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", p.x, p.y - 12);
        ctx.restore();
      }
    }
  }

  function drawBeamSprites(ctx, startOff, reachScale, lowBeam, highBeam, highMix, baseAlpha) {
    if (highMix <= 0.02) {
      ctx.globalAlpha = baseAlpha;
      ctx.drawImage(lowBeam, startOff, -lowBeam.height * 0.5, lowBeam.width * reachScale, lowBeam.height);
    } else if (highMix >= 0.98) {
      ctx.globalAlpha = baseAlpha;
      ctx.drawImage(highBeam, startOff, -highBeam.height * 0.5, highBeam.width * reachScale, highBeam.height);
    } else {
      ctx.globalAlpha = baseAlpha * (1 - highMix);
      ctx.drawImage(lowBeam, startOff, -lowBeam.height * 0.5, lowBeam.width * reachScale, lowBeam.height);
      ctx.globalAlpha = baseAlpha * highMix;
      ctx.drawImage(highBeam, startOff, -highBeam.height * 0.5, highBeam.width * reachScale, highBeam.height);
    }
  }

  function drawBeamUnclipped(ctx, vx, vy, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, alpha) {
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(beamAng);
    drawBeamSprites(ctx, startOff, reachScale, lowBeam, highBeam, highMix, alpha);
    ctx.restore();
  }

  function drawBeamClipped(ctx, vx, vy, ox0, oy0, pxBase, pyBase, nRays, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ox0 - pxBase, oy0 - pyBase);
    for (let k = 0; k < nRays; k++) {
      ctx.lineTo(rayWorldX[k], rayWorldY[k]);
    }
    ctx.lineTo(ox0 + pxBase, oy0 + pyBase);
    ctx.closePath();
    ctx.clip();
    ctx.translate(vx, vy);
    ctx.rotate(beamAng);
    drawBeamSprites(ctx, startOff, reachScale, lowBeam, highBeam, highMix, alpha);
    ctx.restore();
  }

  function tryPushConeCircle(cx, cy, r, rSq, ox0, oy0, cosB, sinB, perpX, perpY, maxReach, tanHalf) {
    if (candCircCount >= 32) return;
    const dxW = cx - ox0;
    const dyW = cy - oy0;
    const along = dxW * cosB + dyW * sinB;
    if (along + r <= 0 || along - r >= maxReach) return;
    const lat = Math.abs(dxW * perpX + dyW * perpY);
    const maxLx = along + r < maxReach ? along + r : maxReach;
    if (lat - r >= maxLx * tanHalf + 6) return;
    candCircX[candCircCount] = cx;
    candCircY[candCircCount] = cy;
    candCircR[candCircCount] = r;
    candCircRSq[candCircCount] = rSq;
    candCircCount++;
  }

  function drawVehicleLights(ctx, v, now, view) {
    const mode = v.lightMode;
    const beamOn = v.isPlayer ? (beamPower > 0.004) : (v.isScooter || mode !== "off");

    if (beamOn) {
      let lowBeam, highBeam, highMix, halfAng, baseCount;
      if (v.isScooter) {
        lowBeam = highBeam = BEAM_SCOOTER;
        highMix = 0;
        halfAng = 0.42;
        baseCount = 5;
      } else if (v.isPlayer) {
        lowBeam = v.goldLights ? BEAM_PLAYER_GOLD_LOW : BEAM_PLAYER_LOW;
        highBeam = v.goldLights ? BEAM_PLAYER_GOLD_HIGH : BEAM_PLAYER_HIGH;
        highMix = beamHighMix;
        halfAng = 0.56;
        baseCount = 13;
      } else {
        lowBeam = v.isBus ? BEAM_BUS_LOW : BEAM_NPC_LOW;
        highBeam = v.isBus ? BEAM_BUS_HIGH : BEAM_NPC_HIGH;
        highMix = mode === "high" ? 1 : 0;
        halfAng = 0.50;
        baseCount = 7;
      }

      const beamAng = v.isPlayer
        ? v.angle + beamSteer + (headlightJolt > 0.01 ? Math.sin(now * 0.028) * 0.022 * headlightJolt : 0)
        : v.angle;
      const reachScale = v.isPlayer ? 1 + beamPitch * 0.095 : 1;
      const joltAlpha = v.isPlayer && headlightJolt > 0.01
        ? (1 - headlightJolt * headlightJolt * (0.14 + 0.08 * Math.sin(now * 0.045)))
        : 1;
      const effectiveAlpha = (v.isPlayer ? 0.88 * beamPower : 0.88) * joltAlpha;

      const cosB = v.isPlayer ? Math.cos(beamAng) : v.cosA;
      const sinB = v.isPlayer ? Math.sin(beamAng) : v.sinA;
      const perpX = -sinB;
      const perpY = cosB;
      const rOff = v.isScooter ? 0 : (v.len * 0.5 - 12);
      const ox0 = v.x + cosB * rOff;
      const oy0 = v.y + sinB * rOff;
      const refW = highMix > 0.02 ? highBeam.width : lowBeam.width;
      const maxReach = (refW - 28) * reachScale;
      const startOff = (v.isScooter ? 6 : v.len * 0.5) - 14 * reachScale;

      // Консервативный AABB пучка + быстрая отсечка закадровых пучков NPC
      const tx = ox0 + cosB * maxReach;
      const ty = oy0 + sinB * maxReach;
      const awx = Math.abs(perpX * (maxReach * 0.62)) + 20;
      const awy = Math.abs(perpY * (maxReach * 0.62)) + 20;
      const bMinX = (ox0 < tx ? ox0 : tx) - awx;
      const bMaxX = (ox0 > tx ? ox0 : tx) + awx;
      const bMinY = (oy0 < ty ? oy0 : ty) - awy;
      const bMaxY = (oy0 > ty ? oy0 : ty) + awy;

      const beamVisible = v.isPlayer || !(bMaxX < view.minX || bMinX > view.maxX || bMaxY < view.minY || bMinY > view.maxY);
      if (beamVisible) {
        const tanHalf = Math.tan(halfAng);
        const absCosB = cosB < 0 ? -cosB : cosB;
        const absSinB = sinB < 0 ? -sinB : sinB;

        candBldgs.length = 0;
        candCircCount = 0;
        candTrunks.length = 0;

        for (let i = 0; i < BUILDINGS.length; i++) {
          const b = BUILDINGS[i];
          if (b.x2 < bMinX || b.x > bMaxX || b.y2 < bMinY || b.y > bMaxY) continue;
          const dxC = b.cx - ox0;
          const dyC = b.cy - oy0;
          const lx = dxC * cosB + dyC * sinB;
          const projAlong = b.hw * absCosB + b.hh * absSinB;
          if (lx + projAlong <= 0 || lx - projAlong >= maxReach) continue;
          const lyAbs = Math.abs(dxC * perpX + dyC * perpY);
          const projLat = b.hw * absSinB + b.hh * absCosB;
          const maxLx = lx + projAlong < maxReach ? lx + projAlong : maxReach;
          if (lyAbs - projLat >= maxLx * tanHalf + 6) continue;
          candBldgs.push(b);
        }

        for (let i = 0; i < visVehicles.length; i++) {
          const other = visVehicles[i];
          if (other === v) continue;
          const pad = other.radius + 10;
          if (other.x + pad < bMinX || other.x - pad > bMaxX || other.y + pad < bMinY || other.y - pad > bMaxY) continue;
          if (other.isBus) {
            const oxOff = other.cosA * 14;
            const oyOff = other.sinA * 14;
            tryPushConeCircle(other.x + oxOff, other.y + oyOff, 10.488, 110, ox0, oy0, cosB, sinB, perpX, perpY, maxReach, tanHalf);
            tryPushConeCircle(other.x - oxOff, other.y - oyOff, 10.488, 110, ox0, oy0, cosB, sinB, perpX, perpY, maxReach, tanHalf);
          } else {
            tryPushConeCircle(other.x, other.y, other.occlR, other.occlRSq, ox0, oy0, cosB, sinB, perpX, perpY, maxReach, tanHalf);
          }
        }

        if (ZONES.secret.x + LH_COLLISION_R >= bMinX && ZONES.secret.x - LH_COLLISION_R <= bMaxX && ZONES.secret.y + LH_COLLISION_R >= bMinY && ZONES.secret.y - LH_COLLISION_R <= bMaxY) {
          tryPushConeCircle(ZONES.secret.x, ZONES.secret.y, LH_COLLISION_R, LH_COLLISION_RSQ, ox0, oy0, cosB, sinB, perpX, perpY, maxReach, tanHalf);
        }

        if (v.isPlayer) {
          for (let i = 0; i < TREES.length; i++) {
            const tr = TREES[i];
            const trR = tr.trunkR;
            const trPad = trR + 8;
            if (tr.x + trPad < bMinX || tr.x - trPad > bMaxX || tr.y + trPad < bMinY || tr.y - trPad > bMaxY) continue;
            const dxW = tr.x - ox0;
            const dyW = tr.y - oy0;
            const along = dxW * cosB + dyW * sinB;
            if (along + trR <= 0 || along - trR >= maxReach) continue;
            const lat = Math.abs(dxW * perpX + dyW * perpY);
            const maxLx = along + trR < maxReach ? along + trR : maxReach;
            if (lat - trR >= maxLx * tanHalf + 6) continue;
            candTrunks.push(tr);
          }
        }

        if (candBldgs.length === 0 && candCircCount === 0 && candTrunks.length === 0) {
          drawBeamUnclipped(ctx, v.x, v.y, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha);
          if (v.isPlayer && playerBounce.alpha > 0.008) {
            playerBounce.alpha *= Math.exp(-12 * lastDt);
          }
        } else if (v.isPlayer) {
          // Двухламповый рейкаст игрока с обходом GPU-стенсила для незатенённых ламп
          let totCount = 0;
          let totSumX = 0;
          let totSumY = 0;
          let totMinT = maxReach;
          const pxBase = perpX * 9;
          const pyBase = perpY * 9;

          const nL = castSmoothFan(ox0 - perpX * 4.6, oy0 - perpY * 4.6, cosB, sinB, halfAng, tanHalf, baseCount, maxReach, true, rayHitOut);
          const occL = rayHitOut.occluded;
          totCount += rayHitOut.count;
          totSumX += rayHitOut.sumX;
          totSumY += rayHitOut.sumY;
          if (rayHitOut.count > 0 && rayHitOut.minT < totMinT) totMinT = rayHitOut.minT;
          if (occL) {
            drawBeamClipped(ctx, v.x, v.y, ox0, oy0, pxBase, pyBase, nL, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha * 0.5);
          }

          const nR = castSmoothFan(ox0 + perpX * 4.6, oy0 + perpY * 4.6, cosB, sinB, halfAng, tanHalf, baseCount, maxReach, true, rayHitOut);
          const occR = rayHitOut.occluded;
          totCount += rayHitOut.count;
          totSumX += rayHitOut.sumX;
          totSumY += rayHitOut.sumY;
          if (rayHitOut.count > 0 && rayHitOut.minT < totMinT) totMinT = rayHitOut.minT;

          if (!occL && !occR) {
            drawBeamUnclipped(ctx, v.x, v.y, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha);
          } else if (!occL && occR) {
            drawBeamUnclipped(ctx, v.x, v.y, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha * 0.5);
            drawBeamClipped(ctx, v.x, v.y, ox0, oy0, pxBase, pyBase, nR, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha * 0.5);
          } else if (occL && !occR) {
            drawBeamUnclipped(ctx, v.x, v.y, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha * 0.5);
          } else {
            drawBeamClipped(ctx, v.x, v.y, ox0, oy0, pxBase, pyBase, nR, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha * 0.5);
          }

          if (totCount > 0) {
            const closeness = Math.max(0.12, 1 - totMinT / maxReach);
            const coverage = Math.min(1, totCount / 7);
            const tAlpha = (0.58 + 0.2 * highMix) * closeness * coverage * beamPower * joltAlpha;
            const tSize = (56 + 16 * highMix) * (0.72 + closeness * 0.45);
            const tBx = totSumX / totCount;
            const tBy = totSumY / totCount;
            if (playerBounce.alpha < 0.02) {
              playerBounce.x = tBx;
              playerBounce.y = tBy;
              playerBounce.alpha = tAlpha;
              playerBounce.size = tSize;
            } else {
              const bLerp = 1 - Math.exp(-11 * lastDt);
              playerBounce.x += (tBx - playerBounce.x) * bLerp;
              playerBounce.y += (tBy - playerBounce.y) * bLerp;
              playerBounce.alpha += (tAlpha - playerBounce.alpha) * bLerp;
              playerBounce.size += (tSize - playerBounce.size) * bLerp;
            }
          } else {
            playerBounce.alpha *= Math.exp(-12 * lastDt);
          }
        } else {
          // Плавный точный рейкаст по углам и касательным для встречных авто, автобуса и скутера
          const nRays = castSmoothFan(ox0, oy0, cosB, sinB, halfAng, tanHalf, baseCount, maxReach, false, rayHitOut);
          if (rayHitOut.occluded) {
            drawBeamClipped(ctx, v.x, v.y, ox0, oy0, perpX * 9, perpY * 9, nRays, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha);
          } else {
            drawBeamUnclipped(ctx, v.x, v.y, beamAng, startOff, reachScale, lowBeam, highBeam, highMix, effectiveAlpha);
          }

          if (rayHitOut.count > 0) {
            const closeness = Math.max(0.12, 1 - rayHitOut.minT / maxReach);
            const coverage = Math.min(1, rayHitOut.count / 3);
            const bAlpha = 0.34 * closeness * coverage;
            const bSize = 38 * (0.72 + closeness * 0.45);
            const bHalf = bSize * 0.5;
            ctx.globalAlpha = bAlpha;
            ctx.drawImage(
              GLOW_BEAM_BOUNCE,
              rayHitOut.sumX / rayHitOut.count - bHalf,
              rayHitOut.sumY / rayHitOut.count - bHalf,
              bSize,
              bSize
            );
            ctx.globalAlpha = 0.88;
          }
        }
      }
    } else if (v.isPlayer && playerBounce.alpha > 0.008) {
      playerBounce.alpha *= Math.exp(-12 * lastDt);
    }

    if (v.isPlayer && playerBounce.alpha > 0.008) {
      const bHalf = playerBounce.size * 0.5;
      ctx.globalAlpha = playerBounce.alpha;
      ctx.drawImage(
        v.goldLights ? GLOW_BEAM_BOUNCE_GOLD : GLOW_BEAM_BOUNCE,
        playerBounce.x - bHalf,
        playerBounce.y - bHalf,
        playerBounce.size,
        playerBounce.size
      );
      ctx.globalAlpha = 0.88;
    }

    // Задние габариты / стоп-сигналы (без лишнего save/rotate и вне экрана)
    if (!v.onScreen) return;
    if (v.isScooter) {
      const tGlow = v.braking ? GLOW_TAIL_BRAKE : GLOW_TAIL_DIM;
      const tOff = tGlow.width * 0.5;
      const tx = v.x - v.cosA * 8;
      const ty = v.y - v.sinA * 8;
      ctx.drawImage(tGlow, tx - tOff, ty - tOff);
    } else if (v.braking || mode !== "off") {
      const tGlow = v.braking ? GLOW_TAIL_BRAKE : GLOW_TAIL_DIM;
      const tOff = tGlow.width * 0.5;
      const tailDist = v.len * 0.5 + 1;
      const tailY = v.wid * 0.5 - 3.2;
      const bx = v.x - v.cosA * tailDist;
      const by = v.y - v.sinA * tailDist;
      ctx.drawImage(tGlow, bx + v.sinA * tailY - tOff, by - v.cosA * tailY - tOff);
      ctx.drawImage(tGlow, bx - v.sinA * tailY - tOff, by + v.cosA * tailY - tOff);
    }
  }

  function drawVehicleBody(ctx, v) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    if (v.isScooter) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-7, -3, 15, 7);
      ctx.fillStyle = v.color;
      ctx.fillRect(-7, -3, 14, 6);
      ctx.fillStyle = "#b58d52";
      ctx.fillRect(-7.5, -3.5, 6, 7);
      ctx.fillStyle = "#1b212a";
      ctx.beginPath();
      ctx.arc(1.5, 0, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f7ebd2";
      ctx.fillRect(6, -1.5, 2, 3);
      ctx.fillStyle = v.braking ? "#ef5350" : "#9c3333";
      ctx.fillRect(-8, -1.5, 1.8, 3);
      if (v.blinkOn) {
        ctx.fillStyle = "#f5a638";
        ctx.fillRect(4, v.blinkDir < 0 ? -4.5 : 2.5, 2.2, 2);
      }
    } else {
      const len = v.len, wid = v.wid, mode = v.lightMode;
      // Тень под машиной
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, len, wid);

      // Кузов
      ctx.fillStyle = v.color;
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
      ctx.strokeStyle = v.isPlayer ? "#e8e3da" : "rgba(232, 227, 218, 0.22)";
      ctx.lineWidth = v.isPlayer ? 1.2 : 0.8;
      ctx.strokeRect(-len / 2, -wid / 2, len, wid);

      if (v.isBus) {
        ctx.fillStyle = "rgba(242, 216, 166, 0.3)";
        ctx.fillRect(-len * 0.38, -wid * 0.44, len * 0.76, wid * 0.88);
        ctx.fillStyle = "#1b1718";
        ctx.fillRect(len * 0.34, -wid * 0.38, len * 0.11, wid * 0.76);
        ctx.fillStyle = "#342d2b";
        ctx.fillRect(-len * 0.2, -wid * 0.22, len * 0.16, wid * 0.44);
        ctx.fillRect(len * 0.06, -wid * 0.22, len * 0.14, wid * 0.44);
      } else {
        ctx.fillStyle = "#1b1718";
        ctx.fillRect(-len * 0.16, -wid * 0.36, len * 0.36, wid * 0.72);
      }

      if (v.taxi) {
        ctx.fillStyle = "#f4dfb0";
        ctx.fillRect(-2, -3, 4, 6);
      }

      ctx.fillStyle = mode === "off" ? "#5a554c" : v.goldLights ? "#fae09c" : "#f7ebd2";
      ctx.fillRect(len / 2 - 2.5, -wid / 2 + 1.5, 2.5, 3.2);
      ctx.fillRect(len / 2 - 2.5, wid / 2 - 4.7, 2.5, 3.2);

      ctx.fillStyle = v.braking ? "#ef5350" : mode === "off" ? "#542424" : "#9c3333";
      ctx.fillRect(-len / 2, -wid / 2 + 1.5, 2.2, 3.5);
      ctx.fillRect(-len / 2, wid / 2 - 5, 2.2, 3.5);

      if (v.hazards) {
        ctx.fillStyle = "#f5a638";
        ctx.fillRect(len / 2 - 2, -wid / 2 - 1, 3, 2.5);
        ctx.fillRect(len / 2 - 2, wid / 2 - 1.5, 3, 2.5);
        ctx.fillRect(-len / 2 - 1, -wid / 2 - 1, 3, 2.5);
        ctx.fillRect(-len / 2 - 1, wid / 2 - 1.5, 3, 2.5);
      } else if (v.blinkOn) {
        ctx.fillStyle = "#f5a638";
        const sideY = v.blinkDir < 0 ? -wid / 2 - 1 : wid / 2 - 1.5;
        ctx.fillRect(len / 2 - 2, sideY, 3, 2.5);
        ctx.fillRect(-len / 2 - 1, sideY, 3, 2.5);
      }
    }
    ctx.restore();
  }

  function drawVehicleHalos(ctx, v) {
    if (!v.isScooter && v.lightMode === "off" && !v.hazards && !v.blinkOn) return;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    if (v.isScooter) {
      ctx.drawImage(GLOW_LENS_LOW, 7 - 8, -8, 16, 16);
      if (v.blinkOn) {
        ctx.drawImage(GLOW_BLINK, 5 - 8, (v.blinkDir < 0 ? -3.5 : 3.5) - 8);
      }
    } else {
      const len = v.len, wid = v.wid;
      if (v.lightMode !== "off") {
        const lensGlow = v.goldLights ? GLOW_LENS_GOLD : v.highBeam ? GLOW_LENS_HIGH : GLOW_LENS_LOW;
        const lOff = lensGlow.width / 2;
        const lx = len / 2 - 1;
        const ly = wid / 2 - 3.1;
        ctx.drawImage(lensGlow, lx - lOff, -ly - lOff);
        ctx.drawImage(lensGlow, lx - lOff, ly - lOff);
      }
      if (v.hazards) {
        const bOff = 8;
        ctx.drawImage(GLOW_BLINK, len / 2 - 0.5 - bOff, -wid / 2 + 0.25 - bOff);
        ctx.drawImage(GLOW_BLINK, len / 2 - 0.5 - bOff, wid / 2 - 0.25 - bOff);
        ctx.drawImage(GLOW_BLINK, -len / 2 + 0.5 - bOff, -wid / 2 + 0.25 - bOff);
        ctx.drawImage(GLOW_BLINK, -len / 2 + 0.5 - bOff, wid / 2 - 0.25 - bOff);
      } else if (v.blinkOn) {
        const bOff = 8;
        const by = v.blinkDir < 0 ? -wid / 2 + 0.25 : wid / 2 - 0.25;
        ctx.drawImage(GLOW_BLINK, len / 2 - 0.5 - bOff, by - bOff);
        ctx.drawImage(GLOW_BLINK, -len / 2 + 0.5 - bOff, by - bOff);
      }
    }
    ctx.restore();
  }

  function stampSpillWall(sctx, wList, cols, rows, isStore, wx0, wy0, dx, dy, wallLen, rot) {
    const cellW = wallLen / cols;
    const fanW = Math.max(isStore ? 36 : 30, cellW * (isStore ? 2.15 : 1.85));
    const fanH = isStore ? 50 : 36;
    const fanW2 = Math.max(40, cellW * 2.4);
    const fanH2 = 44;
    let anyLit = false;

    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const w0 = wList[c];
      const a0 = w0.alpha > 0.03 ? w0.alpha * (1 - w0.curtain * 0.45) * (isStore ? 0.44 : 0.28) : 0;
      const w1 = rows > 1 ? wList[cols + c] : null;
      const a1 = w1 && w1.alpha > 0.05 ? w1.alpha * (1 - w1.curtain * 0.4) * 0.10 : 0;
      if (a0 <= 0 && a1 <= 0) continue;

      anyLit = true;
      sctx.save();
      sctx.translate(wx0 + dx * u, wy0 + dy * u);
      sctx.rotate(rot);
      if (a0 > 0) {
        sctx.globalAlpha = a0;
        sctx.drawImage(WIN_FAN_SPRITES[w0.colorIdx], -fanW * 0.5, 0, fanW, fanH);
      }
      if (a1 > 0) {
        sctx.globalAlpha = a1;
        sctx.drawImage(WIN_FAN_SPRITES[w1.colorIdx], -fanW2 * 0.5, 0, fanW2, fanH2);
      }
      sctx.restore();
    }
    return anyLit;
  }

  function bakeBuildingSpill(b) {
    if (!b.spillCanvas) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(b.spillW * SPILL_SCALE);
      c.height = Math.ceil(b.spillH * SPILL_SCALE);
      b.spillCanvas = c;
      b.spillCtx = c.getContext("2d", { alpha: true });
    }
    const sctx = b.spillCtx;
    const winData = b.windows;
    const cols = winData.cols;
    const rows = winData.rows;
    const wList = winData.list;

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, b.spillCanvas.width, b.spillCanvas.height);
    sctx.setTransform(SPILL_SCALE, 0, 0, SPILL_SCALE, 0, 0);
    sctx.globalCompositeOperation = "lighter";

    let anyLit = false;
    // Север (-Y), Юг (+Y), Запад (-X), Восток (+X) — порядок окон синхронизирован с drawWallWindows
    if (stampSpillWall(sctx, wList, cols, rows, b.storefront, SPILL_PAD, SPILL_PAD, b.w, 0, b.w, Math.PI)) anyLit = true;
    if (stampSpillWall(sctx, wList, cols, rows, b.storefront, SPILL_PAD, SPILL_PAD + b.h, b.w, 0, b.w, 0)) anyLit = true;
    if (stampSpillWall(sctx, wList, cols, rows, b.storefront, SPILL_PAD, SPILL_PAD, 0, b.h, b.h, Math.PI * 0.5)) anyLit = true;
    if (stampSpillWall(sctx, wList, cols, rows, b.storefront, SPILL_PAD + b.w, SPILL_PAD, 0, b.h, b.h, -Math.PI * 0.5)) anyLit = true;

    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(SPILL_PAD + 1, SPILL_PAD + 1, b.w - 2, b.h - 2);
    b.hasSpill = anyLit;
    b.spillDirty = false;
  }

  function drawWindowSpills(ctx, view) {
    let usedLighter = false;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i];
      if (b.x2 + SPILL_PAD < view.minX || b.x - SPILL_PAD > view.maxX || b.y2 + SPILL_PAD < view.minY || b.y - SPILL_PAD > view.maxY) continue;
      if (b.spillDirty && b.spillCooldown <= 0) {
        bakeBuildingSpill(b);
        b.spillCooldown = 0.08;
      }
      if (!b.hasSpill) continue;
      if (!usedLighter) {
        ctx.globalCompositeOperation = "lighter";
        usedLighter = true;
      }
      ctx.drawImage(b.spillCanvas, b.x - SPILL_PAD, b.y - SPILL_PAD, b.spillCanvas.width * 2, b.spillCanvas.height * 2);
    }
    if (usedLighter) ctx.globalCompositeOperation = "source-over";
  }

  const winCoords = new Float32Array(64 * 8);
  const winDepthCoords = new Float32Array(64 * 8);
  const winCurtCoords = new Float32Array(64 * 8);
  const winCx = new Float32Array(64);
  const winCy = new Float32Array(64);
  const winAlphas = new Float32Array(64);
  const winCurtains = new Float32Array(64);
  const winHaloR = new Float32Array(64);
  const winColorIdx = new Uint8Array(64);
  const winBuckets = new Uint8Array(64);
  const WIN_BUCKET_ALPHA = [0.35, 0.68, 1];

  function traceWindowQuad(ctx, arr, o) {
    ctx.moveTo(arr[o], arr[o + 1]);
    ctx.lineTo(arr[o + 2], arr[o + 3]);
    ctx.lineTo(arr[o + 4], arr[o + 5]);
    ctx.lineTo(arr[o + 6], arr[o + 7]);
    ctx.closePath();
  }

  function drawWallWindows(ctx, ax, ay, bx, by, cx, cy, dx, dy, b, now, wallDepth) {
    const winData = b.windows;
    const cols = winData.cols;
    const rows = Math.min(4, winData.rows);
    const abx = bx - ax, aby = by - ay;
    const dcx = cx - dx, dcy = cy - dy;
    const haloScale = wallDepth < 22 ? wallDepth / 22 : 1;
    let n = 0;
    let unlitCount = 0;
    let litCount = 0;
    let curtCount = 0;
    let mask0 = 0;
    let mask1 = 0;
    let mask2 = 0;

    for (let r = 0; r < rows; r++) {
      const isShop = b.storefront && r === 0;
      const v0 = (r + (isShop ? 0.14 : 0.22)) / (rows + 0.18);
      const v1 = (r + (isShop ? 0.88 : 0.78)) / (rows + 0.18);
      const vd = v1 - (v1 - v0) * 0.28;
      for (let c = 0; c < cols; c++) {
        if (n >= 64) break;
        const w = winData.list[(r * cols + c) % winData.list.length];
        const padU = isShop ? 0.1 : 0.2;
        const u0 = (c + padU) / cols;
        const u1 = (c + 1 - padU) / cols;

        const g0x = ax + abx * u0, g0y = ay + aby * u0;
        const r0x = dx + dcx * u0, r0y = dy + dcy * u0;
        const g1x = ax + abx * u1, g1y = ay + aby * u1;
        const r1x = dx + dcx * u1, r1y = dy + dcy * u1;

        const p00x = g0x + (r0x - g0x) * v0, p00y = g0y + (r0y - g0y) * v0;
        const p10x = g1x + (r1x - g1x) * v0, p10y = g1y + (r1y - g1y) * v0;
        const p11x = g1x + (r1x - g1x) * v1, p11y = g1y + (r1y - g1y) * v1;
        const p01x = g0x + (r0x - g0x) * v1, p01y = g0y + (r0y - g0y) * v1;

        const o = n * 8;
        winCoords[o]     = p00x; winCoords[o + 1] = p00y;
        winCoords[o + 2] = p10x; winCoords[o + 3] = p10y;
        winCoords[o + 4] = p11x; winCoords[o + 5] = p11y;
        winCoords[o + 6] = p01x; winCoords[o + 7] = p01y;

        if (w.alpha > 0.04) {
          const tvMod = w.tv ? 0.78 + 0.22 * Math.sin(now * 0.008 + c * 2.7 + r) : 1;
          const a = Math.min(1, w.alpha * tvMod);
          winAlphas[n] = a;
          winColorIdx[n] = w.colorIdx;
          const bi = a >= 0.85 ? 2 : a >= 0.55 ? 1 : 0;
          winBuckets[n] = bi;
          const cBit = 1 << w.colorIdx;
          if (bi === 2) mask2 |= cBit;
          else if (bi === 1) mask1 |= cBit;
          else mask0 |= cBit;

          // Верхнее затенение ниши (интерьерная глубина)
          const d0x = g0x + (r0x - g0x) * vd, d0y = g0y + (r0y - g0y) * vd;
          const d1x = g1x + (r1x - g1x) * vd, d1y = g1y + (r1y - g1y) * vd;
          winDepthCoords[o]     = d0x;  winDepthCoords[o + 1] = d0y;
          winDepthCoords[o + 2] = d1x;  winDepthCoords[o + 3] = d1y;
          winDepthCoords[o + 4] = p11x; winDepthCoords[o + 5] = p11y;
          winDepthCoords[o + 6] = p01x; winDepthCoords[o + 7] = p01y;

          winCx[n] = (p00x + p10x + p11x + p01x) * 0.25;
          winCy[n] = (p00y + p10y + p11y + p01y) * 0.25;
          const winSpan = Math.abs(p10x - p00x) + Math.abs(p10y - p00y) + Math.abs(p01x - p00x) + Math.abs(p01y - p00y);
          const clSpan = winSpan < 11 ? 11 : winSpan > 28 ? 28 : winSpan;
          winHaloR[n] = clSpan * 0.72 * haloScale;
          litCount++;

          winCurtains[n] = w.curtain;
          if (w.curtain > 0) {
            const vc = v1 - (v1 - v0) * w.curtain;
            const c0x = g0x + (r0x - g0x) * vc, c0y = g0y + (r0y - g0y) * vc;
            const c1x = g1x + (r1x - g1x) * vc, c1y = g1y + (r1y - g1y) * vc;
            winCurtCoords[o]     = c0x;  winCurtCoords[o + 1] = c0y;
            winCurtCoords[o + 2] = c1x;  winCurtCoords[o + 3] = c1y;
            winCurtCoords[o + 4] = p11x; winCurtCoords[o + 5] = p11y;
            winCurtCoords[o + 6] = p01x; winCurtCoords[o + 7] = p01y;
            curtCount++;
          }
        } else {
          winAlphas[n] = 0;
          winBuckets[n] = 255;
          winCurtains[n] = 0;
          unlitCount++;
        }
        n++;
      }
    }
    if (!n) return;

    // Проход 1: тёмная основа всех стёкол единым путём
    ctx.fillStyle = "#141112";
    ctx.beginPath();
    for (let i = 0; i < n; i++) traceWindowQuad(ctx, winCoords, i * 8);
    ctx.fill();

    // Проход 2: тёплый отблеск на выключенных стёклах единым путём
    if (unlitCount > 0) {
      ctx.fillStyle = "rgba(210, 192, 172, 0.08)";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (winAlphas[i] > 0) continue;
        traceWindowQuad(ctx, winCoords, i * 8);
      }
      ctx.fill();
    }

    // Проход 3: батч-заливка светящихся стёкол по 3 уровням яркости и 5 палитровым оттенкам
    if (litCount > 0) {
      for (let bi = 2; bi >= 0; bi--) {
        const mask = bi === 2 ? mask2 : bi === 1 ? mask1 : mask0;
        if (!mask) continue;
        if (bi < 2) ctx.globalAlpha = WIN_BUCKET_ALPHA[bi];
        for (let ci = 0; ci < WIN_COLORS.length; ci++) {
          if (!(mask & (1 << ci))) continue;
          ctx.fillStyle = WIN_COLORS[ci];
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            if (winBuckets[i] !== bi || winColorIdx[i] !== ci) continue;
            traceWindowQuad(ctx, winCoords, i * 8);
          }
          ctx.fill();
        }
        if (bi < 2) ctx.globalAlpha = 1;
      }

      // Лёгкая тень перемычки в верхней части проёма для объёма комнат
      ctx.fillStyle = "rgba(22, 14, 12, 0.24)";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (winAlphas[i] <= 0.04) continue;
        traceWindowQuad(ctx, winDepthCoords, i * 8);
      }
      ctx.fill();
    }

    if (curtCount > 0) {
      ctx.fillStyle = "rgba(24, 20, 21, 0.72)";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (winCurtains[i] <= 0) continue;
        traceWindowQuad(ctx, winCurtCoords, i * 8);
      }
      ctx.fill();
    }

    // Проход 4: рамы и поперечные импосты всех окон единым путём
    const addCrossBar = !b.storefront && wallDepth >= 10;
    ctx.strokeStyle = "rgba(14, 18, 25, 0.78)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      ctx.moveTo((winCoords[o] + winCoords[o + 2]) * 0.5, (winCoords[o + 1] + winCoords[o + 3]) * 0.5);
      ctx.lineTo((winCoords[o + 6] + winCoords[o + 4]) * 0.5, (winCoords[o + 7] + winCoords[o + 5]) * 0.5);
      if (addCrossBar) {
        ctx.moveTo((winCoords[o] + winCoords[o + 6]) * 0.5, (winCoords[o + 1] + winCoords[o + 7]) * 0.5);
        ctx.lineTo((winCoords[o + 2] + winCoords[o + 4]) * 0.5, (winCoords[o + 3] + winCoords[o + 5]) * 0.5);
      }
    }
    ctx.stroke();

    // Проход 5: мягкая плёночная ореольность от горящих стёкол
    if (haloScale > 0.18 && litCount > 0) {
      let drewHalo = false;
      for (let i = 0; i < n; i++) {
        const a = winAlphas[i];
        if (a <= 0.14) continue;
        const r = winHaloR[i];
        ctx.globalAlpha = a * (1 - winCurtains[i] * 0.45);
        drewHalo = true;
        ctx.drawImage(winColorIdx[i] === 4 ? GLOW_WIN_HALO_COOL : GLOW_WIN_HALO, winCx[i] - r, winCy[i] - r, r * 2, r * 2);
      }
      if (drewHalo) ctx.globalAlpha = 1;
    }
  }

  function draw25DWall(ctx, ax, ay, bx, by, cx, cy, dx, dy, fill, b, now, view) {
    if (Math.min(ax, bx, cx, dx) > view.maxX || Math.max(ax, bx, cx, dx) < view.minX) return;
    if (Math.min(ay, by, cy, dy) > view.maxY || Math.max(ay, by, cy, dy) < view.minY) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 227, 218, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const wallDepth = Math.abs(dx - ax) + Math.abs(dy - ay);
    if (wallDepth >= 6.0) {
      drawWallWindows(ctx, ax, ay, bx, by, cx, cy, dx, dy, b, now, wallDepth);
    }
  }

  const visBuildings = [];
  function draw25DBuildings(ctx, camX, camY, now, view) {
    visBuildings.length = 0;
    const minX = view.minX - 240, maxX = view.maxX + 240;
    const minY = view.minY - 240, maxY = view.maxY + 240;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i];
      if (b.x2 < minX || b.x > maxX || b.y2 < minY || b.y > maxY) continue;
      const dx = b.cx - camX;
      const dy = b.cy - camY;
      b._distSq = dx * dx + dy * dy;
      visBuildings.push(b);
    }
    visBuildings.sort((a, b) => b._distSq - a._distSq);

    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";

    for (let i = 0; i < visBuildings.length; i++) {
      const b = visBuildings[i];
      const k = b.height * 0.00125;
      const x1 = b.x, y1 = b.y, x2 = b.x2, y2 = b.y2;
      const rx1 = x1 + (x1 - camX) * k;
      const ry1 = y1 + (y1 - camY) * k;
      const rx2 = x2 + (x2 - camX) * k;
      const ry2 = y2 + (y2 - camY) * k;

      if (rx1 > x1) draw25DWall(ctx, x1, y1, x1, y2, rx1, ry2, rx1, ry1, "#1b1819", b, now, view);
      if (rx2 < x2) draw25DWall(ctx, x2, y1, x2, y2, rx2, ry2, rx2, ry1, "#1b1819", b, now, view);
      if (ry1 > y1) draw25DWall(ctx, x1, y1, x2, y1, rx2, ry1, rx1, ry1, "#221e1f", b, now, view);
      if (ry2 < y2) draw25DWall(ctx, x1, y2, x2, y2, rx2, ry2, rx1, ry2, "#221e1f", b, now, view);

      if (rx2 < view.minX || rx1 > view.maxX || ry2 < view.minY || ry1 > view.maxY) continue;

      // Крыша здания
      ctx.fillStyle = b.roof;
      ctx.fillRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
      ctx.strokeStyle = b.trim;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(rx1, ry1, rx2 - rx1, ry2 - ry1);

      const rcx = (rx1 + rx2) / 2;
      const rcy = (ry1 + ry2) / 2;
      const rw = rx2 - rx1;
      const rh = ry2 - ry1;

      if (b.style === "helipad") {
        ctx.strokeStyle = "rgba(232, 227, 218, 0.35)";
        ctx.beginPath();
        ctx.arc(rcx, rcy, Math.min(rw, rh) * 0.28, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.style === "fan") {
        ctx.save();
        ctx.translate(rcx, rcy);
        ctx.rotate(now * 0.003);
        ctx.strokeStyle = "rgba(180, 192, 204, 0.45)";
        ctx.beginPath();
        ctx.moveTo(-11, 0); ctx.lineTo(11, 0);
        ctx.moveTo(0, -11); ctx.lineTo(0, 11);
        ctx.stroke();
        ctx.restore();
      } else if (b.style === "vents") {
        ctx.fillStyle = "#141820";
        ctx.fillRect(rx1 + 12, ry1 + 12, 16, 12);
        ctx.strokeStyle = "rgba(232, 227, 218, 0.16)";
        ctx.strokeRect(rx1 + 12, ry1 + 12, 16, 12);
      }

      if (b.sign) {
        ctx.fillStyle = b.trim;
        ctx.fillText(b.sign, rcx, rcy + 4);
      }
    }
  }

  const visTrees = [];
  const visTreeLx = new Float32Array(TREES.length);
  const visTreeLy = new Float32Array(TREES.length);
  const visTreeUx = new Float32Array(TREES.length);
  const visTreeUy = new Float32Array(TREES.length);
  const visTreeTx = new Float32Array(TREES.length);
  const visTreeTy = new Float32Array(TREES.length);
  const visTreeG1 = new Float32Array(TREES.length);
  const visTreeG2 = new Float32Array(TREES.length);

  function drawTreeGrounds(ctx, now, view) {
    for (let i = 0; i < TREES.length; i++) {
      const tr = TREES[i];
      const pad = tr.r * 1.6 + 24;
      if (tr.x + pad < view.minX || tr.x - pad > view.maxX || tr.y + pad < view.minY || tr.y - pad > view.maxY) continue;

      ctx.drawImage(TREE_SPRITES[tr.variant].ground, tr.x - tr.gHalf, tr.y - tr.gHalf, tr.gSize, tr.gSize);
    }
  }

  function drawTrees(ctx, camX, camY, now, view) {
    visTrees.length = 0;
    for (let i = 0; i < TREES.length; i++) {
      const tr = TREES[i];
      const pad = tr.r * 1.6 + 68;
      if (tr.x + pad < view.minX || tr.x - pad > view.maxX || tr.y + pad < view.minY || tr.y - pad > view.maxY) continue;
      const dx = tr.x - camX;
      const dy = tr.y - camY;
      tr._distSq = dx * dx + dy * dy;
      visTrees.push(tr);
    }
    const n = visTrees.length;
    if (!n) return;

    visTrees.sort((a, b) => b._distSq - a._distSq);

    const w10 = wind * 10;
    const w15 = wind * 15;
    const tSlow = now * 0.0017;
    const tFast = now * 0.0041;
    const tLat = now * 0.0019;
    for (let i = 0; i < n; i++) {
      const tr = visTrees[i];
      const p1 = tSlow + tr.phase;
      const p2 = tFast + tr.phase * 1.7;
      const p3 = tLat + tr.phase * 1.3;
      const g1 = Math.sin(p1) * 1.55 + Math.sin(p2) * 0.55;
      const g2 = Math.sin(p1 - 0.55) * 2.35 + Math.sin(p2 - 0.7) * 0.85;
      const sy1 = Math.cos(p3) * 0.65;
      const sy2 = Math.cos(p3 - 0.5) * 1.0;

      const lx = tr.x + (tr.x - camX) * tr.k1 + w10 + g1;
      const ly = tr.y + (tr.y - camY) * tr.k1 + sy1;
      const ux = tr.x + (tr.x - camX) * tr.k2 + w15 + g2;
      const uy = tr.y + (tr.y - camY) * tr.k2 + sy2;

      visTreeLx[i] = lx;
      visTreeLy[i] = ly;
      visTreeUx[i] = ux;
      visTreeUy[i] = uy;
      visTreeTx[i] = lx + (ux - lx) * 0.22;
      visTreeTy[i] = ly + (uy - ly) * 0.22;
      visTreeG1[i] = g1;
      visTreeG2[i] = g2;
    }

    // Батчинг всех стволов (одна заливка) и бликов мокрой коры (одна обводка)
    ctx.fillStyle = "#241b16";
    ctx.beginPath();
    let hasHighlight = false;
    for (let i = 0; i < n; i++) {
      const tr = visTrees[i];
      const tx = visTreeTx[i], ty = visTreeTy[i];
      const tdx = tx - tr.x, tdy = ty - tr.y;
      const tLenSq = tdx * tdx + tdy * tdy;
      const w0 = tr.w0;
      const w1 = tr.w1;

      if (tLenSq > 0.25) {
        hasHighlight = true;
        const invLen = 1 / Math.sqrt(tLenSq);
        const nx = -tdy * invLen;
        const ny = tdx * invLen;
        ctx.moveTo(tr.x + nx * w0, tr.y + ny * w0);
        ctx.lineTo(tx + nx * w1, ty + ny * w1);
        ctx.lineTo(tx - nx * w1, ty - ny * w1);
        ctx.lineTo(tr.x - nx * w0, tr.y - ny * w0);
        ctx.closePath();
      }
      ctx.moveTo(tr.x + w0, tr.y);
      ctx.arc(tr.x, tr.y, w0, 0, Math.PI * 2);
    }
    ctx.fill();

    if (hasHighlight) {
      ctx.strokeStyle = "#3c2f27";
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const tr = visTrees[i];
        const tx = visTreeTx[i], ty = visTreeTy[i];
        const tdx = tx - tr.x, tdy = ty - tr.y;
        if (tdx * tdx + tdy * tdy <= 0.25) continue;
        const w0 = tr.w0;
        const w1 = tr.w1;
        ctx.moveTo(tr.x - w0 * 0.52, tr.y - w0 * 0.52);
        ctx.lineTo(tx - w1 * 0.5, ty - w1 * 0.5);
      }
      ctx.stroke();
    }

    // Нижний и верхний ярусы предзапечённой листвы при full alpha, затем тёплый отсвет фонарей
    let anyWarm = false;
    for (let i = 0; i < n; i++) {
      const tr = visTrees[i];
      const sprite = TREE_SPRITES[tr.variant];

      ctx.save();
      ctx.translate(visTreeLx[i], visTreeLy[i]);
      ctx.rotate(tr.rot + visTreeG1[i] * 0.015);
      ctx.drawImage(sprite.lower, -tr.lHalf, -tr.lHalf, tr.lSize, tr.lSize);
      ctx.restore();

      ctx.save();
      ctx.translate(visTreeUx[i], visTreeUy[i]);
      ctx.rotate(tr.rot * 0.65 + visTreeG2[i] * 0.022);
      ctx.drawImage(sprite.upper, -tr.uHalf, -tr.uHalf, tr.uSize, tr.uSize);
      ctx.restore();

      if (tr.warmA > 0) anyWarm = true;
    }

    if (anyWarm) {
      for (let i = 0; i < n; i++) {
        const tr = visTrees[i];
        if (tr.warmA <= 0) continue;
        ctx.globalAlpha = tr.warmA;
        ctx.drawImage(
          GLOW_TREE_WARM,
          visTreeUx[i] + tr.warmOffX - tr.wHalf,
          visTreeUy[i] + tr.warmOffY - tr.wHalf,
          tr.wSize,
          tr.wSize
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawCommuterTrain(ctx) {
    const rx = -675;
    ctx.save();
    ctx.fillStyle = "#221e20";
    ctx.fillRect(rx - 10, -2200, 20, 4400);
    ctx.strokeStyle = "#5c534f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx - 10, -2200); ctx.lineTo(rx - 10, 2200);
    ctx.moveTo(rx + 10, -2200); ctx.lineTo(rx + 10, 2200);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const cy = commuterY - i * 56;
      ctx.fillStyle = "#2b2426";
      ctx.fillRect(rx - 12, cy, 24, 48);
      ctx.strokeStyle = "#91837b";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(rx - 12, cy, 24, 48);
      // Тёплый кремовый свет в окнах поезда
      ctx.fillStyle = "#f4e1bc";
      ctx.fillRect(rx - 7, cy + 8, 14, 32);
    }
    ctx.restore();
  }

  function drawBirds(ctx, view) {
    let anyPerched = false;
    let anyFlying = false;
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      if (b.x < view.minX || b.x > view.maxX || b.y < view.minY || b.y > view.maxY) continue;
      if (b.flying) anyFlying = true;
      else anyPerched = true;
    }
    if (!anyPerched && !anyFlying) return;

    if (anyPerched) {
      ctx.fillStyle = "#9e9285";
      ctx.beginPath();
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        if (b.flying || b.x < view.minX || b.x > view.maxX || b.y < view.minY || b.y > view.maxY) continue;
        ctx.moveTo(b.x + 1.8, b.y);
        ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    if (anyFlying) {
      ctx.strokeStyle = "#d9cfc2";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        if (!b.flying || b.x < view.minX || b.x > view.maxX || b.y < view.minY || b.y > view.maxY) continue;
        const wing = Math.sin(b.flapPhase) * 4;
        ctx.moveTo(b.x - 4, b.y - wing);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + 4, b.y - wing);
      }
      ctx.stroke();
    }
  }

  function drawGlassDrops(ctx, width, height) {
    ctx.fillStyle = "rgba(218, 206, 190, 0.14)";
    ctx.beginPath();
    for (let i = 0; i < glassDrops.length; i++) {
      const d = glassDrops[i];
      const gx = d.u * width + Math.sin(d.wigglePhase) * 1.4;
      const gy = d.v * height;
      ctx.moveTo(gx + d.r, gy);
      ctx.arc(gx, gy, d.r, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = "rgba(244, 232, 214, 0.25)";
    ctx.beginPath();
    for (let i = 0; i < glassDrops.length; i++) {
      const d = glassDrops[i];
      const gx = d.u * width + Math.sin(d.wigglePhase) * 1.4;
      const gy = d.v * height;
      const hr = d.r * 0.32;
      const hx = gx - d.r * 0.28;
      const hy = gy - d.r * 0.28;
      ctx.moveTo(hx + hr, hy);
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  return {
    ZONES,
    player,
    update,
    render,
    setCallbacks,
    setOverdrive,
    setSecretUnlocked,
    cycleHeadlights,
    getHeadlightMode,
    setPlayerCar,
    getAtmosphere,
    triggerHorn,
    setAutopilot
  };
})();
