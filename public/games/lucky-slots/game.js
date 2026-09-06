/* =========================================
   LUCKY SLOTS — game.js
   Slot machine with animated reels
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
  GAME_SLUG:       'lucky-slots',
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

  // Cross-tab sync — if the user logs in/out in another tab, react here too
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

    const socket  = new SockJS(CONFIG.API_BASE + CONFIG.WS_ENDPOINT);
    client        = Stomp.over(socket);
    client.debug  = () => {};

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
    WSBus.disconnect();
    _pauseGame('Sign in to keep playing.');
  }

  function _onExpired() {
    console.warn('[AuthReactor] Session expired');
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
    ['spinBtn', 'clearBtn'].forEach(id => {
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
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐'];
const SYMBOL_VALUE = {
  '🍒': 2, '🍋': 3, '🍊': 4, '🍇': 5,
  '🔔': 10, '💎': 20, '7️⃣': 50, '⭐': 100
};

let state = {
  balance:    1000,
  betPerLine: 1,
  paylines:   20,
  spinning:   false,
  paused:     false,
  reels:      [[], [], [], [], []],
  stops:      [0, 0, 0, 0, 0],
  winAmount:  0,
  roundId:    null,
};

/* =========================================
   2. REEL INITIALIZATION
   ========================================= */
function initReels() {
  for (let r = 0; r < 5; r++) {
    state.reels[r] = [];
    for (let i = 0; i < 50; i++) {
      state.reels[r].push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }
  }
  renderReels();
}

function renderReels() {
  for (let r = 0; r < 5; r++) {
    const strip = document.getElementById(`strip${r + 1}`);
    if (!strip) return;
    strip.innerHTML = '';
    state.reels[r].forEach((sym, i) => {
      const div         = document.createElement('div');
      div.className     = 'symbol';
      div.textContent   = sym;
      div.dataset.index = i;
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

  const totalBet = state.betPerLine * state.paylines;
  if (totalBet > state.balance) {
    setMsg('Insufficient balance!');
    return;
  }

  // Debit server-side before animating
  try {
    const data    = await API.post(`/games/${CONFIG.GAME_SLUG}/play`, {
      stake:      totalBet,
      betPerLine: state.betPerLine,
      paylines:   state.paylines,
    });
    state.roundId  = data.id;
    state.balance  = parseFloat(data.walletBalance);
    updateBalance();
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') return;
    setMsg(e.message || 'Bet failed. Try again.');
    return;
  }

  state.spinning  = true;
  state.winAmount = 0;
  hideWinOverlay();
  clearWinningHighlights();

  document.getElementById('spinBtn').disabled = true;
  document.getElementById('msg').textContent  = '';

  const finalStops = [];
  for (let r = 0; r < 5; r++) {
    finalStops.push(Math.floor(Math.random() * 50));
  }

  finalStops.forEach((stop, idx) => {
    setTimeout(() => {
      animateReel(idx, stop, async () => {
        state.stops[idx] = stop;
        if (idx === 4) {
          state.spinning = false;
          document.getElementById('spinBtn').disabled = false;
          await checkWins();
        }
      });
    }, idx * 400);
  });
}

function animateReel(reelIdx, finalStop, callback) {
  const strip        = document.getElementById(`strip${reelIdx + 1}`);
  const startPos     = state.stops[reelIdx];
  const spinDistance = 50 + finalStop - startPos;
  const duration     = 1000 + reelIdx * 200;
  const startTime    = performance.now();

  function animate(now) {
    const elapsed    = now - startTime;
    const progress   = Math.min(elapsed / duration, 1);
    const eased      = 1 - Math.pow(1 - progress, 3);
    const currentPos = startPos + (spinDistance * eased);
    const displayPos = currentPos % 50;

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
  for (let r = 0; r < 5; r++) {
    const stop  = state.stops[r];
    visible[r]  = [
      state.reels[r][(stop - 1 + 50) % 50],
      state.reels[r][stop],
      state.reels[r][(stop + 1) % 50],
    ];
  }

  let totalWin      = 0;
  const activeLines = state.paylines;

  const lines = [
    { name: 'Line 1 (Middle)', row: 1, multiplier: 1 },
    { name: 'Line 2 (Top)',    row: 0, multiplier: 1 },
    { name: 'Line 3 (Bottom)', row: 2, multiplier: 1 },
  ];

  lines.forEach((line, lineIdx) => {
    if (lineIdx >= activeLines) return;
    const symbols = visible.map(r => r[line.row]);
    let matchCount = 1;
    for (let i = 1; i < 5; i++) {
      if (symbols[i] === symbols[0]) matchCount++;
      else break;
    }
    if (matchCount >= 3) {
      const lineWin = SYMBOL_VALUE[symbols[0]] * matchCount * state.betPerLine * line.multiplier;
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
        console.warn('[Slots] settle failed — using local calc:', e.message);
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
    triggerWinParticles();
  } else {
    updateBalance();
    setMsg('No win this time. Try again!', 'info');
  }
}

function highlightWin(lineIdx, symbol) {
  for (let r = 0; r < 5; r++) {
    const strip      = document.getElementById(`strip${r + 1}`);
    const symbols    = strip.querySelectorAll('.symbol');
    const stop       = state.stops[r];
    const visibleIdx = [(stop - 1 + 50) % 50, stop, (stop + 1) % 50];

    visibleIdx.forEach((idx) => {
      if (state.reels[r][idx] === symbol) {
        const el = symbols[idx];
        if (el) el.classList.add('winning');
      }
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
  const total = state.betPerLine * state.paylines;
  const el    = document.getElementById('totalBet');
  if (el) el.textContent = CB.sym() + total.toFixed(2);
}

function showWin(amount) {
  const winAmount = document.getElementById('winAmount');
  const overlay   = document.getElementById('winOverlay');
  const winText   = document.getElementById('winText');

  if (winAmount) winAmount.textContent = CB.sym() + amount.toFixed(2);

  let text = 'WIN!';
  if (amount >= 500)      text = 'MEGA WIN!';
  else if (amount >= 200) text = 'BIG WIN!';
  else if (amount >= 50)  text = 'NICE WIN!';
  if (winText) winText.textContent = text;

  if (overlay) overlay.classList.add('visible');
  setMsg(`Won ${CB.sym()}${amount.toFixed(2)}!`, 'win');
  setTimeout(() => hideWinOverlay(), 3000);
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
                    type === 'info' ? '#00D4FF' : '#888888';
}

/* =========================================
   6. BETTING CONTROLS
   ========================================= */
function adjBet(factor) {
  if (state.spinning || state.paused) return;
  const el = document.getElementById('betAmt');
  let v    = parseFloat(el.value) || 1;
  v        = Math.max(0.10, Math.min(100, Math.round(v * factor * 100) / 100));
  el.value          = v.toFixed(2);
  state.betPerLine  = v;
  updateTotalBet();
}

function setBet(val) {
  if (state.spinning || state.paused) return;
  document.getElementById('betAmt').value = val.toFixed(2);
  state.betPerLine = val;
  updateTotalBet();
}

function adjLines(delta) {
  if (state.spinning || state.paused) return;
  const sl = document.getElementById('linesSlider');
  const v  = Math.max(1, Math.min(20, parseInt(sl.value) + delta));
  sl.value = v;
  updateLines();
}

function updateLines() {
  if (state.spinning || state.paused) return;
  const val      = parseInt(document.getElementById('linesSlider').value);
  state.paylines = val;
  document.getElementById('linesCount').textContent = val;
  updateTotalBet();
}

function clearBet() {
  if (state.spinning || state.paused) return;
  state.betPerLine = 1;
  state.paylines   = 20;
  document.getElementById('betAmt').value      = '1.00';
  document.getElementById('linesSlider').value = '20';
  updateLines();
}

/* =========================================
   7. WIN PARTICLE EFFECTS
   ========================================= */
function triggerWinParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#FFB300', '#FFD700', '#00E676', '#00D4FF', '#E8003D'];

  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const p        = document.createElement('div');
      p.className    = 'particle';
      const x        = Math.random() * window.innerWidth;
      const color    = colors[Math.floor(Math.random() * colors.length)];
      const size     = 4 + Math.random() * 8;
      const duration = 1 + Math.random() * 2;

      p.style.cssText = `
        left: ${x}px;
        top: -10px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        box-shadow: 0 0 6px ${color};
        animation-duration: ${duration}s;
      `;

      container.appendChild(p);
      setTimeout(() => p.remove(), duration * 1000);
    }, i * 30);
  }
}

/* =========================================
   8. INIT
   ========================================= */
async function init() {
  AuthReactor.init();

  // Always render reels so the page looks alive regardless of auth state
  initReels();
  updateTotalBet();

  if (!Auth.isAuthenticated()) {
    // Show gate, disable controls — game resumes once auth:login fires
    state.paused = true;
    document.getElementById('spinBtn').disabled = true;
    window.dispatchEvent(new CustomEvent('auth:logout'));
    return;
  }

  WSBus.connect(() => Wallet.subscribe());
  await Wallet.fetch();
  updateBalance();
}

window.addEventListener('DOMContentLoaded', init);