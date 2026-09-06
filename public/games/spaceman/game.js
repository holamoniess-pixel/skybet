/* =========================================
   SPACEMAN CRASH GAME — game.js
   Astronaut floating in space theme
   ========================================= */

'use strict';

/* =========================================
   1. RNG / CRASH GENERATOR (Provably Fair)
   ========================================= */
const RNG = (() => {
  function randomHex(len) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hmacSHA256(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function generateCrashPoint() {
    const serverSeed = randomHex(16);
    const clientSeed = randomHex(8);
    const nonce      = Math.floor(Math.random() * 100000);
    const hash       = await hmacSHA256(serverSeed, clientSeed + nonce);

    const num    = parseInt(hash.substring(0, 8), 16);
    const maxNum = 0xffffffff;
    const random = num / maxNum;

    let crash = Math.max(1.00, Math.min(1000, 1 / (1 - random)));
    crash = Math.floor(crash * 100) / 100;

    return { crash, serverSeed, clientSeed, nonce: String(nonce), hash };
  }

  return { generateCrashPoint };
})();

/* =========================================
   2. STATE MANAGER
   ========================================= */
const State = (() => {
  const PHASES = { WAITING: 'WAITING', RUNNING: 'RUNNING', CRASHED: 'CRASHED' };

  let state = {
    phase: PHASES.WAITING,
    multiplier: 1.00,
    crashPoint: 2.00,
    startTime: null,
    balance: 1000.00,
    bets: [
      { active: false, amount: 0, cashedOut: false, cashoutMult: 0 },
      { active: false, amount: 0, cashedOut: false, cashoutMult: 0 }
    ],
    history: [],
    fairness: { serverSeed: '', clientSeed: '', nonce: '', hash: '' },
    roundNum: 0,
  };

  function get()  { return state; }
  function getPhase() { return state.phase; }

  function setPhase(p) { state.phase = p; }
  function setMultiplier(m) { state.multiplier = m; }
  function setCrashInfo(info) {
    state.crashPoint = info.crash;
    state.fairness   = info;
  }
  function setStartTime(t) { state.startTime = t; }

  function resetBet(i) {
    state.bets[i] = { active: false, amount: 0, cashedOut: false, cashoutMult: 0 };
  }
  function placeBet(i, amount) {
    state.bets[i] = { active: true, amount, cashedOut: false, cashoutMult: 0 };
    state.balance -= amount;
  }
  function cashOut(i) {
    if (!state.bets[i].active || state.bets[i].cashedOut) return false;
    state.bets[i].cashedOut  = true;
    state.bets[i].cashoutMult = state.multiplier;
    const win = state.bets[i].amount * state.multiplier;
    state.balance += win;
    return win;
  }
  function settleCrash() {
    state.bets.forEach(b => { if (b.active && !b.cashedOut) b.amount = 0; });
    state.history.unshift(state.crashPoint);
    if (state.history.length > 20) state.history.pop();
    state.roundNum++;
  }

  return { PHASES, get, getPhase, setPhase, setMultiplier, setCrashInfo,
           setStartTime, resetBet, placeBet, cashOut, settleCrash };
})();

/* =========================================
   3. MULTIPLIER ENGINE
   ========================================= */
const MultiplierEngine = (() => {
  const GROWTH_RATE = 0.00006;

  function compute(elapsed) {
    return Math.max(1.00, Math.pow(Math.E, GROWTH_RATE * elapsed));
  }

  return { compute };
})();

/* =========================================
   4. CANVAS / ANIMATION CONTROLLER
   ========================================= */
const Renderer = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  // Spaceman state
  let spaceman = {
    x: 0, y: 0,
    scale: 1,
    phase: 'idle',
    flyElapsed: 0,
    angle: 0,
    crashed: false,
    trail: [],
    opacity: 1,
    helmetVisor: 0, // visor shine animation
    jetpackFlame: 0, // jetpack animation
  };

  let stars = [];
  let planets = [];
  let nebulas = [];
  let raf    = null;
  let lastTs = 0;

  function init() {
    resize();
    window.addEventListener('resize', resize);
    generateStars();
    generatePlanets();
    generateNebulas();
    resetSpaceman();
    loop(0);
  }

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    resetSpaceman();
  }

  function generateStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * (canvas.width || 800),
        y: Math.random() * (canvas.height || 400),
        r: Math.random() * 1.5 + 0.3,
        a: Math.random(),
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  function generatePlanets() {
    planets = [];
    const W = canvas.width || 800;
    const H = canvas.height || 400;
    // Add 2-3 planets in background
    for (let i = 0; i < 2; i++) {
      planets.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.3 + 20,
        r: Math.random() * 40 + 20,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1'][i % 3],
        alpha: 0.15 + Math.random() * 0.1,
      });
    }
  }

  function generateNebulas() {
    nebulas = [];
    const W = canvas.width || 800;
    const H = canvas.height || 400;
    for (let i = 0; i < 3; i++) {
      nebulas.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.6,
        r: Math.random() * 100 + 50,
        color: ['rgba(100, 50, 200,', 'rgba(50, 150, 200,', 'rgba(200, 100, 50,'][i % 3],
      });
    }
  }

  function resetSpaceman() {
    const W = canvas.width  || 800;
    const H = canvas.height || 400;
    spaceman.x       = W * 0.08;
    spaceman.y       = H * 0.75;
    spaceman.scale   = 1;
    spaceman.angle   = 0;
    spaceman.crashed = false;
    spaceman.phase   = 'idle';
    spaceman.trail   = [];
    spaceman.opacity = 1;
    spaceman.flyElapsed = 0;
    spaceman.helmetVisor = 0;
    spaceman.jetpackFlame = 0;
  }

  /* ---- DRAW SPACEMAN ---- */
  function drawSpaceman(x, y, scale, angle, crashed, elapsed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Jetpack flames
    if (!crashed && elapsed > 1200) {
      spaceman.jetpackFlame += 0.15;
      const flameLen = 20 + Math.sin(spaceman.jetpackFlame) * 8;
      const grad = ctx.createRadialGradient(-35, 10, 0, -35, 10, flameLen);
      grad.addColorStop(0, 'rgba(255, 150, 50, 0.9)');
      grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
      grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.beginPath();
      ctx.ellipse(-35, 10, 8, flameLen * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Shadow
    ctx.shadowColor = crashed ? '#FF1744' : '#00D4FF';
    ctx.shadowBlur  = crashed ? 30 : 20;

    // Body (astronaut suit)
    ctx.beginPath();
    ctx.ellipse(0, 5, 18, 25, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Helmet
    ctx.beginPath();
    ctx.arc(0, -22, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#F0F0F0';
    ctx.fill();
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Visor
    ctx.beginPath();
    ctx.arc(0, -22, 12, 0.2, Math.PI - 0.2);
    const visorGrad = ctx.createLinearGradient(-10, -30, 10, -15);
    visorGrad.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
    visorGrad.addColorStop(1, 'rgba(0, 100, 200, 0.9)');
    ctx.fillStyle = visorGrad;
    ctx.fill();

    // Visor shine
    spaceman.helmetVisor += 0.02;
    const shineX = Math.sin(spaceman.helmetVisor) * 6;
    ctx.beginPath();
    ctx.arc(shineX, -26, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    // Backpack / Jetpack
    ctx.beginPath();
    ctx.rect(-22, -5, 10, 20);
    ctx.fillStyle = '#D0D0D0';
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Jetpack nozzles
    ctx.beginPath();
    ctx.ellipse(-20, 18, 4, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-25, 18, 4, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();

    // Arms
    ctx.beginPath();
    ctx.moveTo(-18, -5);
    ctx.lineTo(-30, 5);    ctx.lineTo(-28, 8);
    ctx.lineTo(-15, 0);
    ctx.closePath();
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, -5);    ctx.lineTo(30, 5);    ctx.lineTo(28, 8);
    ctx.lineTo(15, 0);
    ctx.closePath();
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(-8, 28);    ctx.lineTo(-12, 45);    ctx.lineTo(-10, 47);
    ctx.lineTo(-6, 30);
    ctx.closePath();
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 28);    ctx.lineTo(12, 45);    ctx.lineTo(10, 47);
    ctx.lineTo(6, 30);
    ctx.closePath();
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.stroke();

    // Boots
    ctx.beginPath();
    ctx.ellipse(-11, 48, 5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, 48, 5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();

    // Chest panel
    ctx.beginPath();
    ctx.roundRect(-8, -5, 16, 12, 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chest light
    ctx.beginPath();
    ctx.arc(0, 1, 3, 0, Math.PI * 2);
    const lightGrad = ctx.createRadialGradient(0, 1, 0, 0, 1, 3);
    lightGrad.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
    lightGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = lightGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---- TRAIL (oxygen bubbles) ---- */
  function drawTrail() {
    if (spaceman.trail.length < 2) return;
    for (let i = 1; i < spaceman.trail.length; i++) {
      const t   = i / spaceman.trail.length;
      const pt0 = spaceman.trail[i - 1];
      const pt1 = spaceman.trail[i];
      ctx.beginPath();
      ctx.arc(pt1.x, pt1.y, 3 * t, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${t * 0.3})`;
      ctx.fill();
    }
  }

  /* ---- BACKGROUND ---- */
  function drawBG(ts) {
    const W = canvas.width, H = canvas.height;

    // Space gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   '#050510');
    sky.addColorStop(0.5, '#0A0A2A');
    sky.addColorStop(1,   '#0A0A0A');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Nebulas
    nebulas.forEach(n => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.color + '0.08)');
      grad.addColorStop(1, n.color + '0)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Planets
    planets.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Stars (with twinkle)
    stars.forEach(s => {
      const twinkle = Math.sin(ts * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.a * twinkle})`;
      ctx.fill();
    });
  }

  /* ---- MULTIPLIER GRAPH LINE ---- */
  let graphPoints = [];

  function resetGraph() { graphPoints = []; }

  function addGraphPoint(x, y) {
    graphPoints.push({ x, y });
    if (graphPoints.length > 300) graphPoints.shift();
  }

  function drawGraph() {
    if (graphPoints.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(graphPoints[0].x, graphPoints[0].y);
    for (let i = 1; i < graphPoints.length; i++) {
      ctx.lineTo(graphPoints[i].x, graphPoints[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00D4FF';
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  /* ---- MAIN LOOP ---- */
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = ts - lastTs;
    lastTs   = ts;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawBG(ts);
    drawGraph();
    drawTrail();

    const st = State.get();

    if (st.phase === State.PHASES.WAITING) {
      spaceman.x = W * 0.12;
      spaceman.y = H * 0.7;
      spaceman.angle = 0;
      spaceman.scale = 1;
      spaceman.trail = [];
      ctx.globalAlpha = 1;
      drawSpaceman(spaceman.x, spaceman.y, spaceman.scale, spaceman.angle, false, 0);

    } else if (st.phase === State.PHASES.RUNNING) {
      spaceman.flyElapsed += dt;
      const t = spaceman.flyElapsed / 1000;

      const TAXI_DUR   = 1000;
      const LIFTOFF_DUR = 2000;

      if (spaceman.flyElapsed < TAXI_DUR) {
        const p  = spaceman.flyElapsed / TAXI_DUR;
        const ep = p * p;
        spaceman.x  = W * 0.12 + ep * (W * 0.35);
        spaceman.y  = H * 0.7;
        spaceman.angle = 0;
        spaceman.scale = 1;
        spaceman.y += Math.sin(spaceman.flyElapsed * 0.05) * 2;

      } else if (spaceman.flyElapsed < LIFTOFF_DUR) {
        const p  = (spaceman.flyElapsed - TAXI_DUR) / (LIFTOFF_DUR - TAXI_DUR);
        const ep = p * p;
        spaceman.x  = W * 0.47 + ep * W * 0.23;
        spaceman.y  = H * 0.7 - ep * H * 0.4;
        spaceman.angle = -ep * 0.4;
        spaceman.scale = 1 - ep * 0.15;

      } else {
        const p2 = (spaceman.flyElapsed - LIFTOFF_DUR) / 1000;
        spaceman.x  = W * 0.70 + p2 * 15;
        spaceman.y  = H * 0.3 - p2 * 10;
        spaceman.angle = -0.4 - p2 * 0.01;
        spaceman.scale = Math.max(0.3, 0.85 - p2 * 0.03);
        spaceman.y    += Math.sin(spaceman.flyElapsed * 0.003) * 3;

        spaceman.x = Math.min(spaceman.x, W * 0.88);
        spaceman.y = Math.max(spaceman.y, H * 0.06);
      }

      // Add trail point
      const tx = spaceman.x - Math.cos(spaceman.angle) * 35 * spaceman.scale;
      const ty = spaceman.y - Math.sin(spaceman.angle) * 35 * spaceman.scale;
      spaceman.trail.push({ x: tx, y: ty });
      if (spaceman.trail.length > 30) spaceman.trail.shift();

      // Graph point
      const gx = W * 0.08 + (spaceman.flyElapsed / 12000) * W * 0.85;
      const gy = H * 0.85 - (st.multiplier - 1) * H * 0.07;
      addGraphPoint(Math.min(gx, W * 0.92), Math.max(gy, H * 0.08));

      ctx.globalAlpha = 1;
      drawSpaceman(spaceman.x, spaceman.y, spaceman.scale, spaceman.angle, false, spaceman.flyElapsed);

    } else if (st.phase === State.PHASES.CRASHED) {
      spaceman.trail = [];
      ctx.globalAlpha = spaceman.opacity;
      drawSpaceman(spaceman.x, spaceman.y, spaceman.scale, spaceman.angle, true, spaceman.flyElapsed);
      spaceman.opacity = Math.max(0, spaceman.opacity - 0.008);
    }

    ctx.globalAlpha = 1;
  }

  function startFlight() {
    spaceman.flyElapsed = 0;
    spaceman.opacity    = 1;
    resetGraph();
  }

  function triggerCrash() {
    spaceman.crashed = true;
  }

  return { init, startFlight, triggerCrash, resetSpaceman };
})();

/* =========================================
   5. FAKE PLAYERS SIMULATION
   ========================================= */
const FakePlayers = (() => {
  const NAMES = [
    'astro_ninja','cosmo_walker','nebula_x','star_chaser','orbit_master',
    'lunar_echo','solar_flare','galaxy_hunter','meteor_man','void_rider',
    'comet_tail','pulsar_99','quasar_wave','super_nova','dark_matter'
  ];

  let players  = [];

  function init(crashPoint) {
    players = NAMES.map(n => ({
      name: n,
      bet:  Math.floor(Math.random() * 95 + 5),
      cashAt: Math.random() < 0.65
        ? parseFloat((Math.random() * (crashPoint - 1.1) + 1.1).toFixed(2))
        : null,
      cashedOut: false,
      lost:      false,
    }));
    updateLeaderboard();
  }

  function tick(multiplier, crashPoint) {
    players.forEach(p => {
      if (p.cashedOut || p.lost) return;
      if (p.cashAt && multiplier >= p.cashAt) {
        p.cashedOut = true;
        p.winAmt    = p.bet * p.cashAt;
        UI.showCashoutTicker(p.name, p.cashAt, p.winAmt);
        updateLeaderboard();
      }
    });
  }

  function settleCrash() {
    players.forEach(p => { if (!p.cashedOut) p.lost = true; });
    updateLeaderboard();
  }

  function updateLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    players.forEach(p => {
      const row  = document.createElement('div');
      row.className = 'lb-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'lb-name';
      nameEl.textContent = p.name;
      const valEl  = document.createElement('span');
      valEl.className = 'lb-cashout' + (p.lost ? ' lost' : '');
      valEl.textContent = p.cashedOut
        ? `+${CB.sym()}${p.winAmt.toFixed(2)} @ ${p.cashAt}x`
        : p.lost
          ? `LOST ${CB.sym()}${p.bet}`
          : `${CB.sym()}${p.bet} bet`;
      row.appendChild(nameEl);
      row.appendChild(valEl);
      list.appendChild(row);
    });
  }

  return { init, tick, settleCrash };
})();

/* =========================================
   6. UI HANDLER
   ========================================= */
const UI = (() => {
  const multEl     = document.getElementById('multiplierDisplay');
  const phaseEl    = document.getElementById('gamePhase');
  const countWrap  = document.getElementById('countdownWrap');
  const countVal   = document.getElementById('countdownVal');
  const crashOver  = document.getElementById('crashOverlay');
  const crashMult  = document.getElementById('crashMult');
  const balanceEl  = document.getElementById('balanceDisplay');
  const histList   = document.getElementById('historyList');
  const ticker     = document.getElementById('cashoutTicker');

  function updateMultiplier(m) {
    multEl.textContent = m.toFixed(2) + 'x';
    multEl.className   = 'multiplier-val';
  }

  function setPhaseText(text) {
    phaseEl.textContent = text;
  }

  function showCountdown(sec) {
    countWrap.classList.add('visible');
    countVal.textContent = sec;
    document.getElementById('multiplierWrap').style.opacity = '0.15';
  }

  function hideCountdown() {
    countWrap.classList.remove('visible');
    document.getElementById('multiplierWrap').style.opacity = '1';
  }

  function showCrash(crashPt) {
    multEl.className    = 'multiplier-val crashed';
    multEl.textContent  = crashPt.toFixed(2) + 'x';
    crashOver.classList.add('visible');
    crashMult.textContent = 'Crashed @ ' + crashPt.toFixed(2) + 'x';
    setTimeout(() => crashOver.classList.remove('visible'), 2000);
  }

  function updateBalance(bal) {
    balanceEl.textContent = CB.sym() + bal.toFixed(2);
  }

  function updateHistory(history) {
    histList.innerHTML = '';
    history.forEach(v => {
      const badge = document.createElement('div');
      badge.className = 'history-badge ' + (v < 2 ? 'badge-low' : v < 5 ? 'badge-mid' : 'badge-high');
      badge.textContent = v.toFixed(2) + 'x';
      histList.appendChild(badge);
    });
  }

  function showCashoutTicker(name, mult, win) {
    const item = document.createElement('div');
    item.className   = 'ticker-item';
    item.textContent = `${name} cashed out @ ${mult.toFixed(2)}x (+${CB.sym()}${win.toFixed(2)})`;
    ticker.prepend(item);
    setTimeout(() => item.remove(), 3500);
  }

  function setBetBtn(idx, mode) {
    const btn = document.getElementById(`betBtn${idx + 1}`);
    if (mode === 'bet') {
      btn.textContent = 'BET';
      btn.className   = 'btn-bet';
      btn.disabled    = false;
    } else if (mode === 'cashout') {
      btn.textContent = 'CASH OUT';
      btn.className   = 'btn-bet cashout-mode';
      btn.disabled    = false;
    } else {
      btn.textContent = 'BET';
      btn.className   = 'btn-bet';
      btn.disabled    = true;
    }
  }

  function setBetStatus(idx, text, color) {
    const el = document.getElementById(`betStatus${idx + 1}`);
    el.textContent = text;
    el.style.color = color || '#00E676';
  }

  function updateFairnessModal(info, crashPt, revealed) {
    document.getElementById('serverSeedDisplay').textContent  = info.serverSeed || '---';
    document.getElementById('clientSeedDisplay').textContent  = info.clientSeed || '---';
    document.getElementById('nonceDisplay').textContent       = info.nonce      || '---';
    document.getElementById('hashDisplay').textContent        = info.hash       || '---';
    document.getElementById('crashPointDisplay').textContent  = revealed ? crashPt.toFixed(2) + 'x' : 'Revealed after round';
  }

  return {
    updateMultiplier, setPhaseText, showCountdown, hideCountdown,
    showCrash, updateBalance, updateHistory, showCashoutTicker,
    setBetBtn, setBetStatus, updateFairnessModal
  };
})();

/* =========================================
   7. GAME LOOP / ORCHESTRATOR
   ========================================= */
const Game = (() => {
  let countdownInterval = null;
  let rafId             = null;
  let gameStartTs       = null;

  async function startWaiting() {
    State.setPhase(State.PHASES.WAITING);
    State.setMultiplier(1.00);

    const info = await RNG.generateCrashPoint();
    State.setCrashInfo(info);
    UI.updateFairnessModal(info, info.crash, false);
    FakePlayers.init(info.crash);

    UI.updateMultiplier(1.00);
    UI.setPhaseText('WAITING FOR NEXT ROUND…');
    Renderer.resetSpaceman();

    [0, 1].forEach(i => {
      const bet = State.get().bets[i];
      if (!bet.active) {
        UI.setBetBtn(i, 'bet');
        UI.setBetStatus(i, '');
      }
    });

    UI.updateBalance(State.get().balance);

    let sec = 6;
    UI.showCountdown(sec);
    countdownInterval = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(countdownInterval);
        UI.hideCountdown();
        startRunning();
      } else {
        document.getElementById('countdownVal').textContent = sec;
      }
    }, 1000);
  }

  function startRunning() {
    State.setPhase(State.PHASES.RUNNING);
    UI.setPhaseText('FLOATING…');
    gameStartTs = performance.now();
    State.setStartTime(gameStartTs);
    Renderer.startFlight();

    [0, 1].forEach(i => {
      const bet = State.get().bets[i];
      if (bet.active) {
        UI.setBetBtn(i, 'cashout');
        UI.setBetStatus(i, `BET: ${CB.sym()}${bet.amount.toFixed(2)}`, '#FFD166');
      } else {
        UI.setBetBtn(i, 'disabled');
      }
    });

    rafId = requestAnimationFrame(runningLoop);
  }

  function runningLoop(ts) {
    const elapsed    = ts - gameStartTs;
    const multiplier = MultiplierEngine.compute(elapsed);
    State.setMultiplier(multiplier);
    UI.updateMultiplier(multiplier);

    FakePlayers.tick(multiplier, State.get().crashPoint);

    [0, 1].forEach(i => {
      const bet    = State.get().bets[i];
      const acEl   = document.getElementById(`autoCashout${i + 1}`);
      const acValEl= document.getElementById(`autoCashoutVal${i + 1}`);
      if (bet.active && !bet.cashedOut && acEl.checked) {
        const target = parseFloat(acValEl.value);
        if (multiplier >= target) doCashout(i);
      }
    });

    if (multiplier >= State.get().crashPoint) {
      doCrash();
      return;
    }

    rafId = requestAnimationFrame(runningLoop);
  }

  function doCashout(i) {
    const win = State.cashOut(i);
    if (win === false) return;
    const mult = State.get().bets[i].cashoutMult;
    UI.setBetBtn(i, 'disabled');
    UI.setBetStatus(i, `✓ Won ${CB.sym()}${win.toFixed(2)} @ ${mult.toFixed(2)}x`, '#00E676');
    UI.updateBalance(State.get().balance);
    UI.showCashoutTicker('YOU', mult, win);
  }

  function doCrash() {
    cancelAnimationFrame(rafId);
    State.setPhase(State.PHASES.CRASHED);

    const crashPt = State.get().crashPoint;
    State.setMultiplier(crashPt);
    UI.updateMultiplier(crashPt);
    UI.setPhaseText('CRASHED');
    UI.showCrash(crashPt);
    UI.updateFairnessModal(State.get().fairness, crashPt, true);

    Renderer.triggerCrash();
    FakePlayers.settleCrash();
    State.settleCrash();
    UI.updateHistory(State.get().history);
    UI.updateBalance(State.get().balance);

    [0, 1].forEach(i => {
      const bet = State.get().bets[i];
      if (bet.active && !bet.cashedOut) {
        UI.setBetBtn(i, 'disabled');
        UI.setBetStatus(i, `✗ Lost ${CB.sym()}${bet.amount.toFixed(2)}`, '#E8003D');
      }
      State.resetBet(i);
    });

    setTimeout(startWaiting, 4000);
  }

  function wireEvents() {
    [1, 2].forEach(n => {
      document.getElementById(`betBtn${n}`).addEventListener('click', () => {
        const i   = n - 1;
        const bet = State.get().bets[i];

        if (State.getPhase() === State.PHASES.RUNNING && bet.active && !bet.cashedOut) {
          doCashout(i);
          return;
        }

        if (State.getPhase() !== State.PHASES.WAITING) return;

        const amtEl = document.getElementById(`betAmt${n}`);
        const amt   = parseFloat(amtEl.value);

        { const _c = CB.checkStake(amt); if (!_c.ok) { alert(_c.reason); return; } }
        if (amt > State.get().balance) { alert('Insufficient balance'); return; }
        if (bet.active) {
          State.resetBet(i);
          State.get().balance += amt;
          UI.setBetBtn(i, 'bet');
          UI.setBetStatus(i, '');
          UI.updateBalance(State.get().balance);
          return;
        }

        State.placeBet(i, amt);
        UI.setBetBtn(i, 'bet');
        UI.setBetStatus(i, `Bet placed: ${CB.sym()}${amt.toFixed(2)}`, '#FFD166');
        UI.updateBalance(State.get().balance);
        document.getElementById(`betBtn${n}`).textContent = 'CANCEL';
      });

      document.querySelectorAll(`.btn-quick[data-bet="${n}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          if (State.getPhase() !== State.PHASES.WAITING) return;
          document.getElementById(`betAmt${n}`).value = btn.dataset.val;
        });
      });

      document.querySelectorAll(`.btn-adj[data-bet="${n}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const inp = document.getElementById(`betAmt${n}`);
          let v = parseFloat(inp.value) || 10;
          if (btn.dataset.action === 'half')   v = Math.max(1, v / 2);
          if (btn.dataset.action === 'double') v = Math.min(1000, v * 2);
          inp.value = Math.round(v);
        });
      });
    });

    document.getElementById('btnFairness').addEventListener('click', () => {
      document.getElementById('modalBackdrop').classList.add('visible');
    });
    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('modalBackdrop').classList.remove('visible');
    });
    document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('modalBackdrop'))
        document.getElementById('modalBackdrop').classList.remove('visible');
    });
  }

  function start() {
    wireEvents();
    Renderer.init();
    startWaiting();
  }

  return { start };
})();

/* =========================================
   BOOT
   ========================================= */
window.addEventListener('DOMContentLoaded', () => Game.start());
