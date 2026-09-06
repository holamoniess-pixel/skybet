/* =========================================
   FRUIT FRENZY — game.js
   Colorful fruit slot machine
   SpeedBet API v1 — April 2026
   Auth-reactive: responds to login, logout, token refresh, session expiry.
   ========================================= */

'use strict';

/* =========================================
   CONFIGURATION
   ========================================= */
const CONFIG = {
  API_BASE:        '',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'fruit-frenzy',
  RECONNECT_DELAY: 3000,
};

/* =========================================
   AUTH MANAGER
   Reactive auth layer — token storage, refresh, expiry handling.
   Emits 'auth:login', 'auth:logout', 'auth:expired' events on window.
   ========================================= */
const Auth = (() => {
  const TOKEN_KEY = 'skybet_token';
  const USER_KEY  = 'skybet_user';

  function getToken()        { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t)       { localStorage.setItem(TOKEN_KEY, t); }
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
    setUser(user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
  }

  function onLogout() {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  // Silent token refresh on 401 — fires auth:expired if refresh also fails
  async function handleExpiry() {
    try {
      const res = await fetch(CONFIG.API_BASE + '/api/auth/refresh', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
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

  // Cross-tab sync — if user logs in/out in another tab, react here too
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
    isAuthenticated, getUser, setUser,
    headers, onLogin, onLogout, handleExpiry,
  };
})();

/* =========================================
   API CLIENT
   REST helpers with automatic 401 → refresh → retry.
   ========================================= */
const API = (() => {
  async function request(method, path, body, retrying = false) {
    const url  = CONFIG.API_BASE + '/api' + path;
    const opts = {
      method,
      headers:     Auth.headers(),
      credentials: 'include',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (res.status === 401 && !retrying) {
      const refreshed = await Auth.handleExpiry();
      if (refreshed) return request(method, path, body, true);
      throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  return {
    get:  (path)       => request('GET',  path),
    post: (path, body) => request('POST', path, body),
  };
})();

/* =========================================
   WEBSOCKET BUS
   STOMP over SockJS with auto-reconnect.
   Tears down and re-connects on auth changes.
   ========================================= */
const WSBus = (() => {
  let client    = null;
  let connected = false;
  const subs    = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded — WebSocket disabled');
      return;
    }
    if (!Auth.isAuthenticated()) {
      console.warn('[WSBus] No auth token — skipping connect');
      return;
    }

    const socket = new SockJS(CONFIG.API_BASE + CONFIG.WS_ENDPOINT);
    client       = Stomp.over(socket);
    client.debug = () => {};

    const headers = Auth.getToken()
      ? { Authorization: `Bearer ${Auth.getToken()}` }
      : {};

    client.connect(headers, () => {
      connected = true;
      console.log('[WSBus] Connected');
      Object.entries(subs).forEach(([topic, cb]) => client.subscribe(topic, cb));
      if (onReady) onReady();
    }, (err) => {
      connected = false;
      console.warn('[WSBus] Disconnected — retrying in', CONFIG.RECONNECT_DELAY, 'ms', err);
      if (Auth.isAuthenticated()) {
        setTimeout(() => connect(onReady), CONFIG.RECONNECT_DELAY);
      }
    });
  }

  function subscribe(topic, callback) {
    subs[topic] = callback;
    if (connected && client) client.subscribe(topic, callback);
  }

  function disconnect() {
    if (client && connected) {
      try { client.disconnect(); } catch { /* ignore */ }
    }
    client    = null;
    connected = false;
  }

  function reconnect(onReady) {
    disconnect();
    connect(onReady);
  }

  return { connect, subscribe, disconnect, reconnect };
})();

/* =========================================
   WALLET MANAGER
   ========================================= */
const Wallet = (() => {
  async function fetch() {
    if (!Auth.isAuthenticated()) return;
    try {
      const data    = await API.get('/wallet/balance');
      state.balance = parseFloat(data.balance);
      updateBalance();
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') {
        console.error('[Wallet] Failed to fetch balance:', e.message);
      }
    }
  }

  function subscribe() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      const data    = JSON.parse(msg.body);
      state.balance = parseFloat(data.balance);
      updateBalance();
      const balEl   = document.getElementById('balanceDisplay');
      if (balEl) {
        balEl.classList.remove('flash-win', 'flash-lose');
        void balEl.offsetWidth;
        balEl.classList.add(parseFloat(data.delta) >= 0 ? 'flash-win' : 'flash-lose');
      }
    });
  }

  return { fetch, subscribe };
})();

/* =========================================
   AUTH REACTOR
   Centralised handler for all auth state changes.
   ========================================= */
const AuthReactor = (() => {
  function init() {
    window.addEventListener('auth:login',   _onLogin);
    window.addEventListener('auth:logout',  _onLogout);
    window.addEventListener('auth:expired', _onExpired);
  }

  async function _onLogin() {
    console.log('[AuthReactor] User logged in');
    WSBus.reconnect(() => Wallet.subscribe());
    await Wallet.fetch();
    _hideAuthGate();
    if (state.paused) {
      state.paused = false;
      _enableControls(true);
      initReels();
      updateBalance();
      updateTotalBet();
    }
  }

  function _onLogout() {
    console.log('[AuthReactor] User logged out');
    // Cancel any running auto-spin cleanly
    if (state.autoSpin) toggleAutoSpin(true);
    WSBus.disconnect();
    _pauseGame('Sign in to keep playing.');
  }

  function _onExpired() {
    console.warn('[AuthReactor] Session expired');
    if (state.autoSpin) toggleAutoSpin(true);
    WSBus.disconnect();
    _pauseGame('Your session expired. Please sign in again.');
  }

  function _pauseGame(message) {
    state.spinning = false;
    state.paused   = true;
    const spinBtn  = document.getElementById('spinBtn');
    if (spinBtn) spinBtn.disabled = true;
    _showAuthGate(message);
    state.balance = 0;
    updateBalance();
  }

  function _showAuthGate(message = 'Please sign in to play.') {
    let gate = document.getElementById('authGate');
    if (!gate) {
      gate           = document.createElement('div');
      gate.id        = 'authGate';
      gate.className = 'auth-gate';
      gate.innerHTML = `
        <div class="auth-gate-inner">
          <p id="authGateMsg" class="auth-gate-msg"></p>
          <a href="/auth/login" class="auth-gate-btn">Sign In</a>
        </div>`;
      document.body.appendChild(gate);
    }
    const msgEl = document.getElementById('authGateMsg');
    if (msgEl) msgEl.textContent = message;
    gate.classList.remove('hidden');
  }

  function _hideAuthGate() {
    const gate = document.getElementById('authGate');
    if (gate) gate.classList.add('hidden');
  }

  function _enableControls(enabled) {
    ['spinBtn', 'autoSpinCheck'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    document.querySelectorAll('.bet-btn, .stake-chip').forEach(b => {
      b.disabled = !enabled;
    });
  }

  return { init };
})();

/* =========================================
   1. GAME STATE
   ========================================= */
const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍉', '🍓', '🍒', '🍑', '🥝', '⭐'];
const FRUIT_VALUE = {
  '🍎': 2, '🍊': 2, '🍋': 3, '🍇': 3,
  '🍉': 5, '🍓': 5, '🍒': 10, '🍑': 10,
  '🥝': 20, '⭐': 50
};

let state = {
  balance:       1000,
  betAmount:     2,
  spinning:      false,
  paused:        false,   // true when unauthenticated
  autoSpin:      false,
  autoSpinCount: 0,
  reels:         [[], [], []],
  stops:         [0, 0, 0],
  winAmount:     0,
  roundId:       null,    // UUID from server after placeBet
};

/* =========================================
   2. REEL INITIALIZATION
   ========================================= */
function initReels() {
  for (let r = 0; r < 3; r++) {
    state.reels[r] = [];
    for (let i = 0; i < 30; i++) {
      state.reels[r].push(FRUITS[Math.floor(Math.random() * FRUITS.length)]);
    }
  }
  renderReels();
}

function renderReels() {
  for (let r = 0; r < 3; r++) {
    const strip = document.getElementById(`strip${r + 1}`);
    if (!strip) return;
    strip.innerHTML = '';
    state.reels[r].forEach((fruit) => {
      const div       = document.createElement('div');
      div.className   = 'symbol';
      div.textContent = fruit;
      strip.appendChild(div);
    });
    strip.style.transform = `translateY(${-state.stops[r] * 100}px)`;
  }
}

/* =========================================
   3. SPIN MECHANICS
   ========================================= */
async function spin() {
  if (state.spinning || state.paused) return;

  if (!Auth.isAuthenticated()) {
    setMsg('Please sign in to play!');
    return;
  }

  if (state.betAmount > state.balance) {
    setMsg('Insufficient balance!');
    return;
  }

  // Debit server-side before animating
  try {
    const data    = await API.post(`/games/${CONFIG.GAME_SLUG}/play`, {
      stake: state.betAmount,
    });
    state.roundId  = data.id;
    state.balance  = parseFloat(data.walletBalance);
    updateBalance();
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') return;
    setMsg(e.message || 'Bet failed. Try again.');
    // If auto-spin was running, stop it cleanly
    if (state.autoSpin) toggleAutoSpin(true);
    return;
  }

  state.spinning  = true;
  state.winAmount = 0;
  hideWinOverlay();
  clearWinningHighlights();

  document.getElementById('spinBtn').disabled = true;
  document.getElementById('msg').textContent  = '';

  const finalStops = [];
  for (let r = 0; r < 3; r++) {
    finalStops.push(Math.floor(Math.random() * 30));
  }

  finalStops.forEach((stop, idx) => {
    setTimeout(() => {
      animateReel(idx, stop, async () => {
        state.stops[idx] = stop;

        if (idx === 2) {
          state.spinning = false;
          document.getElementById('spinBtn').disabled = false;
          await checkWins();

          // Auto-spin continuation — only if still authenticated and not paused
          if (state.autoSpin && state.autoSpinCount > 0 && !state.paused) {
            state.autoSpinCount--;
            if (state.autoSpinCount > 0 && state.balance >= state.betAmount) {
              setTimeout(spin, 1000);
            } else {
              toggleAutoSpin(false);
            }
          }
        }
      });
    }, idx * 300);
  });
}

function animateReel(reelIdx, finalStop, callback) {
  const strip        = document.getElementById(`strip${reelIdx + 1}`);
  const startPos     = state.stops[reelIdx];
  const spinDistance = 30 + finalStop - startPos;
  const duration     = 800 + reelIdx * 150;
  const startTime    = performance.now();

  function animate(now) {
    const elapsed    = now - startTime;
    const progress   = Math.min(elapsed / duration, 1);
    const eased      = 1 - Math.pow(1 - progress, 3);
    const currentPos = startPos + (spinDistance * eased);
    const displayPos = currentPos % 30;

    strip.style.transform = `translateY(${-displayPos * 100}px)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      strip.style.transform = `translateY(${-finalStop * 100}px)`;
      callback();
    }
  }

  requestAnimationFrame(animate);
}

/* =========================================
   4. WIN DETECTION
   ========================================= */
async function checkWins() {
  const visible = [];
  for (let r = 0; r < 3; r++) {
    const stop  = state.stops[r];
    visible[r]  = [
      state.reels[r][(stop - 1 + 30) % 30],
      state.reels[r][stop],
      state.reels[r][(stop + 1) % 30],
    ];
  }

  let totalWin = 0;
  const winLines = [
    { name: 'Top Row',      row: 0,      multiplier: 1   },
    { name: 'Middle Row',   row: 1,      multiplier: 1   },
    { name: 'Bottom Row',   row: 2,      multiplier: 1   },
    { name: 'Diagonal ↘',  diagonal: true, start: 0,  multiplier: 1.5 },
    { name: 'Diagonal ↗',  diagonal: true, start: 2,  multiplier: 1.5 },
  ];

  winLines.forEach((line, lineIdx) => {
    let symbols;
    if (line.diagonal) {
      symbols = [
        visible[0][line.start],
        visible[1][1],
        visible[2][line.start === 0 ? 2 : 0],
      ];
    } else {
      symbols = visible.map(r => r[line.row]);
    }

    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      const lineWin = FRUIT_VALUE[symbols[0]] * state.betAmount * line.multiplier;
      totalWin += lineWin;
      highlightWin(lineIdx, symbols[0]);
    }
  });

  // Settle with server — server is authoritative on balance
  let serverBalance = null;
  if (state.roundId) {
    try {
      const settled = await API.post(`/games/${CONFIG.GAME_SLUG}/settle`, {
        roundId:  state.roundId,
        localWin: totalWin,
      });
      serverBalance = parseFloat(settled.newBalance);
      if (settled.payout !== undefined) totalWin = parseFloat(settled.payout);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') {
        console.warn('[FruitFrenzy] settle failed — using local calc:', e.message);
      }
    }
  }

  if (serverBalance !== null) {
    state.balance = serverBalance;
  } else if (totalWin > 0) {
    state.balance += totalWin;
  }

  state.roundId = null;

  if (totalWin > 0) {
    state.winAmount = totalWin;
    updateBalance();
    showWin(totalWin);
    triggerFruitExplosion();
    spawnFloatingFruits();
  } else {
    updateBalance();
    setMsg('No win this time. Try again!', 'info');
  }
}

function highlightWin(lineIdx, fruit) {
  for (let r = 0; r < 3; r++) {
    const symbols = document.querySelectorAll(`#strip${r + 1} .symbol`);
    symbols.forEach((el) => {
      if (el.textContent === fruit) el.classList.add('winning');
    });
  }
}

function clearWinningHighlights() {
  document.querySelectorAll('.symbol.winning').forEach(el => {
    el.classList.remove('winning');
  });
}

/* =========================================
   5. UI UPDATES
   ========================================= */
function updateBalance() {
  const el = document.getElementById('balanceDisplay');
  if (el) el.textContent = CB.sym() + state.balance.toFixed(2);
}

function updateTotalBet() {
  const el = document.getElementById('totalBet');
  if (el) el.textContent = CB.sym() + state.betAmount.toFixed(2);
}

function showWin(amount) {
  const winAmountEl   = document.getElementById('winAmount');
  const winTextEl     = document.getElementById('winText');
  const winMultEl     = document.getElementById('winMultiplier');
  const overlay       = document.getElementById('winOverlay');

  if (winAmountEl) winAmountEl.textContent = CB.sym() + amount.toFixed(2);

  let text = 'FRUIT WIN!';
  let mult = '1×';
  if (amount >= state.betAmount * 30)      { text = 'JACKPOT!';  mult = '50×'; }
  else if (amount >= state.betAmount * 15) { text = 'BIG WIN!';  mult = '20×'; }
  else if (amount >= state.betAmount * 5)  { text = 'NICE WIN!'; mult = '10×'; }

  if (winTextEl) winTextEl.textContent = text;
  if (winMultEl) winMultEl.textContent = mult;
  if (overlay)   overlay.classList.add('visible');

  setMsg(`Won ${CB.sym()}${amount.toFixed(2)}!`, 'win');
  setTimeout(hideWinOverlay, 3000);
}

function hideWinOverlay() {
  const overlay = document.getElementById('winOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function setMsg(text, type) {
  const msg = document.getElementById('msg');
  if (!msg) return;
  msg.textContent = text;
  msg.style.color = type === 'win'  ? '#00E676' :
                    type === 'info' ? '#FFB300' : '#888888';
}

/* =========================================
   6. BETTING CONTROLS
   ========================================= */
function adjBet(factor) {
  if (state.spinning || state.paused) return;
  const el = document.getElementById('betAmt');
  let v    = parseFloat(el.value) || 2;
  v        = Math.max(0.50, Math.min(100, Math.round(v * factor * 100) / 100));
  el.value        = v.toFixed(2);
  state.betAmount = v;
  updateTotalBet();
}

function setBet(val) {
  if (state.spinning || state.paused) return;
  document.getElementById('betAmt').value = val.toFixed(2);
  state.betAmount = val;
  updateTotalBet();
}

function clearBet() {
  if (state.spinning || state.paused) return;
  state.betAmount = 2;
  document.getElementById('betAmt').value = '2.00';
  updateTotalBet();
}

function toggleAutoSpin(forceOff) {
  if (state.paused) return;
  const check = document.getElementById('autoSpinCheck');
  if (forceOff) check.checked = false;

  state.autoSpin = check.checked;
  if (state.autoSpin) {
    state.autoSpinCount = parseInt(document.getElementById('autoSpinCount').value) || 10;
    if (!state.spinning && state.balance >= state.betAmount) {
      spin();
    }
  }
}

/* =========================================
   7. FRUIT CANVAS ANIMATIONS
   ========================================= */
const FruitCanvas = (() => {
  const canvas = document.getElementById('fruitCanvas');
  if (!canvas) return { init: () => {}, spawnFruit: () => {} };
  const ctx    = canvas.getContext('2d');
  let fruits   = [];

  function init() {
    resize();
    window.addEventListener('resize', resize);
    loop(0);
  }

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function spawnFruit(x, y, emoji) {
    fruits.push({
      x, y,
      vx:       (Math.random() - 0.5) * 8,
      vy:       -Math.random() * 12 - 5,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      emoji,
      life:     1,
      size:     30 + Math.random() * 20,
    });
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    fruits = fruits.filter(f => {
      f.x        += f.vx;
      f.y        += f.vy;
      f.vy       += 0.3;
      f.rotation += f.rotSpeed;
      f.life     -= 0.008;
      if (f.life <= 0 || f.y > H + 50) return false;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation * Math.PI / 180);
      ctx.globalAlpha    = f.life;
      ctx.font           = `${f.size}px serif`;
      ctx.textAlign      = 'center';
      ctx.textBaseline   = 'middle';
      ctx.fillText(f.emoji, 0, 0);
      ctx.restore();
      return true;
    });
  }

  return { init, spawnFruit };
})();

function triggerFruitExplosion() {
  const W      = window.innerWidth;
  const H      = window.innerHeight / 2;
  const emojis = ['🍎', '🍊', '🍋', '🍇', '🍉', '🍓', '🍒', '⭐'];

  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      FruitCanvas.spawnFruit(
        Math.random() * W,
        H,
        emojis[Math.floor(Math.random() * emojis.length)]
      );
    }, i * 50);
  }
}

function spawnFloatingFruits() {
  const container = document.getElementById('particles');
  if (!container) return;
  const emojis = ['🍎', '🍊', '🍋', '🍇', '🍉', '🍓'];

  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const p       = document.createElement('div');
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.cssText = `
        position: fixed;
        left: ${Math.random() * 100}%;
        top: -30px;
        font-size: ${20 + Math.random() * 20}px;
        z-index: 100;
        pointer-events: none;
        animation: fruitFall ${2 + Math.random() * 2}s linear forwards;
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }, i * 100);
  }
}

// Fruit fall keyframe
const style       = document.createElement('style');
style.textContent = `
  @keyframes fruitFall {
    0%   { transform: translateY(0) rotate(0deg);    opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
`;
document.head.appendChild(style);

/* =========================================
   8. INIT
   ========================================= */
async function init() {
  AuthReactor.init();

  // Always render reels and start canvas so the page looks alive
  initReels();
  updateTotalBet();
  FruitCanvas.init();

  if (!Auth.isAuthenticated()) {
    state.paused = true;
    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) spinBtn.disabled = true;
    // Trigger logout event to show the auth gate
    window.dispatchEvent(new CustomEvent('auth:logout'));
    return;
  }

  WSBus.connect(() => Wallet.subscribe());
  await Wallet.fetch();
  updateBalance();
}

window.addEventListener('DOMContentLoaded', init);