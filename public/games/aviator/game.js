'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
  BASE:            'https://speedbetbackend-production.up.railway.app',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'aviator',
  RECONNECT_DELAY: 3000,
  COUNTDOWN_SECS:  6,
};

/* ============================================================
   SPEEDBET API SERVICE
   Mirrors your TypeScript api.ts — vanilla JS, same endpoints,
   same token key, same data-unwrap logic.
   ============================================================ */
const SpeedBetAPI = (() => {

  // ── Token helpers ──────────────────────────────────────────
  const TOKEN_KEY = 'skybet_token';
  const USER_KEY  = 'skybet_user';

  const getToken = () => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  };
  const setToken = t => {
    if (!t || t === 'undefined') { console.error('[api] setToken invalid:', t); return; }
    localStorage.setItem(TOKEN_KEY, t);
  };
  const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
  const getUser    = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser    = u  => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const isAuthed   = () => !!getToken();

  // ── Core fetch ─────────────────────────────────────────────
  // Mirrors your req<T> — unwraps { data: T } or returns root
  async function _req(path, options = {}, auth = false, retrying = false) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else       console.warn(`[api] auth=true but no token for ${path}`);
    }
    let res;
    try {
      res = await fetch(CONFIG.BASE + path, { ...options, headers });
    } catch (e) {
      throw new Error('NETWORK_ERROR');
    }

    // 401 → try refresh once
    if (res.status === 401 && !retrying) {
      const refreshed = await _silentRefresh();
      if (refreshed) return _req(path, options, auth, true);
      throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try { const err = await res.json(); message = err.message ?? err.error ?? message; } catch { /**/ }
      throw new Error(message);
    }

    const json = await res.json();
    return json?.data !== undefined ? json.data : json;
  }

  async function _silentRefresh() {
    try {
      const res = await fetch(CONFIG.BASE + '/api/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      });
      if (!res.ok) throw new Error('refresh_failed');
      const json = await res.json();
      const data = json?.data ?? json;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return true;
    } catch {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return false;
    }
  }

  const _get   = (path, auth = false)        => _req(path, { method: 'GET' }, auth);
  const _post  = (path, body, auth = false)  => _req(path, { method: 'POST',  body: JSON.stringify(body) }, auth);
  const _patch = (path, body, auth = false)  => _req(path, { method: 'PATCH', body: JSON.stringify(body) }, auth);

  // ── AUTH endpoints ─────────────────────────────────────────
  const auth = {
    login: async (email, password) => {
      const data = await _post('/api/auth/login', { email, password });
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    register: async payload => {
      const data = await _post('/api/auth/register', payload);
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    demoLogin: async (role = 'USER') => {
      const data = await _post('/api/auth/demo-login', { role });
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    refresh: async () => {
      const data = await _post('/api/auth/refresh', undefined, true);
      setToken(data.accessToken);
      return data;
    },
    logout: async () => {
      try { await _post('/api/auth/logout', undefined, true); } finally { clearToken(); }
    },
  };

  // ── WALLET endpoints ───────────────────────────────────────
  const wallet = {
    get:          ()        => _get('/api/wallet', true),
    transactions: (p=0,s=20)=> _get(`/api/wallet/transactions?page=${p}&size=${s}`, true),
    withdraw:     payload   => _post('/api/wallet/withdraw', payload, true),
  };

  // ── GAMES endpoints ────────────────────────────────────────
  // Matches your games.* from api.ts exactly
  const games = {
    currentRound: game          => _get(`/api/games/${game}/current-round`, true),
    history:      (limit = 20)  => _get(`/api/games/history?limit=${limit}`, true),
    play:         (game, payload) => _post(`/api/games/${game}/play`, payload, true),
    cashout:      (game, payload) => _post(`/api/games/${game}/cashout`, payload, true),
  };

  // ── USER endpoint ──────────────────────────────────────────
  const user = {
    me:     ()      => _get('/api/users/me', true),
    update: payload => _patch('/api/users/me', payload, true),
  };

  return {
    getToken, setToken, clearToken, getUser, setUser, isAuthed,
    auth, wallet, games, user,
  };
})();

/* ============================================================
   WEBSOCKET BUS  — STOMP over SockJS, auto-reconnect
   ============================================================ */
const WSBus = (() => {
  let client = null, connected = false;
  const pending = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded');
      return;
    }
    if (!SpeedBetAPI.isAuthed()) return;

    const socket = new SockJS(CONFIG.BASE + CONFIG.WS_ENDPOINT);
    client       = Stomp.over(socket);
    client.debug = () => {};

    const wsHeaders = SpeedBetAPI.getToken()
      ? { Authorization: `Bearer ${SpeedBetAPI.getToken()}` } : {};

    client.connect(wsHeaders, () => {
      connected = true;
      Object.entries(pending).forEach(([topic, cb]) => client.subscribe(topic, cb));
      if (onReady) onReady();
    }, () => {
      connected = false;
      if (SpeedBetAPI.isAuthed())
        setTimeout(() => connect(onReady), CONFIG.RECONNECT_DELAY);
    });
  }

  function subscribe(topic, callback) {
    pending[topic] = callback;
    if (connected && client) client.subscribe(topic, callback);
  }

  function disconnect() {
    try { if (client && connected) client.disconnect(); } catch { /**/ }
    client = null; connected = false;
  }

  function reconnect(onReady) { disconnect(); connect(onReady); }

  return { connect, subscribe, disconnect, reconnect };
})();

/* ============================================================
   WALLET MANAGER  — local optimistic balance + server sync
   ============================================================ */
const Wallet = (() => {
  let _balance = 1000.00;

  async function fetch() {
    if (!SpeedBetAPI.isAuthed()) return;
    try {
      const data = await SpeedBetAPI.wallet.get();
      // your WalletDto uses "balance" field
      _balance = parseFloat(data.balance ?? data.amount ?? _balance);
      UI.updateBalance(_balance);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
        console.warn('[Wallet] fetch:', e.message);
    }
  }

  function subscribeWS() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data = JSON.parse(msg.body);
        _balance = parseFloat(data.balance ?? data.amount ?? _balance);
        UI.updateBalance(_balance);
      } catch { /**/ }
    });
  }

  const get    = ()  => _balance;
  const set    = v   => { _balance = parseFloat(v); };
  const deduct = amt => { _balance = Math.max(0, parseFloat((_balance - amt).toFixed(2))); };
  const credit = amt => { _balance = parseFloat((_balance + parseFloat(amt)).toFixed(2)); };

  return { fetch, subscribeWS, get, set, deduct, credit };
})();

/* ============================================================
   CRASH ROUND MANAGER
   Wraps SpeedBetAPI.games.* with per-panel round-id tracking.
   ============================================================ */
const CrashRound = (() => {
  const _roundIds  = [null, null];  // one id per bet panel
  const _cashedOut = [false, false];

  // GET /api/games/{slug}/current-round
  async function fetchCurrentRound(slug) {
    if (!SpeedBetAPI.isAuthed()) return null;
    try {
      return await SpeedBetAPI.games.currentRound(slug);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
        console.warn('[CrashRound] fetchCurrentRound:', e.message);
      return null;
    }
  }

  // POST /api/games/{slug}/play  { stake }  → GameRound
  // Returns the full GameRound object; we store .id for cashout
  async function placeBet(slug, panelIndex, stake) {
    // Country stake floor/ceiling — single source of truth is the
    // SkyBet bridge, which carries the value the user's registered
    // country defines. Reject before we spend a network round-trip.
    { const _c = CB.checkStake(stake); if (!_c.ok) { try { UI.setBetStatus && UI.setBetStatus(0, _c.reason, '#e63946'); } catch (e) {} throw new Error(_c.reason); } }

    const data = await SpeedBetAPI.games.play(slug, { stake });
    _roundIds[panelIndex]  = data.id;
    _cashedOut[panelIndex] = false;
    return data;
  }

  // POST /api/games/{slug}/cashout  { roundId, cashoutAt }  → { status, multiplier, payout }
  async function cashout(slug, multiplier, panelIndex) {
    const roundId = _roundIds[panelIndex];
    if (_cashedOut[panelIndex] || !roundId) return null;
    const data = await SpeedBetAPI.games.cashout(slug, {
      roundId,
      cashoutAt: multiplier,
    });
    _cashedOut[panelIndex] = true;
    return data;
  }

  // Subscribe to server-authoritative state pushes
  function subscribeToState(slug, onTick, onCrash) {
    WSBus.subscribe(`/topic/${slug}/state`, msg => {
      try {
        const payload = JSON.parse(msg.body);
        if (payload.state === 'RUNNING')
          onTick(parseFloat(payload.multiplier), payload.roundNumber);
        else if (payload.state === 'CRASHED')
          onCrash(payload);
      } catch { /**/ }
    });
  }

  function reset(panelIndex) {
    if (panelIndex === undefined) {
      _roundIds[0] = _roundIds[1] = null;
      _cashedOut[0] = _cashedOut[1] = false;
    } else {
      _roundIds[panelIndex]  = null;
      _cashedOut[panelIndex] = false;
    }
  }

  const getRoundId  = i => _roundIds[i];
  const isCashedOut = i => _cashedOut[i];

  return { fetchCurrentRound, placeBet, cashout, subscribeToState, reset, getRoundId, isCashedOut };
})();

/* ============================================================
   RNG  — local provably-fair generator (offline / demo)
   Server crash point overrides this when authenticated.
   ============================================================ */
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
    const num        = parseInt(hash.substring(0, 8), 16);
    const random     = num / 0xffffffff;
    const crash      = Math.max(1.00, Math.min(1000, Math.floor((1 / (1 - random)) * 100) / 100));
    return { crash, serverSeed, clientSeed, nonce: String(nonce), hash };
  }

  return { generateCrashPoint };
})();

/* ============================================================
   STATE MANAGER
   ============================================================ */
const State = (() => {
  const PHASES = { WAITING:'WAITING', RUNNING:'RUNNING', CRASHED:'CRASHED', PAUSED:'PAUSED' };

  let s = {
    phase:      PHASES.WAITING,
    multiplier: 1.00,
    crashPoint: 2.00,
    startTime:  null,
    history:    [],
    fairness:   { serverSeed:'', clientSeed:'', nonce:'', hash:'' },
    roundNum:   0,
    bets: [
      { active:false, amount:0, cashedOut:false, cashoutMult:0 },
      { active:false, amount:0, cashedOut:false, cashoutMult:0 },
    ],
  };

  const get           = ()   => s;
  const getPhase      = ()   => s.phase;
  const setPhase      = p    => { s.phase = p; };
  const setMultiplier = m    => { s.multiplier = m; };
  const setCrashInfo  = info => { s.crashPoint = info.crash; s.fairness = { ...s.fairness, ...info }; };
  const setStartTime  = t    => { s.startTime = t; };
  const resetBet      = i    => { s.bets[i] = { active:false, amount:0, cashedOut:false, cashoutMult:0 }; };

  const placeBet = (i, amount) => {
    s.bets[i] = { active:true, amount, cashedOut:false, cashoutMult:0 };
    Wallet.deduct(amount);
  };

  const cashOut = i => {
    if (!s.bets[i].active || s.bets[i].cashedOut) return false;
    s.bets[i].cashedOut   = true;
    s.bets[i].cashoutMult = s.multiplier;
    const win = parseFloat((s.bets[i].amount * s.multiplier).toFixed(2));
    Wallet.credit(win);
    return win;
  };

  const settleCrash = () => {
    s.bets.forEach(b => { if (b.active && !b.cashedOut) b.amount = 0; });
    s.history.unshift(s.crashPoint);
    if (s.history.length > 20) s.history.pop();
    s.roundNum++;
  };

  return { PHASES, get, getPhase, setPhase, setMultiplier, setCrashInfo, setStartTime, resetBet, placeBet, cashOut, settleCrash };
})();

/* ============================================================
   MULTIPLIER ENGINE
   ============================================================ */
const MultiplierEngine = (() => {
  const GROWTH_RATE = 0.00006;
  const compute = elapsed => Math.max(1.00, Math.pow(Math.E, GROWTH_RATE * elapsed));
  return { compute };
})();

/* ============================================================
   CANVAS RENDERER
   ============================================================ */
const Renderer = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  let plane       = { x:0, y:0, runwayY:0, scale:1, angle:0, crashed:false, flyElapsed:0, trail:[], opacity:1 };
  let clouds      = [], stars = [], graphPoints = [], lastTs = 0;

  function init() {
    resize();
    window.addEventListener('resize', resize);
    _generateStars(); _generateClouds(); resetPlane();
    requestAnimationFrame(_loop);
  }

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    _generateStars(); resetPlane();
  }

  function _generateStars() {
    stars = [];
    for (let i = 0; i < 120; i++)
      stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height*0.7,
                   r: Math.random()*1.2+0.2, a: Math.random() });
  }

  function _generateClouds() {
    clouds = [];
    for (let i = 0; i < 6; i++) clouds.push(_newCloud(true));
  }

  function _newCloud(randomX) {
    return { x: randomX ? Math.random()*canvas.width : canvas.width+120,
             y: Math.random()*canvas.height*0.55+20,
             w: Math.random()*110+60, h: Math.random()*35+18,
             speed: Math.random()*0.25+0.1, alpha: Math.random()*0.12+0.04 };
  }

  function resetPlane() {
    const W = canvas.width||800, H = canvas.height||400;
    Object.assign(plane, { x:W*0.05, y:H*0.82, runwayY:H*0.82, scale:1, angle:0,
                            crashed:false, flyElapsed:0, trail:[], opacity:1 });
  }

  function _drawPlane(x, y, scale, angle, crashed) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
    ctx.shadowColor = crashed ? '#e63946' : '#ff0000';
    ctx.shadowBlur  = crashed ? 30 : 18;

    // Body
    ctx.beginPath(); ctx.moveTo(55,0); ctx.lineTo(-35,-10); ctx.lineTo(-45,0); ctx.lineTo(-35,10); ctx.closePath();
    ctx.fillStyle='#1a1a1a'; ctx.fill(); ctx.strokeStyle='#e63946'; ctx.lineWidth=1.5; ctx.stroke();
    // Red stripe
    ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(-35,-6); ctx.lineTo(-35,6); ctx.closePath();
    ctx.fillStyle='#e63946'; ctx.fill();
    // Cockpit
    ctx.beginPath(); ctx.ellipse(22,-4,9,6,0.15,0,Math.PI*2);
    ctx.fillStyle='rgba(200,30,30,0.5)'; ctx.fill(); ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=1; ctx.stroke();
    // Wing
    ctx.beginPath(); ctx.moveTo(10,-2); ctx.lineTo(-8,-36); ctx.lineTo(-28,-36); ctx.lineTo(-18,-2); ctx.closePath();
    ctx.fillStyle='#111'; ctx.strokeStyle='#e63946'; ctx.lineWidth=1; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5,-2); ctx.lineTo(-10,-28); ctx.lineTo(-16,-28); ctx.lineTo(-12,-2); ctx.closePath();
    ctx.fillStyle='rgba(230,57,70,0.6)'; ctx.fill();
    // Tail
    ctx.beginPath(); ctx.moveTo(-28,0); ctx.lineTo(-45,-20); ctx.lineTo(-45,0); ctx.closePath();
    ctx.fillStyle='#e63946'; ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=1; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-32,0); ctx.lineTo(-45,-14); ctx.lineTo(-50,-14); ctx.lineTo(-42,0); ctx.closePath();
    ctx.fillStyle='#111'; ctx.strokeStyle='#e63946'; ctx.lineWidth=1; ctx.fill(); ctx.stroke();
    // Engine glow
    if (!crashed) {
      const g = ctx.createRadialGradient(-48,0,0,-48,0,18);
      g.addColorStop(0,'rgba(255,100,50,0.9)'); g.addColorStop(0.5,'rgba(230,57,70,0.4)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(-48,0,18,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
    ctx.shadowBlur=0; ctx.restore();
  }

  function _drawTrail() {
    for (let i = 1; i < plane.trail.length; i++) {
      const t = i/plane.trail.length;
      ctx.beginPath(); ctx.moveTo(plane.trail[i-1].x,plane.trail[i-1].y);
      ctx.lineTo(plane.trail[i].x,plane.trail[i].y);
      ctx.strokeStyle=`rgba(230,57,70,${t*0.45})`; ctx.lineWidth=t*4; ctx.stroke();
    }
  }

  function _drawRunway() {
    const H=canvas.height, W=canvas.width, ry=plane.runwayY;
    ctx.fillStyle='rgba(40,44,55,0.8)'; ctx.fillRect(0,ry+12,W,H-ry-12);
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,ry+13); ctx.lineTo(W,ry+13); ctx.stroke();
    ctx.setLineDash([24,16]); ctx.strokeStyle='rgba(255,200,0,0.2)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,ry+22); ctx.lineTo(W,ry+22); ctx.stroke();
    ctx.setLineDash([]);
  }

  function _drawBG() {
    const W=canvas.width, H=canvas.height;
    const sky=ctx.createLinearGradient(0,0,0,H*0.85);
    sky.addColorStop(0,'#070a18'); sky.addColorStop(0.5,'#0d1a2e'); sky.addColorStop(1,'#111828');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${s.a})`; ctx.fill(); });
  }

  function _drawClouds(dt) {
    clouds.forEach(c => {
      ctx.save(); ctx.globalAlpha=c.alpha;
      ctx.beginPath(); ctx.ellipse(c.x,c.y,c.w,c.h,0,0,Math.PI*2);
      ctx.fillStyle='#c0ccdd'; ctx.fill(); ctx.restore();
      if (State.getPhase()===State.PHASES.RUNNING) {
        c.x -= c.speed*dt*0.05;
        if (c.x+c.w<0) Object.assign(c,_newCloud(false));
      }
    });
  }

  let _graphPoints = [];
  function _resetGraph() { _graphPoints = []; }
  function _addGraphPoint(x,y) { _graphPoints.push({x,y}); if(_graphPoints.length>300) _graphPoints.shift(); }
  function _drawGraph() {
    if (_graphPoints.length < 2) return;
    ctx.save(); ctx.beginPath();
    ctx.moveTo(_graphPoints[0].x, _graphPoints[0].y);
    for (let i=1; i<_graphPoints.length; i++) ctx.lineTo(_graphPoints[i].x, _graphPoints[i].y);
    ctx.strokeStyle='rgba(230,57,70,0.5)'; ctx.lineWidth=2;
    ctx.shadowColor='#e63946'; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
  }

  function _loop(ts) {
    requestAnimationFrame(_loop);
    const dt=ts-lastTs; lastTs=ts;
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    _drawBG(); _drawClouds(dt); _drawRunway(); _drawGraph(); _drawTrail();

    const st = State.get();

    if (st.phase===State.PHASES.WAITING || st.phase===State.PHASES.PAUSED) {
      plane.x=W*0.12; plane.y=plane.runwayY; plane.angle=0; plane.scale=1; plane.trail=[];
      ctx.globalAlpha=1; _drawPlane(plane.x,plane.y,plane.scale,plane.angle,false);

    } else if (st.phase===State.PHASES.RUNNING) {
      plane.flyElapsed += dt;
      const TAXI=1200, LIFTOFF=2400;
      if (plane.flyElapsed < TAXI) {
        const p=plane.flyElapsed/TAXI, ep=p*p;
        plane.x=W*0.12+ep*(W*0.38); plane.y=plane.runwayY+Math.sin(plane.flyElapsed*0.03)*1.5;
        plane.angle=0; plane.scale=1;
      } else if (plane.flyElapsed < LIFTOFF) {
        const p=(plane.flyElapsed-TAXI)/(LIFTOFF-TAXI), ep=p*p;
        plane.x=W*0.50+ep*W*0.25; plane.y=plane.runwayY-ep*H*0.45;
        plane.angle=-ep*0.32; plane.scale=1-ep*0.2;
      } else {
        const p2=(plane.flyElapsed-LIFTOFF)/1000;
        plane.x=Math.min(W*0.75+p2*18, W*0.88);
        plane.y=Math.max(plane.runwayY-H*0.45-p2*14+Math.sin(plane.flyElapsed*0.002)*4, H*0.06);
        plane.angle=-0.32-p2*0.012; plane.scale=Math.max(0.3, 0.8-p2*0.04);
      }
      const tx=plane.x-Math.cos(plane.angle)*48*plane.scale;
      const ty=plane.y-Math.sin(plane.angle)*48*plane.scale;
      plane.trail.push({x:tx,y:ty}); if(plane.trail.length>40) plane.trail.shift();
      const gx=W*0.08+(plane.flyElapsed/12000)*W*0.85;
      const gy=H*0.88-(st.multiplier-1)*H*0.08;
      _addGraphPoint(Math.min(gx,W*0.92), Math.max(gy,H*0.08));
      ctx.globalAlpha=1; _drawPlane(plane.x,plane.y,plane.scale,plane.angle,false);

    } else if (st.phase===State.PHASES.CRASHED) {
      plane.trail=[]; ctx.globalAlpha=plane.opacity;
      _drawPlane(plane.x,plane.y,plane.scale,plane.angle,true);
      plane.opacity=Math.max(0,plane.opacity-0.008);
    }
    ctx.globalAlpha=1;
  }

  function startFlight() { plane.flyElapsed=0; plane.opacity=1; _resetGraph(); }
  function triggerCrash() { plane.crashed=true; }

  return { init, startFlight, triggerCrash, resetPlane };
})();

/* ============================================================
   FAKE PLAYERS SIMULATION
   ============================================================ */
const FakePlayers = (() => {
  const NAMES = ['ace_pilot','rocketman','sky_high','night_owl','crypto_chad',
                 'airwolf','thunder7','blazer','neon_rider','ghost_fly',
                 'turbo99','hawk_eye','slick77','dark_star','redline'];
  let players = [];

  function init(crashPoint) {
    players = NAMES.map(n => ({
      name: n, bet: Math.floor(Math.random()*95+5),
      cashAt: Math.random()<0.65 ? parseFloat((Math.random()*(crashPoint-1.1)+1.1).toFixed(2)) : null,
      cashedOut:false, lost:false,
    }));
  }

  function tick(multiplier) {
    players.forEach(p => {
      if (p.cashedOut||p.lost) return;
      if (p.cashAt && multiplier>=p.cashAt) {
        p.cashedOut=true; p.winAmt=parseFloat((p.bet*p.cashAt).toFixed(2));
        UI.showCashoutTicker(p.name, p.cashAt, p.winAmt);
      }
    });
  }

  function settleCrash() { players.forEach(p => { if (!p.cashedOut) p.lost=true; }); }

  return { init, tick, settleCrash };
})();

/* ============================================================
   UI HANDLER
   ============================================================ */
const UI = (() => {
  const $  = id => document.getElementById(id);
  const els = {
    multiplier:   $('multiplierDisplay'),
    phase:        $('gamePhase'),
    countWrap:    $('countdownWrap'),
    countVal:     $('countdownVal'),
    multWrap:     $('multiplierWrap'),
    crashOver:    $('crashOverlay'),
    crashMult:    $('crashMult'),
    balance:      $('balanceDisplay'),
    ticker:       $('cashoutTicker'),
    authGate:     $('authGate'),
    authGateMsg:  $('authGateMsg'),
    authEmail:    $('authEmail'),
    authPassword: $('authPassword'),
    btnLogin:     $('btnLogin'),
    btnDemoUser:  $('btnDemoUser'),
    authError:    $('authError'),
  };

  const updateMultiplier = m => {
    if (!els.multiplier) return;
    els.multiplier.textContent = m.toFixed(2)+'x';
    els.multiplier.className   = 'multiplier-val';
  };
  const setPhaseText = text => { if (els.phase) els.phase.textContent = text; };
  const showCountdown = sec => {
    els.countWrap?.classList.add('visible');
    if (els.countVal) els.countVal.textContent = sec;
    if (els.multWrap) els.multWrap.style.opacity = '0.15';
  };
  const hideCountdown = () => {
    els.countWrap?.classList.remove('visible');
    if (els.multWrap) els.multWrap.style.opacity = '1';
  };
  const showCrash = crashPt => {
    if (!els.multiplier) return;
    els.multiplier.className   = 'multiplier-val crashed';
    els.multiplier.textContent = crashPt.toFixed(2)+'x';
    els.crashOver?.classList.add('visible');
    if (els.crashMult) els.crashMult.textContent = 'Crashed @ '+crashPt.toFixed(2)+'x';
    setTimeout(() => els.crashOver?.classList.remove('visible'), 2200);
  };
  const updateBalance = bal => {
    if (els.balance) els.balance.textContent = CB.sym() +parseFloat(bal).toFixed(2);
  };
  const showCashoutTicker = (name, mult, win) => {
    if (!els.ticker) return;
    const item = document.createElement('div');
    item.className   = 'ticker-item';
    item.textContent = `${name} cashed out @ ${mult.toFixed(2)}x (+${CB.sym()}${win.toFixed(2)})`;
    els.ticker.prepend(item);
    setTimeout(() => item.remove(), 3500);
  };
  const setBetBtn = (idx, mode) => {
    const btn = $(`betBtn${idx+1}`);
    if (!btn) return;
    btn.disabled = false;
    if      (mode==='bet')     { btn.textContent='BET';      btn.className='btn-bet'; }
    else if (mode==='cashout') { btn.textContent='CASH OUT'; btn.className='btn-bet cashout-mode'; }
    else if (mode==='cancel')  { btn.textContent='CANCEL';   btn.className='btn-bet'; }
    else                       { btn.textContent='BET';      btn.className='btn-bet'; btn.disabled=true; }
  };
  const setBetStatus = (idx, text, color) => {
    const e = $(`betStatus${idx+1}`);
    if (e) { e.textContent=text; e.style.color=color||'#39e67e'; }
  };
  const updateFairnessModal = (info, crashPt, revealed) => {
    const s=(id,v)=>{ const e=$(id); if(e) e.textContent=v; };
    s('serverSeedDisplay', info.serverSeed||'---');
    s('clientSeedDisplay', info.clientSeed||'---');
    s('nonceDisplay',      info.nonce     ||'---');
    s('hashDisplay',       info.hash      ||'---');
    s('crashPointDisplay', revealed ? crashPt.toFixed(2)+'x' : 'Revealed after round');
  };
  const showAuthGate = (msg='Sign in to play.') => {
    if (!els.authGate) return;
    if (els.authGateMsg) els.authGateMsg.textContent = msg;
    els.authGate.classList.remove('hidden');
    [0,1].forEach(i => setBetBtn(i,'disabled'));
  };
  const hideAuthGate   = ()  => els.authGate?.classList.add('hidden');
  const setAuthError   = msg => { if (els.authError) els.authError.textContent = msg||''; };
  const setAuthLoading = on  => { if (els.btnLogin) els.btnLogin.disabled = on; };

  return {
    updateMultiplier, setPhaseText, showCountdown, hideCountdown,
    showCrash, updateBalance, showCashoutTicker,
    setBetBtn, setBetStatus, updateFairnessModal,
    showAuthGate, hideAuthGate, setAuthError, setAuthLoading,
  };
})();

/* ============================================================
   AUTH REACTOR
   Reacts to auth:login / auth:logout / auth:expired events.
   Also wires the login form and demo button.
   ============================================================ */
const AuthReactor = (() => {
  function init() {
    window.addEventListener('auth:login',   _onLogin);
    window.addEventListener('auth:logout',  _onLogout);
    window.addEventListener('auth:expired', _onExpired);
    _wireAuthForm();
  }

  function _wireAuthForm() {
    const btnLogin    = document.getElementById('btnLogin');
    const btnDemoUser = document.getElementById('btnDemoUser');
    const pwField     = document.getElementById('authPassword');

    if (btnLogin) {
      btnLogin.addEventListener('click', async () => {
        const email    = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value;
        if (!email || !password) { UI.setAuthError('Enter email and password.'); return; }
        UI.setAuthError(''); UI.setAuthLoading(true);
        try {
          // Uses SpeedBetAPI.auth.login which calls POST /api/auth/login
          const data = await SpeedBetAPI.auth.login(email, password);
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        } catch (e) {
          UI.setAuthError(e.message || 'Login failed.');
        } finally {
          UI.setAuthLoading(false);
        }
      });
    }

    if (btnDemoUser) {
      btnDemoUser.addEventListener('click', async () => {
        UI.setAuthError(''); UI.setAuthLoading(true);
        try {
          // Uses SpeedBetAPI.auth.demoLogin — POST /api/auth/demo-login { role: 'USER' }
          const data = await SpeedBetAPI.auth.demoLogin('USER');
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        } catch (e) {
          // Demo endpoint unavailable — just close gate, run locally
          console.warn('[Auth] demo-login unavailable, running offline:', e.message);
          UI.hideAuthGate();
          UI.updateBalance(Wallet.get());
        } finally {
          UI.setAuthLoading(false);
        }
      });
    }

    if (pwField) {
      pwField.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnLogin')?.click();
      });
    }
  }

  async function _onLogin(e) {
    WSBus.reconnect(() => Wallet.subscribeWS());
    await Wallet.fetch();          // GET /api/wallet → real balance
    UI.hideAuthGate();
    if (State.getPhase() === State.PHASES.PAUSED) Game.resume();
  }

  function _onLogout() {
    WSBus.disconnect();
    Game.pause();
    UI.showAuthGate('Sign in to keep playing.');
    UI.updateBalance(0);
  }

  function _onExpired() {
    WSBus.disconnect();
    Game.pause();
    UI.showAuthGate('Your session expired. Please sign in again.');
    UI.updateBalance(0);
  }

  return { init };
})();

/* ============================================================
   GAME ORCHESTRATOR
   ============================================================ */
const Game = (() => {
  let _countdownInterval = null;
  let _rafId             = null;
  let _gameStartTs       = null;
  let _paused            = false;

  /* ── networking ──────────────────────── */
  async function _startNetworking() {
    WSBus.connect(() => Wallet.subscribeWS());
    await Wallet.fetch();
    await CrashRound.fetchCurrentRound(CONFIG.GAME_SLUG);

    // Server-pushed state — use for server-side auto-cashout reconciliation
    CrashRound.subscribeToState(
      CONFIG.GAME_SLUG,
      serverMult => {
        // Check each panel's auto-cashout against server multiplier
        [0,1].forEach(i => {
          const bet   = State.get().bets[i];
          const acEl  = document.getElementById(`autoCashout${i+1}`);
          const acVal = document.getElementById(`autoCashoutVal${i+1}`);
          if (bet.active && !bet.cashedOut && acEl?.checked)
            if (serverMult >= parseFloat(acVal.value)) _doCashout(i);
        });
      },
      payload => {
        // Server crash: optionally reveal server seed
        if (payload.serverSeed) {
          State.get().fairness.serverSeed = payload.serverSeed;
          UI.updateFairnessModal(State.get().fairness, State.get().crashPoint, true);
        }
      }
    );
  }

  /* ── pause / resume ──────────────────── */
  function pause() {
    _paused = true;
    clearInterval(_countdownInterval);
    cancelAnimationFrame(_rafId);
    State.setPhase(State.PHASES.PAUSED);
    UI.setPhaseText('GAME PAUSED');
    [0,1].forEach(i => { UI.setBetBtn(i,'disabled'); State.resetBet(i); });
    CrashRound.reset();
  }

  async function resume() {
    _paused = false;
    await _startNetworking();
    startWaiting();
  }

  /* ── WAITING ─────────────────────────── */
  async function startWaiting() {
    if (_paused) return;

    State.setPhase(State.PHASES.WAITING);
    State.setMultiplier(1.00);
    CrashRound.reset();

    // Generate local crash point (demo/offline fallback)
    const localInfo = await RNG.generateCrashPoint();
    State.setCrashInfo(localInfo);
    UI.updateFairnessModal(localInfo, localInfo.crash, false);
    FakePlayers.init(localInfo.crash);

    // If authenticated, fetch server crash point and override local
    if (SpeedBetAPI.isAuthed()) {
      try {
        const roundData = await CrashRound.fetchCurrentRound(CONFIG.GAME_SLUG);
        if (roundData?.crashPoint) {
          const serverCrash = parseFloat(roundData.crashPoint);
          State.setCrashInfo({ ...localInfo, crash: serverCrash });
          FakePlayers.init(serverCrash);
        }
      } catch { /* stay with local */ }
    }

    UI.updateMultiplier(1.00);
    UI.setPhaseText('WAITING FOR NEXT ROUND…');
    Renderer.resetPlane();
    UI.updateBalance(Wallet.get());

    [0,1].forEach(i => {
      if (!State.get().bets[i].active) {
        UI.setBetBtn(i, SpeedBetAPI.isAuthed() ? 'bet' : 'disabled');
        UI.setBetStatus(i, '');
      }
    });

    let sec = CONFIG.COUNTDOWN_SECS;
    UI.showCountdown(sec);
    _countdownInterval = setInterval(() => {
      if (_paused) { clearInterval(_countdownInterval); return; }
      sec--;
      if (sec <= 0) {
        clearInterval(_countdownInterval);
        UI.hideCountdown();
        startRunning();
      } else {
        const cv = document.getElementById('countdownVal');
        if (cv) cv.textContent = sec;
      }
    }, 1000);
  }

  /* ── RUNNING ─────────────────────────── */
  async function startRunning() {
    if (_paused) return;

    State.setPhase(State.PHASES.RUNNING);
    UI.setPhaseText('FLYING…');
    _gameStartTs = performance.now();
    State.setStartTime(_gameStartTs);
    Renderer.startFlight();

    // ── Place bets on server for each active panel ──────────
    // POST /api/games/aviator/play { stake }  → GameRound { id, stake, payout, … }
    for (let i = 0; i < 2; i++) {
      const bet = State.get().bets[i];
      if (bet.active && SpeedBetAPI.isAuthed()) {
        try {
          await CrashRound.placeBet(CONFIG.GAME_SLUG, i, bet.amount);
          // Server debited stake — GameRound.id stored in CrashRound for cashout
        } catch (e) {
          if (e.message === 'SESSION_EXPIRED') break;
          console.warn(`[Game] placeBet panel ${i+1}:`, e.message);
          // Keep playing locally — server sync failed but game continues
        }
      }
    }

    [0,1].forEach(i => {
      const bet = State.get().bets[i];
      if (bet.active) { UI.setBetBtn(i,'cashout'); UI.setBetStatus(i,`BET: ${CB.sym()}${bet.amount.toFixed(2)}`,'#ffd166'); }
      else              UI.setBetBtn(i,'disabled');
    });

    _rafId = requestAnimationFrame(_runningLoop);
  }

  /* ── RAF loop ────────────────────────── */
  function _runningLoop(ts) {
    if (_paused) return;
    const elapsed    = ts - _gameStartTs;
    const multiplier = MultiplierEngine.compute(elapsed);
    State.setMultiplier(multiplier);
    UI.updateMultiplier(multiplier);
    FakePlayers.tick(multiplier);

    // Local auto-cashout
    [0,1].forEach(i => {
      const bet   = State.get().bets[i];
      const acEl  = document.getElementById(`autoCashout${i+1}`);
      const acVal = document.getElementById(`autoCashoutVal${i+1}`);
      if (bet.active && !bet.cashedOut && acEl?.checked)
        if (multiplier >= parseFloat(acVal.value)) _doCashout(i);
    });

    if (multiplier >= State.get().crashPoint) { _doCrash(); return; }
    _rafId = requestAnimationFrame(_runningLoop);
  }

  /* ── CASHOUT ─────────────────────────── */
  async function _doCashout(i) {
    const win = State.cashOut(i);   // optimistic local credit
    if (win === false) return;
    const mult = State.get().bets[i].cashoutMult;

    UI.setBetBtn(i, 'disabled');
    UI.setBetStatus(i, `✓ Won ${CB.sym()}${win.toFixed(2)} @ ${mult.toFixed(2)}x`, '#39e67e');
    UI.updateBalance(Wallet.get());
    UI.showCashoutTicker('YOU', mult, win);

    // ── POST /api/games/aviator/cashout { roundId, cashoutAt } ──
    if (SpeedBetAPI.isAuthed()) {
      try {
        const result = await CrashRound.cashout(CONFIG.GAME_SLUG, mult, i);
        // result: { status, multiplier, payout }
        if (result?.payout !== undefined) {
          const serverPayout = parseFloat(result.payout);
          // Reconcile: remove optimistic credit, apply server-confirmed payout
          Wallet.deduct(win);
          Wallet.credit(serverPayout);
          UI.updateBalance(Wallet.get());
          UI.setBetStatus(i, `✓ Won ${CB.sym()}${serverPayout.toFixed(2)} @ ${mult.toFixed(2)}x`, '#39e67e');
        }
        // If server sends updated walletBalance use it for full reconciliation
        if (result?.walletBalance !== undefined) {
          Wallet.set(parseFloat(result.walletBalance));
          UI.updateBalance(Wallet.get());
        }
      } catch (e) {
        if (e.message === 'SESSION_EXPIRED') return;
        console.warn('[Game] cashout sync failed (local win kept):', e.message);
      }
    }
  }

  /* ── CRASH ───────────────────────────── */
  async function _doCrash() {
    cancelAnimationFrame(_rafId);
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
    UI.updateBalance(Wallet.get());

    [0,1].forEach(i => {
      const bet = State.get().bets[i];
      if (bet.active && !bet.cashedOut)
        UI.setBetStatus(i, `✗ Lost ${CB.sym()}${bet.amount.toFixed(2)}`, '#e63946');
      UI.setBetBtn(i, 'disabled');
      State.resetBet(i);
    });

    // Re-fetch real balance after crash to reconcile with server
    if (SpeedBetAPI.isAuthed()) {
      setTimeout(async () => {
        try { await Wallet.fetch(); } catch { /**/ }
      }, 800);
    }

    setTimeout(() => { if (!_paused) startWaiting(); }, 4000);
  }

  /* ── EVENT WIRING ────────────────────── */
  function _wireEvents() {
    [1,2].forEach(n => {
      const btn = document.getElementById(`betBtn${n}`);
      if (!btn) return;
      const i = n-1;

      btn.addEventListener('click', () => {
        const bet = State.get().bets[i];

        // Running + active → cashout
        if (State.getPhase()===State.PHASES.RUNNING && bet.active && !bet.cashedOut) {
          _doCashout(i); return;
        }
        if (State.getPhase()!==State.PHASES.WAITING) return;

        // Not authed
        if (!SpeedBetAPI.isAuthed()) { UI.showAuthGate('Sign in to place bets.'); return; }

        const amtEl = document.getElementById(`betAmt${n}`);
        const amt   = parseFloat(amtEl?.value);
        { const _c = CB.checkStake(amt); if (!_c.ok) { alert(_c.reason); return; } }
        if (amt > Wallet.get())     { alert('Insufficient balance'); return; }

        if (bet.active) {
          // Cancel pending bet — refund locally
          Wallet.credit(bet.amount);
          State.resetBet(i);
          UI.setBetBtn(i,'bet'); UI.setBetStatus(i,''); UI.updateBalance(Wallet.get());
          return;
        }

        State.placeBet(i, amt);   // deducts locally
        UI.setBetBtn(i,'cancel');
        UI.setBetStatus(i, `Bet placed: ${CB.sym()}${amt.toFixed(2)}`, '#ffd166');
        UI.updateBalance(Wallet.get());
      });

      // Quick-bet buttons
      document.querySelectorAll(`.btn-quick[data-bet="${n}"]`).forEach(qb => {
        qb.addEventListener('click', () => {
          if (State.getPhase()!==State.PHASES.WAITING) return;
          const inp = document.getElementById(`betAmt${n}`);
          if (inp) inp.value = qb.dataset.val;
        });
      });

      // ½ / 2× buttons
      document.querySelectorAll(`.btn-adj[data-bet="${n}"]`).forEach(ab => {
        ab.addEventListener('click', () => {
          const inp = document.getElementById(`betAmt${n}`);
          let v = parseFloat(inp?.value)||10;
          if (ab.dataset.action==='half')   v = Math.max(1, v/2);
          if (ab.dataset.action==='double') v = Math.min(100000, v*2);
          if (inp) inp.value = Math.round(v);
        });
      });
    });

    // Fairness modal
    const btnF = document.getElementById('btnFairness');
    const mb   = document.getElementById('modalBackdrop');
    const mc   = document.getElementById('modalClose');
    btnF?.addEventListener('click',  () => mb?.classList.add('visible'));
    mc?.addEventListener('click',    () => mb?.classList.remove('visible'));
    mb?.addEventListener('click', e => { if (e.target===mb) mb.classList.remove('visible'); });
  }

  /* ── BOOT ────────────────────────────── */
  async function start() {
    _wireEvents();
    Renderer.init();
    AuthReactor.init();

    if (!SpeedBetAPI.isAuthed()) {
      // No token — show auth gate, game still runs visually in demo mode
      UI.updateBalance(Wallet.get());
      UI.showAuthGate('Sign in to place real bets.');
      startWaiting();
      return;
    }

    await _startNetworking();
    startWaiting();
  }

  return { start, pause, resume };
})();

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => Game.start());