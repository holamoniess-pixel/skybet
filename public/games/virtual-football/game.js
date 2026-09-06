'use strict';

/* =========================================
   VIRTUAL FOOTBALL — game.js
   Fully Integrated — SpeedBet API v1 — May 2026

   Architecture mirrors Aviator game.js exactly:
     0.  CONFIG          — shared constants (BASE matches Aviator)
     1.  SpeedBetAPI     — token helpers + REST with 401→refresh→retry + endpoint groups
     2.  WSBus           — STOMP/SockJS hub with auto-reconnect
     3.  Wallet          — optimistic balance with get/set/deduct/credit + WS sync
     4.  MatchRound      — round tracking: placeBet, settle
     5.  State           — game state manager
     6.  TEAMS           — team data + random picker
     7.  Odds            — odds engine
     8.  Renderer        — canvas pitch renderer
     9.  UI              — DOM controller + auth gate
    10.  AuthReactor     — central login/logout/expiry handler + form wiring
    11.  Game            — main orchestrator (start / pause / resume)
   ========================================= */

/* =========================================
   0. CONFIG  — mirrors Aviator CONFIG exactly
   ========================================= */
const CONFIG = {
  BASE:            'https://speedbetbackend-production.up.railway.app',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'football',
  RECONNECT_DELAY: 3000,
  MATCH_DURATION:  30,   // seconds per match (30s real-time = 90 match minutes)
  COUNTDOWN_SECS:  8,    // seconds between matches
};

/* =========================================
   1. SPEEDBET API SERVICE
   Mirrors Aviator SpeedBetAPI exactly.
   All paths: CONFIG.BASE + '/api' + path
   Token key: 'skybet_token'  (shared with Aviator — same session)
   ========================================= */
const SpeedBetAPI = (() => {

  const TOKEN_KEY = 'skybet_token';
  const USER_KEY  = 'skybet_user';

  const getToken = () => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  };
  const setToken = t => {
    if (!t || t === 'undefined') { console.error('[SpeedBetAPI] setToken invalid:', t); return; }
    localStorage.setItem(TOKEN_KEY, t);
  };
  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const getUser  = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser  = u  => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const isAuthed = () => !!getToken();

  // ── Core fetch — mirrors Aviator _req exactly ──────────────
  async function _req(path, options = {}, auth = false, retrying = false) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else       console.warn(`[SpeedBetAPI] auth=true but no token for ${path}`);
    }
    let res;
    try {
      res = await fetch(CONFIG.BASE + path, { ...options, headers });
    } catch {
      throw new Error('NETWORK_ERROR');
    }

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
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error('refresh_failed');
      const json = await res.json();
      const data = json?.data ?? json;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      console.log('[SpeedBetAPI] Token refreshed silently');
      return true;
    } catch {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return false;
    }
  }

  const _get  = (path, auth = false)       => _req(path, { method: 'GET' }, auth);
  const _post = (path, body, auth = false) => _req(path, { method: 'POST', body: JSON.stringify(body) }, auth);

  // ── AUTH endpoints — identical paths to Aviator ────────────
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
    get:          ()               => _get('/api/wallet', true),
    transactions: (p = 0, s = 20) => _get(`/api/wallet/transactions?page=${p}&size=${s}`, true),
    withdraw:     payload          => _post('/api/wallet/withdraw', payload, true),
  };

  // ── GAMES endpoints ────────────────────────────────────────
  // POST /api/games/{slug}/play    { stake, betType, odds }  → GameRound { id, walletBalance, … }
  // POST /api/games/{slug}/settle  { game, stake, result, roundId } → { newBalance, payout }
  const games = {
    currentRound: game            => _get(`/api/games/${game}/current-round`, true),
    history:      (limit = 20)    => _get(`/api/games/history?limit=${limit}`, true),
    play:         (game, payload) => _post(`/api/games/${game}/play`,   payload, true),
    settle:       (game, payload) => _post(`/api/games/${game}/settle`, payload, true),
  };

  // ── USER endpoint ──────────────────────────────────────────
  const user = {
    me:     ()      => _get('/api/users/me', true),
    update: payload => _post('/api/users/me', payload, true),
  };

  // ── Cross-tab token sync ───────────────────────────────────
  window.addEventListener('storage', (e) => {
    if (e.key !== TOKEN_KEY) return;
    if (!e.newValue && e.oldValue) {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    } else if (e.newValue && !e.oldValue) {
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: getUser() } }));
    }
  });

  return {
    getToken, setToken, clearToken,
    getUser, setUser, isAuthed,
    auth, wallet, games, user,
  };
})();

/* =========================================
   2. WEBSOCKET BUS — STOMP over SockJS
   Mirrors Aviator WSBus exactly.
   ========================================= */
const WSBus = (() => {
  let client = null, connected = false;
  const pending = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded — live wallet updates disabled');
      return;
    }
    if (!SpeedBetAPI.isAuthed()) return;

    const socket = new SockJS(CONFIG.BASE + CONFIG.WS_ENDPOINT);
    client       = Stomp.over(socket);
    client.debug = () => {};

    const wsHeaders = SpeedBetAPI.getToken()
      ? { Authorization: `Bearer ${SpeedBetAPI.getToken()}` }
      : {};

    client.connect(wsHeaders, () => {
      connected = true;
      console.log('[WSBus] connected');
      Object.entries(pending).forEach(([topic, cb]) => client.subscribe(topic, cb));
      if (onReady) onReady();
    }, () => {
      connected = false;
      console.warn('[WSBus] disconnected');
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

/* =========================================
   3. WALLET MANAGER
   Mirrors Aviator Wallet exactly.
   Optimistic balance; server reconciled via WS + API.
   ========================================= */
const Wallet = (() => {
  let _balance = 0;

  async function fetch() {
    if (!SpeedBetAPI.isAuthed()) return;
    try {
      const data = await SpeedBetAPI.wallet.get();
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
  const deduct = amt => { _balance = Math.max(0, parseFloat((_balance - parseFloat(amt)).toFixed(2))); };
  const credit = amt => { _balance = parseFloat((_balance + parseFloat(amt)).toFixed(2)); };

  return { fetch, subscribeWS, get, set, deduct, credit };
})();

/* =========================================
   4. MATCH ROUND MANAGER
   Wraps SpeedBetAPI.games.play / settle
   with per-match round-id tracking.
   Mirrors Aviator CrashRound pattern.
   ========================================= */
const MatchRound = (() => {
  let _roundId = null;
  let _settled = false;

  // POST /api/games/football/play { stake, betType, odds } → GameRound
  async function placeBet(stake, betType, odds) {
    // Country stake floor/ceiling — single source of truth is the
    // SkyBet bridge, which carries the value the user's registered
    // country defines. Reject before we spend a network round-trip.
    { const _c = CB.checkStake(stake); if (!_c.ok) { try { UI.setBetStatus && UI.setBetStatus(0, _c.reason, '#e63946'); } catch (e) {} throw new Error(_c.reason); } }

    const data = await SpeedBetAPI.games.play(CONFIG.GAME_SLUG, { stake, betType, odds });
    _roundId = data.id ?? null;
    _settled = false;
    if (data.walletBalance !== undefined) {
      Wallet.set(parseFloat(data.walletBalance));
      UI.updateBalance(Wallet.get());
    }
    return data;
  }

  // POST /api/games/football/settle { game, stake, result, roundId }
  async function settle(stake, betType, odds, homeScore, awayScore, won) {
    if (_settled) return null;
    const payload = {
      game:   CONFIG.GAME_SLUG,
      stake,
      result: { homeScore, awayScore, betType, won, odds },
      ...(_roundId ? { roundId: _roundId } : {}),
    };
    const data = await SpeedBetAPI.games.settle(CONFIG.GAME_SLUG, payload);
    _settled = true;
    return data;
  }

  function reset()        { _roundId = null; _settled = false; }
  const getRoundId = ()   => _roundId;
  const isSettled  = ()   => _settled;

  return { placeBet, settle, reset, getRoundId, isSettled };
})();

/* =========================================
   5. GAME STATE
   ========================================= */
const PHASES = { WAITING: 'WAITING', RUNNING: 'RUNNING', ENDED: 'ENDED', PAUSED: 'PAUSED' };

const State = (() => {
  let s = {
    phase:       PHASES.WAITING,
    paused:      false,
    homeTeam:    null,
    awayTeam:    null,
    homeScore:   0,
    awayScore:   0,
    matchTime:   0,
    betPlaced:   false,
    selectedBet: null,   // 'home' | 'draw' | 'away' | 'over' | 'under'
    betAmount:   10,
    betResult:   null,   // 'won' | 'lost'
    history:     [],
    stats: {
      homeShots: 0, awayShots: 0,
      homeShotsOnTarget: 0, awayShotsOnTarget: 0,
      homePossession: 50, awayPossession: 50,
      homeCorners: 0, awayCorners: 0,
    },
  };

  const get      = ()  => s;
  const getPhase = ()  => s.phase;
  const setPhase = p   => { s.phase = p; };

  const resetMatch = () => {
    s.homeScore = 0; s.awayScore = 0; s.matchTime = 0;
    s.betPlaced = false; s.betResult = null;
    s.stats = {
      homeShots: 0, awayShots: 0,
      homeShotsOnTarget: 0, awayShotsOnTarget: 0,
      homePossession: 50, awayPossession: 50,
      homeCorners: 0, awayCorners: 0,
    };
  };

  const placeBet = (type, amount) => {
    s.selectedBet = type;
    s.betAmount   = amount;
    s.betPlaced   = true;
    Wallet.deduct(amount);  // optimistic deduction
  };

  const cancelBet = () => {
    if (s.betPlaced) Wallet.credit(s.betAmount);
    s.betPlaced   = false;
    s.selectedBet = null;
  };

  const addHistory = (entry) => {
    s.history.unshift(entry);
    if (s.history.length > 10) s.history.pop();
  };

  return { get, getPhase, setPhase, resetMatch, placeBet, cancelBet, addHistory };
})();

/* =========================================
   6. TEAM DATA
   ========================================= */
const TEAMS = [
  { name: 'RED DEVILS',      color: '#E8003D', short: 'RD' },
  { name: 'BLUE EAGLES',     color: '#00D4FF', short: 'BE' },
  { name: 'GREEN GORILLAS',  color: '#00E676', short: 'GG' },
  { name: 'GOLD LIONS',      color: '#FFB300', short: 'GL' },
  { name: 'PURPLE PANTHERS', color: '#B388FF', short: 'PP' },
  { name: 'ORANGE ORCS',     color: '#FF6D00', short: 'OO' },
  { name: 'WHITE WOLVES',    color: '#EFEFEF', short: 'WW' },
  { name: 'CYAN SHARKS',     color: '#00E5FF', short: 'CS' },
];

function pickRandomTeams() {
  const idx1 = Math.floor(Math.random() * TEAMS.length);
  let idx2   = Math.floor(Math.random() * TEAMS.length);
  while (idx2 === idx1) idx2 = Math.floor(Math.random() * TEAMS.length);

  const s = State.get();
  s.homeTeam = TEAMS[idx1];
  s.awayTeam = TEAMS[idx2];

  const set = (id, val, prop) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === 'text') el.textContent      = val;
    if (prop === 'bg')   el.style.background = val;
  };

  set('homeTeam',       s.homeTeam.name,  'text');
  set('homeColor',      s.homeTeam.color, 'bg');
  set('homeStatsLabel', s.homeTeam.name,  'text');
  set('awayTeam',       s.awayTeam.name,  'text');
  set('awayColor',      s.awayTeam.color, 'bg');
  set('awayStatsLabel', s.awayTeam.name,  'text');
}

/* =========================================
   7. ODDS ENGINE
   ========================================= */
const Odds = (() => {
  function generate() {
    const homeWinProb = 0.38 + (Math.random() * 0.12);
    const drawProb    = 0.27 + (Math.random() * 0.06);
    const awayWinProb = 1 - homeWinProb - drawProb;
    const toOdds      = p => parseFloat((0.93 / p).toFixed(2));  // ~7% margin

    return {
      home:  toOdds(homeWinProb),
      draw:  toOdds(drawProb),
      away:  toOdds(awayWinProb),
      over:  parseFloat((1.70 + Math.random() * 0.40).toFixed(2)),
      under: parseFloat((1.90 + Math.random() * 0.50).toFixed(2)),
    };
  }

  function render(odds) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val.toFixed(2); };
    set('homeOdds',  odds.home);
    set('drawOdds',  odds.draw);
    set('awayOdds',  odds.away);
    set('overOdds',  odds.over);
    set('underOdds', odds.under);
  }

  function getSelected() {
    const s   = State.get();
    const map = { home: 'homeOdds', draw: 'drawOdds', away: 'awayOdds', over: 'overOdds', under: 'underOdds' };
    const id  = map[s.selectedBet];
    return id ? parseFloat(document.getElementById(id)?.textContent || '1') : 1;
  }

  return { generate, render, getSelected };
})();

/* =========================================
   8. CANVAS / PITCH RENDERER
   ========================================= */
const Renderer = (() => {
  const canvas = document.getElementById('pitchCanvas');
  const ctx    = canvas?.getContext('2d');

  let players  = { home: [], away: [] };
  let ball     = { x: 0, y: 0, vx: 0, vy: 0 };
  let lastTs   = 0;
  let _running = false;

  function init() {
    if (!canvas) { console.warn('[Renderer] pitchCanvas not found'); return; }
    resize();
    window.addEventListener('resize', resize);
    resetPlayers();
    resetBall();
    _running = true;
    requestAnimationFrame(_loop);
  }

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    resetPlayers();
  }

  function resetPlayers() {
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const s = State.get();
    const homeColor = (s.homeTeam || {}).color || '#E8003D';
    const awayColor = (s.awayTeam || {}).color || '#00D4FF';

    players.home = [];
    for (let i = 0; i < 5; i++) {
      players.home.push({
        x: W * 0.15 + (i % 3) * W * 0.1,
        y: H * 0.2  + i * H * 0.15,
        r: 12, color: homeColor,
        targetX: null, targetY: null,
        speed: 0.5 + Math.random() * 0.5,
      });
    }
    players.away = [];
    for (let i = 0; i < 5; i++) {
      players.away.push({
        x: W * 0.85 - (i % 3) * W * 0.1,
        y: H * 0.2  + i * H * 0.15,
        r: 12, color: awayColor,
        targetX: null, targetY: null,
        speed: 0.5 + Math.random() * 0.5,
      });
    }
  }

  function resetBall() {
    if (!canvas) return;
    ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0 };
  }

  function _movePlayers(dt) {
    if (State.getPhase() !== PHASES.RUNNING) return;
    const W = canvas.width, H = canvas.height;

    [...players.home, ...players.away].forEach(p => {
      if (p.targetX === null) {
        p.targetX = Math.max(20, Math.min(W - 20, p.x + (Math.random() - 0.5) * W * 0.3));
        p.targetY = Math.max(20, Math.min(H - 20, p.y + (Math.random() - 0.5) * H * 0.3));
      }
      const dx = p.targetX - p.x, dy = p.targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5) { p.targetX = null; }
      else {
        p.x += (dx / dist) * p.speed * dt * 0.05;
        p.y += (dy / dist) * p.speed * dt * 0.05;
      }
    });
  }

  function _moveBall(dt) {
    if (State.getPhase() !== PHASES.RUNNING) return;
    const W = canvas.width, H = canvas.height;

    if (Math.random() < 0.01) {
      const all    = [...players.home, ...players.away];
      const target = all[Math.floor(Math.random() * all.length)];
      const dx     = target.x - ball.x, dy = target.y - ball.y;
      const dist   = Math.sqrt(dx * dx + dy * dy) || 1;
      ball.vx = (dx / dist) * (2 + Math.random() * 3);
      ball.vy = (dy / dist) * (2 + Math.random() * 3);
    }

    ball.x += ball.vx * dt * 0.05;
    ball.y += ball.vy * dt * 0.05;

    if (ball.x < 20 || ball.x > W - 20) { ball.vx *= -1; ball.x = Math.max(20, Math.min(W - 20, ball.x)); }
    if (ball.y < 20 || ball.y > H - 20) { ball.vy *= -1; ball.y = Math.max(20, Math.min(H - 20, ball.y)); }

    if (ball.x < 30 && Math.abs(ball.y - H / 2) < H * 0.15) _triggerGoal('home');
    if (ball.x > W - 30 && Math.abs(ball.y - H / 2) < H * 0.15) _triggerGoal('away');
  }

  function _triggerGoal(team) {
    if (State.getPhase() !== PHASES.RUNNING) return;
    const s = State.get();
    if (team === 'home') {
      s.homeScore++;
      s.stats.homeShots++;
      s.stats.homeShotsOnTarget++;
      UI.addEvent(s.homeTeam.name, '⚽ GOAL!', 'goal');
    } else {
      s.awayScore++;
      s.stats.awayShots++;
      s.stats.awayShotsOnTarget++;
      UI.addEvent(s.awayTeam.name, '⚽ GOAL!', 'goal');
    }
    UI.setScore(s.homeScore, s.awayScore);
    resetBall();
    State.setPhase(PHASES.ENDED);
    setTimeout(() => {
      if (!State.get().paused) State.setPhase(PHASES.RUNNING);
    }, 1200);
  }

  function _drawPitch() {
    const W = canvas.width, H = canvas.height;

    const grass = ctx.createLinearGradient(0, 0, W, 0);
    grass.addColorStop(0,   '#0a3d0a');
    grass.addColorStop(0.5, '#0d4d0d');
    grass.addColorStop(1,   '#0a3d0a');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < W; i += 40) {
      ctx.fillStyle = i % 80 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
      ctx.fillRect(i, 0, 40, H);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    ctx.beginPath();
    ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(10,     H / 2 - H * 0.15, 10, H * 0.3);
    ctx.fillRect(W - 20, H / 2 - H * 0.15, 10, H * 0.3);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(20, H / 2 - H * 0.22, W * 0.15, H * 0.44);
    ctx.strokeRect(W - 20 - W * 0.15, H / 2 - H * 0.22, W * 0.15, H * 0.44);
  }

  function _drawPlayer(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y + 3, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle   = p.color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1.5; ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 3, p.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  }

  function _drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y + 3, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
    ctx.fillStyle   = '#FFFFFF'; ctx.fill();
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 1; ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(ball.x + Math.cos(angle) * 4, ball.y + Math.sin(angle) * 4, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#333333'; ctx.fill();
    }
  }

  function _loop(ts) {
    if (!_running) return;
    requestAnimationFrame(_loop);
    const dt = ts - lastTs;
    lastTs   = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _drawPitch();
    _movePlayers(dt);
    _moveBall(dt);
    players.home.forEach(_drawPlayer);
    players.away.forEach(_drawPlayer);
    _drawBall();
  }

  return { init, resetPlayers, resetBall };
})();

/* =========================================
   9. UI CONTROLLER
   ========================================= */
const UI = (() => {
  const $ = id => document.getElementById(id);

  const els = {
    authGate:       $('auth-gate'),
    authGateMsg:    $('auth-gate-msg'),
    authEmail:      $('authEmail'),
    authPassword:   $('authPassword'),
    btnLogin:       $('btnLogin'),
    btnDemoUser:    $('btnDemoUser'),
    authError:      $('authError'),
    balanceDisplay: $('balanceDisplay'),
    betStatus:      $('betStatus'),
    homeScore:      $('homeScore'),
    awayScore:      $('awayScore'),
    timerValue:     $('timerValue'),
    timerBar:       $('timerBar'),
    eventsFeed:     $('eventsFeed'),
    historyList:    $('historyList'),
    selValue:       $('selValue'),
    countdownWrap:  $('countdownWrap'),
    countdownVal:   $('countdownVal'),
    placeBetBtn:    $('placeBetBtn'),
    betAmt:         $('betAmt'),
  };

  function updateBalance(amount) {
    if (els.balanceDisplay)
      els.balanceDisplay.textContent = CB.sym() + parseFloat(amount).toFixed(2);
  }

  function showAuthGate(message = 'Sign in to play.') {
    if (!els.authGate) return;
    if (els.authGateMsg) els.authGateMsg.textContent = message;
    els.authGate.classList.remove('hidden');
    _setBettingEnabled(false);
  }

  function hideAuthGate() {
    if (!els.authGate) return;
    els.authGate.classList.add('hidden');
    _setBettingEnabled(true);
  }

  function _setBettingEnabled(enabled) {
    document.querySelectorAll('.mkt-btn, .btn-quick, .btn-adj').forEach(b => {
      b.disabled = !enabled;
    });
    if (els.placeBetBtn) els.placeBetBtn.disabled = !enabled;
    if (els.betAmt)      els.betAmt.disabled      = !enabled;
  }

  function setBetStatus(text, color = '') {
    if (!els.betStatus) return;
    els.betStatus.textContent = text;
    if (color) els.betStatus.style.color = color;
  }

  function setScore(home, away) {
    if (els.homeScore) els.homeScore.textContent = home;
    if (els.awayScore) els.awayScore.textContent = away;
  }

  function setTimer(min, sec, progress) {
    if (els.timerValue)
      els.timerValue.textContent =
        String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    if (els.timerBar) els.timerBar.style.width = (progress * 100) + '%';
  }

  function showCountdown(sec) {
    if (els.countdownWrap) els.countdownWrap.classList.add('visible');
    if (els.countdownVal)  els.countdownVal.textContent = sec;
  }

  function hideCountdown() {
    if (els.countdownWrap) els.countdownWrap.classList.remove('visible');
  }

  function addEvent(team, text, type) {
    if (!els.eventsFeed) return;
    const item = document.createElement('div');
    item.className   = 'event-item ' + type;
    const s          = State.get();
    item.textContent = `[${String(s.matchTime).padStart(2, '0')}'] ${team}: ${text}`;
    els.eventsFeed.prepend(item);
    while (els.eventsFeed.children.length > 5)
      els.eventsFeed.removeChild(els.eventsFeed.lastChild);
    setTimeout(() => item.classList.add('fading'), 2500);
    setTimeout(() => item.remove(), 3000);
  }

  function addHistory() {
    if (!els.historyList) return;
    els.historyList.innerHTML = '';
    State.get().history.forEach(h => {
      const el = document.createElement('div');
      el.className = `history-item ${h.won ? 'home-win' : 'away-win'}`;
      el.innerHTML =
        `<span>${h.home} ${h.score} ${h.away}</span>` +
        `<span>${h.won ? '✓' : '✗'}</span>`;
      els.historyList.appendChild(el);
    });
  }

  function updateStats() {
    const stats = State.get().stats;
    const map   = {
      homeShots:         'homeShots',
      homeShotsOnTarget: 'homeShotsOnTarget',
      homePossession:    'homePossession',
      homeCorners:       'homeCorners',
      awayShots:         'awayShots',
      awayShotsOnTarget: 'awayShotsOnTarget',
      awayPossession:    'awayPossession',
      awayCorners:       'awayCorners',
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = key.includes('Possession') ? stats[key] + '%' : stats[key];
    });
  }

  function clearBetSelection() {
    if (els.selValue) els.selValue.textContent = 'None';
    document.querySelectorAll('.mkt-btn').forEach(b => b.classList.remove('selected'));
  }

  function setAuthError(msg)  { if (els.authError) els.authError.textContent = msg || ''; }
  function setAuthLoading(on) {
    if (els.btnLogin)    els.btnLogin.disabled    = on;
    if (els.btnDemoUser) els.btnDemoUser.disabled = on;
  }

  return {
    updateBalance, showAuthGate, hideAuthGate,
    setBetStatus, setScore, setTimer,
    showCountdown, hideCountdown,
    addEvent, addHistory, updateStats, clearBetSelection,
    setAuthError, setAuthLoading,
  };
})();

/* =========================================
   10. AUTH REACTOR
   Mirrors Aviator AuthReactor exactly.
   Wires login form + demo button + enter-key.
   ========================================= */
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
          const data = await SpeedBetAPI.auth.demoLogin('USER');
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        } catch (e) {
          // Demo endpoint unavailable — allow offline play
          console.warn('[AuthReactor] demo-login unavailable, running offline:', e.message);
          UI.hideAuthGate();
          UI.updateBalance(Wallet.get());
          if (State.get().paused) Game.resume();
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

  async function _onLogin() {
    WSBus.reconnect(() => Wallet.subscribeWS());
    await Wallet.fetch();   // GET /api/wallet → real balance
    UI.hideAuthGate();
    if (State.get().paused) Game.resume();
  }

  function _onLogout() {
    WSBus.disconnect();
    Game.pause('Sign in to keep playing.');
  }

  function _onExpired() {
    WSBus.disconnect();
    Game.pause('Your session expired. Please sign in again.');
  }

  return { init };
})();

/* =========================================
   11. GAME ORCHESTRATOR
   Mirrors Aviator Game pattern exactly.
   Phases: WAITING → RUNNING → ENDED → WAITING
   ========================================= */
const Game = (() => {
  let _countdownInterval = null;
  let _matchTimer        = null;
  let _startTime         = null;

  /* ── networking — mirrors Aviator _startNetworking ───────── */
  async function _startNetworking() {
    WSBus.connect(() => Wallet.subscribeWS());
    await Wallet.fetch();
  }

  /* ── pause / resume — mirrors Aviator pause/resume ───────── */
  function pause(message = 'Sign in to play.') {
    const s  = State.get();
    s.paused = true;
    clearInterval(_countdownInterval);
    clearInterval(_matchTimer);
    State.setPhase(PHASES.PAUSED);
    UI.hideCountdown();
    UI.showAuthGate(message);
    UI.updateBalance(0);
    MatchRound.reset();
  }

  async function resume() {
    State.get().paused = false;
    await _startNetworking();
    startWaiting();
  }

  /* ── WAITING ─────────────────────────── */
  function startWaiting() {
    const s = State.get();
    if (s.paused) return;

    State.setPhase(PHASES.WAITING);
    State.resetMatch();
    MatchRound.reset();

    pickRandomTeams();
    Renderer.resetPlayers();
    Renderer.resetBall();

    const odds = Odds.generate();
    Odds.render(odds);

    UI.setScore(0, 0);
    UI.setTimer(0, 0, 0);
    UI.setBetStatus('');
    UI.clearBetSelection();
    UI.updateBalance(Wallet.get());

    const eventsFeed = document.getElementById('eventsFeed');
    if (eventsFeed) eventsFeed.innerHTML = '';

    // Enable betting controls if authenticated — mirrors Aviator setBetBtn logic
    if (SpeedBetAPI.isAuthed()) {
      document.querySelectorAll('.mkt-btn, .btn-quick, .btn-adj').forEach(b => b.disabled = false);
      const placeBetBtn = document.getElementById('placeBetBtn');
      const betAmt      = document.getElementById('betAmt');
      if (placeBetBtn) {
        placeBetBtn.textContent = 'PLACE BET';
        placeBetBtn.classList.remove('cancel-mode');
        placeBetBtn.disabled = false;
      }
      if (betAmt) betAmt.disabled = false;
    }

    let sec = CONFIG.COUNTDOWN_SECS;
    UI.showCountdown(sec);
    _countdownInterval = setInterval(() => {
      if (s.paused) { clearInterval(_countdownInterval); return; }
      sec--;
      if (sec <= 0) {
        clearInterval(_countdownInterval);
        UI.hideCountdown();
        _startRunning();
      } else {
        const cv = document.getElementById('countdownVal');
        if (cv) cv.textContent = sec;
      }
    }, 1000);
  }

  /* ── RUNNING ─────────────────────────── */
  async function _startRunning() {
    const s = State.get();
    if (s.paused) return;

    State.setPhase(PHASES.RUNNING);
    _startTime = Date.now();

    // POST /api/games/football/play — mirrors Aviator CrashRound.placeBet
    if (s.betPlaced && SpeedBetAPI.isAuthed()) {
      try {
        const odds  = Odds.getSelected();
        const round = await MatchRound.placeBet(s.betAmount, s.selectedBet, odds);
        // Server authoritative balance reconciliation
        if (round.walletBalance !== undefined) {
          Wallet.set(parseFloat(round.walletBalance));
          UI.updateBalance(Wallet.get());
        }
      } catch (e) {
        if (e.message === 'SESSION_EXPIRED') return;
        // Server unavailable — local optimistic deduction from State.placeBet still stands
        console.warn('[Game] placeBet API failed, running locally:', e.message);
      }
    }

    // Lock bet controls during match — mirrors Aviator running state
    document.querySelectorAll('.mkt-btn, .btn-quick, .btn-adj').forEach(b => b.disabled = true);
    const placeBetBtn = document.getElementById('placeBetBtn');
    const betAmt      = document.getElementById('betAmt');
    if (placeBetBtn) placeBetBtn.disabled = true;
    if (betAmt)      betAmt.disabled      = true;

    if (s.betPlaced)
      UI.setBetStatus(`Bet placed: ${CB.sym()}${s.betAmount.toFixed(2)} on ${s.selectedBet?.toUpperCase()}`, '#FFD166');

    _runMatchLoop();
  }

  /* ── MATCH LOOP ──────────────────────── */
  function _runMatchLoop() {
    const s               = State.get();
    const matchDurationMs = CONFIG.MATCH_DURATION * 1000;

    clearInterval(_matchTimer);
    _matchTimer = setInterval(() => {
      if (s.paused) { clearInterval(_matchTimer); return; }
      if (State.getPhase() === PHASES.PAUSED) { clearInterval(_matchTimer); return; }

      const elapsed  = Date.now() - _startTime;
      const progress = Math.min(elapsed / matchDurationMs, 1);

      s.matchTime  = Math.floor(progress * 90);
      const min    = Math.floor(s.matchTime / 60);
      const sec    = s.matchTime % 60;
      UI.setTimer(min, sec, progress);

      // Random in-match events
      if (Math.random() < 0.005 && State.getPhase() === PHASES.RUNNING) {
        const roll = Math.random();
        if (roll < 0.15) {
          const scorer = Math.random() < 0.5 ? 'home' : 'away';
          if (scorer === 'home') {
            s.homeScore++;
            s.stats.homeShots++;
            s.stats.homeShotsOnTarget++;
            UI.addEvent(s.homeTeam.name, '⚽ GOAL!', 'goal');
          } else {
            s.awayScore++;
            s.stats.awayShots++;
            s.stats.awayShotsOnTarget++;
            UI.addEvent(s.awayTeam.name, '⚽ GOAL!', 'goal');
          }
          UI.setScore(s.homeScore, s.awayScore);
        } else if (roll < 0.35) {
          if (Math.random() < 0.5) { s.stats.homeShots++; UI.addEvent(s.homeTeam.name, 'Shot on target', 'shot'); }
          else                     { s.stats.awayShots++; UI.addEvent(s.awayTeam.name, 'Shot on target', 'shot'); }
        } else if (roll < 0.45) {
          if (Math.random() < 0.5) { s.stats.homeCorners++; UI.addEvent(s.homeTeam.name, 'Corner kick', 'corner'); }
          else                     { s.stats.awayCorners++; UI.addEvent(s.awayTeam.name, 'Corner kick', 'corner'); }
        } else if (roll < 0.55) {
          const team = Math.random() < 0.5 ? s.homeTeam.name : s.awayTeam.name;
          UI.addEvent(team, '🟨 Yellow Card', 'card');
        }
      }

      // Possession drift
      s.stats.homePossession = Math.max(30, Math.min(70,
        s.stats.homePossession + (Math.random() - 0.5) * 2
      ));
      s.stats.awayPossession = 100 - s.stats.homePossession;

      UI.updateStats();

      if (progress >= 1) { clearInterval(_matchTimer); _endMatch(); }
    }, 100);
  }

  /* ── END MATCH ───────────────────────── */
  async function _endMatch() {
    const s = State.get();
    if (s.paused) return;

    State.setPhase(PHASES.ENDED);

    const totalGoals = s.homeScore + s.awayScore;
    const overUnder  = totalGoals > 2.5 ? 'over' : 'under';

    UI.addEvent('FULL TIME', `${s.homeScore} - ${s.awayScore}`, 'info');

    if (s.betPlaced && s.selectedBet) {
      let won = false;
      if (s.selectedBet === 'home'  && s.homeScore > s.awayScore)  won = true;
      if (s.selectedBet === 'draw'  && s.homeScore === s.awayScore) won = true;
      if (s.selectedBet === 'away'  && s.homeScore < s.awayScore)   won = true;
      if (s.selectedBet === 'over'  && overUnder === 'over')        won = true;
      if (s.selectedBet === 'under' && overUnder === 'under')       won = true;

      const odds = Odds.getSelected();

      try {
        // POST /api/games/football/settle — mirrors Aviator cashout server call
        const settled = await MatchRound.settle(
          s.betAmount, s.selectedBet, odds,
          s.homeScore, s.awayScore, won
        );

        // Server authoritative balance — mirrors Aviator _doCashout reconciliation
        const serverBalance = parseFloat(
          settled?.newBalance ?? settled?.walletBalance ?? settled?.balance ?? NaN
        );
        if (!isNaN(serverBalance)) {
          Wallet.set(serverBalance);
        }

        if (won) {
          const payout = parseFloat(settled?.payout ?? (s.betAmount * odds));
          if (isNaN(serverBalance)) Wallet.credit(payout);
          UI.setBetStatus(`Won ${CB.sym()}${payout.toFixed(2)}!`, '#00E676');
          s.betResult = 'won';
        } else {
          // Stake already deducted optimistically
          UI.setBetStatus(`Lost ${CB.sym()}${s.betAmount.toFixed(2)}`, '#E8003D');
          s.betResult = 'lost';
        }

      } catch (err) {
        if (err.message === 'SESSION_EXPIRED') return;

        // Offline fallback — resolve locally, mirrors Aviator cashout sync failure handling
        console.warn('[endMatch] settle API failed, resolving locally:', err.message);
        if (won) {
          const winAmt = parseFloat((s.betAmount * odds).toFixed(2));
          Wallet.credit(winAmt);
          UI.setBetStatus(`Won ${CB.sym()}${winAmt.toFixed(2)}!`, '#00E676');
          s.betResult = 'won';
        } else {
          UI.setBetStatus(`Lost ${CB.sym()}${s.betAmount.toFixed(2)}`, '#E8003D');
          s.betResult = 'lost';
        }
      }

      UI.updateBalance(Wallet.get());

      State.addHistory({
        home:  s.homeTeam.name,
        away:  s.awayTeam.name,
        score: `${s.homeScore}-${s.awayScore}`,
        won:   s.betResult === 'won',
      });
      UI.addHistory();
    }

    // Re-fetch authoritative balance after settle — mirrors Aviator _doCrash pattern
    if (SpeedBetAPI.isAuthed()) {
      setTimeout(async () => {
        try { await Wallet.fetch(); } catch { /**/ }
      }, 800);
    }

    setTimeout(() => {
      if (!s.paused) startWaiting();
    }, 5000);
  }

  /* ── BETTING (called from UI events) ─── */
  function selectBet(type) {
    if (State.get().betPlaced || State.getPhase() !== PHASES.WAITING) return;
    if (!SpeedBetAPI.isAuthed()) { UI.showAuthGate('Sign in to place bets.'); return; }

    State.get().selectedBet = type;
    const selValue = document.getElementById('selValue');
    if (selValue) selValue.textContent = type.toUpperCase();
    document.querySelectorAll('.mkt-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.bet === type)
    );
  }

  function placeBet() {
    if (State.get().paused)                   return;
    if (!SpeedBetAPI.isAuthed())              { UI.showAuthGate('Sign in to place bets.'); return; }
    if (State.getPhase() !== PHASES.WAITING)  return;

    const s = State.get();
    if (!s.selectedBet) { alert('Please select a market first!'); return; }
    if (s.betPlaced)    { alert('Bet already placed for this match!'); return; }

    const betAmtEl = document.getElementById('betAmt');
    const amt      = parseFloat(betAmtEl?.value);
    { const _c = CB.checkStake(amt); if (!_c.ok) { alert(_c.reason); return; } }
    if (amt > Wallet.get())    { alert('Insufficient balance'); return; }

    State.placeBet(s.selectedBet, amt);  // optimistic deduction via Wallet.deduct
    UI.updateBalance(Wallet.get());
    UI.setBetStatus(`Bet placed: ${CB.sym()}${amt.toFixed(2)} on ${s.selectedBet.toUpperCase()}`, '#FFD166');

    const btn = document.getElementById('placeBetBtn');
    if (btn) { btn.textContent = 'CANCEL BET'; btn.classList.add('cancel-mode'); }
  }

  function cancelBet() {
    if (State.getPhase() !== PHASES.WAITING) return;
    State.cancelBet();  // refunds via Wallet.credit
    UI.updateBalance(Wallet.get());
    UI.setBetStatus('');
    UI.clearBetSelection();
    const btn = document.getElementById('placeBetBtn');
    if (btn) { btn.textContent = 'PLACE BET'; btn.classList.remove('cancel-mode'); }
  }

  /* ── EVENT WIRING ────────────────────── */
  function _wireEvents() {
    document.querySelectorAll('.mkt-btn').forEach(btn =>
      btn.addEventListener('click', () => selectBet(btn.dataset.bet))
    );

    document.querySelectorAll('.btn-quick').forEach(btn =>
      btn.addEventListener('click', () => {
        const el = document.getElementById('betAmt');
        // Strip whatever currency symbol is in play (GH₵, ₦, KSh, $…)
        // rather than assuming a dollar sign, then clamp to the country's
        // stake range so a quick-pick can never land under the floor.
        const parsed = parseFloat(String(btn.textContent).replace(/[^0-9.]/g, ''));
        if (el) el.value = CB.clampStake(isFinite(parsed) ? parsed : CB.minStake());
      })
    );

    document.querySelectorAll('.btn-adj').forEach(btn =>
      btn.addEventListener('click', () => {
        const el = document.getElementById('betAmt');
        if (!el) return;
        let v = parseFloat(el.value) || 10;
        v = btn.textContent === '½'
          ? Math.max(1, v * 0.5)
          : Math.min(100000, v * 2);
        el.value = Math.round(v * 100) / 100;
      })
    );

    const placeBetBtn = document.getElementById('placeBetBtn');
    if (placeBetBtn) {
      placeBetBtn.addEventListener('click', () => {
        if (State.get().betPlaced) cancelBet();
        else                       placeBet();
      });
    }
  }

  /* ── BOOT — mirrors Aviator Game.start exactly ───────────── */
  async function start() {
    _wireEvents();
    Renderer.init();
    AuthReactor.init();  // register auth events before any network calls

    if (!SpeedBetAPI.isAuthed()) {
      // Guest mode — show auth gate but still run match visually (demo mode)
      UI.updateBalance(0);
      UI.showAuthGate('Sign in to place bets.');
      State.get().paused = false;  // visual loop still runs
      startWaiting();
      return;
    }

    await _startNetworking();
    startWaiting();
  }

  return { start, pause, resume, selectBet, placeBet, cancelBet };
})();

/* =========================================
   12. BOOT
   ========================================= */
window.addEventListener('DOMContentLoaded', () => Game.start());