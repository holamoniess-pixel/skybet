/**
 * SPORTY KICK — CRASH GAME
 * game.js — Complete game logic + Backend Integration
 * Fully mirrors Aviator game.js architecture — May 2026
 * =====================================================
 * Modules:
 *   1.  Config & Constants
 *   2.  Auth Manager              (shared sb_token/sb_user key, cross-tab sync, silent refresh)
 *   3.  API Client                (auth/wallet/games sub-namespaces + low-level get/post)
 *   4.  WebSocket Bus             (STOMP/SockJS — reconnect-aware, auth headers)
 *   5.  Auth Event Reactor        (login / logout / expiry + form wiring)
 *   6.  Wallet Manager            (fetch + WS subscribe)
 *   7.  State Management          (single source of truth)
 *   8.  RNG / Crash Generator     (client-side HMAC-SHA256 fallback, matches Aviator)
 *   9.  Multiplier System         (exponential curve e^(k*t), matches server)
 *  10.  Canvas / Animation        (ball + background + trail + particles)
 *  11.  UI Controller             (DOM updates, auth gate, fairness modal)
 *  12.  Bet & Cashout Logic       (optimistic local + server reconcile)
 *  13.  Fake Players System       (leaderboard + live feed)
 *  14.  Game State Manager        (waiting / running / crashed transitions)
 *  15.  Game Loop                 (rAF tick)
 *  16.  Bootstrap
 */

'use strict';

/* =====================================================
   1. CONFIG & CONSTANTS
   ===================================================== */
const CONFIG = {
  BASE:              'https://speedbetbackend-production.up.railway.app',
  WS_ENDPOINT:       '/ws',
  WAIT_MIN:          5000,
  WAIT_MAX:          8000,
  CRASH_MAX:         200,
  GROWTH_RATE:       0.00006,       // exponential: e^(GROWTH_RATE * elapsed_ms) — matches Aviator
  SHAKE_THRESHOLD:   0.80,
  PARTICLE_COUNT:    20,
  MAX_HISTORY:       12,
  MAX_FEED_ITEMS:    5,
  GAME_SLUG:         'sporty-kick',
  RECONNECT_DELAY:   3000,
  FAKE_PLAYER_NAMES: ['Alex','Maria','John','Priya','Omar','Sophie','Chen','Kwame','Lena','Raj','Nia','Sam','Jin','Fati','Bruno'],
  AVATAR_COLORS:     ['#7c4dff','#00bcd4','#e91e63','#ff5722','#4caf50','#2196f3','#ff9800','#9c27b0'],
};


/* =====================================================
   2. AUTH MANAGER
   Shares token keys with Aviator (sb_token / sb_user) so both
   games run on a single session. Mirrors Aviator SpeedBetAPI
   token helpers exactly.
   ===================================================== */
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

  function onLogin(accessToken, user) {
    setToken(accessToken);
    if (user) setUser(user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
  }

  function onLogout() {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  /** Called by APIClient on 401. Returns true if token was refreshed. */
  async function handleExpiry() {
    try {
      const res = await fetch(CONFIG.BASE + '/api/auth/refresh', {
        method:  'POST',
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
    onLogin, onLogout, handleExpiry,
  };
})();


/* =====================================================
   3. API CLIENT
   ===================================================== */
const API = (() => {
  async function request(method, path, body, retrying = false) {
    const url     = CONFIG.BASE + '/api' + path;
    const headers = { 'Content-Type': 'application/json' };
    const token   = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
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
      try { const err = await res.json(); msg = err.message ?? err.error ?? msg; } catch { /**/ }
      throw new Error(msg);
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

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
    get:          ()         => request('GET', '/wallet'),
    transactions: (p=0,s=20) => request('GET', `/wallet/transactions?page=${p}&size=${s}`),
  };

  const games = {
    currentRound: slug          => request('GET',  `/games/${slug}/current-round`),
    play:         (slug, body)  => request('POST', `/games/${slug}/play`,    body),
    cashout:      (slug, body)  => request('POST', `/games/${slug}/cashout`, body),
    reveal:       (slug, round) => request('GET',  `/games/${slug}/round/${round}/reveal`),
  };

  return { auth, wallet, games };
})();


/* =====================================================
   4. WEBSOCKET BUS (STOMP over SockJS)
   ===================================================== */
const WSBus = (() => {
  let client    = null;
  let connected = false;
  const subs    = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined') {
      console.warn('[WSBus] SockJS not available — WebSocket features disabled');
      return;
    }
    if (!Auth.isAuthenticated()) {
      console.warn('[WSBus] No auth token — skipping WebSocket connect');
      return;
    }

    const wsHeaders = Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {};

    if (typeof StompJs !== 'undefined') {
      client = new StompJs.Client({
        webSocketFactory: () => new SockJS(CONFIG.BASE + CONFIG.WS_ENDPOINT),
        reconnectDelay:   CONFIG.RECONNECT_DELAY,
        connectHeaders:   wsHeaders,
        onConnect() {
          connected = true;
          console.log('[WSBus] connected');
          Object.entries(subs).forEach(([topic, cb]) => client.subscribe(topic, cb));
          if (onReady) onReady();
        },
        onDisconnect() {
          connected = false;
          console.warn('[WSBus] disconnected');
        },
      });
      client.activate();
    } else if (typeof Stomp !== 'undefined') {
      const socket = new SockJS(CONFIG.BASE + CONFIG.WS_ENDPOINT);
      client       = Stomp.over(socket);
      client.debug = () => {};
      client.connect(wsHeaders, () => {
        connected = true;
        console.log('[WSBus] connected (stomp.js)');
        Object.entries(subs).forEach(([topic, cb]) => client.subscribe(topic, cb));
        if (onReady) onReady();
      }, () => {
        connected = false;
        console.warn('[WSBus] disconnected');
        if (Auth.isAuthenticated())
          setTimeout(() => connect(onReady), CONFIG.RECONNECT_DELAY);
      });
    } else {
      console.warn('[WSBus] No STOMP client available');
    }
  }

  function subscribe(topic, cb) {
    subs[topic] = cb;
    if (connected && client) client.subscribe(topic, cb);
  }

  function disconnect() {
    try {
      if (client) {
        typeof client.deactivate === 'function'
          ? client.deactivate()
          : client.disconnect?.();
      }
    } catch { /**/ }
    client    = null;
    connected = false;
  }

  function reconnect(onReady) { disconnect(); connect(onReady); }

  return { connect, subscribe, disconnect, reconnect };
})();


/* =====================================================
   5. AUTH EVENT REACTOR
   ===================================================== */
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
        const data = await API.auth.login(email, password);
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
        const data = await API.auth.demoLogin('USER');
        Auth.onLogin(data.accessToken, data.user);
      } catch (e) {
        console.warn('[AuthReactor] demo-login unavailable, running offline:', e.message);
        UI.hideAuthGate();
        gameLoopPaused = false;
        await enterWaiting();
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

  async function _onLogin() {
    WSBus.reconnect(() => Wallet.subscribe());
    await Wallet.fetch();
    UI.hideAuthGate();
    if (gameLoopPaused) {
      gameLoopPaused = false;
      await enterWaiting();
    }
  }

  function _onLogout() {
    WSBus.disconnect();
    _pauseGame('Sign in to keep playing.');
  }

  function _onExpired() {
    WSBus.disconnect();
    _pauseGame('Your session expired. Please sign in again.');
  }

  function _pauseGame(message) {
    gameLoopPaused = true;
    cancelFakeTimers();
    state.bets.forEach(b => { b.active = false; b.cashedOut = false; b.winnings = 0; b.roundId = null; });
    updateButtons();
    UI.showAuthGate(message);
  }

  return { init };
})();


/* =====================================================
   6. WALLET MANAGER
   ===================================================== */
const Wallet = (() => {
  async function fetch() {
    if (!Auth.isAuthenticated()) return;
    try {
      const data    = await API.wallet.get();
      state.balance = parseFloat(data.balance ?? data.amount ?? state.balance);
      updateBalance();
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
        console.warn('[Wallet] fetch failed, keeping local balance:', e.message);
    }
  }

  function subscribe() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const payload = JSON.parse(msg.body);
        if (payload.balance !== undefined) {
          state.balance = parseFloat(payload.balance);
          updateBalance();
        }
      } catch { /**/ }
    });
  }

  return { fetch, subscribe };
})();


/* =====================================================
   7. STATE MANAGEMENT
   ===================================================== */
const STATES = Object.freeze({ WAITING: 'WAITING', RUNNING: 'RUNNING', CRASHED: 'CRASHED' });

let gameLoopPaused = false;

const state = {
  current:             STATES.WAITING,
  crashPoint:          2.00,
  multiplier:          1.00,
  roundStart:          0,
  waitStart:           0,
  waitDuration:        6000,
  balance:             1000.00,
  history:             [],
  currentRoundNumber:  null,
  commitHash:          '',
  serverSeed:          '',
  clientSeed:          '',
  nonce:               '',
  hash:                '',
  bets: [
    { active: false, amount: 10, cashedOut: false, winnings: 0, roundId: null },
    { active: false, amount: 5,  cashedOut: false, winnings: 0, roundId: null },
  ],
};


/* =====================================================
   8. RNG / CRASH GENERATOR
   ===================================================== */
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
    const crash      = Math.max(1.00, Math.min(CONFIG.CRASH_MAX, Math.floor((1 / (1 - random)) * 100) / 100));

    state.serverSeed = serverSeed;
    state.clientSeed = clientSeed;
    state.nonce      = String(nonce);
    state.hash       = hash;

    return { crash, serverSeed, clientSeed, nonce: String(nonce), hash };
  }

  function generateCrashPointSync() {
    const r = Math.random() * 0.97;
    return Math.min(Math.max(parseFloat((1 / (1 - r)).toFixed(2)), 1.01), CONFIG.CRASH_MAX);
  }

  function generateHash() {
    return randomHex(20);
  }

  return { generateCrashPoint, generateCrashPointSync, generateHash };
})();


/* =====================================================
   9. MULTIPLIER SYSTEM
   ===================================================== */
function calcMultiplier(elapsedMs) {
  return Math.max(1.00, Math.floor(Math.pow(Math.E, CONFIG.GROWTH_RATE * elapsedMs) * 100) / 100);
}


/* =====================================================
   10. CANVAS / ANIMATION CONTROLLER
   ===================================================== */
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

const anim = {
  ballX:       0,
  ballY:       0,
  ballScale:   1,
  shakeX:      0,
  shakeY:      0,
  cloudOffset: 0,
  particles:   [],
  stars:       [],
  trailPoints: [],
  rafId:       null,
  lastTime:    0,
};

function initStars() {
  anim.stars = [];
  for (let i = 0; i < 80; i++) {
    anim.stars.push({
      x:       Math.random(),
      y:       Math.random() * 0.75,
      r:       0.5 + Math.random() * 1.2,
      alpha:   0.2 + Math.random() * 0.6,
      twinkle: Math.random() * Math.PI * 2,
      speed:   0.005 + Math.random() * 0.015,
    });
  }
}

/* ─────────────────────────────────────────────────────
   FIX: resizeCanvas — reads the PARENT's *CSS* size via
   offsetWidth / offsetHeight (not getBoundingClientRect
   which feeds back into the layout and causes the canvas
   to grow endlessly each frame).
   We also clamp the height so it never grows past the
   explicitly set CSS height on the wrapper.
   ───────────────────────────────────────────────────── */
function resizeCanvas() {
  const parent = canvas.parentElement;

  // Use offsetWidth/Height — these reflect CSS layout, not canvas pixel size,
  // so reading them does NOT create a reflow feedback loop with the canvas.
  const w = parent.offsetWidth  || 400;
  const h = parent.offsetHeight || 420;

  // Only update if dimensions actually changed — avoids unnecessary repaints.
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
  }
}

function drawBackground(now) {
  const W = canvas.width, H = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (state.current === STATES.CRASHED) {
    sky.addColorStop(0, '#1a0408'); sky.addColorStop(1, '#060005');
  } else if (state.current === STATES.WAITING) {
    sky.addColorStop(0, '#060916'); sky.addColorStop(1, '#04060f');
  } else {
    sky.addColorStop(0, '#030714'); sky.addColorStop(1, '#060a1f');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  anim.stars.forEach(s => {
    s.twinkle += s.speed;
    const alpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  anim.cloudOffset = (anim.cloudOffset + 0.25) % (W + 300);
  [
    { bx: 100, by: 0.12, rx: 90,  ry: 22 },
    { bx: 360, by: 0.08, rx: 110, ry: 18 },
    { bx: 650, by: 0.15, rx: 80,  ry: 20 },
  ].forEach(c => {
    const cx = ((c.bx - anim.cloudOffset + W + 300) % (W + 300)) - 150;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.beginPath(); ctx.ellipse(cx, c.by * H, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 35, c.by * H - 8, c.rx * 0.6, c.ry * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  });

  ctx.strokeStyle = 'rgba(0,180,100,0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  const groundGlow = ctx.createLinearGradient(0, H - 80, 0, H);
  groundGlow.addColorStop(0, 'transparent');
  groundGlow.addColorStop(1, 'rgba(0,100,30,0.15)');
  ctx.fillStyle = groundGlow;
  ctx.fillRect(0, H - 80, W, 80);
}

function drawGround() {
  const W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, H - 24, 0, H);
  g.addColorStop(0, '#0a2a0f'); g.addColorStop(1, '#040d06');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 24, W, 24);

  ctx.strokeStyle = 'rgba(0,200,60,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - 24); ctx.lineTo(W, H - 24); ctx.stroke();

  ctx.strokeStyle = 'rgba(0,160,40,0.12)'; ctx.lineWidth = 8;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, H - 24); ctx.lineTo(x + 30, H - 24); ctx.stroke();
  }
}

function updateBallPosition(now) {
  const W = canvas.width, H = canvas.height;
  const groundY = H - 30;

  if (state.current === STATES.WAITING) {
    anim.ballX     = 70 + Math.sin(now * 0.001) * 8;
    anim.ballY     = groundY - 4 + Math.abs(Math.sin(now * 0.003)) * -4;
    anim.ballScale = 1.0;
    anim.shakeX    = 0;
    anim.shakeY    = 0;
    anim.trailPoints = [];

  } else if (state.current === STATES.RUNNING) {
    const prog = Math.min((state.multiplier - 1) / Math.max(state.crashPoint - 1, 0.01), 1);
    anim.ballX     = 70 + prog * (W * 0.78);
    anim.ballY     = groundY - Math.pow(prog, 1.6) * (H * 0.82);
    anim.ballScale = Math.max(0.28, 1 - prog * 0.72);

    if (prog > CONFIG.SHAKE_THRESHOLD) {
      const intensity = (prog - CONFIG.SHAKE_THRESHOLD) / (1 - CONFIG.SHAKE_THRESHOLD) * 5;
      anim.shakeX = (Math.random() - 0.5) * intensity * 2;
      anim.shakeY = (Math.random() - 0.5) * intensity * 2;
    } else {
      anim.shakeX *= 0.75;
      anim.shakeY *= 0.75;
    }

    const last = anim.trailPoints[anim.trailPoints.length - 1];
    if (!last || Math.hypot(anim.ballX - last[0], anim.ballY - last[1]) > 8) {
      anim.trailPoints.push([anim.ballX, anim.ballY, anim.ballScale]);
    }
    if (anim.trailPoints.length > 60) anim.trailPoints.shift();

  } else {
    // CRASHED — ball freezes
    anim.shakeX = 0;
    anim.shakeY = 0;
  }
}

function drawTrail() {
  if (state.current !== STATES.RUNNING || anim.trailPoints.length < 2) return;
  for (let i = 1; i < anim.trailPoints.length; i++) {
    const alpha     = (i / anim.trailPoints.length) * 0.5;
    const [x, y, s]  = anim.trailPoints[i];
    const [px, py]   = anim.trailPoints[i - 1];
    ctx.strokeStyle = `rgba(0,230,118,${alpha})`;
    ctx.lineWidth   = 3 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
  }
}

function drawBall() {
  const bx = anim.ballX + anim.shakeX;
  const by = anim.ballY + anim.shakeY;
  const r  = 18 * anim.ballScale;
  const H  = canvas.height;

  const shadowAlpha = Math.max(0, 0.35 * (1 - (H - anim.ballY) / H));
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  ctx.beginPath(); ctx.ellipse(anim.ballX, H - 22, r * 2.2, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

  if (state.current === STATES.RUNNING) {
    ctx.shadowColor = '#00e676'; ctx.shadowBlur = 24 * anim.ballScale;
    ctx.strokeStyle = `rgba(0,230,118,${0.3 * anim.ballScale})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const ballGrad = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.05, bx, by, r);
  if (state.current === STATES.CRASHED) {
    ballGrad.addColorStop(0, '#ff8c60');
    ballGrad.addColorStop(0.5, '#cc3010');
    ballGrad.addColorStop(1, '#6b0000');
  } else {
    ballGrad.addColorStop(0, '#fffde7');
    ballGrad.addColorStop(0.45, '#e0e0e0');
    ballGrad.addColorStop(1, '#a0a0a0');
  }
  ctx.fillStyle = ballGrad;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();

  const seamColor = state.current === STATES.CRASHED
    ? `rgba(90,0,0,${0.7 * anim.ballScale})`
    : `rgba(40,40,40,${0.4 * anim.ballScale})`;
  ctx.strokeStyle = seamColor; ctx.lineWidth = 1.2 * anim.ballScale;
  ctx.beginPath(); ctx.arc(bx, by, r * 0.65, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by, r * 0.65, Math.PI + 0.4, -0.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by, r * 0.55, -Math.PI * 0.6, -Math.PI * 0.4, false); ctx.stroke();

  const hiGrad = ctx.createRadialGradient(bx - r * 0.38, by - r * 0.38, 0, bx - r * 0.28, by - r * 0.28, r * 0.42);
  hiGrad.addColorStop(0, `rgba(255,255,255,${0.45 * anim.ballScale})`);
  hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hiGrad;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
}

function spawnParticles(x, y, color = '#00e676', count = CONFIG.PARTICLE_COUNT) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    anim.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      r: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles() {
  anim.particles = anim.particles.filter(p => p.life > 0);
  anim.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.12;
    p.life -= 0.025;
  });
  ctx.globalAlpha = 1;
}


/* =====================================================
   11. UI CONTROLLER
   ===================================================== */
const UI = (() => {
  const els = {
    multEl:      document.getElementById('mult-value'),
    statusEl:    document.getElementById('status-label'),
    histList:    document.getElementById('hist-list'),
    liveFeed:    document.getElementById('live-feed'),
    crashFlash:  document.getElementById('crash-flash'),
    fairVal:     document.getElementById('fair-val'),
    balEl:       document.getElementById('balance-display'),
    lbList:      document.getElementById('lb-list'),
    authGate:    document.getElementById('auth-gate'),
    authGateMsg: document.getElementById('auth-gate-msg'),
  };

  const feedItems = [];

  function updateBalance() {
    if (els.balEl) {
      els.balEl.textContent = CB.sym() + state.balance.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    }
  }

  function flashBalance(won) {
    if (!els.balEl) return;
    els.balEl.classList.remove('win-bump', 'lose-bump');
    void els.balEl.offsetWidth;
    els.balEl.classList.add(won ? 'win-bump' : 'lose-bump');
  }

  function updateMultiplierDisplay(value, stateClass) {
    if (!els.multEl) return;
    els.multEl.textContent = parseFloat(value).toFixed(2) + '×';
    els.multEl.className   = 'state-' + stateClass;
    if (stateClass === 'running') {
      const scale = Math.min(1 + (value - 1) * 0.012, 1.25);
      els.multEl.style.transform = `scale(${scale.toFixed(3)})`;
    } else {
      els.multEl.style.transform = '';
    }
  }

  function setStatus(text) { if (els.statusEl) els.statusEl.textContent = text; }

  function flashCrash() {
    if (!els.crashFlash) return;
    els.crashFlash.classList.add('show');
    setTimeout(() => els.crashFlash.classList.remove('show'), 350);
  }

  function addHistory(val) {
    state.history.unshift(parseFloat(val.toFixed(2)));
    if (state.history.length > CONFIG.MAX_HISTORY) state.history.pop();
    if (!els.histList) return;
    els.histList.innerHTML = '';
    state.history.forEach(v => {
      const el = document.createElement('span');
      el.className   = 'hist-item ' + (v < 1.8 ? 'hist-low' : v < 5 ? 'hist-mid' : 'hist-high');
      el.textContent = v.toFixed(2) + '×';
      els.histList.appendChild(el);
    });
  }

  function addFeedItem(name, multVal, amount) {
    if (!els.liveFeed) return;
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `<span class="feed-name">${name}</span><span class="feed-amt">${multVal}× ${CB.sym()}${amount}</span>`;
    els.liveFeed.prepend(el);
    feedItems.push(el);
    if (feedItems.length > CONFIG.MAX_FEED_ITEMS) { const old = feedItems.shift(); old.remove(); }
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; }, 3500);
    setTimeout(() => {
      if (el.parentNode) el.remove();
      const idx = feedItems.indexOf(el);
      if (idx !== -1) feedItems.splice(idx, 1);
    }, 4000);
  }

  function updateButtons() {
    for (let i = 0; i < 2; i++) {
      const btn      = document.getElementById(`btn-${i}`);
      const betInput = document.getElementById(`bet-${i}`);
      const autoInp  = document.getElementById(`auto-${i}`);
      const profitEl = document.getElementById(`profit-${i}`);
      if (!btn || !betInput) continue;
      const b = state.bets[i];

      betInput.disabled = state.current !== STATES.WAITING || gameLoopPaused;
      if (autoInp) autoInp.disabled = state.current !== STATES.WAITING || gameLoopPaused;

      if (gameLoopPaused) {
        btn.textContent = 'BET';
        btn.className   = 'action-btn bet-btn';
        btn.disabled    = true;
        if (profitEl) profitEl.textContent = '';
        continue;
      }

      if (state.current === STATES.WAITING) {
        btn.textContent = b.active ? 'CANCEL BET' : 'BET';
        btn.className   = b.active ? 'action-btn cancel-btn' : 'action-btn bet-btn';
        btn.disabled    = false;
        if (profitEl) profitEl.textContent = '';

      } else if (state.current === STATES.RUNNING) {
        if (b.active && !b.cashedOut) {
          btn.textContent = 'CASH OUT';
          btn.className   = 'action-btn cashout-btn';
          btn.disabled    = false;
          if (profitEl) {
            profitEl.textContent = '+$' + (b.amount * state.multiplier).toFixed(2);
            profitEl.style.color = '#00e676';
          }
        } else if (b.cashedOut) {
          btn.textContent = '✓ $' + b.winnings.toFixed(2);
          btn.className   = 'action-btn bet-btn';
          btn.disabled    = true;
          if (profitEl) {
            profitEl.textContent = '+$' + b.winnings.toFixed(2);
            profitEl.style.color = '#00e676';
          }
        } else {
          btn.textContent = 'BET (next round)';
          btn.className   = 'action-btn bet-btn';
          btn.disabled    = true;
          if (profitEl) profitEl.textContent = '';
        }

      } else {
        // CRASHED
        if (b.active && !b.cashedOut) {
          btn.textContent = '✗ LOST';
          btn.className   = 'action-btn lost-btn';
          btn.disabled    = true;
          if (profitEl) {
            profitEl.textContent = '-$' + b.amount.toFixed(2);
            profitEl.style.color = '#ff3d3d';
          }
        } else if (b.cashedOut) {
          btn.textContent = '✓ $' + b.winnings.toFixed(2);
          btn.className   = 'action-btn bet-btn';
          btn.disabled    = true;
          if (profitEl) {
            profitEl.textContent = '+$' + b.winnings.toFixed(2);
            profitEl.style.color = '#00e676';
          }
        } else {
          btn.textContent = 'BET';
          btn.className   = 'action-btn bet-btn';
          btn.disabled    = false;
          if (profitEl) profitEl.textContent = '';
        }
      }
    }
  }

  function updateFairnessDisplay() {
    if (els.fairVal) {
      els.fairVal.textContent = state.serverSeed
        ? `Seed: ${state.serverSeed.slice(0, 14)}…`
        : state.commitHash
          ? state.commitHash.slice(0, 14) + '…'
          : '—';
    }
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('serverSeedDisplay', state.serverSeed || '---');
    s('clientSeedDisplay', state.clientSeed || '---');
    s('nonceDisplay',      state.nonce      || '---');
    s('hashDisplay',       state.hash       || '---');
    s('crashPointDisplay', state.serverSeed ? state.crashPoint.toFixed(2) + '×' : 'Revealed after round');
  }

  function showAuthGate(message = 'Please sign in to play.') {
    if (!els.authGate) return;
    if (els.authGateMsg) els.authGateMsg.textContent = message;
    els.authGate.classList.remove('hidden');
  }

  function hideAuthGate() {
    if (!els.authGate) return;
    els.authGate.classList.add('hidden');
  }

  function wireFairnessModal() {
    const btnF = document.getElementById('btnFairness');
    const mb   = document.getElementById('modalBackdrop');
    const mc   = document.getElementById('modalClose');
    btnF?.addEventListener('click',  () => mb?.classList.add('visible'));
    mc?.addEventListener('click',    () => mb?.classList.remove('visible'));
    mb?.addEventListener('click', e => { if (e.target === mb) mb.classList.remove('visible'); });
  }

  return {
    updateBalance, flashBalance, updateMultiplierDisplay,
    setStatus, flashCrash, addHistory, addFeedItem,
    updateButtons, updateFairnessDisplay,
    showAuthGate, hideAuthGate, wireFairnessModal,
  };
})();

// Convenience wrappers
function updateBalance()              { UI.updateBalance(); }
function updateButtons()              { UI.updateButtons(); }
function updateFairnessDisplay()      { UI.updateFairnessDisplay(); }
function setStatus(text)              { UI.setStatus(text); }
function flashCrash()                 { UI.flashCrash(); }
function addHistory(val)              { UI.addHistory(val); }
function addFeedItem(n, m, a)         { UI.addFeedItem(n, m, a); }
function updateMultiplierDisplay(v,s) { UI.updateMultiplierDisplay(v, s); }


/* =====================================================
   12. BET & CASHOUT LOGIC
   ===================================================== */
async function toggleBet(i) {
  if (gameLoopPaused) return;
  if (state.current === STATES.RUNNING) { await cashout(i); return; }
  if (state.current !== STATES.WAITING) return;

  if (!Auth.isAuthenticated()) { UI.showAuthGate('Sign in to place bets.'); return; }

  const amountInput = parseFloat(document.getElementById(`bet-${i}`)?.value);
  if (!amountInput || amountInput <= 0) return;

  const b = state.bets[i];

  if (b.active) {
    state.balance = Math.floor((state.balance + b.amount) * 100) / 100;
    b.active  = false;
    b.amount  = 0;
    b.roundId = null;
    UI.updateBalance();
    UI.flashBalance(true);
    UI.updateButtons();
    return;
  }

  if (amountInput > state.balance) return;
  b.amount = Math.floor(amountInput * 100) / 100;

  state.balance = Math.floor((state.balance - b.amount) * 100) / 100;
  UI.updateBalance();

  try {
    const round = await API.games.play(CONFIG.GAME_SLUG, { stake: b.amount });
    b.roundId = round.id ?? null;
    if (round.walletBalance !== undefined) {
      state.balance = parseFloat(round.walletBalance);
      UI.updateBalance();
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      state.balance = Math.floor((state.balance + b.amount) * 100) / 100;
      UI.updateBalance();
      return;
    }
    console.warn('[toggleBet] API unavailable, keeping local deduction:', err.message);
  }

  b.active    = true;
  b.cashedOut = false;
  b.winnings  = 0;
  UI.updateBalance();
  UI.updateButtons();
}

async function cashout(i) {
  const b = state.bets[i];
  if (state.current !== STATES.RUNNING || !b.active || b.cashedOut) return;

  const cashoutAt = parseFloat(state.multiplier.toFixed(2));

  b.winnings    = Math.floor(b.amount * cashoutAt * 100) / 100;
  state.balance = Math.floor((state.balance + b.winnings) * 100) / 100;
  b.cashedOut   = true;

  spawnParticles(anim.ballX, anim.ballY, '#00e676', 24);
  UI.updateBalance();
  UI.flashBalance(true);
  UI.updateButtons();

  if (!Auth.isAuthenticated()) return;

  try {
    const data = await API.games.cashout(CONFIG.GAME_SLUG, {
      roundId:   b.roundId,
      cashoutAt,
    });
    if (data.walletBalance !== undefined) {
      state.balance = parseFloat(data.walletBalance);
    } else if (data.newBalance !== undefined) {
      state.balance = parseFloat(data.newBalance);
    } else if (data.payout !== undefined) {
      const serverWin = parseFloat(data.payout);
      state.balance   = Math.floor((state.balance - b.winnings + serverWin) * 100) / 100;
      b.winnings      = serverWin;
    }
    UI.updateBalance();
    UI.updateButtons();
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') return;
    console.warn('[cashout] API failed, keeping local win:', err.message);
  }
}

function checkAutoCashout() {
  for (let i = 0; i < 2; i++) {
    const val = parseFloat(document.getElementById(`auto-${i}`)?.value);
    const b   = state.bets[i];
    if (val && val >= 1.01 && b.active && !b.cashedOut && state.multiplier >= val) {
      cashout(i);
    }
  }
}

function setQuick(i, factor) {
  const inp = document.getElementById(`bet-${i}`);
  if (!inp) return;
  const cur = parseFloat(inp.value) || 0;
  inp.value = factor === 'max'
    ? Math.min(state.balance, 10000).toFixed(2)
    : Math.max(1, parseFloat((cur * factor).toFixed(2)));
}


/* =====================================================
   13. FAKE PLAYERS SYSTEM
   ===================================================== */
const fakeTimers = [];
const lbPlayers  = [];

function pickName()        { return CONFIG.FAKE_PLAYER_NAMES[Math.floor(Math.random() * CONFIG.FAKE_PLAYER_NAMES.length)]; }
function pickAvatarColor() { return CONFIG.AVATAR_COLORS[Math.floor(Math.random() * CONFIG.AVATAR_COLORS.length)]; }
function initials(name)    { return name.substring(0, 2).toUpperCase(); }

function scheduleFakeCashouts() {
  const count = 3 + Math.floor(Math.random() * 4);
  lbPlayers.length = 0;
  renderLeaderboard();

  for (let i = 0; i < count; i++) {
    const delay = 400 + Math.random() * 7000;
    fakeTimers.push(setTimeout(() => {
      if (state.current !== STATES.RUNNING) return;
      const name   = pickName();
      const color  = pickAvatarColor();
      const mult   = Math.min(state.multiplier * (0.7 + Math.random() * 0.6), state.crashPoint - 0.01);
      const bet    = 5 + Math.random() * 200;
      const profit = bet * mult;
      addFeedItem(name, mult.toFixed(2), profit.toFixed(0));
      addLeaderboardEntry(name, color, mult, bet, profit);
    }, delay));
  }
}

function cancelFakeTimers() { fakeTimers.forEach(clearTimeout); fakeTimers.length = 0; }

function addLeaderboardEntry(name, color, mult, bet, profit) {
  lbPlayers.push({ name, color, mult, profit });
  if (lbPlayers.length > 8) lbPlayers.shift();
  renderLeaderboard();
}

function renderLeaderboard() {
  const lbList = document.getElementById('lb-list');
  if (!lbList) return;
  lbList.innerHTML = '';
  lbPlayers.forEach(p => {
    const el = document.createElement('div');
    el.className = 'lb-item';
    el.innerHTML = `
      <div class="lb-avatar" style="background:${p.color}">${initials(p.name)}</div>
      <span class="lb-name">${p.name}</span>
      <span class="lb-mult" style="color:${p.mult >= 5 ? '#00e5ff' : p.mult >= 2 ? '#00e676' : '#aaa'}">${p.mult.toFixed(2)}×</span>
      <span class="lb-profit">+${CB.sym()}${p.profit.toFixed(0)}</span>
    `;
    lbList.appendChild(el);
  });
}


/* =====================================================
   14. GAME STATE MANAGER
   ===================================================== */
async function enterWaiting() {
  if (gameLoopPaused) return;

  state.current      = STATES.WAITING;
  state.multiplier   = 1.00;
  state.serverSeed   = '';
  state.waitDuration = CONFIG.WAIT_MIN + Math.random() * (CONFIG.WAIT_MAX - CONFIG.WAIT_MIN);
  state.waitStart    = performance.now();

  state.bets.forEach(b => {
    b.active    = false;
    b.cashedOut = false;
    b.winnings  = 0;
    b.roundId   = null;
  });
  anim.trailPoints = [];
  cancelFakeTimers();

  try {
    const localInfo  = await RNG.generateCrashPoint();
    state.crashPoint = localInfo.crash;
    state.commitHash = localInfo.hash;
    state.clientSeed = localInfo.clientSeed;
    state.nonce      = localInfo.nonce;
    state.hash       = localInfo.hash;
  } catch {
    state.crashPoint = RNG.generateCrashPointSync();
    state.commitHash = RNG.generateHash();
  }

  if (Auth.isAuthenticated()) {
    try {
      const data               = await API.games.currentRound(CONFIG.GAME_SLUG);
      state.currentRoundNumber = data.roundNumber ?? data.id ?? null;
      if (data.crashAt !== undefined)    state.crashPoint = parseFloat(data.crashAt);
      if (data.crashPoint !== undefined) state.crashPoint = parseFloat(data.crashPoint);
      if (data.commitHash)               state.commitHash = data.commitHash;
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') return;
      console.warn('[enterWaiting] API unavailable, using client RNG:', err.message);
    }
  }

  UI.updateFairnessDisplay();
  UI.updateButtons();
  updateMultiplierDisplay(1.00, 'waiting');
}

function enterRunning() {
  if (gameLoopPaused) return;
  state.current    = STATES.RUNNING;
  state.roundStart = performance.now();
  updateMultiplierDisplay(1.00, 'running');
  setStatus('Round in progress');
  scheduleFakeCashouts();
}

async function enterCrashed() {
  state.current    = STATES.CRASHED;
  state.multiplier = state.crashPoint;

  state.bets.forEach(b => { if (b.active && !b.cashedOut) b.active = false; });

  updateMultiplierDisplay(state.crashPoint, 'crashed');
  setStatus('Crashed at ' + state.crashPoint.toFixed(2) + '×');
  flashCrash();
  addHistory(state.crashPoint);
  spawnParticles(anim.ballX, anim.ballY, '#ff3d3d', 30);
  cancelFakeTimers();
  UI.updateButtons();

  if (state.currentRoundNumber && Auth.isAuthenticated()) {
    try {
      const data       = await API.games.reveal(CONFIG.GAME_SLUG, state.currentRoundNumber);
      state.serverSeed = data.serverSeed || '';
      UI.updateFairnessDisplay();
    } catch { /**/ }
  }

  if (Auth.isAuthenticated()) {
    setTimeout(async () => {
      try {
        const walletData  = await API.wallet.get();
        state.balance     = parseFloat(walletData.balance ?? walletData.amount ?? state.balance);
        UI.updateBalance();
        UI.flashBalance(false);
      } catch { /**/ }
    }, 800);
  }

  setTimeout(enterWaiting, 3000);
}


/* =====================================================
   15. GAME LOOP
   ===================================================== */
function tick(now) {
  anim.lastTime = now;

  if (!gameLoopPaused) {
    if (state.current === STATES.WAITING) {
      const elapsed   = now - state.waitStart;
      const remaining = Math.max(0, (state.waitDuration - elapsed) / 1000);
      updateMultiplierDisplay(1.00, 'waiting');
      setStatus(remaining > 0 ? `Next round in ${remaining.toFixed(1)}s` : 'Starting…');
      if (elapsed >= state.waitDuration) enterRunning();

    } else if (state.current === STATES.RUNNING) {
      const elapsed    = now - state.roundStart;
      state.multiplier = calcMultiplier(elapsed);
      checkAutoCashout();
      updateMultiplierDisplay(state.multiplier, 'running');

      if (state.multiplier >= state.crashPoint) enterCrashed();
    }

    if (state.current === STATES.RUNNING) UI.updateButtons();
  }

  // FIX: resizeCanvas is now safe to call every frame — it uses offsetWidth/Height
  // which do not read from the canvas's own size, breaking the feedback loop.
  resizeCanvas();
  updateBallPosition(now);
  drawBackground(now);
  drawTrail();
  drawGround();
  drawBall();
  updateParticles();

  requestAnimationFrame(tick);
}


/* =====================================================
   16. BOOTSTRAP
   ===================================================== */
async function init() {
  initStars();
  resizeCanvas();

  // FIX: Use ResizeObserver on the canvas PARENT instead of listening to window resize.
  // This fires only when the container genuinely changes size (e.g. orientation change,
  // browser chrome hide/show on mobile) — not every animation frame.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvas.parentElement);
  } else {
    // Fallback for older browsers
    window.addEventListener('resize', resizeCanvas);
  }

  AuthReactor.init();
  UI.wireFairnessModal();

  if (!Auth.isAuthenticated()) {
    UI.showAuthGate('Sign in to play.');
    gameLoopPaused = true;
    anim.lastTime  = performance.now();
    requestAnimationFrame(tick);
    return;
  }

  WSBus.connect(() => {
    Wallet.subscribe();

    WSBus.subscribe(`/topic/${CONFIG.GAME_SLUG}/state`, msg => {
      try {
        const payload = JSON.parse(msg.body);

        if (payload.state === 'CRASHED' && state.current === STATES.RUNNING) {
          state.crashPoint = parseFloat(payload.crashAt ?? payload.crashPoint ?? state.crashPoint);
          enterCrashed();
        }

        if (payload.state === 'RUNNING' && payload.multiplier !== undefined) {
          const serverMult = parseFloat(payload.multiplier);
          for (let i = 0; i < 2; i++) {
            const val = parseFloat(document.getElementById(`auto-${i}`)?.value);
            const b   = state.bets[i];
            if (val && val >= 1.01 && b.active && !b.cashedOut && serverMult >= val) cashout(i);
          }
        }
      } catch { /**/ }
    });
  });

  await Wallet.fetch();

  for (let i = 0; i < 6; i++) addHistory(RNG.generateCrashPointSync());

  await enterWaiting();

  anim.lastTime = performance.now();
  requestAnimationFrame(tick);
}

// Expose to HTML onclick handlers
window.toggleBet = toggleBet;
window.setQuick  = setQuick;

// Boot
init();