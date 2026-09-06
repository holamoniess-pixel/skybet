/* =============================================
   MINES GAME — SportyBet Style
   game.js — Fully Integrated (May 2026)

   Architecture mirrors Aviator/SpeedBet API v1 pattern:
     1.  CONFIG          — shared constants
     2.  SpeedBetAPI     — token helpers + REST (GET/POST/PATCH) with 401→refresh→retry
     3.  WSBus           — STOMP/SockJS hub with auto-reconnect (mirrors Aviator)
     4.  Wallet          — balance fetch + optimistic credits/debits + WS sync
     5.  AuthReactor     — central login/logout/expiry handler + form wiring
     6.  Fairness        — provably-fair SHA-256 hash verification
     7.  State           — central state manager
     8.  SVG Assets      — diamond & bomb graphics
     9.  Multiplier       — deterministic payout calculation
    10.  Grid             — tile build & interaction
    11.  Stats            — UI stat panel updates
    12.  Effects          — particles, explosions, rain
    13.  GameCore         — orchestrates all modules (init / pause / resume)

   FIXES vs previous version:
     [Bug 1] Double-click race on clickTile — _starting flag blocks re-entry before API responds
     [Bug 2] Optimistic debit now happens BEFORE the /start API call (matches Aviator pattern)
     [Bug 3] state.balance getter/setter removed — all balance access goes directly through Wallet
     [Fix 4] credentials:'include' removed from _req — matches Aviator; avoids CORS preflight issues
     [Fix 5] _cashingOut flag added to cashOut() to block double-tap during HTTP round-trip
   ============================================= */

'use strict';

/* ═══════════════════════════════════════════════
   1. CONFIG — must match application.yaml
   ═══════════════════════════════════════════════ */
const CONFIG = {
  GAME_SLUG:       'mines',
  BASE:            'https://speedbetbackend-production.up.railway.app',
  API_BASE:        '/api',
  WS_ENDPOINT:     '/ws',
  GRID_SIZE:       25,
  RTP:             0.97,
  RECONNECT_DELAY: 3000,
};

/* ═══════════════════════════════════════════════
   2. SPEEDBET API SERVICE
   ═══════════════════════════════════════════════ */
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

  const getUserId = () =>
    document.querySelector('meta[name="user-id"]')?.content
    || getUser()?.id
    || null;

  // ── Core fetch ─────────────────────────────────────────────
  // [Fix 4] credentials:'include' removed — matches Aviator pattern, avoids CORS preflight
  async function _req(path, options = {}, auth = false, retrying = false) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else       console.warn(`[SpeedBetAPI] auth=true but no token for ${path}`);
    }
    let res;
    try {
      res = await fetch(CONFIG.BASE + CONFIG.API_BASE + path, { ...options, headers });
    } catch (e) {
      throw new Error('NETWORK_ERROR');
    }

    if (res.status === 401 && !retrying) {
      const refreshed = await _silentRefresh();
      if (refreshed) return _req(path, options, auth, true);
      throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try { const err = await res.json(); message = err.message ?? err.error ?? message; } catch { /* ignore */ }
      throw new Error(message);
    }

    const json = await res.json();
    return json?.data !== undefined ? json.data : json;
  }

  async function _silentRefresh() {
    try {
      const res = await fetch(CONFIG.BASE + CONFIG.API_BASE + '/auth/refresh', {
        method:  'POST',
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

  const _get   = (path, auth = false)        => _req(path, { method: 'GET' }, auth);
  const _post  = (path, body, auth = false)  => _req(path, { method: 'POST',  body: JSON.stringify(body) }, auth);
  const _patch = (path, body, auth = false)  => _req(path, { method: 'PATCH', body: JSON.stringify(body) }, auth);

  const auth = {
    login: async (email, password) => {
      const data = await _post('/auth/login', { email, password });
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    register: async payload => {
      const data = await _post('/auth/register', payload);
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    demoLogin: async (role = 'USER') => {
      const data = await _post('/auth/demo-login', { role });
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
      return data;
    },
    refresh: async () => {
      const data = await _post('/auth/refresh', undefined, true);
      setToken(data.accessToken);
      return data;
    },
    logout: async () => {
      try { await _post('/auth/logout', undefined, true); } finally { clearToken(); }
    },
  };

  const wallet = {
    get:          ()               => _get('/wallet', true),
    transactions: (p = 0, s = 20) => _get(`/wallet/transactions?page=${p}&size=${s}`, true),
    withdraw:     payload          => _post('/wallet/withdraw', payload, true),
  };

  const games = {
    start:   payload      => _post('/games/mines/start',   payload, true),
    reveal:  payload      => _post('/games/mines/reveal',  payload, true),
    cashout: payload      => _post('/games/mines/cashout', payload, true),
    history: (limit = 20) => _get(`/games/history?limit=${limit}`, true),
  };

  const user = {
    me:     ()      => _get('/users/me', true),
    update: payload => _patch('/users/me', payload, true),
  };

  // Cross-tab token sync
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
    getUser, setUser, getUserId,
    isAuthed,
    auth, wallet, games, user,
  };
})();

/* ═══════════════════════════════════════════════
   3. WSBUS — STOMP / SockJS WebSocket Hub
   ═══════════════════════════════════════════════ */
const WSBus = (() => {
  let client    = null;
  let connected = false;
  const pending = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded — WebSocket disabled');
      return;
    }
    if (!SpeedBetAPI.isAuthed()) {
      console.warn('[WSBus] No auth token — skipping WebSocket connect');
      return;
    }

    const socket = new SockJS(CONFIG.BASE + CONFIG.WS_ENDPOINT);
    client       = Stomp.over(socket);
    client.debug = () => {};

    const wsHeaders = SpeedBetAPI.getToken()
      ? { Authorization: `Bearer ${SpeedBetAPI.getToken()}` }
      : {};

    client.connect(wsHeaders, () => {
      connected = true;
      console.log('[WSBus] Connected');
      Object.entries(pending).forEach(([topic, cb]) => client.subscribe(topic, cb));
      if (onReady) onReady();
    }, () => {
      connected = false;
      console.warn('[WSBus] Disconnected');
      if (SpeedBetAPI.isAuthed()) {
        setTimeout(() => connect(onReady), CONFIG.RECONNECT_DELAY);
      }
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

/* ═══════════════════════════════════════════════
   4. WALLET — Optimistic balance + server sync
   ═══════════════════════════════════════════════ */
const Wallet = (() => {
  let _balance = 0;

  async function fetch() {
    if (!SpeedBetAPI.isAuthed()) return;
    try {
      const data = await SpeedBetAPI.wallet.get();
      _balance = parseFloat(data.balance ?? data.amount ?? _balance);
      _updateUI();
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR') {
        console.warn('[Wallet] fetch failed:', e.message);
      }
    }
  }

  function subscribeWS() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data = JSON.parse(msg.body);
        const prev = _balance;
        _balance = parseFloat(data.balance ?? data.amount ?? _balance);
        _updateUI();
        const el = document.getElementById('balance');
        if (el) {
          el.classList.remove('balance-win', 'balance-lose');
          void el.offsetWidth;
          el.classList.add(_balance >= prev ? 'balance-win' : 'balance-lose');
        }
      } catch { /* ignore */ }
    });
  }

  function _updateUI() { updateBalance(); }

  const get    = ()  => _balance;
  const set    = v   => { _balance = parseFloat(v); };
  const deduct = amt => { _balance = Math.max(0, parseFloat((_balance - parseFloat(amt)).toFixed(2))); };
  const credit = amt => { _balance = parseFloat((_balance + parseFloat(amt)).toFixed(2)); };

  return { fetch, subscribeWS, get, set, deduct, credit };
})();

/* ═══════════════════════════════════════════════
   5. AUTH REACTOR
   ═══════════════════════════════════════════════ */
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
    const authError   = document.getElementById('authError');

    if (btnLogin) {
      btnLogin.addEventListener('click', async () => {
        const email    = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value;
        if (!email || !password) {
          if (authError) authError.textContent = 'Enter email and password.';
          return;
        }
        if (authError) authError.textContent = '';
        btnLogin.disabled = true;
        try {
          const data = await SpeedBetAPI.auth.login(email, password);
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        } catch (e) {
          if (authError) authError.textContent = e.message || 'Login failed.';
        } finally {
          btnLogin.disabled = false;
        }
      });
    }

    if (btnDemoUser) {
      btnDemoUser.addEventListener('click', async () => {
        if (authError) authError.textContent = '';
        btnDemoUser.disabled = true;
        try {
          const data = await SpeedBetAPI.auth.demoLogin('USER');
          window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        } catch (e) {
          console.warn('[AuthReactor] demo-login unavailable, running offline:', e.message);
          hideAuthGate();
          updateBalance();
        } finally {
          btnDemoUser.disabled = false;
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
    console.log('[AuthReactor] User logged in:', e.detail?.user?.email);
    WSBus.reconnect(() => Wallet.subscribeWS());
    await Wallet.fetch();
    hideAuthGate();
    if (state._paused) GameCore.resume();
  }

  function _onLogout() {
    console.log('[AuthReactor] User logged out');
    WSBus.disconnect();
    GameCore.pause('Sign in to keep playing.');
  }

  function _onExpired() {
    console.warn('[AuthReactor] Session expired');
    WSBus.disconnect();
    GameCore.pause('Your session expired. Please sign in again.');
  }

  return { init };
})();

/* ═══════════════════════════════════════════════
   6. FAIRNESS — Provably-Fair SHA-256 Verification
   ═══════════════════════════════════════════════ */
const Fairness = (() => {
  async function verify(serverSeed, userId, roundId, commitHash) {
    if (!serverSeed || !userId || !roundId || !commitHash) return false;
    try {
      const raw = serverSeed + userId + roundId;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hex = Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const ok = hex === commitHash;
      _showResult(ok, hex);
      return ok;
    } catch (err) {
      console.error('[Fairness] verification error:', err);
      return false;
    }
  }

  function _showResult(ok, hash) {
    const el = document.getElementById('fair-hash');
    if (!el) return;
    el.textContent = ok
      ? `✓ Verified — ${hash.slice(0, 16)}…`
      : `✗ Mismatch — ${hash.slice(0, 16)}…`;
    el.style.color = ok ? '#22c55e' : '#ff4444';
  }

  function showCommitHash(hash) {
    const el = document.getElementById('fair-hash');
    if (el) el.textContent = hash ? hash.slice(0, 20) + '…' : '—';
  }

  return { verify, showCommitHash };
})();

/* ═══════════════════════════════════════════════
   7. STATE — Central State Manager

   [Bug 3 fixed] state.balance getter/setter removed.
   All balance reads use Wallet.get(), all writes use
   Wallet.set() / Wallet.deduct() / Wallet.credit().
   The old getter/setter was lost silently after every
   `state = { ...state }` spread in newGame().
   ═══════════════════════════════════════════════ */
let state = {
  active:      false,
  gameOver:    false,
  bombs:       [],
  revealed:    [],
  diamonds:    0,
  bet:         10,
  bombCount:   3,

  roundId:     null,
  commitHash:  null,

  // In-flight guards (see Bug 1, Bug 5 fixes)
  _starting:   false,   // true while /start HTTP request is in-flight
  _cashingOut: false,   // true while /cashout HTTP request is in-flight

  _paused:     false,
};

/* ═══════════════════════════════════════════════
   AUTH GATE UI HELPERS
   ═══════════════════════════════════════════════ */
function showAuthGate(message = 'Please sign in to play.') {
  const gate = document.getElementById('authGate');
  const msg  = document.getElementById('authGateMsg');
  if (gate) gate.classList.remove('hidden');
  if (msg)  msg.textContent = message;
  const btn = document.getElementById('startBtn');
  if (btn) btn.disabled = true;
}

function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.add('hidden');
  const btn = document.getElementById('startBtn');
  if (btn) btn.disabled = false;
}

/* ═══════════════════════════════════════════════
   8. SVG ASSETS — Diamond & Bomb
   ═══════════════════════════════════════════════ */
function diamondSVG() {
  return `<svg class="diamond-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   style="stop-color:#e0f9ff"/>
        <stop offset="30%"  style="stop-color:#7dd3fc"/>
        <stop offset="60%"  style="stop-color:#38bdf8"/>
        <stop offset="100%" style="stop-color:#0284c7"/>
      </linearGradient>
      <linearGradient id="dg2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   style="stop-color:#f0feff;stop-opacity:0.9"/>
        <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:0.5"/>
      </linearGradient>
      <filter id="df1">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
        <feColorMatrix in="blur" type="matrix"
          values="1 0 0 0 0.2  0 1 0 0 0.9  0 0 1 0 1  0 0 0 18 -7" result="glow"/>
        <feBlend in="SourceGraphic" in2="glow" mode="screen"/>
      </filter>
    </defs>
    <polygon points="50,5 90,35 50,95 10,35" fill="url(#dg1)" filter="url(#df1)"/>
    <polygon points="50,5 90,35 50,35" fill="url(#dg2)" opacity="0.6"/>
    <polygon points="50,5 10,35 50,35" fill="#e0f9ff" opacity="0.25"/>
    <polygon points="10,35 50,95 50,65" fill="#0369a1" opacity="0.4"/>
    <polygon points="90,35 50,95 50,65" fill="#0284c7" opacity="0.5"/>
    <polygon points="50,35 70,42 50,65 30,42" fill="#7dd3fc" opacity="0.3"/>
    <line x1="50" y1="0"  x2="50" y2="8"  stroke="#e0f9ff" stroke-width="1.5" opacity="0.8"/>
    <line x1="46" y1="4"  x2="54" y2="4"  stroke="#e0f9ff" stroke-width="1.5" opacity="0.8"/>
    <line x1="92" y1="28" x2="98" y2="22" stroke="#a8edff" stroke-width="1"   opacity="0.7"/>
    <line x1="94" y1="22" x2="98" y2="28" stroke="#a8edff" stroke-width="1"   opacity="0.7"/>
    <polygon points="50,5 90,35 50,95 10,35" fill="none"
      stroke="#a8edff" stroke-width="0.8" opacity="0.6"/>
    <line x1="10" y1="35" x2="90" y2="35" stroke="#e0f9ff" stroke-width="0.6" opacity="0.4"/>
    <line x1="50" y1="5"  x2="50" y2="95" stroke="#e0f9ff" stroke-width="0.4" opacity="0.2"/>
  </svg>`;
}

function bombSVG() {
  return `<svg class="bomb-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg1" cx="40%" cy="35%" r="60%">
        <stop offset="0%"   style="stop-color:#555"/>
        <stop offset="100%" style="stop-color:#111"/>
      </radialGradient>
      <radialGradient id="bg2" cx="30%" cy="30%" r="40%">
        <stop offset="0%"   style="stop-color:#888;stop-opacity:0.5"/>
        <stop offset="100%" style="stop-color:transparent"/>
      </radialGradient>
      <filter id="bombGlow">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feFlood flood-color="#ff4444" flood-opacity="0.6" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="shadow"/>
        <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="72" cy="20" r="5" fill="#f59e0b" opacity="0.9" filter="url(#bombGlow)">
      <animate attributeName="opacity" values="0.9;0.4;0.9" dur="0.4s" repeatCount="indefinite"/>
      <animate attributeName="r"       values="5;7;5"       dur="0.4s" repeatCount="indefinite"/>
    </circle>
    <path d="M60,32 Q66,20 72,20" fill="none" stroke="#888"
      stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="48" cy="58" r="30" fill="url(#bg1)" filter="url(#bombGlow)"/>
    <circle cx="48" cy="58" r="30" fill="url(#bg2)"/>
    <rect   x="45"  y="26"  width="6"  height="10" rx="3" fill="#666"/>
    <circle cx="20" cy="48" r="3.5" fill="#555"/>
    <circle cx="76" cy="48" r="3.5" fill="#555"/>
    <circle cx="28" cy="30" r="3"   fill="#555"/>
    <circle cx="68" cy="30" r="3"   fill="#555"/>
    <circle cx="22" cy="68" r="3"   fill="#555"/>
    <circle cx="74" cy="68" r="3"   fill="#555"/>
    <circle cx="48" cy="87" r="3.5" fill="#555"/>
    <ellipse cx="38" cy="46" rx="8" ry="5" fill="#fff" opacity="0.12"
      transform="rotate(-30,38,46)"/>
    <line x1="42" y1="52" x2="35" y2="62" stroke="#ff4444" stroke-width="1" opacity="0.4"/>
    <line x1="54" y1="55" x2="60" y2="65" stroke="#ff4444" stroke-width="1" opacity="0.3"/>
  </svg>`;
}

function unknownTileInner() {
  return `<div class="tile-inner"></div>`;
}

/* ═══════════════════════════════════════════════
   9. MULTIPLIER — Deterministic Payout Calculation
   Must match MinesService.calcMultiplier() exactly.
   ═══════════════════════════════════════════════ */
function getMultiplier(diamonds, bombs, total = CONFIG.GRID_SIZE) {
  if (diamonds === 0) return 1.0;
  let safe = total - bombs;
  let prob = 1;
  for (let i = 0; i < diamonds; i++) {
    prob *= (safe - i) / (total - i);
  }
  return Math.round((1 / prob) * CONFIG.RTP * 100) / 100;
}

/* ═══════════════════════════════════════════════
   10. GRID — Tile Build & Interaction
   ═══════════════════════════════════════════════ */
function buildGrid() {
  const g = document.getElementById('grid');
  if (!g) return;
  g.innerHTML = '';
  for (let i = 0; i < CONFIG.GRID_SIZE; i++) {
    const t       = document.createElement('div');
    t.className   = 'tile';
    t.dataset.idx = i;
    t.innerHTML   = unknownTileInner();
    t.addEventListener('click', () => clickTile(i, t));
    g.appendChild(t);
  }
}

function syncMines() {
  const sl = document.getElementById('mineSlider');
  if (!sl) return;
  const v = +sl.value;
  state.bombCount = v;
  const mc = document.getElementById('minesCount');
  if (mc) mc.textContent = v;
  updateStats(0, v);
  updateSafeBar(CONFIG.GRID_SIZE, v);
}

function adjMines(d) {
  const sl = document.getElementById('mineSlider');
  if (!sl) return;
  const v  = Math.max(1, Math.min(24, +sl.value + d));
  sl.value = v;
  syncMines();
}

function adjBet(factor) {
  if (state.active) return;
  const el = document.getElementById('betAmt');
  if (!el) return;
  let v = parseFloat(el.value) || 10;
  v = Math.max(1, Math.min(10000, Math.round(v * factor * 100) / 100));
  el.value = v;
}

function setBet(val) {
  if (state.active) return;
  const el = document.getElementById('betAmt');
  if (el) el.value = val;
}

/* ─────────────────────────────────────────────────────────────
   clickTile
   [Bug 1 fixed] _starting flag blocks re-entry before the
                 /start API responds, preventing double-click
                 from firing two round-start requests.
   [Bug 2 fixed] Wallet.deduct() is now called BEFORE the API
                 call (optimistic debit), matching Aviator.
                 If the API throws, we refund immediately.
   ───────────────────────────────────────────────────────────── */
async function clickTile(idx, el) {
  if (state.gameOver)               return;
  if (state.revealed.includes(idx)) return;
  if (state._paused)                return;

  if (!SpeedBetAPI.isAuthed()) {
    showAuthGate('Sign in to place bets.');
    return;
  }

  // ── First click: start round server-side ──────────────────
  if (!state.active) {
    // [Bug 1] block re-entry while the HTTP request is in-flight
    if (state._starting) return;

    const bet = parseFloat(document.getElementById('betAmt').value) || 10;
    if (bet > Wallet.get()) {
      setMsg('Insufficient balance!', 'lose');
      return;
    }

    state.bet       = bet;
    state.bombCount = +document.getElementById('mineSlider').value;

    // [Bug 2] Optimistic debit BEFORE API call — matches Aviator pattern
    state._starting = true;
    Wallet.deduct(state.bet);
    updateBalance();

    try {
      const res = await SpeedBetAPI.games.start({
        stake:        state.bet,
        bombCount:    state.bombCount,
        firstTileIdx: idx,
      });

      state.roundId    = res.roundId;
      state.commitHash = res.commitHash;
      Fairness.showCommitHash(res.commitHash);

      state.active   = true;
      state.revealed = [idx];
      state.diamonds = res.diamondsFound;

      activateGameUI();
      applyDiamond(idx, el);
      updateStats(state.diamonds, state.bombCount);
      updateSafeBar(CONFIG.GRID_SIZE - state.revealed.length, state.bombCount);
      setMsg(
        `💎 Diamond! Multiplier: ${res.multiplier.toFixed(2)}× — Cash out GHS ${(state.bet * res.multiplier).toFixed(2)}`,
        'info'
      );

    } catch (err) {
      // [Bug 2] Refund the optimistic debit if the API fails
      Wallet.credit(state.bet);
      updateBalance();
      if (err.message !== 'SESSION_EXPIRED') {
        setMsg(`Error starting round: ${err.message}`, 'lose');
      }
    } finally {
      // [Bug 1] Always clear the in-flight flag
      state._starting = false;
    }
    return;
  }

  // ── Subsequent clicks: reveal tile server-side ────────────
  try {
    const res = await SpeedBetAPI.games.reveal({
      roundId: state.roundId,
      tileIdx: idx,
    });

    state.revealed.push(idx);

    if (res.result === 'BOMB') {
      applyBomb(idx, el);
      triggerExplosion(el);
      state.gameOver = true;
      state.active   = false;

      setTimeout(() => revealAll(false, res.bombPositions), 300);
      setMsg('💥 Bomb! You lost GHS ' + state.bet.toFixed(2), 'lose');
      addHistory(false, state.bet, 0);
      showOverlay(false, 0);
      deactivateGameUI();

      setTimeout(async () => {
        try { await Wallet.fetch(); } catch { /* ignore */ }
      }, 800);

      const userId = SpeedBetAPI.getUserId();
      if (userId && res.serverSeed) {
        Fairness.verify(res.serverSeed, userId, state.roundId, state.commitHash);
      }

    } else if (res.result === 'AUTO_WIN') {
      state.diamonds = res.diamondsFound;
      applyDiamond(idx, el);
      updateStats(state.diamonds, state.bombCount);
      handleCashoutSuccess(res.payout, res.multiplier, res.bombPositions, res.serverSeed);

    } else {
      // SAFE tile
      state.diamonds = res.diamondsFound;
      applyDiamond(idx, el);
      updateStats(state.diamonds, state.bombCount);
      updateSafeBar(CONFIG.GRID_SIZE - state.revealed.length, state.bombCount);
      setMsg(
        `💎 Diamond! Multiplier: ${res.multiplier.toFixed(2)}× — Cash out GHS ${res.potentialPayout.toFixed(2)}`,
        'info'
      );
    }

  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      setMsg(`Error revealing tile: ${err.message}`, 'lose');
    }
  }
}

function applyDiamond(idx, el) {
  el.classList.remove('active-game');
  el.classList.add('revealed', 'diamond');
  el.innerHTML = diamondSVG();
  triggerDiamondBurst(el);
}

function applyBomb(idx, el) {
  el.classList.remove('active-game');
  el.classList.add('revealed', 'bomb');
  el.innerHTML = bombSVG();
}

function activateGameUI() {
  const btn = document.getElementById('startBtn');
  const lbl = document.getElementById('startLabel');
  if (btn) btn.classList.add('cashout');
  if (lbl) lbl.textContent = 'Cash Out';
  document.querySelectorAll('.tile').forEach(t => t.classList.add('active-game'));
}

function deactivateGameUI() {
  const btn = document.getElementById('startBtn');
  const lbl = document.getElementById('startLabel');
  if (btn) btn.classList.remove('cashout');
  if (lbl) lbl.textContent = 'New Game';
}

/* ═══════════════════════════════════════════════
   11. STATS — UI Panel Updates
   ═══════════════════════════════════════════════ */
function updateStats(diamonds, bombs) {
  const bet      = parseFloat(document.getElementById('betAmt')?.value) || 10;
  const mult     = getMultiplier(diamonds, bombs);
  const profit   = (bet * mult - bet).toFixed(2);
  const nextMult = getMultiplier(diamonds + 1, bombs);
  const nextWin  = (bet * nextMult).toFixed(2);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('multStat',   mult.toFixed(2) + '×');
  set('profitStat', '+' + profit);
  set('nextStat',   'GHS ' + nextWin);
}

function updateSafeBar(remaining, bombs) {
  const safeTiles = remaining - Math.min(bombs, remaining);
  const pct       = remaining === 0 ? 0 : Math.round((safeTiles / remaining) * 100);
  const bar   = document.getElementById('safeBar');
  const pctEl = document.getElementById('safePct');
  if (bar)   bar.style.width   = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

// [Bug 3 fixed] updateBalance() reads directly from Wallet.get() —
// no longer relies on state.balance which was lost after the spread in newGame().
function updateBalance() {
  const el = document.getElementById('balance');
  if (el) {
    el.textContent = 'GHS ' + Wallet.get().toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

/* ═══════════════════════════════════════════════
   CASH OUT
   [Fix 5] _cashingOut flag prevents double-tap
           during the HTTP round-trip, mirrors
           Aviator's CrashRound.isCashedOut() guard.
   ═══════════════════════════════════════════════ */
async function cashOut() {
  if (!state.active || state.diamonds === 0) return;
  if (state._cashingOut) return;   // [Fix 5] double-tap guard
  if (!SpeedBetAPI.isAuthed()) { showAuthGate('Sign in to cash out.'); return; }

  state._cashingOut = true;

  try {
    const res = await SpeedBetAPI.games.cashout({ roundId: state.roundId });

    if (res.newBalance !== undefined) {
      Wallet.set(parseFloat(res.newBalance));
      updateBalance();
    } else if (res.walletBalance !== undefined) {
      Wallet.set(parseFloat(res.walletBalance));
      updateBalance();
    }

    handleCashoutSuccess(res.payout, res.multiplier, res.bombPositions, res.serverSeed);

  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      // Fallback to local calculation if API is unreachable
      console.error('[cashOut] server error, applying local fallback:', err.message);
      const mult = getMultiplier(state.diamonds, state.bombCount);
      const won  = parseFloat((state.bet * mult).toFixed(2));
      Wallet.credit(won);
      updateBalance();
      handleCashoutSuccess(won, mult, [], null);
    }
  } finally {
    state._cashingOut = false;
  }
}

function handleCashoutSuccess(payout, multiplier, bombPositions, serverSeed) {
  state.active   = false;
  state.gameOver = true;

  revealAll(true, bombPositions);
  setMsg(`✅ Cashed out! Won GHS ${parseFloat(payout).toFixed(2)} (${parseFloat(multiplier).toFixed(2)}×)`, 'win');
  addHistory(true, state.bet, payout);
  showOverlay(true, payout, multiplier);
  triggerWinRain();
  deactivateGameUI();

  setTimeout(async () => {
    try { await Wallet.fetch(); } catch { /* ignore */ }
  }, 800);

  const userId = SpeedBetAPI.getUserId();
  if (serverSeed && userId) {
    Fairness.verify(serverSeed, userId, state.roundId, state.commitHash);
  }
}

function startOrCashOut() {
  if (state._paused) return;
  if (state.gameOver || !state.active) {
    newGame();
  } else {
    cashOut();
  }
}

/* ─────────────────────────────────────────────────────────────
   newGame
   [Bug 3 fixed] No longer spreads state.balance.
   State is reset cleanly without the getter/setter that was
   being silently dropped by the object spread.
   ───────────────────────────────────────────────────────────── */
function newGame() {
  const bet       = parseFloat(document.getElementById('betAmt')?.value) || 10;
  const bombCount = +document.getElementById('mineSlider')?.value || 3;

  // Reset all game fields; wallet balance lives in Wallet module, not state
  state.active      = false;
  state.gameOver    = false;
  state.bombs       = [];
  state.revealed    = [];
  state.diamonds    = 0;
  state.bet         = bet;
  state.bombCount   = bombCount;
  state.roundId     = null;
  state.commitHash  = null;
  state._starting   = false;
  state._cashingOut = false;
  // _paused is intentionally NOT reset here

  buildGrid();
  hideOverlay();
  Fairness.showCommitHash(null);

  const btn = document.getElementById('startBtn');
  const lbl = document.getElementById('startLabel');
  if (btn) btn.classList.remove('cashout');
  if (lbl) lbl.textContent = 'Place Bet';

  setMsg('Pick your bet and hit Place Bet!', '');
  updateStats(0, state.bombCount);
  updateSafeBar(CONFIG.GRID_SIZE, state.bombCount);
}

function revealAll(won, bombPositions = []) {
  document.querySelectorAll('.tile').forEach((t, i) => {
    if (!state.revealed.includes(i)) {
      t.classList.remove('active-game');
      t.classList.add('dead');
      if (bombPositions.includes(i)) {
        setTimeout(() => {
          t.classList.add('bomb-ghost');
          t.innerHTML = bombSVG();
        }, Math.random() * 400);
      } else if (won) {
        setTimeout(() => {
          t.classList.add('diamond-ghost');
          t.innerHTML = diamondSVG();
        }, Math.random() * 300);
      }
    }
  });
}

/* ═══════════════════════════════════════════════
   OVERLAY / MESSAGE / HISTORY
   ═══════════════════════════════════════════════ */
function showOverlay(won, amount, mult) {
  const ov = document.getElementById('gridOverlay');
  const oc = document.getElementById('overlayContent');
  if (!ov || !oc) return;
  ov.style.display = 'flex';
  if (won) {
    oc.innerHTML = `
      <div class="overlay-title win">🎉 You Won!</div>
      <div class="overlay-amount">GHS ${parseFloat(amount).toFixed(2)}</div>
      <div class="overlay-sub">${parseFloat(mult).toFixed(2)}× multiplier • ${state.diamonds} diamonds found</div>
    `;
  } else {
    oc.innerHTML = `
      <div class="overlay-title lose">💣 Boom!</div>
      <div class="overlay-amount" style="color:#ff4444">−GHS ${state.bet.toFixed(2)}</div>
      <div class="overlay-sub">${state.diamonds} diamond${state.diamonds !== 1 ? 's' : ''} found before the bomb</div>
    `;
  }
}

function hideOverlay() {
  const ov = document.getElementById('gridOverlay');
  if (ov) ov.style.display = 'none';
}

function setMsg(text, cls) {
  const m = document.getElementById('msg');
  if (m) {
    m.textContent = text;
    m.className   = 'msg ' + (cls || '');
  }
}

function addHistory(won, bet, payout) {
  const h = document.getElementById('history');
  if (!h) return;
  const pill     = document.createElement('div');
  pill.className = 'hist-pill ' + (won ? 'win' : 'lose');
  if (won) {
    pill.innerHTML = `💎 +GHS ${(payout - bet).toFixed(2)}`;
  } else {
    pill.innerHTML = `💣 −GHS ${bet.toFixed(2)}`;
  }
  h.insertBefore(pill, h.firstChild);
  while (h.children.length > 12) h.removeChild(h.lastChild);
}

/* ═══════════════════════════════════════════════
   12. EFFECTS — Particles, Explosions, Rain
   ═══════════════════════════════════════════════ */
function triggerDiamondBurst(el) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const burst  = document.getElementById('burst');
  if (!burst) return;
  const colors = ['#a8edff', '#7dd3fc', '#e0f9ff', '#38bdf8', '#f0feff'];

  for (let i = 0; i < 12; i++) {
    const p     = document.createElement('div');
    p.className = 'burst-particle';
    const angle = (i / 12) * 360;
    const dist  = 40 + Math.random() * 60;
    const size  = 4 + Math.random() * 6;
    p.style.cssText = `
      left:${cx}px;top:${cy}px;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --tx:${Math.cos(angle * Math.PI / 180) * dist}px;
      --ty:${Math.sin(angle * Math.PI / 180) * dist}px;
      box-shadow:0 0 6px ${colors[0]};
    `;
    burst.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

function triggerExplosion(el) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const burst  = document.getElementById('burst');
  if (!burst) return;
  const colors = ['#ff4444', '#ff8800', '#ffcc00', '#ff6600'];

  for (let i = 0; i < 20; i++) {
    const p     = document.createElement('div');
    p.className = 'burst-particle';
    const angle = Math.random() * 360;
    const dist  = 30 + Math.random() * 80;
    const size  = 5 + Math.random() * 10;
    p.style.cssText = `
      left:${cx}px;top:${cy}px;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --tx:${Math.cos(angle * Math.PI / 180) * dist}px;
      --ty:${Math.sin(angle * Math.PI / 180) * dist}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    burst.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }

  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed;inset:0;background:rgba(255,68,68,0.15);
    pointer-events:none;z-index:9999;
    animation:flashOut 0.4s ease forwards;
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  if (!document.getElementById('flash-style')) {
    const s       = document.createElement('style');
    s.id          = 'flash-style';
    s.textContent = `@keyframes flashOut{0%{opacity:1}100%{opacity:0}}`;
    document.head.appendChild(s);
  }
}

function triggerWinRain() {
  const burst = document.getElementById('burst');
  if (!burst) return;
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const p     = document.createElement('div');
      p.className = 'burst-particle';
      const x     = Math.random() * window.innerWidth;
      const tx    = (Math.random() - 0.5) * 80;
      const ty    = window.innerHeight + 100;
      p.style.cssText = `
        left:${x}px;top:-10px;
        width:8px;height:8px;
        background:${Math.random() > 0.5 ? '#f5c518' : '#a8edff'};
        --tx:${tx}px;--ty:${ty}px;
        animation-duration:1.2s;
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        box-shadow:0 0 8px currentColor;
      `;
      burst.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }, i * 60);
  }
}

function spawnBgParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#f5c518', '#a8edff', '#22c55e', '#f59e0b'];
  for (let i = 0; i < 20; i++) {
    const p     = document.createElement('div');
    p.className = 'particle';
    const size  = 2 + Math.random() * 4;
    p.style.cssText = `
      left:${Math.random() * 100}%;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random() * 8}s;
      animation-duration:${8 + Math.random() * 12}s;
    `;
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════
   13. GAME CORE — Init / Pause / Resume
   ═══════════════════════════════════════════════ */
const GameCore = (() => {

  async function _startNetworking() {
    WSBus.connect(() => Wallet.subscribeWS());
    await Wallet.fetch();
  }

  async function init() {
    buildGrid();
    syncMines();
    spawnBgParticles();

    AuthReactor.init();

    if (!SpeedBetAPI.isAuthed()) {
      updateBalance();
      showAuthGate('Sign in to play.');
      state._paused = true;
      return;
    }

    await _startNetworking();
    Fairness.showCommitHash(null);
    setMsg('Pick your bet and hit Place Bet!', '');
  }

  function pause(message = 'Game paused.') {
    state._paused     = true;
    state.active      = false;
    state.gameOver    = true;
    state._starting   = false;
    state._cashingOut = false;
    state.roundId     = null;
    state.commitHash  = null;

    buildGrid();
    deactivateGameUI();
    setMsg(message, 'lose');
    showAuthGate(message);
    updateBalance();
  }

  async function resume() {
    state._paused  = false;
    state.gameOver = false;
    hideAuthGate();
    await _startNetworking();
    newGame();
  }

  return { init, pause, resume };
})();

/* ═══════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => GameCore.init());