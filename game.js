/* Fishing with Friends — overhauled mobile-first canvas game.
   - DPR-aware responsive canvas (portrait + landscape)
   - Pre-rendered painterly background (mountains, pines, sun, clouds, rocks)
   - Animated water with ripples + twinkling sun sparkles
   - Detailed cartoon characters (blond + brunette) and a two-seater kayak
   - Touch-first input with a dedicated CAST/HOOK button + tap-anywhere
*/

(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = canvas.parentElement;
  const els = {
    caught: document.getElementById('caught'),
    score: document.getElementById('score'),
    time: document.getElementById('time'),
    sceneLabel: document.getElementById('scene-label'),
    bite: document.getElementById('bite-indicator'),
    startOverlay: document.getElementById('start-overlay'),
    endOverlay: document.getElementById('end-overlay'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    finalCaught: document.getElementById('final-caught'),
    finalScore: document.getElementById('final-score'),
    finalRank: document.getElementById('final-rank'),
    castBtn: document.getElementById('cast-btn'),
    castLabel: document.querySelector('#cast-btn .cast-label'),
    castSub: document.querySelector('#cast-btn .cast-sub'),
  };

  // ---------- Virtual world ----------
  // Scenes are drawn into a virtual coordinate system with fixed height = 720.
  // Width adapts to aspect ratio so portrait phones get a slimmer scene.
  const VH = 720;
  const state = {
    scale: 1,
    W: 1200,        // virtual width
    H: VH,
    dpr: 1,
    scene: 'stream',
    running: false,
    timeLeft: 60,
    caught: 0,
    score: 0,
    t: 0,
    line: {
      tipX: 0, tipY: 0,
      bobX: 0, bobY: 0,
      cast: false,
      hooked: null,
      lastBite: 0,
      cooldown: 0,
      reeling: 0,
    },
    fish: [],
    splashes: [],
    floats: [],
    sparkles: [],
    bubbles: [],
    lastSpawn: 0,
    bg: { canvas: null, ctx: null, w: 0, h: 0, scene: null },
  };

  const FISH_TYPES = [
    { id:'minnow', size: 18, color:'#9fcfe6', back:'#5a8fae',  belly:'#e6f3fb', points: 5,  weight: 0.42 },
    { id:'trout',  size: 34, color:'#9bbf73', back:'#3c5e3a',  belly:'#fff6cc', points: 15, weight: 0.30 },
    { id:'sunny',  size: 30, color:'#f3a23a', back:'#a4521a',  belly:'#fff0c4', points: 25, weight: 0.13 },
    { id:'bass',   size: 52, color:'#5d8a48', back:'#2c4730',  belly:'#e0d2a0', points: 40, weight: 0.12 },
    { id:'goldie', size: 32, color:'#f5cf45', back:'#a17317',  belly:'#fff7d2', points: 80, weight: 0.03 },
  ];

  // ---------- Resize / canvas setup ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(320, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    state.dpr = dpr;
    state.scale = (h * dpr) / VH;
    state.W = (w * dpr) / state.scale; // virtual width
    state.H = VH;
    ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    invalidateBg();
    seedSparkles();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  function invalidateBg() {
    state.bg.scene = null;
  }

  function ensureBg() {
    if (
      state.bg.scene === state.scene &&
      state.bg.w === state.W &&
      state.bg.h === state.H
    ) return;
    if (!state.bg.canvas) {
      state.bg.canvas = document.createElement('canvas');
      state.bg.ctx = state.bg.canvas.getContext('2d');
    }
    state.bg.canvas.width = Math.ceil(state.W);
    state.bg.canvas.height = Math.ceil(state.H);
    const bx = state.bg.ctx;
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.clearRect(0, 0, state.W, state.H);
    if (state.scene === 'stream') paintStreamBg(bx, state.W, state.H);
    else paintKayakBg(bx, state.W, state.H);
    state.bg.w = state.W;
    state.bg.h = state.H;
    state.bg.scene = state.scene;
  }

  // ---------- Background painting (cached) ----------

  // Scene composition constants — share between bg painter and characters.
  // kidY is the BODY CENTER (chest height); the body extends from y=-50 (head top)
  // to y=+190 (feet). With scale 1.15 and waterY 0.6, the waterline cuts the kid
  // mid-calf so they read as wading in shallow water.
  const COMP = {
    stream: { waterY: 0.6, kidY: 0.4, kidScale: 1.15 },
    kayak:  { waterY: 0.58, kayakY: 0.66, kayakScale: 1.0 },
  };

  function paintStreamBg(c, W, H) {
    paintSky(c, W, H);
    paintSunWithRays(c, W, H, 0.78);
    paintClouds(c, W, H, 7);
    paintAtmosphericHaze(c, W, H, H * 0.36);
    paintFarMountains(c, W, H);
    paintAtmosphericHaze(c, W, H, H * 0.46, 0.18);
    paintMidHills(c, W, H);
    paintPineForest(c, W, H, H * 0.54);
    paintRiverbank(c, W, H, COMP.stream.waterY);
    paintBaseWater(c, W, H, H * COMP.stream.waterY, ['#5fb7e6', '#2e7ab1', '#15436c']);
    paintRocksFG(c, W, H, COMP.stream.waterY);
  }

  function paintKayakBg(c, W, H) {
    paintSky(c, W, H, '#cce6f5', '#8fbfdf');
    paintSunWithRays(c, W, H, 0.72);
    paintClouds(c, W, H, 6);
    paintAtmosphericHaze(c, W, H, H * 0.36);
    paintFarMountains(c, W, H, '#7d9cb8', '#5d7a96');
    paintAtmosphericHaze(c, W, H, H * 0.46, 0.18);
    paintMidHills(c, W, H, '#3d6a4a', '#2e5538');
    paintPineForest(c, W, H, H * 0.56, true);
    paintBaseWater(c, W, H, H * COMP.kayak.waterY, ['#74c4e6', '#2a78a8', '#0e3d68']);
    paintLakeShoreReflections(c, W, H);
  }

  function paintSky(c, W, H, top = '#d8ecff', mid = '#8fc8e8') {
    // 3-stop gradient with a hint of warm horizon
    const g = c.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, top);
    g.addColorStop(0.7, mid);
    g.addColorStop(1, '#bcdcef');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H * 0.7);
  }

  function paintSunWithRays(c, W, H, xFrac = 0.7) {
    const cx = W * xFrac;
    const cy = H * 0.16;
    const r = Math.min(W, H) * 0.16;

    // Outer glow
    const glow = c.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 1.6);
    glow.addColorStop(0, 'rgba(255, 250, 220, 0.85)');
    glow.addColorStop(0.35, 'rgba(255, 230, 170, 0.40)');
    glow.addColorStop(1, 'rgba(255, 200, 140, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    c.fill();

    // Sun rays (subtle wedges)
    c.save();
    c.translate(cx, cy);
    c.globalCompositeOperation = 'lighter';
    const rayGrad = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 4);
    rayGrad.addColorStop(0, 'rgba(255, 245, 200, 0.32)');
    rayGrad.addColorStop(1, 'rgba(255, 245, 200, 0)');
    c.fillStyle = rayGrad;
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i / 6) * Math.PI * 2 + 0.3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(r * 4, -r * 0.18);
      c.lineTo(r * 4, r * 0.18);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();

    // Sun disc
    c.fillStyle = 'rgba(255, 250, 220, 0.95)';
    c.beginPath();
    c.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    c.fill();
  }

  function paintAtmosphericHaze(c, W, H, y, alpha = 0.32) {
    // Soft horizontal haze band that sits in front of distant objects
    const g = c.createLinearGradient(0, y - 30, 0, y + 50);
    g.addColorStop(0, `rgba(220, 230, 240, 0)`);
    g.addColorStop(0.5, `rgba(220, 230, 240, ${alpha})`);
    g.addColorStop(1, `rgba(220, 230, 240, 0)`);
    c.fillStyle = g;
    c.fillRect(0, y - 30, W, 80);
  }

  function paintClouds(c, W, H, n = 6) {
    const seed = mulberry32(13);
    for (let i = 0; i < n; i++) {
      const x = seed() * W;
      const y = H * (0.04 + seed() * 0.22);
      const s = 0.35 + seed() * 0.55;  // smaller and wispier
      const tone = 0.85 + seed() * 0.15;
      drawCloudShape(c, x, y, s, tone);
    }
  }

  function drawCloudShape(c, x, y, s, tone = 0.95) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // long, soft underside shadow
    c.fillStyle = 'rgba(150, 170, 195, 0.18)';
    c.beginPath();
    c.ellipse(0, 14, 110, 8, 0, 0, Math.PI * 2);
    c.fill();
    // wispy puffs (more, smaller, varied)
    const puffs = [
      [-60, 4, 22], [-40, -4, 26], [-20, -8, 24], [0, -10, 22],
      [22, -6, 24], [44, -2, 20], [60, 4, 16],
    ];
    c.fillStyle = `rgba(255, 255, 255, ${tone})`;
    puffs.forEach(([cx, cy, r]) => {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
    });
    // top wisp highlight
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath();
    c.ellipse(-10, -14, 38, 4, 0, 0, Math.PI * 2);
    c.fill();
    // stretched whisp tail
    c.fillStyle = `rgba(255,255,255,${tone * 0.7})`;
    c.beginPath();
    c.ellipse(70, 6, 30, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function paintFarMountains(c, W, H, top = '#88a4be', shadow = '#5e7a96') {
    // Two layers: a paler "back ridge" then the main range, for atmospheric depth.
    paintMountainRidge(c, W, H, {
      baseY: H * 0.46,
      heightMin: 80,
      heightVar: 70,
      width: 260,
      seed: 19,
      fill: '#a3bcd2',
      shadow: '#7c97b0',
      snowAlpha: 0.55,
    });
    paintMountainRidge(c, W, H, {
      baseY: H * 0.5,
      heightMin: 130,
      heightVar: 120,
      width: 200,
      seed: 7,
      fill: top,
      shadow,
      snowAlpha: 0.92,
    });
  }

  function paintMountainRidge(c, W, H, opts) {
    const seed = mulberry32(opts.seed);
    const peaks = [];
    let x = -opts.width * 0.6;
    while (x < W + opts.width) {
      const peakX = x + opts.width * (0.4 + seed() * 0.4);
      const peakY = opts.baseY - (opts.heightMin + seed() * opts.heightVar);
      const skew = (seed() - 0.5) * 0.4;  // tilt the peak left or right
      peaks.push({ x: peakX, y: peakY, skew });
      x = peakX + opts.width * 0.3;
    }

    // Body — curved silhouette using bezier between peaks
    c.fillStyle = opts.fill;
    c.beginPath();
    c.moveTo(-20, opts.baseY);
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const prevX = i === 0 ? -20 : (peaks[i-1].x + (p.x - peaks[i-1].x) * 0.55);
      const prevY = i === 0 ? opts.baseY : (peaks[i-1].y + (opts.baseY - peaks[i-1].y) * 0.45);
      // gentle saddle between peaks
      c.quadraticCurveTo(prevX, prevY + 4, p.x - opts.width * 0.18, p.y + (p.y - opts.baseY) * -0.05);
      // sharp-ish ridge to peak
      c.lineTo(p.x + p.skew * 20, p.y);
      c.lineTo(p.x + 8, p.y + 6);
    }
    c.lineTo(W + 20, opts.baseY);
    c.closePath();
    c.fill();

    // Shadow side (right of each peak)
    c.fillStyle = opts.shadow;
    c.globalAlpha = 0.85;
    for (const p of peaks) {
      c.beginPath();
      c.moveTo(p.x + p.skew * 20, p.y);
      c.lineTo(p.x + 8, p.y + 8);
      c.bezierCurveTo(p.x + 30, p.y + 50, p.x + 60, p.y + 90, p.x + 80, opts.baseY);
      c.lineTo(p.x, opts.baseY);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;

    // Snow caps — multiple irregular patches per peak
    c.fillStyle = `rgba(255,255,255,${opts.snowAlpha})`;
    for (const p of peaks) {
      const px = p.x + p.skew * 20;
      const py = p.y;
      c.beginPath();
      c.moveTo(px, py);
      // jagged snowline
      c.lineTo(px - 22, py + 28);
      c.bezierCurveTo(px - 14, py + 22, px - 6, py + 32, px + 2, py + 24);
      c.bezierCurveTo(px + 10, py + 32, px + 18, py + 22, px + 26, py + 32);
      c.lineTo(px + 30, py + 8);
      c.closePath();
      c.fill();
      // tiny secondary snow speckle on the shadow side
      c.fillStyle = `rgba(255,255,255,${opts.snowAlpha * 0.5})`;
      c.beginPath();
      c.ellipse(px + 16, py + 36, 10, 4, 0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(255,255,255,${opts.snowAlpha})`;
    }

    // Crisp highlight along the lit ridge
    c.strokeStyle = `rgba(255,255,255,${opts.snowAlpha * 0.4})`;
    c.lineWidth = 1.5;
    for (const p of peaks) {
      c.beginPath();
      c.moveTo(p.x + p.skew * 20, p.y);
      c.lineTo(p.x - 18, p.y + 22);
      c.stroke();
    }
  }

  function paintMidHills(c, W, H, base = '#4b7855', shadow = '#385e3f') {
    const baseY = H * 0.62;
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(-20, baseY + 20);
    const seed = mulberry32(31);
    for (let x = -20; x <= W + 20; x += 60) {
      const y = baseY - 40 - Math.abs(Math.sin(x * 0.012 + 1.2)) * 60 - seed() * 20;
      c.lineTo(x, y);
    }
    c.lineTo(W + 20, baseY + 20);
    c.closePath();
    c.fill();
    // shading band
    c.fillStyle = shadow;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(-20, baseY);
    for (let x = -20; x <= W + 20; x += 60) {
      const y = baseY - 30 - Math.abs(Math.sin(x * 0.013 + 0.7)) * 40;
      c.lineTo(x, y);
    }
    c.lineTo(W + 20, baseY);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }

  function paintPineForest(c, W, H, baseY, dense = false) {
    // Three layered bands of pines, getting darker and taller in front,
    // with varied widths/heights and tiered branches for a real forest feel.
    const bands = [
      { y: baseY - 6,  color: '#3d6a4a', shadow: '#2a4d33', step: 18, hMin: 22, hVar: 18, wMin: 14, wVar: 6, seedOff: 11 },
      { y: baseY + 10, color: '#235a32', shadow: '#143a1d', step: 16, hMin: 32, hVar: 24, wMin: 14, wVar: 8, seedOff: 33 },
      { y: baseY + 28, color: '#143a23', shadow: '#0a2614', step: 14, hMin: 40, hVar: 30, wMin: 16, wVar: 10, seedOff: dense ? 71 : 91 },
    ];
    for (const band of bands) {
      const seed = mulberry32(band.seedOff);
      for (let x = -12; x < W + 12; x += band.step) {
        const jitter = (seed() - 0.5) * band.step * 0.6;
        const px = x + jitter;
        const h = band.hMin + seed() * band.hVar;
        const w = band.wMin + seed() * band.wVar;
        drawPine(c, px, band.y, w, h, band.color, band.shadow);
      }
    }
  }

  function drawPine(c, x, baseY, w, h, color, shadow) {
    // Trunk hint at the bottom
    c.fillStyle = '#3a2412';
    c.fillRect(x + w * 0.45, baseY - 4, 2, 6);

    // Tiered triangle branches
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const tH = h * (1 - i * 0.22);
      const tW = w * (1 - i * 0.22);
      const tBase = baseY - i * (h * 0.28);
      // shadow side (right)
      c.fillStyle = shadow;
      c.beginPath();
      c.moveTo(x + tW * 0.5, tBase - tH);
      c.lineTo(x + tW + 1, tBase + 1);
      c.lineTo(x + tW * 0.5, tBase + 1);
      c.closePath();
      c.fill();
      // lit side (left)
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x + tW * 0.5, tBase - tH);
      c.lineTo(x - 1, tBase + 1);
      c.lineTo(x + tW * 0.5, tBase + 1);
      c.closePath();
      c.fill();
      // top highlight
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.beginPath();
      c.moveTo(x + tW * 0.5, tBase - tH);
      c.lineTo(x + tW * 0.42, tBase - tH + 6);
      c.lineTo(x + tW * 0.5, tBase - tH + 4);
      c.closePath();
      c.fill();
    }
  }

  function paintRiverbank(c, W, H, waterFrac = 0.66) {
    // narrow grass strip and a bright foam line right at the waterline
    const y = H * waterFrac;
    const grad = c.createLinearGradient(0, y - 6, 0, y + 4);
    grad.addColorStop(0, '#3c6b3a');
    grad.addColorStop(1, 'rgba(40, 70, 50, 0)');
    c.fillStyle = grad;
    c.fillRect(0, y - 6, W, 10);
    // foam crest
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(0, y - 1, W, 2);
  }

  function paintBaseWater(c, W, H, topY, palette) {
    const grad = c.createLinearGradient(0, topY, 0, H);
    grad.addColorStop(0, palette[0]);
    grad.addColorStop(0.55, palette[1]);
    grad.addColorStop(1, palette[2]);
    c.fillStyle = grad;
    c.fillRect(0, topY, W, H - topY);
  }

  function paintLakeShoreReflections(c, W, H) {
    // soft mountain reflection just below the waterline
    const topY = H * 0.64;
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#3d6a4a';
    c.beginPath();
    c.moveTo(0, topY);
    for (let x = 0; x <= W; x += 30) {
      const y = topY + Math.abs(Math.sin(x * 0.012 + 0.3)) * 22;
      c.lineTo(x, y);
    }
    c.lineTo(W, topY);
    c.closePath();
    c.fill();
    c.restore();
  }

  function paintRocksFG(c, W, H, waterFrac = 0.66) {
    // foreground rocks placed close to the bottom so they don't crowd the kids
    const seed = mulberry32(123);
    const y0 = H * 0.85;
    const rocks = 5 + Math.floor(W / 280);
    for (let i = 0; i < rocks; i++) {
      const x = (i / rocks) * W + (seed() - 0.5) * 70 + 50;
      const y = y0 + (seed() - 0.4) * 50;
      const r = 30 + seed() * 50;
      drawRock(c, x, y, r);
      // foam wake around the rock waterline
      drawRockFoam(c, x, y, r);
    }
    // submerged dark spots — clamp BELOW the waterline so they never appear in air
    const waterTop = H * waterFrac + 10;
    c.fillStyle = 'rgba(20, 50, 80, 0.45)';
    for (let i = 0; i < 14; i++) {
      const x = seed() * W;
      const y = waterTop + seed() * (H - waterTop) * 0.85;
      c.beginPath();
      c.ellipse(x, y, 14 + seed() * 22, 4 + seed() * 7, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawRock(c, x, y, r) {
    // body
    const grad = c.createLinearGradient(x, y - r * 0.6, x, y + r * 0.5);
    grad.addColorStop(0, '#a39c8a');
    grad.addColorStop(1, '#5e574a');
    c.fillStyle = grad;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    // top highlight
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.22, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    // crack/texture
    c.strokeStyle = 'rgba(40,30,20,0.28)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x - r * 0.4, y);
    c.lineTo(x - r * 0.1, y - r * 0.05);
    c.lineTo(x + r * 0.2, y + r * 0.04);
    c.stroke();
    // damp waterline
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, y + r * 0.42, r * 0.95, r * 0.18, 0, 0, Math.PI * 2);
    c.stroke();
  }

  function drawRockFoam(c, x, y, r) {
    // little white wave shapes hugging the upstream side of the rock
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.ellipse(x - r * 0.55, y + r * 0.46, r * 0.35, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + r * 0.2, y + r * 0.48, r * 0.5, 4, 0, 0, Math.PI * 2);
    c.fill();
    // soft bow wave just upstream
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(x - r * 0.85, y + r * 0.35, r * 0.45, 3, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Pseudo-random
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- Animated water layer (per frame) ----------
  function drawWater(W, H) {
    const topY = state.scene === 'stream' ? H * 0.66 : H * 0.64;
    // moving ripples
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.6;
    const t = state.t * 0.0008;
    const step = state.scene === 'stream' ? 22 : 26;
    for (let y = topY + 10; y < H; y += step) {
      ctx.beginPath();
      const phase = t + y * 0.05;
      for (let x = 0; x <= W; x += 14) {
        const yy = y + Math.sin(phase + x * 0.018) * (state.scene === 'stream' ? 2.8 : 1.8);
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function seedSparkles() {
    state.sparkles = [];
    const W = state.W, H = state.H;
    const topY = state.scene === 'stream' ? H * 0.7 : H * 0.66;
    const count = Math.floor(W / 30);
    const rng = mulberry32(7);
    for (let i = 0; i < count; i++) {
      state.sparkles.push({
        x: rng() * W,
        y: topY + rng() * (H - topY) * 0.85,
        phase: rng() * Math.PI * 2,
        speed: 1 + rng() * 2,
        r: 0.6 + rng() * 1.4,
      });
    }
  }

  function drawSparkles() {
    ctx.save();
    for (const s of state.sparkles) {
      const a = (Math.sin(state.t * 0.003 * s.speed + s.phase) + 1) * 0.5;
      if (a < 0.1) continue;
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------- Characters ----------

  // The blond little-buddy. A toddler-ish proportions, big head, big mop of hair.
  function drawBlondKid(cx, cy, opts = {}) {
    const a = (Math.sin(state.t * 0.0018) * 0.04) + (opts.lean || 0);
    const s = opts.scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.rotate(a);

    // Submerged legs (waders) — only show top portion above water
    if (!opts.seated) {
      ctx.fillStyle = '#56683a';
      rrect(-30, 110, 26, 80, 8);
      rrect(4, 110, 26, 80, 8);
      // wader belt
      ctx.fillStyle = '#7c3a1a';
      rrect(-32, 102, 64, 9, 3);
    }

    // Vest body (puffy fishing vest)
    const vestGrad = ctx.createLinearGradient(0, 18, 0, 110);
    vestGrad.addColorStop(0, '#c69460');
    vestGrad.addColorStop(1, '#8a6233');
    ctx.fillStyle = vestGrad;
    rrect(-46, 22, 92, 90, 14);

    // Hoodie underneath at neck and arms
    ctx.fillStyle = '#d99a3a';
    rrect(-52, 30, 14, 78, 6);
    rrect(38, 30, 14, 78, 6);
    ctx.fillStyle = '#b87b22';
    rrect(-12, 18, 24, 14, 4); // hoodie neck

    // Vest pockets w/ outline
    ctx.strokeStyle = '#5d3f1a';
    ctx.lineWidth = 1.6;
    ctx.fillStyle = '#a87a44';
    rrect(-32, 56, 26, 26, 5);
    ctx.strokeRect(-32, 56, 26, 26);
    rrect(6, 56, 26, 26, 5);
    ctx.strokeRect(6, 56, 26, 26);
    // zipper line
    ctx.strokeStyle = '#5d3f1a';
    ctx.beginPath();
    ctx.moveTo(0, 22); ctx.lineTo(0, 112);
    ctx.stroke();

    // Head
    drawHead({
      skinTop: '#fdddb6',
      skinBot: '#ecbe89',
      skinShadow: '#c98d57',
      cheek: 'rgba(232,118,108,0.55)',
      mouth: '#7a3a26',
      brow: '#a06820',
      iris: '#3e6a8c',
    });

    // Hair — golden mop with bangs (raised so it doesn't cover eyes)
    ctx.fillStyle = '#e9b94a';
    ctx.beginPath();
    ctx.moveTo(-42, -24);
    ctx.bezierCurveTo(-46, -56, 32, -60, 42, -24);
    ctx.bezierCurveTo(42, -14, 34, -10, 24, -14);
    ctx.bezierCurveTo(14, -22, -12, -22, -24, -14);
    ctx.bezierCurveTo(-34, -10, -42, -14, -42, -24);
    ctx.closePath();
    ctx.fill();
    // darker hair shadow underside
    ctx.fillStyle = '#b88420';
    ctx.beginPath();
    ctx.ellipse(0, -18, 36, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // bangs (raised — does NOT cross the eyes)
    ctx.fillStyle = '#cf9a36';
    ctx.beginPath();
    ctx.moveTo(-26, -22);
    ctx.quadraticCurveTo(-4, -38, 24, -18);
    ctx.lineTo(20, -14);
    ctx.quadraticCurveTo(0, -22, -22, -14);
    ctx.closePath();
    ctx.fill();
    // hair tufts (texture)
    ctx.fillStyle = '#f6cf63';
    [[-28,-30],[-14,-36],[2,-40],[18,-36],[30,-30]].forEach(([x,y]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // tiny side curl
    ctx.fillStyle = '#cf9a36';
    ctx.beginPath(); ctx.arc(-36, -14, 7, 0, Math.PI * 2); ctx.fill();

    // Visible right arm (sleeve) holding the net
    if (opts.holdNet) {
      // sleeve from shoulder to hand
      ctx.strokeStyle = '#9a6c2e';
      ctx.lineCap = 'round';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(36, 38);    // shoulder
      ctx.quadraticCurveTo(58, 44, 70, 64);  // bent forearm
      ctx.stroke();
      // sleeve highlight
      ctx.strokeStyle = '#c69460';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(40, 36);
      ctx.quadraticCurveTo(60, 42, 70, 60);
      ctx.stroke();
      // hand (skin)
      ctx.fillStyle = '#fadcb6';
      ctx.beginPath(); ctx.arc(72, 66, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8a674';
      ctx.beginPath(); ctx.arc(74, 70, 5, 0, Math.PI * 2); ctx.fill();

      // Net handle continues from hand
      ctx.strokeStyle = '#8a4d18';
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(72, 66);
      ctx.lineTo(146, 122);
      ctx.stroke();
      // grip wrap
      ctx.strokeStyle = '#3d2812';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const t = 0.05 + i * 0.05;
        const x = 72 + (146 - 72) * t;
        const y = 66 + (122 - 66) * t;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 3);
        ctx.lineTo(x + 4, y + 3);
        ctx.stroke();
      }
      // net hoop with thickness
      ctx.strokeStyle = '#2b3f55';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(170, 142, 28, 0, Math.PI * 2); ctx.stroke();
      // net inside (slightly translucent)
      ctx.fillStyle = 'rgba(180, 210, 230, 0.45)';
      ctx.beginPath(); ctx.arc(170, 142, 26, 0, Math.PI * 2); ctx.fill();
      // mesh weave
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.8;
      for (let i = -24; i <= 24; i += 5) {
        ctx.beginPath(); ctx.moveTo(170 + i, 142 - 24); ctx.lineTo(170 + i, 142 + 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(170 - 24, 142 + i); ctx.lineTo(170 + 24, 142 + i); ctx.stroke();
      }
      // hoop top highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(170, 142, 28, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }

    if (opts.holdPaddle) drawPaddle(opts.paddlePhase || 0);
    ctx.restore();
  }

  function drawBrunetteKid(cx, cy, opts = {}) {
    const a = (Math.sin(state.t * 0.0014 + 1) * 0.03) + (opts.lean || 0);
    const s = opts.scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.rotate(a);

    if (!opts.seated) {
      ctx.fillStyle = '#4d5e36';
      rrect(-30, 110, 26, 80, 8);
      rrect(4, 110, 26, 80, 8);
      ctx.fillStyle = '#3a3a3a';
      rrect(-32, 102, 64, 9, 3);
    }

    // Black hoodie
    ctx.fillStyle = '#262d36';
    rrect(-52, 26, 104, 100, 14);
    // Vest over hoodie
    const vGrad = ctx.createLinearGradient(0, 32, 0, 124);
    vGrad.addColorStop(0, '#8c7e58');
    vGrad.addColorStop(1, '#5b4f33');
    ctx.fillStyle = vGrad;
    rrect(-44, 36, 88, 86, 12);
    // Vest pockets with fly pin
    ctx.strokeStyle = '#3b2f1a';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#a59670';
    rrect(-32, 60, 24, 24, 4); ctx.strokeRect(-32, 60, 24, 24);
    rrect(8, 60, 24, 24, 4);  ctx.strokeRect(8, 60, 24, 24);
    // small fly pin (red dot + white wing)
    ctx.fillStyle = '#e84a3a';
    ctx.beginPath(); ctx.arc(20, 58, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(23, 56, 1.5, 0, Math.PI * 2); ctx.fill();
    // zipper
    ctx.strokeStyle = '#3b2f1a';
    ctx.beginPath();
    ctx.moveTo(0, 36); ctx.lineTo(0, 122);
    ctx.stroke();

    // Head
    drawHead({
      skinTop: '#f3cc9f',
      skinBot: '#d6a26f',
      skinShadow: '#a9744a',
      cheek: 'rgba(190,98,82,0.5)',
      mouth: '#6a3422',
      brow: '#3a2412',
      iris: '#5a3a22',
    });

    // Curly brown hair — tighter ring of curls AROUND the head, NOT over the eyes
    ctx.fillStyle = '#3e2716';
    const outerCurls = [
      [-36,-26,14],[-26,-36,17],[-12,-42,17],[6,-42,17],[22,-38,17],[36,-28,14],
      [-40,-12,12],[40,-12,12],
    ];
    outerCurls.forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    // lighter highlights on top curls
    ctx.fillStyle = '#5a3920';
    [[-22,-32,8],[-6,-40,9],[12,-38,8],[26,-32,8]].forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    // bangs — placed up at the forehead, NOT over the eyes
    ctx.fillStyle = '#2c1a0c';
    ctx.beginPath();
    ctx.moveTo(-26, -22);
    ctx.quadraticCurveTo(-2, -34, 26, -22);
    ctx.quadraticCurveTo(20, -16, 8, -18);
    ctx.quadraticCurveTo(-8, -16, -26, -22);
    ctx.closePath();
    ctx.fill();
    // freckles across the bridge (small, subtle)
    ctx.fillStyle = '#8a4f30';
    [[-10,3],[-4,5],[5,3],[11,5],[-14,7],[15,7]].forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI*2); ctx.fill();
    });

    // Visible rod arm (sleeve from shoulder, hoodie cuff, glove)
    const rodAngle = opts.rodAngle ?? -0.32;
    // sleeve under hoodie (black)
    ctx.strokeStyle = '#262d36';
    ctx.lineCap = 'round';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.quadraticCurveTo(70, 40, 80, 56);
    ctx.stroke();
    // vest sleeve overlay (the vest is sleeveless but the upper arm shows the vest edge)
    ctx.strokeStyle = '#7a6c44';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(40, 36);
    ctx.lineTo(50, 40);
    ctx.stroke();

    ctx.save();
    ctx.translate(80, 56);
    ctx.rotate(rodAngle);
    // hoodie cuff
    ctx.fillStyle = '#1d242c';
    rrect(-10, -16, 20, 12, 3);
    // glove (red/orange) with knuckle band
    ctx.fillStyle = '#c1442a';
    rrect(-9, -14, 24, 26, 6);
    ctx.fillStyle = '#7a2a18';
    rrect(-9, -14, 24, 6, 3);
    ctx.fillStyle = '#e85d3a';
    rrect(-9, -2, 24, 4, 2);
    // little finger lines
    ctx.strokeStyle = '#7a2a18';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const x = -7 + i * 7;
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 12); ctx.stroke();
    }
    // rod
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.quadraticCurveTo(120, -34, 230, -10);
    ctx.stroke();
    // rod highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, -6);
    ctx.quadraticCurveTo(120, -36, 220, -14);
    ctx.stroke();
    // line guides
    ctx.fillStyle = '#222';
    [0.25, 0.5, 0.75].forEach(t => {
      const x = 8 + (230 - 8) * t;
      const y = -2 + (-10 - -2) * t - 20 * t * (1 - t);
      ctx.beginPath(); ctx.arc(x, y - 2, 2, 0, Math.PI * 2); ctx.fill();
    });
    // rod tip mark
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.arc(230, -10, 3, 0, Math.PI * 2); ctx.fill();
    // reel
    const reelG = ctx.createRadialGradient(20, 10, 1, 20, 10, 13);
    reelG.addColorStop(0, '#dadada');
    reelG.addColorStop(1, '#454545');
    ctx.fillStyle = reelG;
    ctx.beginPath(); ctx.arc(20, 10, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(20, 10, 13, 0, Math.PI * 2); ctx.stroke();
    // reel inner ring
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(20, 10, 8, 0, Math.PI * 2); ctx.stroke();
    // reel handle
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(20, 10, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Save the world-space rod tip so the line can attach.
    // Rod tip is at local (230, -10) inside the (80, 56) + rotate(rodAngle) frame.
    // Skip when drawing as a reflection — we don't want to overwrite the real tip.
    if (!opts._ghost) {
      const tipBodyX = 80 + 230 * Math.cos(rodAngle) - (-10) * Math.sin(rodAngle);
      const tipBodyY = 56 + 230 * Math.sin(rodAngle) + (-10) * Math.cos(rodAngle);
      const rodTipLocal = transformPoint(tipBodyX, tipBodyY);
      state.line.tipX = rodTipLocal.x;
      state.line.tipY = rodTipLocal.y;
    }

    if (opts.holdPaddle) drawPaddle(opts.paddlePhase || 0);
    ctx.restore();
  }

  // Get the current canvas-space point for a coordinate inside a translated + rotated frame.
  function transformPoint(lx, ly) {
    const m = ctx.getTransform();
    // m maps draw-space -> device pixels; we want draw-space (virtual) directly.
    // Since ctx.getTransform includes the DPR scale we set in resize, we need to undo that.
    const scale = state.scale;
    const x = (m.a * lx + m.c * ly + m.e) / scale;
    const y = (m.b * lx + m.d * ly + m.f) / scale;
    return { x, y };
  }

  // p: { skinTop, skinBot, skinShadow, cheek, mouth, brow }
  function drawHead(p) {
    // Neck
    ctx.fillStyle = p.skinBot;
    rrect(-13, 14, 26, 16, 5);
    // Neck shadow
    ctx.fillStyle = p.skinShadow;
    ctx.fillRect(-13, 14, 26, 4);

    // Head — slightly tall, painterly
    const hg = ctx.createRadialGradient(-6, -16, 6, 0, -4, 50);
    hg.addColorStop(0, p.skinTop);
    hg.addColorStop(1, p.skinBot);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, -8, 40, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side shading on the right (subtle volume)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -8, 40, 45, 0, 0, Math.PI * 2);
    ctx.clip();
    const sg = ctx.createLinearGradient(10, 0, 40, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, p.skinShadow + (typeof p.skinShadow === 'string' && p.skinShadow.length === 7 ? '88' : ''));
    ctx.fillStyle = sg;
    ctx.fillRect(0, -56, 50, 100);
    ctx.restore();

    // Ears
    ctx.fillStyle = p.skinBot;
    ctx.beginPath(); ctx.ellipse(-39, -4, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(39, -4, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skinShadow;
    ctx.beginPath(); ctx.ellipse(-39, -2, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(39, -2, 3, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Cheeks
    ctx.fillStyle = p.cheek;
    ctx.beginPath(); ctx.arc(-22, 6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 6, 7, 0, Math.PI * 2); ctx.fill();

    // Eyebrows (drawn before eyes so eyes pop above)
    ctx.strokeStyle = p.brow;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -16); ctx.quadraticCurveTo(-12, -19, -6, -16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -16); ctx.quadraticCurveTo(12, -19, 18, -16);
    ctx.stroke();

    // Eyes — bigger whites so the sparkle reads on mobile
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-12, -6, 7, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -6, 7, 8, 0, 0, Math.PI*2); ctx.fill();
    // iris (looking slightly to the right toward fish)
    ctx.fillStyle = p.iris || '#3a5a7a';
    ctx.beginPath(); ctx.arc(-11, -5, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -5, 4.2, 0, Math.PI * 2); ctx.fill();
    // pupil
    ctx.fillStyle = '#0c1822';
    ctx.beginPath(); ctx.arc(-11, -5, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -5, 2.4, 0, Math.PI * 2); ctx.fill();
    // catchlight
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-9.5, -7, 1.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(14.5, -7, 1.4, 0, Math.PI*2); ctx.fill();
    // tiny secondary glint
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(-13, -3, 0.7, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -3, 0.7, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Nose
    ctx.fillStyle = p.skinShadow;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(0, 8, 3, 2);
    ctx.quadraticCurveTo(0, 4, -3, 2);
    ctx.closePath();
    ctx.fill();

    // Smile — open with teeth + tongue
    ctx.fillStyle = '#5a2014';
    ctx.beginPath();
    ctx.ellipse(0, 14, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-7, 11, 14, 3);
    ctx.fillStyle = '#e07060';
    ctx.beginPath(); ctx.ellipse(0, 16, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.mouth;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 12, 9, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  function drawPaddle(phase) {
    // simple double-bladed paddle the blond kid holds in the kayak
    const swing = Math.sin(state.t * 0.003 + phase) * 0.35;
    ctx.save();
    ctx.translate(-30, 60);
    ctx.rotate(-0.2 + swing);
    // shaft
    ctx.fillStyle = '#1c1c1c';
    rrect(-7, -100, 14, 220, 4);
    // top blade (yellow)
    ctx.fillStyle = '#f4c734';
    ctx.beginPath();
    ctx.ellipse(0, -110, 28, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9a7a14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -110, 28, 50, 0, 0, Math.PI * 2);
    ctx.stroke();
    // bottom blade (orange)
    ctx.fillStyle = '#e85d1c';
    ctx.beginPath();
    ctx.ellipse(0, 130, 28, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8c3210';
    ctx.beginPath();
    ctx.ellipse(0, 130, 28, 50, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Kayak ----------
  function drawKayak(cx, cy) {
    const bob = Math.sin(state.t * 0.0017) * 5;
    ctx.save();
    ctx.translate(cx, cy + bob);
    // hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 70, 290, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // hull body
    const grad = ctx.createLinearGradient(0, -10, 0, 80);
    grad.addColorStop(0, '#f6a040');
    grad.addColorStop(0.55, '#e87523');
    grad.addColorStop(1, '#a8410f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-260, 30);
    ctx.bezierCurveTo(-210, -30, 220, -30, 280, 30);
    ctx.bezierCurveTo(220, 80, -210, 80, -260, 30);
    ctx.closePath();
    ctx.fill();
    // hull stripe
    ctx.strokeStyle = '#7a2c0a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-240, 50);
    ctx.bezierCurveTo(-100, 76, 180, 76, 260, 50);
    ctx.stroke();
    // top deck shine
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, -8, 200, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // cockpit holes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(-90, 16, 60, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(110, 16, 60, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // cockpit lip
    ctx.strokeStyle = '#a04019';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(-90, 16, 60, 18, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(110, 16, 60, 18, 0, 0, Math.PI * 2); ctx.stroke();
    // bungee cord (front)
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-220, 0); ctx.lineTo(-180, -10); ctx.lineTo(-160, 4); ctx.lineTo(-120, -8);
    ctx.stroke();
    ctx.restore();

    // Now render seated kids inside
    ctx.save();
    ctx.translate(cx - 90, cy - 40 + bob);
    drawBlondKid(0, 0, { seated: true, holdPaddle: true, paddlePhase: 0.0 });
    ctx.restore();

    ctx.save();
    ctx.translate(cx + 110, cy - 40 + bob);
    drawBrunetteKid(0, 0, { seated: true, rodAngle: -0.55 + Math.sin(state.t * 0.001) * 0.05 });
    ctx.restore();
  }

  // ---------- Fish ----------
  function rollFish() {
    let r = Math.random(), acc = 0;
    for (const f of FISH_TYPES) {
      acc += f.weight;
      if (r <= acc) return f;
    }
    return FISH_TYPES[0];
  }

  function spawnFish(force) {
    if (state.fish.length > 8 && !force) return;
    const type = rollFish();
    const fromLeft = Math.random() < 0.5;
    const W = state.W, H = state.H;
    const yMin = state.scene === 'stream' ? H * 0.78 : H * 0.74;
    const yMax = H * 0.94;
    const speed = (0.45 + Math.random() * 0.7) * (fromLeft ? 1 : -1);
    state.fish.push({
      type,
      x: fromLeft ? -60 : W + 60,
      y: yMin + Math.random() * (yMax - yMin),
      vx: speed,
      bobPhase: Math.random() * Math.PI * 2,
      flip: !fromLeft,
      curious: 0,
    });
  }

  function maintainFish(dt) {
    state.lastSpawn += dt;
    if (state.lastSpawn > 1100 && state.fish.length < 7) {
      spawnFish(true);
      state.lastSpawn = 0;
    }
    for (let i = state.fish.length - 1; i >= 0; i--) {
      const f = state.fish[i];
      if (state.line.hooked === f) continue;
      f.x += f.vx * dt * 0.06;
      f.bobPhase += dt * 0.005;
      f.y += Math.sin(f.bobPhase) * 0.12;

      const dx = state.line.bobX - f.x;
      const dy = state.line.bobY - f.y;
      const d = Math.hypot(dx, dy);
      if (state.line.cast && d < 150 && state.line.cooldown <= 0 && !state.line.hooked) {
        f.curious += dt * 0.0011;
        f.x += Math.sign(dx) * 0.45;
        f.y += Math.sign(dy) * 0.18;
        if (f.curious > 1.0 + Math.random() * 0.7) biteFish(f);
      } else {
        f.curious = Math.max(0, f.curious - dt * 0.0008);
      }
      if (f.x < -180 || f.x > state.W + 180) state.fish.splice(i, 1);
    }
  }

  function biteFish(f) {
    state.line.hooked = f;
    state.line.lastBite = state.t;
    addSplash(state.line.bobX, state.line.bobY, 1);
    pulseBubbles(state.line.bobX, state.line.bobY, 6);
    showBite(true);
    haptic([12, 40, 12]);
    setTimeout(() => {
      if (state.line.hooked === f && state.t - state.line.lastBite > 950) {
        state.line.hooked = null;
        f.curious = 0;
        f.vx = (Math.random() < 0.5 ? -1 : 1) * 1.4;
        showBite(false);
        floatText(state.line.bobX, state.line.bobY - 30, 'Got away!', '#cc4040');
      }
    }, 1000);
  }

  function drawFish() {
    for (const f of state.fish) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.flip) ctx.scale(-1, 1);
      const t = f.type;

      // belly
      ctx.fillStyle = t.belly;
      ctx.beginPath();
      ctx.ellipse(0, t.size * 0.06, t.size, t.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, -t.size * 0.06, t.size, t.size * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      // back
      ctx.fillStyle = t.back;
      ctx.beginPath();
      ctx.ellipse(0, -t.size * 0.28, t.size * 0.95, t.size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // dorsal fin
      ctx.fillStyle = t.back;
      ctx.beginPath();
      ctx.moveTo(-t.size * 0.2, -t.size * 0.4);
      ctx.quadraticCurveTo(0, -t.size * 0.85, t.size * 0.3, -t.size * 0.4);
      ctx.closePath();
      ctx.fill();
      // pectoral fin
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(t.size * 0.2, t.size * 0.05);
      ctx.quadraticCurveTo(t.size * 0.45, t.size * 0.42, t.size * 0.55, t.size * 0.05);
      ctx.closePath();
      ctx.fill();

      // tail
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(-t.size, 0);
      ctx.quadraticCurveTo(-t.size - 22, -t.size * 0.5, -t.size - 24, -t.size * 0.18);
      ctx.lineTo(-t.size - 16, 0);
      ctx.lineTo(-t.size - 24, t.size * 0.18);
      ctx.quadraticCurveTo(-t.size - 22, t.size * 0.5, -t.size, 0);
      ctx.closePath();
      ctx.fill();

      // eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.size * 0.55, -t.size * 0.12, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(t.size * 0.6, -t.size * 0.12, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.size * 0.62, -t.size * 0.16, 0.9, 0, Math.PI * 2); ctx.fill();

      // mouth
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(t.size * 0.85, t.size * 0.05);
      ctx.quadraticCurveTo(t.size * 0.96, t.size * 0.15, t.size * 0.92, t.size * 0.22);
      ctx.stroke();

      // scales hint for bigger fish
      if (t.size > 30) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let r = -0.4; r <= 0.4; r += 0.2) {
          ctx.beginPath();
          ctx.arc(t.size * 0.1, t.size * r, t.size * 0.55, -1.4, 1.4);
          ctx.stroke();
        }
      }

      // bite "!"
      if (state.line.hooked === f) {
        const sc = 1 + Math.sin(state.t * 0.02) * 0.15;
        ctx.save();
        ctx.scale(sc, sc);
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 3;
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText('!', 0, -t.size - 14);
        ctx.fillText('!', 0, -t.size - 14);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ---------- Line + bobber ----------
  function drawLineAndBobber() {
    const L = state.line;
    if (!L.cast) return;
    // line with slack curve
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L.tipX, L.tipY);
    const midX = (L.tipX + L.bobX) / 2;
    const midY = (L.tipY + L.bobY) / 2 + 18;
    ctx.quadraticCurveTo(midX, midY, L.bobX, L.bobY);
    ctx.stroke();

    // bobber bob
    const bobY = L.bobY + (L.hooked ? Math.sin(state.t * 0.03) * 5 : Math.sin(state.t * 0.005) * 2);
    // shadow on water
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(L.bobX + 2, bobY + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // red top
    const bobG = ctx.createRadialGradient(L.bobX - 3, bobY - 3, 1, L.bobX, bobY, 11);
    bobG.addColorStop(0, '#ff7d6e');
    bobG.addColorStop(1, '#b3231a');
    ctx.fillStyle = bobG;
    ctx.beginPath(); ctx.arc(L.bobX, bobY, 10, 0, Math.PI * 2); ctx.fill();
    // white bottom hemisphere
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(L.bobX, bobY, 10, 0, Math.PI); ctx.fill();
    // outline
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(L.bobX, bobY, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L.bobX - 10, bobY); ctx.lineTo(L.bobX + 10, bobY); ctx.stroke();
    ctx.restore();
  }

  // ---------- Splashes / bubbles / floats ----------
  function addSplash(x, y, scale = 1) {
    state.splashes.push({ x, y, r: 5 * scale, max: 38 * scale, life: 0, dur: 600 });
  }
  function pulseBubbles(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      state.bubbles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + 4 + Math.random() * 8,
        vy: -0.6 - Math.random() * 0.6,
        r: 1.5 + Math.random() * 2.5,
        life: 0,
        dur: 800 + Math.random() * 400,
      });
    }
  }
  function floatText(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0, dur: 1100 });
  }
  function drawSplashes() {
    for (let i = state.splashes.length - 1; i >= 0; i--) {
      const s = state.splashes[i];
      s.life += 16;
      const t = Math.min(1, s.life / s.dur);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.95})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + (s.max - s.r) * t, 0, Math.PI * 2);
      ctx.stroke();
      // inner ring
      ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, (s.r + (s.max - s.r) * t) * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      if (t >= 1) state.splashes.splice(i, 1);
    }
  }
  function drawBubbles() {
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      const b = state.bubbles[i];
      b.life += 16;
      const t = Math.min(1, b.life / b.dur);
      b.y += b.vy;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      if (t >= 1) state.bubbles.splice(i, 1);
    }
  }
  function drawFloats() {
    ctx.font = 'bold 24px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    for (let i = state.floats.length - 1; i >= 0; i--) {
      const f = state.floats[i];
      f.life += 16;
      const t = Math.min(1, f.life / f.dur);
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1d2b36';
      ctx.strokeText(f.text, f.x, f.y - t * 38);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - t * 38);
      ctx.globalAlpha = 1;
      if (t >= 1) state.floats.splice(i, 1);
    }
  }

  // ---------- Game flow ----------
  function showBite(on) {
    els.bite.classList.toggle('hidden', !on);
    els.castBtn.classList.toggle('bite', !!on);
    els.castLabel.textContent = on ? 'HOOK!' : (state.line.cast ? 'REEL' : 'CAST');
    els.castSub.textContent = on ? 'tap now!' : (state.line.cast ? 'no bite yet' : 'tap to cast');
  }

  function updateCastUI() {
    const on = !!state.line.hooked;
    if (on) showBite(true); else showBite(false);
  }

  function castOrHook() {
    if (!state.running) return;
    const L = state.line;
    if (L.cooldown > 0) return;
    if (!L.cast) {
      // Cast: place bobber slightly to the right of and below the rod tip,
      // within the visible water area.
      const W = state.W, H = state.H;
      const targetX = clamp(L.tipX + 200, W * 0.35, W * 0.92);
      const targetY = (state.scene === 'stream' ? H * 0.83 : H * 0.82);
      L.bobX = targetX;
      L.bobY = targetY;
      L.cast = true;
      L.cooldown = 250;
      addSplash(targetX, targetY, 0.9);
      pulseBubbles(targetX, targetY, 4);
      haptic(8);
      updateCastUI();
      return;
    }
    if (L.hooked) {
      const f = L.hooked;
      const dt = state.t - L.lastBite;
      if (dt > 50 && dt < 850) {
        // success!
        state.caught += 1;
        state.score += f.type.points;
        floatText(f.x, f.y - 30, `+${f.type.points}`, '#1f8f3a');
        addSplash(f.x, f.y, 1.4);
        pulseBubbles(f.x, f.y, 8);
        const idx = state.fish.indexOf(f);
        if (idx >= 0) state.fish.splice(idx, 1);
        L.hooked = null;
        L.cast = false;
        L.cooldown = 380;
        haptic([18, 30, 40]);
        updateHUD();
      } else {
        floatText(L.bobX, L.bobY - 30, 'Too soon!', '#cc4040');
        haptic(40);
      }
      updateCastUI();
      return;
    }
    // No bite — reel in
    L.cast = false;
    L.cooldown = 280;
    updateCastUI();
  }

  function updateHUD() {
    els.caught.textContent = state.caught;
    els.score.textContent = state.score;
  }

  function setScene(name) {
    state.scene = name;
    els.sceneLabel.textContent = name === 'stream' ? 'Stream' : 'Kayak';
    document.querySelectorAll('.scene-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.scene === name);
    });
    state.line.cast = false;
    state.line.hooked = null;
    state.fish = [];
    invalidateBg();
    seedSparkles();
    updateCastUI();
  }

  function rankFor(score) {
    if (score >= 250) return 'Master Angler 🏆';
    if (score >= 150) return 'Sharp Hook ✨';
    if (score >= 75)  return 'Solid Catch 🎯';
    if (score >= 30)  return 'Getting the hang of it';
    return 'Try again — the big ones are out there!';
  }

  function startGame() {
    state.running = true;
    state.timeLeft = 60;
    state.caught = 0;
    state.score = 0;
    state.fish = [];
    state.splashes = [];
    state.bubbles = [];
    state.floats = [];
    state.line.cast = false;
    state.line.hooked = null;
    state.line.cooldown = 0;
    for (let i = 0; i < 5; i++) spawnFish(true);
    updateHUD();
    updateCastUI();
    els.startOverlay.classList.add('hidden');
    els.endOverlay.classList.add('hidden');
  }

  function endGame() {
    state.running = false;
    els.finalCaught.textContent = state.caught;
    els.finalScore.textContent = state.score;
    els.finalRank.textContent = rankFor(state.score);
    els.endOverlay.classList.remove('hidden');
    showBite(false);
  }

  // ---------- Main loop ----------
  let last = 0;
  function loop(now) {
    const dt = Math.min(40, now - last || 16);
    last = now;
    state.t += dt;

    if (state.running) {
      state.timeLeft -= dt / 1000;
      if (state.timeLeft <= 0) { state.timeLeft = 0; endGame(); }
      els.time.textContent = Math.ceil(state.timeLeft);
      maintainFish(dt);
      if (state.line.cast) state.line.bobX += Math.sin(state.t * 0.0007) * 0.2;
      if (state.line.cooldown > 0) state.line.cooldown -= dt;
      if (state.line.hooked) {
        const f = state.line.hooked;
        f.x += (state.line.bobX - f.x) * 0.18;
        f.y += (state.line.bobY - f.y) * 0.18;
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  function render() {
    ensureBg();
    const W = state.W, H = state.H;

    // 1) Blit cached background
    ctx.save();
    ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
    ctx.drawImage(state.bg.canvas, 0, 0);
    ctx.restore();

    // 2) Scene foreground
    if (state.scene === 'stream') {
      drawWater(W, H);
      drawSparkles();
      // Reflections drawn first (under the kids), then the kids on top.
      const cy = H * COMP.stream.kidY;
      const blondX = W * 0.42, brunetteX = W * 0.6;
      drawCharacterReflection(blondX, cy, COMP.stream.kidScale, 'blond');
      drawCharacterReflection(brunetteX, cy, COMP.stream.kidScale, 'brunette');
      drawBlondKid(blondX, cy, { holdNet: true, scale: COMP.stream.kidScale });
      drawBrunetteKid(brunetteX, cy, {
        rodAngle: -0.32 + Math.sin(state.t * 0.0009) * 0.05,
        scale: COMP.stream.kidScale,
      });
    } else {
      drawWater(W, H);
      drawSparkles();
      drawKayak(W * 0.5, H * COMP.kayak.kayakY);
    }

    // 3) Fish, line, effects
    drawFish();
    drawLineAndBobber();
    drawSplashes();
    drawBubbles();
    drawFloats();
  }

  // Soft, semi-transparent flipped silhouette to suggest a water reflection.
  function drawCharacterReflection(cx, cy, scale, who) {
    const waterY = state.H * COMP.stream.waterY;
    ctx.save();
    ctx.translate(cx, waterY);
    ctx.scale(scale, -scale * 0.35);
    ctx.translate(0, -(waterY - cy) / scale);
    ctx.globalAlpha = 0.22;
    ctx.filter = 'blur(2px)';
    if (who === 'blond') drawBlondKid(0, 0, { holdNet: false, scale: 1, _ghost: true });
    else drawBrunetteKid(0, 0, { rodAngle: -0.32, scale: 1, _ghost: true });
    ctx.restore();
  }
  requestAnimationFrame(loop);

  // ---------- Helpers ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function haptic(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (_) {} }

  // ---------- Input ----------
  function preventScroll(e) { e.preventDefault(); }
  canvas.addEventListener('pointerdown', e => { castOrHook(); preventScroll(e); });
  els.castBtn.addEventListener('pointerdown', e => { castOrHook(); preventScroll(e); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { castOrHook(); e.preventDefault(); }
    if (e.key === '1') setScene('stream');
    if (e.key === '2') setScene('kayak');
  });
  els.startBtn.addEventListener('click', startGame);
  els.restartBtn.addEventListener('click', startGame);
  document.querySelectorAll('.scene-btn').forEach(b => {
    b.addEventListener('click', () => setScene(b.dataset.scene));
  });

  // ---------- Boot ----------
  resize();
  setScene('stream');
  // Pre-spawn a few fish so the start screen has motion
  for (let i = 0; i < 4; i++) spawnFish(true);
})();
