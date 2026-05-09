// Fishing with Friends — a cozy click-to-catch fishing game
// Two scenes: a rocky stream (fly fishing) and a kayak on the lake.
// Drawn entirely with canvas primitives so it ships as static files.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const els = {
    caught: document.getElementById('caught'),
    score: document.getElementById('score'),
    time: document.getElementById('time'),
    sceneLabel: document.getElementById('scene-label'),
    startOverlay: document.getElementById('start-overlay'),
    endOverlay: document.getElementById('end-overlay'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    finalCaught: document.getElementById('final-caught'),
    finalScore: document.getElementById('final-score'),
  };

  // ---------- Game state ----------
  const state = {
    scene: 'stream',     // 'stream' | 'kayak'
    running: false,
    timeLeft: 60,
    caught: 0,
    score: 0,
    // fishing line
    line: {
      // start anchored to the rod tip; updated each frame in render
      tipX: 320, tipY: 260,
      bobX: 360, bobY: 480,
      vy: 0,
      cast: false,        // cast and floating
      hooked: null,       // fish object or null
      tension: 0,         // 0..1 wiggle
      lastBite: 0,        // ms timer for bite indicator
      cooldown: 0,
    },
    fish: [],
    splashes: [],
    floats: [],           // popup score texts
    paddleSwing: 0,       // for kayak idle anim
    rodSwing: 0,          // for stream idle anim
    boatBob: 0,
    t: 0,                 // ms accumulator
  };

  // ---------- Fish definitions ----------
  const FISH_TYPES = [
    { name: 'minnow',  size: 22, color: '#9ecde6', stripe: '#6aa6c8', points: 5,  rare: 0.55 },
    { name: 'trout',   size: 38, color: '#7fb685', stripe: '#3d6e4a', points: 15, rare: 0.30 },
    { name: 'bass',    size: 56, color: '#5a8d4a', stripe: '#33533c', points: 30, rare: 0.13 },
    { name: 'goldie',  size: 30, color: '#f5b03e', stripe: '#a0651a', points: 50, rare: 0.02 },
  ];

  function rollFish() {
    const r = Math.random();
    let acc = 0;
    for (const f of FISH_TYPES) {
      acc += f.rare;
      if (r <= acc) return f;
    }
    return FISH_TYPES[0];
  }

  function spawnFish() {
    const type = rollFish();
    const fromLeft = Math.random() < 0.5;
    const y = state.scene === 'stream'
      ? 540 + Math.random() * 110
      : 520 + Math.random() * 130;
    const speed = (0.6 + Math.random() * 0.9) * (fromLeft ? 1 : -1);
    state.fish.push({
      type,
      x: fromLeft ? -60 : W + 60,
      y,
      vx: speed,
      bobPhase: Math.random() * Math.PI * 2,
      flip: !fromLeft,
      curious: 0,
      caughtAnim: 0,
    });
  }

  // Keep population reasonable
  function maintainFish(dt) {
    if (state.fish.length < 6 && Math.random() < 0.02) spawnFish();
    for (let i = state.fish.length - 1; i >= 0; i--) {
      const f = state.fish[i];
      if (state.line.hooked === f) continue;
      f.x += f.vx * dt * 60 / 1000;
      f.bobPhase += dt * 0.004;
      // gentle vertical wobble
      f.y += Math.sin(f.bobPhase) * 0.15;
      // curiosity toward bobber
      const dx = state.line.bobX - f.x;
      const dy = state.line.bobY - f.y;
      const d = Math.hypot(dx, dy);
      if (state.line.cast && d < 130 && state.line.cooldown <= 0) {
        f.curious += dt * 0.001;
        f.x += Math.sign(dx) * 0.4;
        f.y += Math.sign(dy) * 0.15;
        // Bite!
        if (f.curious > 1.0 + Math.random() * 0.8 && !state.line.hooked) {
          biteFish(f);
        }
      } else {
        f.curious = Math.max(0, f.curious - dt * 0.0008);
      }
      if (f.x < -120 || f.x > W + 120) state.fish.splice(i, 1);
    }
  }

  function biteFish(f) {
    state.line.hooked = f;
    state.line.lastBite = state.t;
    addSplash(state.line.bobX, state.line.bobY);
    // The player has a window to hook the fish (press / click)
    setTimeout(() => {
      if (state.line.hooked === f && state.t - state.line.lastBite > 900) {
        // missed it
        state.line.hooked = null;
        f.curious = 0;
        f.vx = (Math.random() < 0.5 ? -1 : 1) * 1.4;
        floatText(state.line.bobX, state.line.bobY - 30, 'Got away!', '#cc4040');
      }
    }, 950);
  }

  function hookSet() {
    if (!state.line.cast) {
      // begin cast
      state.line.cast = true;
      state.line.cooldown = 250;
      // place bobber a little ahead of the rod tip
      const targetX = state.scene === 'stream' ? 380 + Math.random() * 380 : 700 + Math.random() * 300;
      const targetY = state.scene === 'stream' ? 600 : 600;
      state.line.bobX = targetX;
      state.line.bobY = targetY - 200;
      state.line.vy = 4;
      addSplash(targetX, targetY, 0.6);
      return;
    }
    if (state.line.hooked) {
      const f = state.line.hooked;
      const reactionMs = state.t - state.line.lastBite;
      // good hookset between 80ms .. 750ms
      if (reactionMs > 60 && reactionMs < 800) {
        state.caught += 1;
        state.score += f.type.points;
        floatText(f.x, f.y - 30, `+${f.type.points}`, '#1f8f3a');
        addSplash(f.x, f.y, 1.1);
        state.line.hooked = null;
        // remove fish
        const idx = state.fish.indexOf(f);
        if (idx >= 0) state.fish.splice(idx, 1);
        state.line.cast = false;
        state.line.cooldown = 400;
        updateHUD();
      } else {
        floatText(state.line.bobX, state.line.bobY - 30, 'Too soon!', '#cc4040');
      }
      return;
    }
    // No bite — reel in
    state.line.cast = false;
    state.line.cooldown = 250;
  }

  function addSplash(x, y, scale = 1) {
    state.splashes.push({ x, y, r: 4 * scale, max: 30 * scale, life: 0, dur: 500 });
  }

  function floatText(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0, dur: 900 });
  }

  // ---------- Drawing ----------

  function drawSky() {
    // gradient is set on the canvas via CSS, but reinforce with subtle shapes
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    g.addColorStop(0, '#bfe7ff');
    g.addColorStop(1, '#7fc6ee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.65);

    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    drawCloud(140, 110, 1);
    drawCloud(420, 80, 0.8);
    drawCloud(820, 130, 1.1);
    drawCloud(1080, 70, 0.7);
  }

  function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 26 * s, y - 8 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 52 * s, y, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 78 * s, y + 4 * s, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains() {
    // far range — soft blue
    ctx.fillStyle = '#7896b6';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    let x = 0;
    for (; x <= W; x += 80) {
      const h = 320 + Math.sin(x * 0.013) * 60 + Math.cos(x * 0.0072) * 40;
      ctx.lineTo(x, h);
    }
    ctx.lineTo(W, 380);
    ctx.closePath();
    ctx.fill();

    // near range — green forest
    ctx.fillStyle = '#3f7244';
    ctx.beginPath();
    ctx.moveTo(0, 460);
    for (x = 0; x <= W; x += 30) {
      const h = 420 + Math.sin(x * 0.02) * 24 + Math.cos(x * 0.011 + 1.3) * 18;
      ctx.lineTo(x, h);
    }
    ctx.lineTo(W, 460);
    ctx.closePath();
    ctx.fill();

    // tree line silhouettes
    ctx.fillStyle = '#345e3a';
    for (let i = 0; i < W; i += 14) {
      const baseY = 430 + Math.sin(i * 0.022) * 14;
      const treeH = 22 + ((i * 53) % 18);
      ctx.beginPath();
      ctx.moveTo(i, baseY);
      ctx.lineTo(i + 6, baseY - treeH);
      ctx.lineTo(i + 12, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawStreamScene() {
    drawSky();
    drawMountains();

    // water
    const water = ctx.createLinearGradient(0, 460, 0, H);
    water.addColorStop(0, '#5db1e0');
    water.addColorStop(0.6, '#2d6fa6');
    water.addColorStop(1, '#1d4d80');
    ctx.fillStyle = water;
    ctx.fillRect(0, 460, W, H - 460);

    // ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = 480; y < H; y += 26) {
      ctx.beginPath();
      const phase = (state.t * 0.0006 + y * 0.05);
      for (let x = 0; x <= W; x += 18) {
        const yy = y + Math.sin(phase + x * 0.018) * 2.2;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // rocks scattered in foreground
    drawRock(110, 590, 60);
    drawRock(260, 640, 40);
    drawRock(940, 610, 70);
    drawRock(1110, 660, 50);

    // characters: two kids wading — left = blond w/ net, right = brunette w/ rod
    drawKidBlond(420, 360, { holdNet: true, rodAngle: -0.35 + Math.sin(state.t*0.001)*0.06 });
    drawKidBrunette(720, 350, { rodAngle: -0.22 + Math.sin(state.t*0.0009 + 1)*0.05 });

    // rod tip from the brunette's rod (right kid) — that's our line
    state.line.tipX = 720 + 220;
    state.line.tipY = 350 + 30;

    drawFish();
    drawLineAndBobber();
    drawSplashes();
    drawFloats();
  }

  function drawKayakScene() {
    drawSky();
    drawMountains();

    // water (a calmer lake)
    const water = ctx.createLinearGradient(0, 460, 0, H);
    water.addColorStop(0, '#6cbde6');
    water.addColorStop(1, '#205c8d');
    ctx.fillStyle = water;
    ctx.fillRect(0, 460, W, H - 460);

    // ripple grid
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    for (let y = 480; y < H; y += 22) {
      ctx.beginPath();
      const ph = state.t * 0.0005 + y * 0.04;
      for (let x = 0; x <= W; x += 14) {
        const yy = y + Math.sin(ph + x * 0.012) * 1.6;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    drawFish();

    // kayak with both kids — bobs gently
    const bob = Math.sin(state.t * 0.0015) * 6;
    drawKayak(380, 540 + bob);

    // The right kid in the kayak is holding the rod; rod tip is at ~ (720, 470)
    state.line.tipX = 730;
    state.line.tipY = 470 + bob;

    drawLineAndBobber();
    drawSplashes();
    drawFloats();
  }

  function drawRock(x, y, w) {
    ctx.fillStyle = '#8a8275';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a59a89';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.25, y - w * 0.18, w * 0.55, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Characters ---
  // The two kids are stylized to evoke the reference illustrations:
  //  blond toddler with net, brunette older kid with vest + rod.
  function drawKidBlond(cx, cy, opts = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    // legs (waders, in water)
    ctx.fillStyle = '#5b6f3a';
    rrect(-30, 100, 26, 100, 8);
    rrect(4, 100, 26, 100, 8);
    // body / vest
    ctx.fillStyle = '#9b6f3d';   // tan vest
    rrect(-44, 20, 88, 90, 14);
    // hoodie under vest
    ctx.fillStyle = '#d99a3a';
    rrect(-50, 30, 14, 70, 6);
    rrect(36, 30, 14, 70, 6);
    // pockets
    ctx.fillStyle = '#7a5527';
    rrect(-32, 56, 26, 22, 5);
    rrect(6, 56, 26, 22, 5);
    // head
    ctx.fillStyle = '#f6d6b3';
    ctx.beginPath();
    ctx.arc(0, -10, 38, 0, Math.PI * 2);
    ctx.fill();
    // hair (blond mop)
    ctx.fillStyle = '#e5b34a';
    ctx.beginPath();
    ctx.arc(0, -28, 38, Math.PI, 0);
    ctx.bezierCurveTo(38, -14, 30, -2, 18, -4);
    ctx.bezierCurveTo(8, -16, -8, -16, -18, -4);
    ctx.bezierCurveTo(-30, -2, -38, -14, -38, -28);
    ctx.closePath();
    ctx.fill();
    // bangs
    ctx.fillStyle = '#cf9a36';
    ctx.beginPath();
    ctx.moveTo(-22, -18);
    ctx.quadraticCurveTo(-4, -32, 18, -16);
    ctx.lineTo(20, -8);
    ctx.quadraticCurveTo(0, -18, -20, -8);
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.fillStyle = '#1e2933';
    ctx.beginPath(); ctx.arc(-12, -6, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -6, 3.2, 0, Math.PI * 2); ctx.fill();
    // smile
    ctx.strokeStyle = '#7a3a26';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // cheeks
    ctx.fillStyle = 'rgba(230, 120, 110, 0.45)';
    ctx.beginPath(); ctx.arc(-20, 6, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 6, 5, 0, Math.PI*2); ctx.fill();

    // arm holding net
    if (opts.holdNet) {
      ctx.strokeStyle = '#f6d6b3';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(80, 70);
      ctx.stroke();
      // net handle
      ctx.strokeStyle = '#c97633';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(72, 70);
      ctx.lineTo(150, 130);
      ctx.stroke();
      // net hoop
      ctx.strokeStyle = '#3d5a78';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(170, 150, 26, 0, Math.PI * 2);
      ctx.stroke();
      // net mesh
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(170, 150, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawKidBrunette(cx, cy, opts = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    // legs
    ctx.fillStyle = '#56683a';
    rrect(-30, 100, 26, 100, 8);
    rrect(4, 100, 26, 100, 8);
    // black hoodie
    ctx.fillStyle = '#27313a';
    rrect(-50, 26, 100, 96, 14);
    // vest
    ctx.fillStyle = '#6f6753';
    rrect(-44, 36, 88, 80, 12);
    // pocket lines
    ctx.strokeStyle = '#3e3a2c';
    ctx.lineWidth = 2;
    ctx.strokeRect(-30, 60, 24, 22);
    ctx.strokeRect(6, 60, 24, 22);
    // head
    ctx.fillStyle = '#f1c79b';
    ctx.beginPath();
    ctx.arc(0, -10, 38, 0, Math.PI * 2);
    ctx.fill();
    // curly hair
    ctx.fillStyle = '#5d3a22';
    ctx.beginPath();
    for (let a = Math.PI; a >= 0; a -= 0.18) {
      const r = 38 + Math.sin(a * 6) * 4;
      ctx.lineTo(Math.cos(a) * r, -28 + Math.sin(a) * -r * 0.6);
    }
    ctx.bezierCurveTo(38, -10, 30, 4, 12, 0);
    ctx.bezierCurveTo(0, -10, -10, -10, -16, 0);
    ctx.bezierCurveTo(-30, 4, -38, -10, -38, -28);
    ctx.closePath();
    ctx.fill();
    // freckles
    ctx.fillStyle = '#a76844';
    [[-10,2],[-4,4],[6,2],[12,4]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    });
    // eyes
    ctx.fillStyle = '#1e2933';
    ctx.beginPath(); ctx.arc(-11, -6, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -6, 3.2, 0, Math.PI * 2); ctx.fill();
    // smile
    ctx.strokeStyle = '#6a3422';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // rod arm + rod
    const a = opts.rodAngle ?? -0.25;
    ctx.save();
    ctx.translate(40, 50);
    ctx.rotate(a);
    // glove
    ctx.fillStyle = '#b94a2a';
    rrect(-6, -12, 22, 22, 5);
    // rod
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.quadraticCurveTo(120, -30, 220, -20);
    ctx.stroke();
    // reel
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(20, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawKayak(x, y) {
    ctx.save();
    ctx.translate(x, y);
    // hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(260, 130, 280, 20, 0, 0, Math.PI*2);
    ctx.fill();

    // kayak hull (orange)
    const hull = ctx.createLinearGradient(0, 60, 0, 150);
    hull.addColorStop(0, '#f08c2e');
    hull.addColorStop(1, '#c24f17');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(20, 100);
    ctx.bezierCurveTo(60, 60, 460, 60, 520, 100);
    ctx.bezierCurveTo(460, 140, 60, 140, 20, 100);
    ctx.closePath();
    ctx.fill();
    // hull stripe
    ctx.strokeStyle = '#8c3a10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 110);
    ctx.bezierCurveTo(160, 132, 380, 132, 500, 110);
    ctx.stroke();

    // cockpit holes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(170, 90, 50, 18, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(360, 90, 50, 18, 0, 0, Math.PI*2); ctx.fill();

    // blond kid in front cockpit, with paddle
    ctx.save();
    ctx.translate(170, -50);
    drawSeatedKidBlond();
    ctx.restore();

    // brunette kid in rear cockpit, with rod up holding fish
    ctx.save();
    ctx.translate(360, -50);
    drawSeatedKidBrunette();
    ctx.restore();

    ctx.restore();
  }

  function drawSeatedKidBlond() {
    // life vest body
    ctx.fillStyle = '#c9a16a';
    rrect(-44, 30, 88, 80, 12);
    // pocket lines
    ctx.strokeStyle = '#7a5b30';
    ctx.lineWidth = 2;
    ctx.strokeRect(-32, 60, 24, 22);
    ctx.strokeRect(8, 60, 24, 22);
    // head
    ctx.fillStyle = '#f6d6b3';
    ctx.beginPath(); ctx.arc(0, -8, 36, 0, Math.PI*2); ctx.fill();
    // hair
    ctx.fillStyle = '#e5b34a';
    ctx.beginPath();
    ctx.arc(0, -22, 36, Math.PI, 0);
    ctx.bezierCurveTo(36, -10, 28, 0, 16, -2);
    ctx.bezierCurveTo(8, -14, -8, -14, -16, -2);
    ctx.bezierCurveTo(-28, 0, -36, -10, -36, -22);
    ctx.closePath();
    ctx.fill();
    // eyes / smile
    ctx.fillStyle = '#1e2933';
    ctx.beginPath(); ctx.arc(-11, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#7a3a26';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 8, 8, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();

    // paddle
    const swing = Math.sin(state.t * 0.0035) * 0.25;
    ctx.save();
    ctx.translate(-30, 50);
    ctx.rotate(-0.25 + swing);
    // shaft
    ctx.fillStyle = '#222';
    rrect(-8, -90, 16, 200, 4);
    // blade top (yellow)
    ctx.fillStyle = '#f4c734';
    ctx.beginPath();
    ctx.ellipse(0, -110, 28, 50, 0, 0, Math.PI*2); ctx.fill();
    // blade bottom (orange)
    ctx.fillStyle = '#e85d1c';
    ctx.beginPath();
    ctx.ellipse(0, 130, 28, 50, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawSeatedKidBrunette() {
    // life vest
    ctx.fillStyle = '#cdb88c';
    rrect(-44, 30, 88, 80, 12);
    // dark hoodie sleeve hint
    ctx.fillStyle = '#27313a';
    rrect(-50, 36, 12, 70, 6);
    rrect(38, 36, 12, 70, 6);
    // pocket
    ctx.fillStyle = '#a25040';
    rrect(-30, 58, 22, 16, 4);
    // head
    ctx.fillStyle = '#f1c79b';
    ctx.beginPath(); ctx.arc(0, -8, 36, 0, Math.PI*2); ctx.fill();
    // curly brown hair
    ctx.fillStyle = '#5d3a22';
    ctx.beginPath();
    for (let a = Math.PI; a >= 0; a -= 0.18) {
      const r = 36 + Math.sin(a * 6) * 3.5;
      ctx.lineTo(Math.cos(a) * r, -22 + Math.sin(a) * -r * 0.6);
    }
    ctx.bezierCurveTo(36, -8, 28, 4, 12, 0);
    ctx.bezierCurveTo(0, -8, -10, -8, -16, 0);
    ctx.bezierCurveTo(-28, 4, -36, -8, -36, -22);
    ctx.closePath();
    ctx.fill();
    // eyes / smile
    ctx.fillStyle = '#1e2933';
    ctx.beginPath(); ctx.arc(-10, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#6a3422';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 8, 8, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();

    // raised arm with rod (rod tip set externally to (730, 470))
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.quadraticCurveTo(160, -40, 360, -10);  // local rod path; mostly cosmetic
    ctx.stroke();
    // reel
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.arc(40, 26, 8, 0, Math.PI*2); ctx.fill();
  }

  // --- Fish ---
  function drawFish() {
    for (const f of state.fish) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.flip) ctx.scale(-1, 1);
      const t = f.type;
      // body
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, t.size, t.size * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      // back stripe
      ctx.fillStyle = t.stripe;
      ctx.beginPath();
      ctx.ellipse(0, -t.size * 0.28, t.size * 0.95, t.size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(-t.size, 0);
      ctx.lineTo(-t.size - 18, -14);
      ctx.lineTo(-t.size - 18, 14);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.size * 0.55, -t.size * 0.1, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(t.size * 0.6, -t.size * 0.1, 2.2, 0, Math.PI*2); ctx.fill();
      // mouth hint
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(t.size * 0.85, t.size * 0.1);
      ctx.lineTo(t.size * 0.95, t.size * 0.18);
      ctx.stroke();
      // bite indicator
      if (state.line.hooked === f) {
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -t.size - 12);
      }
      ctx.restore();
    }
  }

  function drawLineAndBobber() {
    const L = state.line;
    if (!L.cast && L.cooldown <= 0) return;
    // line
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L.tipX, L.tipY);
    // small curve
    const midX = (L.tipX + L.bobX) / 2;
    const midY = (L.tipY + L.bobY) / 2 + 18;
    ctx.quadraticCurveTo(midX, midY, L.bobX, L.bobY);
    ctx.stroke();

    // bobber
    const bobBobY = L.bobY + (L.hooked ? Math.sin(state.t * 0.03) * 4 : Math.sin(state.t * 0.005) * 2);
    ctx.fillStyle = '#e8423a';
    ctx.beginPath(); ctx.arc(L.bobX, bobBobY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(L.bobX, bobBobY, 9, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(L.bobX, bobBobY, 9, 0, Math.PI * 2); ctx.stroke();
  }

  function drawSplashes() {
    for (let i = state.splashes.length - 1; i >= 0; i--) {
      const s = state.splashes[i];
      s.life += 16;
      const t = Math.min(1, s.life / s.dur);
      ctx.strokeStyle = `rgba(255,255,255,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + (s.max - s.r) * t, 0, Math.PI * 2);
      ctx.stroke();
      if (t >= 1) state.splashes.splice(i, 1);
    }
  }

  function drawFloats() {
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    for (let i = state.floats.length - 1; i >= 0; i--) {
      const f = state.floats[i];
      f.life += 16;
      const t = Math.min(1, f.life / f.dur);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - t * 30);
      ctx.globalAlpha = 1;
      if (t >= 1) state.floats.splice(i, 1);
    }
  }

  // --- Helpers ---
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Loop ----------
  let last = 0;
  function loop(now) {
    const dt = Math.min(40, now - last || 16);
    last = now;
    state.t += dt;

    if (state.running) {
      state.timeLeft -= dt / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endGame();
      }
      els.time.textContent = Math.ceil(state.timeLeft);

      maintainFish(dt);

      // bobber animation: drift
      if (state.line.cast) {
        state.line.bobX += Math.sin(state.t * 0.0007) * 0.2;
      }
      if (state.line.cooldown > 0) state.line.cooldown -= dt;

      // hooked fish drag the bobber
      if (state.line.hooked) {
        const f = state.line.hooked;
        f.x += (state.line.bobX - f.x) * 0.2;
        f.y += (state.line.bobY - f.y) * 0.2;
      }
    }

    ctx.clearRect(0, 0, W, H);
    if (state.scene === 'stream') drawStreamScene();
    else drawKayakScene();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

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
    // reset line on scene change
    state.line.cast = false;
    state.line.hooked = null;
  }

  function startGame() {
    state.running = true;
    state.timeLeft = 60;
    state.caught = 0;
    state.score = 0;
    state.fish = [];
    state.splashes = [];
    state.floats = [];
    state.line.cast = false;
    state.line.hooked = null;
    for (let i = 0; i < 5; i++) spawnFish();
    updateHUD();
    els.startOverlay.classList.add('hidden');
    els.endOverlay.classList.add('hidden');
  }

  function endGame() {
    state.running = false;
    els.finalCaught.textContent = state.caught;
    els.finalScore.textContent = state.score;
    els.endOverlay.classList.remove('hidden');
  }

  // ---------- Input ----------
  function onAction(e) {
    if (!state.running) return;
    hookSet();
    if (e) e.preventDefault();
  }

  canvas.addEventListener('mousedown', onAction);
  canvas.addEventListener('touchstart', onAction, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') onAction(e);
    if (e.key === '1') setScene('stream');
    if (e.key === '2') setScene('kayak');
  });

  els.startBtn.addEventListener('click', startGame);
  els.restartBtn.addEventListener('click', startGame);
  document.querySelectorAll('.scene-btn').forEach(b => {
    b.addEventListener('click', () => setScene(b.dataset.scene));
  });

  setScene('stream');
})();
