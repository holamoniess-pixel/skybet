/* ══════════════════════════════════════════════════════════════
   SPORTY JET — CRASH GAME  |  game.js

   Modules:
     0.  CONFIG              — shared constants
     1.  Auth                — token storage, refresh, cross-tab sync
     2.  APILayer            — REST helpers with 401→refresh→retry
     3.  WSBus               — STOMP/SockJS hub with auth-aware reconnect
     4.  AuthReactor         — login / logout / expiry + form wiring
     5.  CrashGenerator      — provably fair crash point (server-authoritative)
     6.  MultiplierEngine    — exponential multiplier curve (matches Aviator)
     7.  RNG                 — local provably-fair generator (offline / demo)
     8.  State               — canonical game state store
     9.  AnimationController — canvas rendering (Aviator-style plane + fx)
    10.  UIHandler           — DOM updates & feedback
    11.  FakePlayers         — simulated cashout ticker
    12.  GameStateManager    — orchestrates all modules
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   0. CONFIG
   ══════════════════════════════════════════════════════════════ */
const CONFIG = {
  API_BASE:        'https://speedbetbackend-production.up.railway.app',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'sporty-jet',
  RECONNECT_DELAY: 3000,
  COUNTDOWN_SECS:  6,
};


/* ══════════════════════════════════════════════════════════════
   1. AUTH MANAGER
   Shares token keys with Aviator (sb_token / sb_user) so both
   games run on a single session.
   ══════════════════════════════════════════════════════════════ */
const Auth = (() => {
  const TOKEN_KEY = 'skybet_token';
  const USER_KEY  = 'skybet_user';

  function getToken() {
    const t = localStorage.getItem(TOKEN_KEY);
    return (t && t !== 'undefined' && t !== 'null') ? t : null;
  }
  function setToken(t) {
    if (!t || t === 'undefined') { console.error('[Auth] setToken invalid:', t); return; }
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken()      { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function isAuthenticated() { return !!getToken(); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  function headers(extra = {}) {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  function onLogin(accessToken, user) {
    setToken(accessToken);
    if (user) setUser(user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
  }

  function onLogout() {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  /** Called by APILayer on 401. Returns true if token was refreshed. */
  async function handleExpiry() {
    try {
      const res = await fetch(CONFIG.API_BASE + '/api/auth/refresh', {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Refresh failed');
      const json = await res.json();
      const data = json.data ?? json;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      console.log('[Auth] Token refreshed silently');
      return true;
    } catch {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return false;
    }
  }

  // Cross-tab sync
  window.addEventListener('storage', e => {
    if (e.key !== TOKEN_KEY) return;
    if (!e.newValue && e.oldValue)
      window.dispatchEvent(new CustomEvent('auth:logout'));
    else if (e.newValue && !e.oldValue)
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: getUser() } }));
  });

  return {
    getToken, setToken, clearToken,
    isAuthenticated, getUser, setUser,
    headers, onLogin, onLogout, handleExpiry,
  };
})();


/* ══════════════════════════════════════════════════════════════
   2. API LAYER
   Mirrors Aviator's SpeedBetAPI — typed REST helpers with
   automatic 401 → refresh → retry.
   ══════════════════════════════════════════════════════════════ */
const APILayer = (() => {
  async function request(method, path, body, retrying = false) {
    const url  = CONFIG.API_BASE + '/api' + path;
    const opts = {
      method,
      headers:     Auth.headers(),
      credentials: 'include',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      throw new Error('NETWORK_ERROR');
    }

    if (res.status === 401 && !retrying) {
      const refreshed = await Auth.handleExpiry();
      if (refreshed) return request(method, path, body, true);
      throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).message || msg; } catch (_) {}
      throw new Error(msg);
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  // Sub-namespaces match Aviator's SpeedBetAPI shape
  const auth = {
    login: async (email, password) => {
      const data = await request('POST', '/auth/login', { email, password });
      Auth.setToken(data.accessToken);
      if (data.user) Auth.setUser(data.user);
      return data;
    },
    register: async payload => {
      const data = await request('POST', '/auth/register', payload);
      Auth.setToken(data.accessToken);
      if (data.user) Auth.setUser(data.user);
      return data;
    },
    demoLogin: async (role = 'USER') => {
      const data = await request('POST', '/auth/demo-login', { role });
      Auth.setToken(data.accessToken);
      if (data.user) Auth.setUser(data.user);
      return data;
    },
    logout: async () => {
      try { await request('POST', '/auth/logout'); } finally { Auth.clearToken(); }
    },
  };

  const wallet = {
    get:          ()         => request('GET',  '/wallet'),
    transactions: (p=0,s=20) => request('GET',  `/wallet/transactions?page=${p}&size=${s}`),
  };

  const games = {
    currentRound: slug          => request('GET',  `/games/${slug}/current-round`),
    play:         (slug, body)  => request('POST', `/games/${slug}/play`,    body),
    cashout:      (slug, body)  => request('POST', `/games/${slug}/cashout`, body),
    reveal:       (slug, round) => request('GET',  `/games/${slug}/round/${round}/reveal`),
  };

  // Low-level helpers kept for backward compat
  const get  = path        => request('GET',  path);
  const post = (path, body) => request('POST', path, body);

  return { auth, wallet, games, get, post };
})();

const SLUG = () => CONFIG.GAME_SLUG;


/* ══════════════════════════════════════════════════════════════
   3. WEBSOCKET BUS  (STOMP over SockJS)
   ══════════════════════════════════════════════════════════════ */
const WSBus = (() => {
  let client    = null;
  let connected = false;
  // Use object (not array) so re-subscribe on reconnect works correctly
  const pending = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded — WebSocket disabled');
      return;
    }
    if (!Auth.isAuthenticated()) {
      console.warn('[WSBus] No auth token — skipping WebSocket connect');
      return;
    }

    const socket = new SockJS(CONFIG.API_BASE + CONFIG.WS_ENDPOINT);
    client       = Stomp.over(socket);
    client.debug = () => {};

    const wsHeaders = Auth.getToken()
      ? { Authorization: `Bearer ${Auth.getToken()}` } : {};

    client.connect(wsHeaders, () => {
      connected = true;
      console.info('[WSBus] Connected');
      Object.entries(pending).forEach(([topic, cb]) =>
        client.subscribe(topic, cb),
      );
      if (onReady) onReady();
    }, () => {
      connected = false;
      console.warn('[WSBus] Disconnected');
      if (Auth.isAuthenticated())
        setTimeout(() => connect(onReady), CONFIG.RECONNECT_DELAY);
    });
  }

  function subscribe(topic, callback) {
    pending[topic] = callback;
    if (connected && client) client.subscribe(topic, callback);
  }

  function disconnect() {
    try { if (client && connected) client.disconnect(); } catch { /* ignore */ }
    client    = null;
    connected = false;
  }

  function reconnect(onReady) { disconnect(); connect(onReady); }

  return { connect, subscribe, disconnect, reconnect };
})();


/* ══════════════════════════════════════════════════════════════
   4. AUTH REACTOR
   Central handler for login / logout / expiry.
   Wires the login form and demo button in the auth gate.
   ══════════════════════════════════════════════════════════════ */
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

    btnLogin?.addEventListener('click', async () => {
      const email    = document.getElementById('authEmail')?.value?.trim();
      const password = document.getElementById('authPassword')?.value;
      if (!email || !password) { _setError('Enter email and password.'); return; }
      _setError(''); _setLoading(true);
      try {
        const data = await APILayer.auth.login(email, password);
        Auth.onLogin(data.accessToken, data.user);
      } catch (e) {
        _setError(e.message || 'Login failed.');
      } finally {
        _setLoading(false);
      }
    });

    btnDemoUser?.addEventListener('click', async () => {
      _setError(''); _setLoading(true);
      try {
        const data = await APILayer.auth.demoLogin('USER');
        Auth.onLogin(data.accessToken, data.user);
      } catch (e) {
        // Demo endpoint unreachable — run offline with local balance
        console.warn('[AuthReactor] demo-login unavailable, running offline:', e.message);
        UIHandler.hideAuthGate();
        UIHandler.updateBalance(GameStateManager.getBalance());
        GameStateManager.resume();
      } finally {
        _setLoading(false);
      }
    });

    pwField?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnLogin')?.click();
    });
  }

  function _setError(msg)  { const el = document.getElementById('authError'); if (el) el.textContent = msg || ''; }
  function _setLoading(on) { const el = document.getElementById('btnLogin');  if (el) el.disabled   = on; }

  async function _onLogin(e) {
    console.log('[AuthReactor] User logged in:', e.detail?.user?.email);
    WSBus.reconnect(() => _subscribeWallet());
    try {
      const data = await APILayer.wallet.get();
      GameStateManager.setBalance(parseFloat(data.balance));
    } catch { /* keep current balance */ }
    UIHandler.hideAuthGate();
    GameStateManager.resume();
  }

  function _subscribeWallet() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data = JSON.parse(msg.body);
        if (data.balance !== undefined) {
          GameStateManager.setBalance(parseFloat(data.balance));
        }
      } catch { /* ignore malformed */ }
    });
  }

  function _onLogout() {
    console.log('[AuthReactor] User logged out');
    WSBus.disconnect();
    GameStateManager.pause();
    UIHandler.showAuthGate('Sign in to keep playing.');
    UIHandler.updateBalance(0);
  }

  function _onExpired() {
    console.warn('[AuthReactor] Session expired');
    WSBus.disconnect();
    GameStateManager.pause();
    UIHandler.showAuthGate('Your session expired. Please sign in again.');
    UIHandler.updateBalance(0);
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   5. CRASH GENERATOR  (provably fair)
   Server is authoritative. Falls back to client HMAC when
   unauthenticated or server is unreachable.
   ══════════════════════════════════════════════════════════════ */
const CrashGenerator = (() => {
  let _serverSeed  = '';
  let _clientSeed  = '';
  let _hash        = '';
  let _nonce       = 1;
  let _commitHash  = '';
  let _roundNumber = null;

  function _randHex(n) {
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('').slice(0, n);
  }

  async function _hmac(key, msg) {
    const enc = new TextEncoder();
    const k   = await crypto.subtle.importKey(
      'raw', enc.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
    return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function _clientGenerate() {
    _serverSeed = _randHex(32);
    _clientSeed = _randHex(16);
    _hash       = await _hmac(_serverSeed, _clientSeed + ':' + _nonce);
    _nonce++;
    const rand  = parseInt(_hash.slice(0, 8), 16) / 0xffffffff;
    return Math.max(1.01, Math.min(1000, Math.floor(1 / (1 - rand) * 100) / 100));
  }

  async function generate() {
    if (!Auth.isAuthenticated()) {
      return _clientGenerate();
    }

    try {
      const data   = await APILayer.games.currentRound(SLUG());
      _roundNumber = data.roundNumber ?? data.id ?? null;
      _commitHash  = data.commitHash  ?? '';
      _clientSeed  = _randHex(16);
      _hash        = _commitHash || _hash;

      if (data.crashAt !== undefined)    return parseFloat(data.crashAt);
      if (data.crashPoint !== undefined) return parseFloat(data.crashPoint);
      return _clientGenerate();
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      console.warn('[CrashGenerator] Server unreachable, using client RNG:', err.message);
      return _clientGenerate();
    }
  }

  async function reveal() {
    if (!_roundNumber) return;
    try {
      const data  = await APILayer.games.reveal(SLUG(), _roundNumber);
      _serverSeed = data.serverSeed || '';
      _hash       = data.revealHash || _hash;
    } catch { /* fairness widget shows commit hash only */ }
  }

  function getSeeds() {
    return {
      server: _serverSeed
        ? _serverSeed.slice(0, 14) + '…'
        : (_commitHash ? _commitHash.slice(0, 14) + '…' : '(offline)'),
      client: _clientSeed || '—',
      hash:   _hash ? _hash.slice(0, 14) + '…' : '—',
    };
  }

  function getRoundNumber() { return _roundNumber; }

  return { generate, reveal, getSeeds, getRoundNumber };
})();


/* ══════════════════════════════════════════════════════════════
   6. MULTIPLIER ENGINE
   Uses Aviator's exponential curve: e^(GROWTH_RATE * elapsed_ms)
   This replaces the original linear-ish curve and matches the
   server-side calculation exactly.
   ══════════════════════════════════════════════════════════════ */
const MultiplierEngine = (() => {
  const GROWTH_RATE = 0.00006; // matches Aviator's MultiplierEngine
  let _startTime = 0;
  let _running   = false;

  function start() { _startTime = performance.now(); _running = true; }
  function stop()  { _running = false; }

  function getMultiplier() {
    if (!_running) return 1.00;
    const elapsed = performance.now() - _startTime;
    return Math.max(1.00, Math.floor(Math.pow(Math.E, GROWTH_RATE * elapsed) * 100) / 100);
  }

  function getElapsed() {
    return performance.now() - _startTime; // milliseconds (matches Aviator)
  }

  return { start, stop, getMultiplier, getElapsed };
})();


/* ══════════════════════════════════════════════════════════════
   7. RNG  — local provably-fair generator (offline / demo)
   Ported directly from Aviator. Server crash point overrides
   this when authenticated.
   ══════════════════════════════════════════════════════════════ */
const RNG = (() => {
  function randomHex(len) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hmacSHA256(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign'],
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


/* ══════════════════════════════════════════════════════════════
   8. STATE  — canonical game state store
   Ported from Aviator's State module. Provides a single source
   of truth consumed by GameStateManager.
   ══════════════════════════════════════════════════════════════ */
const State = (() => {
  const PHASES = {
    WAITING: 'WAITING',
    RUNNING: 'RUNNING',
    CRASHED: 'CRASHED',
    PAUSED:  'PAUSED',
  };

  let s = {
    phase:      PHASES.WAITING,
    multiplier: 1.00,
    crashPoint: 2.00,
    startTime:  null,
    history:    [],
    fairness:   { serverSeed: '', clientSeed: '', nonce: '', hash: '' },
    roundNum:   0,
    // Single bet panel (Sporty Jet has one panel; extend to array for dual-panel)
    bet: { active: false, amount: 0, cashedOut: false, cashoutMult: 0 },
  };

  const get           = ()    => s;
  const getPhase      = ()    => s.phase;
  const setPhase      = p     => { s.phase = p; };
  const setMultiplier = m     => { s.multiplier = m; };
  const setCrashInfo  = info  => {
    s.crashPoint = info.crash ?? info.crashPoint ?? s.crashPoint;
    s.fairness   = { ...s.fairness, ...info };
  };
  const setStartTime  = t     => { s.startTime = t; };
  const resetBet      = ()    => {
    s.bet = { active: false, amount: 0, cashedOut: false, cashoutMult: 0 };
  };

  function placeBet(amount, balance) {
    s.bet = { active: true, amount, cashedOut: false, cashoutMult: 0 };
    return Math.max(0, Math.floor((balance - amount) * 100) / 100);
  }

  function cashOut(balance) {
    if (!s.bet.active || s.bet.cashedOut) return false;
    s.bet.cashedOut   = true;
    s.bet.cashoutMult = s.multiplier;
    const win = Math.floor(s.bet.amount * s.multiplier * 100) / 100;
    return { win, newBalance: Math.floor((balance + win) * 100) / 100 };
  }

  function settleCrash(balance) {
    if (s.bet.active && !s.bet.cashedOut) {
      balance = Math.max(0, Math.floor((balance - s.bet.amount) * 100) / 100);
    }
    s.history.unshift(s.crashPoint);
    if (s.history.length > 20) s.history.pop();
    s.roundNum++;
    return balance;
  }

  return {
    PHASES,
    get, getPhase, setPhase, setMultiplier, setCrashInfo, setStartTime,
    resetBet, placeBet, cashOut, settleCrash,
  };
})();


/* ══════════════════════════════════════════════════════════════
   9. ANIMATION CONTROLLER
   Canvas rendering — uses the Aviator plane design verbatim,
   with Sporty Jet's starfield / cloud / trail / particle FX.
   ══════════════════════════════════════════════════════════════ */
const AnimationController = (() => {
  const canvas = document.getElementById('sky-canvas');
  const ctx    = canvas.getContext('2d');

  let W = 0, H = 0;

  // Plane state — mirrors Aviator's `plane` object
  let plane = {
    x: 0, y: 0, runwayY: 0,
    scale: 1, angle: 0,
    crashed: false,
    flyElapsed: 0,   // milliseconds, matches Aviator timing
    trail: [],
    opacity: 1,
  };

  const particles = [];
  const stars     = [];
  const clouds    = [];
  let shake       = { x: 0, y: 0 };

  // ── Resize ──────────────────────────────────────────────────
  function resize() {
    const wrap = document.getElementById('canvas-wrap');
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    canvas.width  = W;
    canvas.height = H;
    _rebuildStars();
    resetPlane();
  }

  function _rebuildStars() {
    stars.length = 0;
    for (let i = 0; i < 140; i++) {
      stars.push({
        x:      Math.random() * W,
        y:      Math.random() * H,
        r:      Math.random() * 1.6 + 0.3,
        bright: Math.random(),
        speed:  Math.random() * 0.4 + 0.1,
        a:      Math.random(),
      });
    }
  }

  function _initClouds() {
    clouds.length = 0;
    for (let i = 0; i < 7; i++) {
      clouds.push(_newCloud(true));
    }
  }

  function _newCloud(randomX) {
    return {
      x:     randomX ? Math.random() * W : W + 120,
      y:     H * 0.05 + Math.random() * H * 0.55,
      w:     70 + Math.random() * 130,
      h:     25 + Math.random() * 45,
      speed: 0.25 + Math.random() * 0.55,
      alpha: 0.04 + Math.random() * 0.07,
    };
  }

  // ── Plane reset ──────────────────────────────────────────────
  function resetPlane() {
    Object.assign(plane, {
      x:          W * 0.12,
      y:          H * 0.82,
      runwayY:    H * 0.82,
      scale:      1,
      angle:      0,
      crashed:    false,
      flyElapsed: 0,
      trail:      [],
      opacity:    1,
    });
    shake.x = 0;
    shake.y = 0;
  }

  // ── Plane update (Aviator flight path) ───────────────────────
  // dt in milliseconds — matches Aviator's _runningLoop timing
  function updatePlane(dt) {
    plane.flyElapsed += dt;
    const TAXI    = 1200;
    const LIFTOFF = 2400;
    const fe      = plane.flyElapsed;

    if (fe < TAXI) {
      const p = fe / TAXI;
      const ep = p * p;
      plane.x     = W * 0.12 + ep * (W * 0.38);
      plane.y     = plane.runwayY + Math.sin(fe * 0.03) * 1.5;
      plane.angle = 0;
      plane.scale = 1;
    } else if (fe < LIFTOFF) {
      const p  = (fe - TAXI) / (LIFTOFF - TAXI);
      const ep = p * p;
      plane.x     = W * 0.50 + ep * W * 0.25;
      plane.y     = plane.runwayY - ep * H * 0.45;
      plane.angle = -ep * 0.32;
      plane.scale = 1 - ep * 0.2;
    } else {
      const p2 = (fe - LIFTOFF) / 1000;
      plane.x     = Math.min(W * 0.75 + p2 * 18, W * 0.88);
      plane.y     = Math.max(plane.runwayY - H * 0.45 - p2 * 14 + Math.sin(fe * 0.002) * 4, H * 0.06);
      plane.angle = -0.32 - p2 * 0.012;
      plane.scale = Math.max(0.3, 0.8 - p2 * 0.04);
    }

    // Engine trail smoke
    const tx = plane.x - Math.cos(plane.angle) * 48 * plane.scale;
    const ty = plane.y - Math.sin(plane.angle) * 48 * plane.scale;
    plane.trail.push({ x: tx, y: ty });
    if (plane.trail.length > 40) plane.trail.shift();

    // Shake at high elapsed
    if (fe > 1500) {
      const jitter = Math.min(0.5, (fe - 1500) * 0.00008) * 8;
      shake.x = (Math.random() - 0.5) * jitter;
      shake.y = (Math.random() - 0.5) * jitter;
    }
  }

  // ── Crash fly-off ────────────────────────────────────────────
  function startCrashFlyOff() {
    plane.crashed = true;
    spawnExplosion(plane.x, plane.y);
  }

  function _updateCrashFlyOff() {
    if (!plane.crashed) return;
    plane.opacity = Math.max(0, plane.opacity - 0.008);
  }

  // ── Particles ────────────────────────────────────────────────
  function _spawnParticle(x, y, vx, vy, life, color, size) {
    particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
  }

  function spawnExplosion(x, y) {
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 9;
      const c = ['#ff2244', '#ff6600', '#ffcc00', '#ffffff', '#ff8844'][Math.floor(Math.random() * 5)];
      _spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.6 + Math.random() * 0.9, c, 2 + Math.random() * 4);
    }
  }

  // ── Background ───────────────────────────────────────────────
  function _drawBackground(isRunning) {
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#070a18');
    bg.addColorStop(0.5, '#0d1a2e');
    bg.addColorStop(1,   '#111828');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    const t = Date.now() * 0.001;
    stars.forEach(s => {
      if (isRunning) s.x -= s.speed;
      if (s.x < 0) s.x = W;
      const blink = 0.4 + 0.6 * Math.sin(t * 1.2 + s.x * 0.05);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(s.a * blink).toFixed(2)})`;
      ctx.fill();
    });

    // Clouds
    const cSpeed = isRunning ? 2.5 : 0.4;
    clouds.forEach(c => {
      c.x -= c.speed * cSpeed;
      if (c.x < -c.w * 1.5) Object.assign(c, _newCloud(false));
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle   = 'rgba(140,180,255,1)';
      ctx.beginPath(); ctx.ellipse(c.x,              c.y,             c.w,        c.h,        0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + c.w * 0.42, c.y - c.h * 0.3,  c.w * 0.6,  c.h * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x - c.w * 0.35, c.y - c.h * 0.22, c.w * 0.5,  c.h * 0.6,  0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // ── Runway (Aviator style) ───────────────────────────────────
  function _drawRunway() {
    const ry = plane.runwayY;
    ctx.fillStyle = 'rgba(40,44,55,0.8)';
    ctx.fillRect(0, ry + 12, W, H - ry - 12);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, ry + 13); ctx.lineTo(W, ry + 13); ctx.stroke();

    ctx.setLineDash([24, 16]);
    ctx.strokeStyle = 'rgba(255,200,0,0.2)';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(0, ry + 22); ctx.lineTo(W, ry + 22); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Trail ────────────────────────────────────────────────────
  function _drawTrail() {
    for (let i = 1; i < plane.trail.length; i++) {
      const t = i / plane.trail.length;
      ctx.beginPath();
      ctx.moveTo(plane.trail[i - 1].x, plane.trail[i - 1].y);
      ctx.lineTo(plane.trail[i].x,     plane.trail[i].y);
      ctx.strokeStyle = `rgba(230,57,70,${(t * 0.45).toFixed(2)})`;
      ctx.lineWidth   = t * 4;
      ctx.stroke();
    }
  }

  // ── Aviator-style plane ───────────────────────────────────────
  function _drawPlane(x, y, scale, angle, crashed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.shadowColor = crashed ? '#e63946' : '#ff0000';
    ctx.shadowBlur  = crashed ? 30 : 18;

    // Fuselage body
    ctx.beginPath();
    ctx.moveTo(55, 0);
    ctx.lineTo(-35, -10);
    ctx.lineTo(-45, 0);
    ctx.lineTo(-35, 10);
    ctx.closePath();
    ctx.fillStyle   = '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Red body stripe
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-35, -6);
    ctx.lineTo(-35, 6);
    ctx.closePath();
    ctx.fillStyle = '#e63946';
    ctx.fill();

    // Cockpit dome
    ctx.beginPath();
    ctx.ellipse(22, -4, 9, 6, 0.15, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(200,30,30,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Main wing
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(-8, -36);
    ctx.lineTo(-28, -36);
    ctx.lineTo(-18, -2);
    ctx.closePath();
    ctx.fillStyle   = '#111';
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();

    // Wing accent stripe
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(-10, -28);
    ctx.lineTo(-16, -28);
    ctx.lineTo(-12, -2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(230,57,70,0.6)';
    ctx.fill();

    // Tail fin
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-45, -20);
    ctx.lineTo(-45, 0);
    ctx.closePath();
    ctx.fillStyle   = '#e63946';
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();

    // Horizontal stabiliser
    ctx.beginPath();
    ctx.moveTo(-32, 0);
    ctx.lineTo(-45, -14);
    ctx.lineTo(-50, -14);
    ctx.lineTo(-42, 0);
    ctx.closePath();
    ctx.fillStyle   = '#111';
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();

    // Engine glow (only when not crashed)
    if (!crashed) {
      const g = ctx.createRadialGradient(-48, 0, 0, -48, 0, 18);
      g.addColorStop(0,   'rgba(255,100,50,0.9)');
      g.addColorStop(0.5, 'rgba(230,57,70,0.4)');
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(-48, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Particles ────────────────────────────────────────────────
  function _drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.06;
      p.vx *= 0.98;
      p.life -= 0.022;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── Graph (Aviator-style multiplier curve) ───────────────────
  const _graphPoints = [];
  function resetGraph()       { _graphPoints.length = 0; }
  function addGraphPoint(x, y) {
    _graphPoints.push({ x, y });
    if (_graphPoints.length > 300) _graphPoints.shift();
  }

  function _drawGraph() {
    if (_graphPoints.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(_graphPoints[0].x, _graphPoints[0].y);
    for (let i = 1; i < _graphPoints.length; i++)
      ctx.lineTo(_graphPoints[i].x, _graphPoints[i].y);
    ctx.strokeStyle = 'rgba(230,57,70,0.5)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#e63946';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Main draw frame ──────────────────────────────────────────
  let _lastTs = 0;

  function drawFrame(gamePhase, dt) {
    const isRunning  = gamePhase === State.PHASES.RUNNING;
    const isCrashed  = gamePhase === State.PHASES.CRASHED;

    _drawBackground(isRunning);
    _drawRunway();
    _drawGraph();
    _drawTrail();
    _drawParticles();

    if (isRunning) {
      updatePlane(dt || 16);

      // Push graph point
      const mult = State.get().multiplier;
      const gx   = W * 0.08 + (plane.flyElapsed / 12000) * W * 0.85;
      const gy   = H * 0.88 - (mult - 1) * H * 0.08;
      addGraphPoint(Math.min(gx, W * 0.92), Math.max(gy, H * 0.08));

      ctx.save();
      ctx.translate(shake.x, shake.y);
      _drawPlane(plane.x, plane.y, plane.scale, plane.angle, false);
      ctx.restore();
    } else if (isCrashed) {
      _updateCrashFlyOff();
      ctx.globalAlpha = plane.opacity;
      _drawPlane(plane.x, plane.y, plane.scale, plane.angle, true);
      ctx.globalAlpha = 1;
    } else {
      // Waiting / Paused — plane sits on runway
      plane.x     = W * 0.12;
      plane.y     = plane.runwayY;
      plane.angle = 0;
      plane.scale = 1;
      plane.trail = [];
      _drawPlane(plane.x, plane.y, plane.scale, plane.angle, false);
    }

    shake.x *= 0.82;
    shake.y *= 0.82;
  }

  function init() {
    resize();
    _initClouds();
    window.addEventListener('resize', resize);
  }

  return {
    init, resetPlane, resetGraph,
    startCrashFlyOff, drawFrame, spawnExplosion,
  };
})();


/* ══════════════════════════════════════════════════════════════
   10. UI HANDLER
   ══════════════════════════════════════════════════════════════ */
const UIHandler = (() => {
  const multEl      = document.getElementById('mult-display');
  const statusEl    = document.getElementById('status-text');
  const hintEl      = document.getElementById('cashout-hint');
  const countdownEl = document.getElementById('countdown-txt');
  const balanceEl   = document.getElementById('balance-display');
  const historyBar  = document.getElementById('history-bar');
  const mainBtn     = document.getElementById('main-btn');
  const betInput    = document.getElementById('bet-input');
  const flashEl     = document.getElementById('flash-overlay');
  const fakeTicker  = document.getElementById('fake-ticker');
  const fServer     = document.getElementById('f-server');
  const fClient     = document.getElementById('f-client');
  const fHash       = document.getElementById('f-hash');
  const canvasWrap  = document.getElementById('canvas-wrap');
  const authGateEl  = document.getElementById('authGate');
  const authMsgEl   = document.getElementById('authGateMsg');
  // Aviator fairness modal elements (if present)
  const fServerFull = document.getElementById('serverSeedDisplay');
  const fClientFull = document.getElementById('clientSeedDisplay');
  const fNonce      = document.getElementById('nonceDisplay');
  const fHashFull   = document.getElementById('hashDisplay');
  const fCrashPt    = document.getElementById('crashPointDisplay');

  function setMultiplier(val, mode) {
    if (!multEl) return;
    multEl.textContent = val.toFixed(2) + 'x';
    multEl.className   = 'mult-' + mode;
  }

  function setStatus(txt)      { if (statusEl)    statusEl.textContent    = txt; }
  function setCountdown(txt)   { if (countdownEl) countdownEl.textContent = txt; }
  function setCashoutHint(txt) { if (hintEl)      hintEl.textContent      = txt; }

  function updateBalance(val) {
    if (balanceEl) balanceEl.textContent = '₵ ' + parseFloat(val).toFixed(2);
  }
  // Alias used by AuthReactor / legacy callers
  const setBalance = updateBalance;

  function triggerFlash() {
    if (!flashEl) return;
    flashEl.style.opacity = '1';
    setTimeout(() => { flashEl.style.opacity = '0'; }, 180);
  }

  function showWin(amount) {
    if (!canvasWrap) return;
    const el = document.createElement('div');
    el.className   = 'win-pop';
    el.textContent = '+₵' + parseFloat(amount).toFixed(2);
    canvasWrap.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // Matches Aviator's showCashoutTicker
  function showCashoutTicker(name, mult, win) {
    if (!fakeTicker) return;
    const item = document.createElement('div');
    item.className   = 'ticker-item fake-pill pill-win';
    item.textContent = `${name} cashed @${parseFloat(mult).toFixed(2)}x  +₵${parseFloat(win).toFixed(2)}`;
    fakeTicker.prepend(item);
    setTimeout(() => item.remove(), 3200);
    const all = fakeTicker.querySelectorAll('.ticker-item');
    if (all.length > 5) all[all.length - 1].remove();
  }

  function setMainBtn(mode) {
    if (!mainBtn) return;
    mainBtn.disabled  = false;
    mainBtn.className = 'main-btn';
    switch (mode) {
      case 'idle':
        mainBtn.textContent = 'BET';
        mainBtn.classList.add('btn-bet');
        break;
      case 'bet-placed':
        mainBtn.textContent = 'BET PLACED ✓';
        mainBtn.classList.add('btn-cashed');
        mainBtn.disabled    = true;
        break;
      case 'cashout':
        mainBtn.textContent = 'CASH OUT';
        mainBtn.classList.add('btn-cashout');
        break;
      case 'cashed':
        mainBtn.textContent = 'CASHED OUT ✓';
        mainBtn.classList.add('btn-cashed');
        mainBtn.disabled    = true;
        break;
      case 'no-bet-running':
        mainBtn.textContent = 'RUNNING…';
        mainBtn.classList.add('btn-waiting');
        mainBtn.disabled    = true;
        break;
      case 'crashed':
        mainBtn.textContent = 'BET';
        mainBtn.classList.add('btn-bet');
        break;
      case 'paused':
        mainBtn.textContent = 'SIGN IN';
        mainBtn.classList.add('btn-waiting');
        mainBtn.disabled    = true;
        break;
      case 'disabled':
        mainBtn.textContent = 'BET';
        mainBtn.classList.add('btn-bet');
        mainBtn.disabled    = true;
        break;
    }
  }

  function addHistory(val) {
    if (!historyBar) return;
    const badge = document.createElement('span');
    const cls   = val < 2 ? 'hist-low' : val < 5 ? 'hist-mid' : 'hist-high';
    badge.className   = 'hist-badge ' + cls;
    badge.textContent = val.toFixed(2) + 'x';
    historyBar.prepend(badge);
    const all = historyBar.querySelectorAll('.hist-badge');
    if (all.length > 14) all[all.length - 1].remove();
  }

  function addFakePill(text, isWin) {
    if (!fakeTicker) return;
    const pill = document.createElement('div');
    pill.className   = 'fake-pill ' + (isWin ? 'pill-win' : 'pill-lose');
    pill.textContent = text;
    fakeTicker.appendChild(pill);
    setTimeout(() => pill.remove(), 3200);
    const all = fakeTicker.querySelectorAll('.fake-pill');
    if (all.length > 5) all[0].remove();
  }

  function clearFakePills() { if (fakeTicker) fakeTicker.innerHTML = ''; }

  // Full fairness modal (Aviator style)
  function updateFairnessModal(info, crashPt, revealed) {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('serverSeedDisplay', info.serverSeed || info.server || '---');
    s('clientSeedDisplay', info.clientSeed || info.client || '---');
    s('nonceDisplay',      info.nonce || '---');
    s('hashDisplay',       info.hash  || '---');
    s('crashPointDisplay', revealed ? crashPt.toFixed(2) + 'x' : 'Revealed after round');
  }

  // Short fairness bar (original Sporty Jet style)
  function setFairness(seeds) {
    if (fServer) fServer.textContent = seeds.server;
    if (fClient) fClient.textContent = seeds.client;
    if (fHash)   fHash.textContent   = seeds.hash;
    // Also populate full modal if present
    updateFairnessModal(seeds, State.get().crashPoint, false);
  }

  function getBet()           { return parseFloat(betInput?.value) || 0; }
  function setBet(v)          { if (betInput) betInput.value = v; }
  function lockBetInput(lock) { if (betInput) betInput.disabled = lock; }

  function showAuthGate(message = 'Please sign in to play.') {
    if (!authGateEl) return;
    if (authMsgEl) authMsgEl.textContent = message;
    authGateEl.classList.remove('hidden');
    setMainBtn('paused');
    lockBetInput(true);
  }

  function hideAuthGate() {
    if (!authGateEl) return;
    authGateEl.classList.add('hidden');
    lockBetInput(false);
  }

  return {
    setMultiplier, setStatus, setCountdown, setCashoutHint,
    updateBalance, setBalance,
    triggerFlash, showWin, showCashoutTicker,
    setMainBtn, addHistory, addFakePill, clearFakePills,
    setFairness, updateFairnessModal,
    getBet, setBet, lockBetInput,
    showAuthGate, hideAuthGate,
  };
})();


/* ══════════════════════════════════════════════════════════════
   11. FAKE PLAYERS  (ported from Aviator's FakePlayers)
   ══════════════════════════════════════════════════════════════ */
const FakePlayers = (() => {
  const NAMES = [
    'Kojo', 'Ama', 'Yaw', 'Efua', 'Kwame', 'Nana', 'Abena', 'Ali',
    'Sam', 'Akua', 'Fiifi', 'Mensah',
    'ace_pilot', 'rocketman', 'sky_high', 'night_owl', 'crypto_chad',
    'airwolf', 'thunder7', 'blazer', 'neon_rider', 'ghost_fly',
  ];
  const BETS = [5, 10, 20, 50, 100, 200, 500];

  let players = [];

  function init(crashPoint) {
    players = NAMES.map(name => ({
      name,
      bet:       BETS[Math.floor(Math.random() * BETS.length)],
      cashAt:    Math.random() < 0.65
        ? parseFloat((Math.random() * (crashPoint - 1.1) + 1.1).toFixed(2))
        : null,
      cashedOut: false,
      lost:      false,
    }));
  }

  function tick(multiplier) {
    players.forEach(p => {
      if (p.cashedOut || p.lost) return;
      if (p.cashAt && multiplier >= p.cashAt) {
        p.cashedOut = true;
        p.winAmt    = parseFloat((p.bet * p.cashAt).toFixed(2));
        UIHandler.showCashoutTicker(p.name, p.cashAt, p.winAmt);
      }
    });
  }

  function settleCrash() {
    players.forEach(p => { if (!p.cashedOut) p.lost = true; });
  }

  return { init, tick, settleCrash };
})();


/* ══════════════════════════════════════════════════════════════
   12. GAME STATE MANAGER
   Orchestrates all modules. Merges Aviator's Game orchestrator
   logic into Sporty Jet's single-panel flow.
   ══════════════════════════════════════════════════════════════ */
const GameStateManager = (() => {
  let balance        = 1000;
  let betAmount      = 0;
  let betPlaced      = false;
  let cashedOut      = false;
  let crashPoint     = 2.00;
  let currentRoundId = null;
  let _paused        = false;
  let _rafId         = 0;
  let _gameStartTs   = null; // performance.now() timestamp for dt calc
  let _lastFrameTs   = 0;

  // ── Helpers ──────────────────────────────────────────────────
  function getBalance() { return balance; }

  function setBalance(val) {
    balance = parseFloat(val) || 0;
    UIHandler.updateBalance(balance);
  }

  // ── RAF loop ─────────────────────────────────────────────────
  function _tick(ts) {
    if (_paused) return;

    const dt = _lastFrameTs ? ts - _lastFrameTs : 16;
    _lastFrameTs = ts;

    const phase = State.getPhase();
    AnimationController.drawFrame(phase, dt);

    if (phase === State.PHASES.WAITING) {
      // countdown is driven by setInterval in _prepareWait
    }

    if (phase === State.PHASES.RUNNING) {
      const mult = MultiplierEngine.getMultiplier();
      State.setMultiplier(mult);
      UIHandler.setMultiplier(mult, 'running');
      FakePlayers.tick(mult);

      if (mult >= crashPoint) { _doCrash(); return; }
    }

    _rafId = requestAnimationFrame(_tick);
  }

  // ── WAITING phase ─────────────────────────────────────────────
  let _countdownInterval = null;

  async function _prepareWait() {
    if (_paused) return;

    State.setPhase(State.PHASES.WAITING);
    State.resetBet();
    betPlaced      = false;
    cashedOut      = false;
    currentRoundId = null;

    UIHandler.setStatus('WAITING FOR NEXT ROUND');
    UIHandler.setMultiplier(1.00, 'waiting');
    UIHandler.setCountdown('');
    UIHandler.setCashoutHint('');
    UIHandler.setMainBtn(Auth.isAuthenticated() ? 'idle' : 'paused');
    UIHandler.lockBetInput(!Auth.isAuthenticated());
    UIHandler.clearFakePills();
    AnimationController.resetPlane();
    AnimationController.resetGraph();

    // Generate crash point via provably-fair RNG
    const localInfo = await RNG.generateCrashPoint();
    crashPoint = localInfo.crash;
    State.setCrashInfo(localInfo);
    UIHandler.setFairness({
      server: localInfo.serverSeed ? localInfo.serverSeed.slice(0, 14) + '…' : '(offline)',
      client: localInfo.clientSeed || '—',
      hash:   localInfo.hash ? localInfo.hash.slice(0, 14) + '…' : '—',
      ...localInfo,
    });
    UIHandler.updateFairnessModal(localInfo, crashPoint, false);
    FakePlayers.init(crashPoint);

    // Override with server crash point if authenticated
    if (Auth.isAuthenticated()) {
      try {
        const data   = await APILayer.games.currentRound(SLUG());
        currentRoundId = data.id ?? data.roundNumber ?? null;
        if (data.crashAt !== undefined) {
          crashPoint = parseFloat(data.crashAt);
          State.setCrashInfo({ ...localInfo, crash: crashPoint });
          FakePlayers.init(crashPoint);
        } else if (data.crashPoint !== undefined) {
          crashPoint = parseFloat(data.crashPoint);
          State.setCrashInfo({ ...localInfo, crash: crashPoint });
          FakePlayers.init(crashPoint);
        }
        if (data.commitHash) {
          UIHandler.setFairness({
            server: data.commitHash.slice(0, 14) + '…',
            client: localInfo.clientSeed || '—',
            hash:   data.commitHash.slice(0, 14) + '…',
          });
        }
      } catch (err) {
        if (err.message === 'SESSION_EXPIRED') return;
        console.warn('[GameStateManager] currentRound fetch failed:', err.message);
      }
    }

    // Countdown
    let sec = CONFIG.COUNTDOWN_SECS;
    UIHandler.setCountdown('Next round in ' + sec + 's');

    if (_countdownInterval) clearInterval(_countdownInterval);
    _countdownInterval = setInterval(() => {
      if (_paused) { clearInterval(_countdownInterval); return; }
      sec--;
      if (sec <= 0) {
        clearInterval(_countdownInterval);
        UIHandler.setCountdown('');
        _startRound();
      } else {
        UIHandler.setCountdown('Next round in ' + sec + 's');
      }
    }, 1000);

    cancelAnimationFrame(_rafId);
    _lastFrameTs = 0;
    _rafId = requestAnimationFrame(_tick);
  }

  // ── RUNNING phase ─────────────────────────────────────────────
  async function _startRound() {
    if (_paused) return;

    State.setPhase(State.PHASES.RUNNING);
    MultiplierEngine.start();
    _gameStartTs = performance.now();
    State.setStartTime(_gameStartTs);

    UIHandler.setStatus('JET FLYING…');
    UIHandler.setCountdown('');
    UIHandler.setMultiplier(1.00, 'running');
    UIHandler.lockBetInput(true);
    UIHandler.setMainBtn(betPlaced ? 'cashout' : 'no-bet-running');

    // POST bet to server if placed during wait phase
    if (betPlaced && Auth.isAuthenticated()) {
      try {
        const data = await APILayer.games.play(SLUG(), { stake: betAmount });
        currentRoundId = data.id ?? null;
        if (data.walletBalance !== undefined) {
          balance = parseFloat(data.walletBalance);
          UIHandler.updateBalance(balance);
        }
      } catch (err) {
        if (err.message === 'SESSION_EXPIRED') return;
        console.warn('[GameStateManager] play API failed, continuing locally:', err.message);
      }
    }

    _rafId = requestAnimationFrame(_tick);
  }

  // ── CRASHED phase ─────────────────────────────────────────────
  async function _doCrash() {
    cancelAnimationFrame(_rafId);
    State.setPhase(State.PHASES.CRASHED);
    MultiplierEngine.stop();

    const cp = crashPoint;
    State.setMultiplier(cp);
    UIHandler.setMultiplier(cp, 'crashed');
    UIHandler.setStatus('FLEW AWAY AT ' + cp.toFixed(2) + 'x!');
    UIHandler.setCountdown('');
    UIHandler.triggerFlash();
    UIHandler.addHistory(cp);
    UIHandler.setMainBtn('crashed');
    UIHandler.clearFakePills();
    AnimationController.startCrashFlyOff();
    FakePlayers.settleCrash();

    // Settle bet locally
    if (betPlaced && !cashedOut) {
      balance = State.settleCrash(balance);
      UIHandler.updateBalance(balance);
      UIHandler.setCashoutHint('Lost ₵' + betAmount.toFixed(2));
    } else {
      State.settleCrash(balance);
    }

    // Reveal provably-fair server seed
    await CrashGenerator.reveal();
    const seeds = CrashGenerator.getSeeds();
    UIHandler.setFairness(seeds);
    UIHandler.updateFairnessModal(seeds, cp, true);

    // Reconcile balance with server
    if (Auth.isAuthenticated()) {
      try {
        const data = await APILayer.wallet.get();
        balance    = parseFloat(data.balance ?? balance);
        UIHandler.updateBalance(balance);
      } catch (err) {
        if (err.message !== 'SESSION_EXPIRED' && err.message !== 'NETWORK_ERROR')
          console.warn('[doCrash] Wallet sync failed:', err.message);
      }
    }

    // Keep RAF alive for crash animation, then restart
    _lastFrameTs = 0;
    _rafId = requestAnimationFrame(_tick);
    setTimeout(() => {
      cancelAnimationFrame(_rafId);
      if (!_paused) _prepareWait();
    }, 3200);
  }

  // ── Cash out ──────────────────────────────────────────────────
  async function cashOut() {
    if (State.getPhase() !== State.PHASES.RUNNING || !betPlaced || cashedOut) return;
    cashedOut = true;

    const mult      = MultiplierEngine.getMultiplier();
    const cashoutAt = parseFloat(mult.toFixed(2));

    // Optimistic local credit
    const result  = State.cashOut(balance);
    if (!result) return;
    const localWin = result.win;
    balance        = result.newBalance;

    UIHandler.updateBalance(balance);
    UIHandler.setCashoutHint('Cashed out @ ' + cashoutAt.toFixed(2) + 'x  +₵' + localWin.toFixed(2));
    UIHandler.setMainBtn('cashed');
    UIHandler.showWin(localWin);
    UIHandler.showCashoutTicker('YOU', cashoutAt, localWin);

    if (!Auth.isAuthenticated()) return;

    try {
      const data = await APILayer.games.cashout(SLUG(), {
        roundId:  currentRoundId,
        cashoutAt,
      });
      // result shape: { status, multiplier, payout, walletBalance?, newBalance? }
      if (data.walletBalance !== undefined) {
        balance = parseFloat(data.walletBalance);
      } else if (data.newBalance !== undefined) {
        balance = parseFloat(data.newBalance);
      } else if (data.payout !== undefined) {
        const serverWin = parseFloat(data.payout);
        balance = Math.floor((balance - localWin + serverWin) * 100) / 100;
        UIHandler.setCashoutHint('Cashed out @ ' + cashoutAt.toFixed(2) + 'x  +₵' + serverWin.toFixed(2));
      }
      UIHandler.updateBalance(balance);
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') return;
      console.warn('[cashOut] API failed, keeping local win:', err.message);
    }
  }

  // ── Place bet ─────────────────────────────────────────────────
  async function placeBet() {
    if (State.getPhase() !== State.PHASES.WAITING || betPlaced) return;

    if (!Auth.isAuthenticated()) {
      UIHandler.showAuthGate('Sign in to place bets.');
      return;
    }

    const amt = UIHandler.getBet();
    if (!amt || amt <= 0) { alert('Enter a valid bet amount!'); return; }
    if (amt > balance)    { alert('Insufficient balance!');     return; }

    betAmount = Math.floor(amt * 100) / 100;

    // Optimistic local deduction
    balance = State.placeBet(betAmount, balance);
    UIHandler.updateBalance(balance);

    betPlaced = true;
    UIHandler.setMainBtn('bet-placed');
    UIHandler.setBetStatus('Bet placed: ₵' + betAmount.toFixed(2));
  }

  // ── Main button dispatcher ────────────────────────────────────
  function handleMainBtn() {
    if (_paused) {
      UIHandler.showAuthGate('Sign in to play.');
      return;
    }
    const phase = State.getPhase();
    if (phase === State.PHASES.WAITING)      placeBet();
    else if (phase === State.PHASES.RUNNING) cashOut();
  }

  // ── Pause / resume ────────────────────────────────────────────
  function pause() {
    _paused = true;
    cancelAnimationFrame(_rafId);
    if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
    MultiplierEngine.stop();
    State.setPhase(State.PHASES.PAUSED);
    UIHandler.setStatus('SIGN IN TO PLAY');
    UIHandler.setMainBtn('paused');
    UIHandler.lockBetInput(true);
  }

  async function resume() {
    _paused = false;
    UIHandler.hideAuthGate();
    try {
      const data = await APILayer.wallet.get();
      balance    = parseFloat(data.balance ?? balance);
      UIHandler.updateBalance(balance);
    } catch { /* keep current */ }
    _prepareWait();
  }

  // ── WS server-authoritative crash ────────────────────────────
  function _hookServerCrash() {
    WSBus.subscribe(`/topic/${SLUG()}/state`, msg => {
      try {
        const payload = JSON.parse(msg.body);
        if (payload.state === 'CRASHED' && State.getPhase() === State.PHASES.RUNNING) {
          crashPoint = parseFloat(payload.crashAt ?? payload.crashPoint ?? crashPoint);
          _doCrash();
        }
        if (payload.state === 'RUNNING' && payload.multiplier) {
          // Server-side tick for auto-cashout reconciliation (mirrors Aviator)
          const serverMult = parseFloat(payload.multiplier);
          if (State.get().bet.active && !State.get().bet.cashedOut) {
            const acEl  = document.getElementById('auto-cashout-toggle');
            const acVal = document.getElementById('auto-cashout-val');
            if (acEl?.checked && serverMult >= parseFloat(acVal?.value || 0)) {
              cashOut();
            }
          }
        }
      } catch { /* ignore malformed */ }
    });

    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data = JSON.parse(msg.body);
        if (data.balance !== undefined) {
          balance = parseFloat(data.balance);
          UIHandler.updateBalance(balance);
        }
      } catch { /* ignore malformed */ }
    });
  }

  // ── Clickable rain drops (bonus mechanic) ─────────────────────
  function _spawnRainDrop() {
    const root = document.getElementById('rain-layer');
    if (!root || _paused) return;
    const amounts = [1, 2, 3, 5, 10];
    const amt     = amounts[Math.floor(Math.random() * amounts.length)];
    const drop    = document.createElement('div');
    drop.className   = 'rain-drop';
    drop.textContent = '+₵' + amt;
    drop.style.left  = (8  + Math.random() * 78) + '%';
    drop.style.top   = (10 + Math.random() * 60) + '%';

    drop.addEventListener('click', () => {
      balance = Math.floor((balance + amt) * 100) / 100;
      UIHandler.updateBalance(balance);
      const anim     = document.createElement('div');
      anim.className   = 'collect-anim';
      anim.textContent = '+₵' + amt + '!';
      anim.style.left  = drop.style.left;
      anim.style.top   = drop.style.top;
      root.appendChild(anim);
      setTimeout(() => anim.remove(), 900);
      drop.remove();
    });

    root.appendChild(drop);
    setTimeout(() => { if (drop.parentNode) drop.remove(); }, 5000);
  }

  // ── Fairness modal wiring (Aviator style) ─────────────────────
  function _wireFairnessModal() {
    const btnF = document.getElementById('btnFairness');
    const mb   = document.getElementById('modalBackdrop');
    const mc   = document.getElementById('modalClose');
    btnF?.addEventListener('click',  () => mb?.classList.add('visible'));
    mc?.addEventListener('click',    () => mb?.classList.remove('visible'));
    mb?.addEventListener('click', e => { if (e.target === mb) mb.classList.remove('visible'); });
  }

  // ── Boot ──────────────────────────────────────────────────────
  async function init() {
    AnimationController.init();
    AuthReactor.init();
    _wireFairnessModal();

    if (!Auth.isAuthenticated()) {
      UIHandler.showAuthGate('Sign in to play.');
      UIHandler.updateBalance(balance);
      _paused = true;
      State.setPhase(State.PHASES.PAUSED);
      AnimationController.drawFrame(State.PHASES.PAUSED, 16);

      // Keep canvas alive with idle animation
      function _idleTick(ts) {
        const dt = _lastFrameTs ? ts - _lastFrameTs : 16;
        _lastFrameTs = ts;
        AnimationController.drawFrame(State.getPhase(), dt);
        if (_paused) requestAnimationFrame(_idleTick);
      }
      requestAnimationFrame(_idleTick);
      return;
    }

    // Authenticated boot
    WSBus.connect(() => _hookServerCrash());
    _hookServerCrash();

    try {
      const data = await APILayer.wallet.get();
      balance    = parseFloat(data.balance ?? balance);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED' && err.message !== 'NETWORK_ERROR')
        console.warn('[init] Wallet fetch failed, using default balance:', err.message);
    }

    UIHandler.updateBalance(balance);
    setInterval(_spawnRainDrop, 4500 + Math.random() * 3500);
    _prepareWait();
  }

  // ── Global onclick / helper hooks ────────────────────────────
  window.handleMainBtn = handleMainBtn;
  window.setBet        = v  => UIHandler.setBet(v);
  window.halfBet       = () => UIHandler.setBet(Math.max(1, Math.floor(UIHandler.getBet() / 2 * 100) / 100));
  window.doubleBet     = () => UIHandler.setBet(Math.min(balance, Math.floor(UIHandler.getBet() * 2 * 100) / 100));

  return { init, pause, resume, getBalance, setBalance };
})();

// Stub so UIHandler.setBetStatus doesn't throw if called before wiring
UIHandler.setBetStatus = (text, color) => {
  const el = document.getElementById('bet-status');
  if (el) { el.textContent = text || ''; if (color) el.style.color = color; }
};

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => GameStateManager.init());