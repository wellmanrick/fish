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

  function paintStreamBg(c, W, H) {
    paintSky(c, W, H);
    paintSun(c, W, H, 0.78);
    paintClouds(c, W, H, 6);
    paintFarMountains(c, W, H);
    paintMidHills(c, W, H);
    paintPineForest(c, W, H, H * 0.58);
    paintRiverbank(c, W, H);
    paintBaseWater(c, W, H, H * 0.66, ['#5fb7e6', '#2e7ab1', '#15436c']);
    paintRocksFG(c, W, H, true);
  }

  function paintKayakBg(c, W, H) {
    paintSky(c, W, H, '#bce0f5', '#8fbfdf');
    paintSun(c, W, H, 0.72);
    paintClouds(c, W, H, 5);
    paintFarMountains(c, W, H, '#7d9cb8', '#5d7a96');
    paintMidHills(c, W, H, '#3d6a4a', '#2e5538');
    paintPineForest(c, W, H, H * 0.6, true);
    paintBaseWater(c, W, H, H * 0.64, ['#74c4e6', '#2a78a8', '#0e3d68']);
    paintLakeShoreReflections(c, W, H);
  }

  function paintSky(c, W, H, top = '#cbe6ff', mid = '#8fc8e8') {
    const g = c.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, top);
    g.addColorStop(1, mid);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H * 0.7);
  }

  function paintSun(c, W, H, xFrac = 0.7) {
    const cx = W * xFrac;
    const cy = H * 0.18;
    const r = Math.min(W, H) * 0.18;
    const grad = c.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    grad.addColorStop(0.4, 'rgba(255, 240, 180, 0.45)');
    grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
    c.fillStyle = grad;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    // Sun core
    c.fillStyle = 'rgba(255, 250, 220, 0.9)';
    c.beginPath();
    c.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    c.fill();
  }

  function paintClouds(c, W, H, n = 6) {
    const seed = mulberry32(13);
    for (let i = 0; i < n; i++) {
      const x = seed() * W;
      const y = H * (0.06 + seed() * 0.18);
      const s = 0.7 + seed() * 0.9;
      drawCloudShape(c, x, y, s);
    }
  }

  function drawCloudShape(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // soft underside shadow
    c.fillStyle = 'rgba(150, 170, 195, 0.35)';
    c.beginPath();
    c.ellipse(0, 12, 90, 14, 0, 0, Math.PI * 2);
    c.fill();
    // body
    c.fillStyle = 'rgba(255, 255, 255, 0.95)';
    [
      [-50, 4, 30],
      [-20, -10, 36],
      [10, -14, 30],
      [40, -6, 32],
      [60, 8, 26],
    ].forEach(([cx, cy, r]) => {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
    });
    // highlight
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(-10, -16, 30, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function paintFarMountains(c, W, H, top = '#7e9bb8', shadow = '#5e7a96') {
    const baseY = H * 0.5;
    const peaks = [];
    const seed = mulberry32(7);
    let x = -40;
    while (x < W + 80) {
      const peakX = x + 80 + seed() * 80;
      const peakY = baseY - (110 + seed() * 110);
      peaks.push([peakX, peakY]);
      x = peakX + 40;
    }
    // body
    c.fillStyle = top;
    c.beginPath();
    c.moveTo(-20, baseY);
    for (const p of peaks) {
      c.lineTo(p[0] - 50, baseY - 10);
      c.lineTo(p[0], p[1]);
    }
    c.lineTo(W + 20, baseY);
    c.closePath();
    c.fill();
    // shadow side
    c.fillStyle = shadow;
    c.beginPath();
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      c.moveTo(p[0], p[1]);
      c.lineTo(p[0] + 28, p[1] + 38);
      c.lineTo(p[0] + 60, baseY);
      c.lineTo(p[0], baseY);
      c.closePath();
    }
    c.fill();
    // snow caps
    c.fillStyle = 'rgba(255,255,255,0.92)';
    for (const p of peaks) {
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(p[0] - 18, p[1] + 22);
      c.lineTo(p[0] - 8, p[1] + 18);
      c.lineTo(p[0] + 4, p[1] + 26);
      c.lineTo(p[0] + 16, p[1] + 18);
      c.lineTo(p[0] + 24, p[1] + 28);
      c.closePath();
      c.fill();
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
    // Dense band of triangular pine silhouettes
    const seed = mulberry32(dense ? 55 : 91);
    const rows = dense ? 2 : 2;
    for (let row = 0; row < rows; row++) {
      const y0 = baseY + row * 22;
      const tone = row === 0 ? '#1f4a2e' : '#163a23';
      c.fillStyle = tone;
      const step = 14;
      for (let x = -10; x < W + 10; x += step) {
        const h = 36 + seed() * 26 + (row === 0 ? 0 : 8);
        const w = 12 + seed() * 6;
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x + w / 2, y0 - h);
        c.lineTo(x + w, y0);
        c.closePath();
        c.fill();
        // tiny highlight on top
        if (seed() > 0.7) {
          c.fillStyle = 'rgba(255,255,255,0.07)';
          c.beginPath();
          c.moveTo(x + w * 0.45, y0 - h + 6);
          c.lineTo(x + w * 0.55, y0 - h + 6);
          c.lineTo(x + w / 2, y0 - h);
          c.closePath();
          c.fill();
          c.fillStyle = tone;
        }
      }
    }
  }

  function paintRiverbank(c, W, H) {
    // narrow grass strip just at the waterline
    const y = H * 0.66;
    const grad = c.createLinearGradient(0, y - 6, 0, y + 4);
    grad.addColorStop(0, '#3c6b3a');
    grad.addColorStop(1, 'rgba(40, 70, 50, 0)');
    c.fillStyle = grad;
    c.fillRect(0, y - 6, W, 10);
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

  function paintRocksFG(c, W, H, withWaterline) {
    // distribute foreground rocks deterministically
    const seed = mulberry32(123);
    const y0 = H * 0.78;
    const rocks = 6 + Math.floor(W / 260);
    for (let i = 0; i < rocks; i++) {
      const x = (i / rocks) * W + (seed() - 0.5) * 80 + 40;
      const y = y0 + (seed() - 0.4) * 60;
      const r = 28 + seed() * 50;
      drawRock(c, x, y, r);
    }
    // submerged dark spots
    c.fillStyle = 'rgba(20, 50, 80, 0.45)';
    for (let i = 0; i < 18; i++) {
      const x = seed() * W;
      const y = H * 0.72 + seed() * (H * 0.22);
      c.beginPath();
      c.ellipse(x, y, 16 + seed() * 26, 5 + seed() * 8, 0, 0, Math.PI * 2);
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
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.22, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    // damp waterline
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, y + r * 0.42, r * 0.95, r * 0.18, 0, 0, Math.PI * 2);
    c.stroke();
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
    ctx.save();
    ctx.translate(cx, cy);
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
      skinTop: '#fadcb6',
      skinBot: '#e9bd87',
      cheek: 'rgba(220,110,110,0.55)',
      mouth: '#7a3a26',
    });

    // Hair — golden mop with bangs
    ctx.fillStyle = '#e9b94a';
    ctx.beginPath();
    ctx.moveTo(-40, -22);
    ctx.bezierCurveTo(-44, -52, 30, -56, 40, -22);
    ctx.bezierCurveTo(40, -10, 32, -2, 22, -6);
    ctx.bezierCurveTo(12, -16, -10, -16, -22, -6);
    ctx.bezierCurveTo(-32, -2, -40, -10, -40, -22);
    ctx.closePath();
    ctx.fill();
    // bangs darker layer
    ctx.fillStyle = '#cf9a36';
    ctx.beginPath();
    ctx.moveTo(-22, -16);
    ctx.quadraticCurveTo(-2, -32, 22, -14);
    ctx.lineTo(22, -6);
    ctx.quadraticCurveTo(2, -18, -22, -6);
    ctx.closePath();
    ctx.fill();
    // hair tufts (texture)
    ctx.fillStyle = '#f3c75f';
    [[-26,-26],[-12,-32],[2,-34],[16,-32],[28,-26]].forEach(([x,y]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Holding net (one arm out)
    if (opts.holdNet) {
      // hand
      ctx.fillStyle = '#fadcb6';
      ctx.beginPath();
      ctx.arc(56, 56, 9, 0, Math.PI * 2);
      ctx.fill();
      // net handle
      ctx.strokeStyle = '#a8651b';
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(56, 56);
      ctx.lineTo(140, 110);
      ctx.stroke();
      // net hoop
      ctx.strokeStyle = '#3d5a78';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(168, 132, 26, 0, Math.PI * 2);
      ctx.stroke();
      // net mesh
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(168, 132, 24, 0, Math.PI * 2);
      ctx.fill();
      // mesh weave
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.7;
      for (let i = -22; i <= 22; i += 6) {
        ctx.beginPath();
        ctx.moveTo(168 + i, 132 - 22);
        ctx.lineTo(168 + i, 132 + 22);
        ctx.stroke();
      }
      for (let i = -22; i <= 22; i += 6) {
        ctx.beginPath();
        ctx.moveTo(168 - 22, 132 + i);
        ctx.lineTo(168 + 22, 132 + i);
        ctx.stroke();
      }
    }

    if (opts.holdPaddle) drawPaddle(opts.paddlePhase || 0);
    ctx.restore();
  }

  function drawBrunetteKid(cx, cy, opts = {}) {
    const a = (Math.sin(state.t * 0.0014 + 1) * 0.03) + (opts.lean || 0);
    ctx.save();
    ctx.translate(cx, cy);
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
      skinTop: '#f0c79b',
      skinBot: '#d4a16f',
      cheek: 'rgba(180,90,80,0.45)',
      mouth: '#6a3422',
    });

    // Curly brown hair
    ctx.fillStyle = '#5a3920';
    const curls = [
      [-32,-22,16],[-22,-32,18],[-8,-36,16],[8,-36,16],[22,-32,18],[34,-22,16],
      [-30,-12,14],[30,-12,14],
    ];
    curls.forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    // bangs
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.moveTo(-22, -10);
    ctx.quadraticCurveTo(-4, -24, 22, -10);
    ctx.lineTo(20, -2);
    ctx.quadraticCurveTo(0, -12, -22, -2);
    ctx.closePath();
    ctx.fill();
    // freckles
    ctx.fillStyle = '#a76844';
    [[-9,4],[-3,6],[6,4],[12,6],[-14,8],[15,8]].forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI*2); ctx.fill();
    });

    // Rod arm + rod tip lives in `opts.rodTip` (world coords relative to body)
    const rodAngle = opts.rodAngle ?? -0.32;
    ctx.save();
    ctx.translate(40, 50);
    ctx.rotate(rodAngle);
    // glove (red/orange)
    ctx.fillStyle = '#c1442a';
    rrect(-7, -14, 22, 24, 5);
    ctx.fillStyle = '#7a2a18';
    rrect(-7, -14, 22, 6, 3);
    // rod
    ctx.strokeStyle = '#161616';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.quadraticCurveTo(140, -36, 240, -16);
    ctx.stroke();
    // rod tip mark
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.arc(240, -16, 2.8, 0, Math.PI * 2); ctx.fill();
    // reel
    const reelG = ctx.createRadialGradient(20, 8, 1, 20, 8, 11);
    reelG.addColorStop(0, '#c8c8c8');
    reelG.addColorStop(1, '#5a5a5a');
    ctx.fillStyle = reelG;
    ctx.beginPath(); ctx.arc(20, 8, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(20, 8, 11, 0, Math.PI * 2); ctx.stroke();
    // reel handle
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.arc(20, 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Save the world-space rod tip so the line can attach
    const rodTipLocal = transformPoint(40 + 240 * Math.cos(rodAngle) - (-16) * Math.sin(rodAngle),
                                       50 + 240 * Math.sin(rodAngle) + (-16) * Math.cos(rodAngle));
    state.line.tipX = rodTipLocal.x;
    state.line.tipY = rodTipLocal.y;

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

  function drawHead(p) {
    // neck
    ctx.fillStyle = p.skinBot;
    rrect(-12, 14, 24, 14, 4);
    // head shape (slightly pear)
    const hg = ctx.createLinearGradient(0, -42, 0, 28);
    hg.addColorStop(0, p.skinTop);
    hg.addColorStop(1, p.skinBot);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, -8, 38, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    // ear hint
    ctx.fillStyle = p.skinBot;
    ctx.beginPath();
    ctx.ellipse(-37, -4, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(37, -4, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // cheeks
    ctx.fillStyle = p.cheek;
    ctx.beginPath(); ctx.arc(-20, 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 4, 6, 0, Math.PI * 2); ctx.fill();
    // eyes — whites + pupil + highlight
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-12, -6, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -6, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1c2a36';
    ctx.beginPath(); ctx.arc(-11, -5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-10, -7, 1.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -7, 1.1, 0, Math.PI*2); ctx.fill();
    // nose hint
    ctx.fillStyle = 'rgba(170, 110, 80, 0.55)';
    ctx.beginPath(); ctx.ellipse(0, 4, 2.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // smile
    ctx.strokeStyle = p.mouth;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 10, 8, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    // teeth hint
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 12, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
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
      // Two kids wading. Brunette on the right (rod tip is captured into state.line.tipX/Y).
      drawBlondKid(W * 0.42, H * 0.5, { holdNet: true });
      drawBrunetteKid(W * 0.62, H * 0.5, { rodAngle: -0.32 + Math.sin(state.t * 0.0009) * 0.05 });
    } else {
      drawWater(W, H);
      drawSparkles();
      drawKayak(W * 0.5, H * 0.62);
    }

    // 3) Fish, line, effects
    drawFish();
    drawLineAndBobber();
    drawSplashes();
    drawBubbles();
    drawFloats();
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
