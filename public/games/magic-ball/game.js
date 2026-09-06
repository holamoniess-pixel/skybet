/**
 * MAGIC BALL CASINO GAME — game.js
 * Fully Integrated — SpeedBet API v1 — May 2026
 *
 * Architecture mirrors Aviator/Mines SpeedBet pattern:
 *   1.  CONFIG            — shared constants
 *   2.  SpeedBetAPI       — token helpers + REST with 401→refresh→retry + all endpoint groups
 *   3.  WSBus             — STOMP/SockJS hub with auto-reconnect
 *   4.  Wallet            — optimistic balance with get/set/deduct/credit + WS sync
 *   5.  AuthReactor       — central login/logout/expiry handler + form wiring
 *   6.  CrashRound        — round tracking: placeBet, cashout, revealSeed, WS state sub
 *   7.  RNG               — local animation RNG (server is authoritative for results)
 *   8.  ColorMap          — red/black number mapping
 *   9.  BettingEngine     — market definitions, bet placement, evaluation
 *  10.  GameState         — phase manager
 *  11.  UI Controller     — all DOM updates, auth gate
 *  12.  AnimController    — particles, win/lose effects
 *  13.  Background        — canvas background
 *  14.  PayoutCalc        — payout helpers
 *  15.  Game              — main orchestrator (init / pause / resume)
 */

'use strict';

/* ============================================================
   1. CONFIGURATION
   ============================================================ */
const CONFIG = {
  BASE:            '',           // set to 'http://localhost:8080' for local dev; '' for same-origin
  API_BASE:        '/api',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'football',
  RECONNECT_DELAY: 3000,
  AUTO_CASHOUT:    null,
  GROWTH_BASE:     0.12,
};

/* ============================================================
   2. SPEEDBET API SERVICE
   Mirrors Aviator SpeedBetAPI exactly —
   token storage, silent refresh, data-unwrap,
   endpoint groups: auth / wallet / games / user.
   Cross-tab storage sync included.
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

  // ── Core fetch ─────────────────────────────────────────────
  // Unwraps { data: T } envelope or returns root object.
  async function _req(path, options = {}, auth = false, retrying = false) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else       console.warn(`[SpeedBetAPI] auth=true but no token for ${path}`);
    }
    let res;
    try {
      res = await fetch(CONFIG.BASE + CONFIG.API_BASE + path, { ...options, headers, credentials: 'include' });
    } catch (e) {
      throw new Error('NETWORK_ERROR');
    }

    // 401 → try silent refresh once
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
        method:      'POST',
        credentials: 'include',
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

  // ── AUTH endpoints ─────────────────────────────────────────
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

  // ── WALLET endpoints ───────────────────────────────────────
  const wallet = {
    get:          ()              => _get('/wallet/balance', true),
    transactions: (p = 0, s = 20) => _get(`/wallet/transactions?page=${p}&size=${s}`, true),
    withdraw:     payload         => _post('/wallet/withdraw', payload, true),
  };

  // ── GAMES endpoints ────────────────────────────────────────
  const games = {
    currentRound: slug             => _get(`/games/${slug}/current-round`, true),
    play:         (slug, payload)  => _post(`/games/${slug}/play`, payload, true),
    cashout:      (slug, payload)  => _post(`/games/${slug}/cashout`, payload, true),
    settle:       (slug, payload)  => _post(`/games/${slug}/settle`, payload, true),
    revealSeed:   (slug, roundId)  => _get(`/games/${slug}/round/${roundId}/reveal`, true),
    history:      (limit = 20)     => _get(`/games/history?limit=${limit}`, true),
  };

  // ── USER endpoints ─────────────────────────────────────────
  const user = {
    me:     ()      => _get('/users/me', true),
    update: payload => _patch('/users/me', payload, true),
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

/* ============================================================
   3. WSBUS — STOMP / SockJS WebSocket Hub
   Mirrors Aviator WSBus — pending subs dict,
   Stomp.over(SockJS), auto-reconnect when authed.
   ============================================================ */
const WSBus = (() => {
  let client    = null;
  let connected = false;
  const pending = {}; // topic → callback (last-writer-wins)

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

/* ============================================================
   4. WALLET MANAGER
   Optimistic balance with get/set/deduct/credit helpers.
   Server balance reconciled via WS push and after API calls.
   ============================================================ */
const Wallet = (() => {
  let _balance = 0;

  async function fetch() {
    if (!SpeedBetAPI.isAuthed()) return;
    try {
      const data = await SpeedBetAPI.wallet.get();
      _balance = parseFloat(data.balance ?? data.amount ?? _balance);
      UI.updateBalance(_balance);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR') {
        console.warn('[Wallet] fetch failed:', e.message);
      }
    }
  }

  function subscribeWS() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data  = JSON.parse(msg.body);
        const prev  = _balance;
        _balance    = parseFloat(data.balance ?? data.amount ?? _balance);
        UI.updateBalance(_balance);
        UI.flashBalance(_balance >= prev);
      } catch { /* ignore */ }
    });
  }

  const get    = ()  => _balance;
  const set    = v   => { _balance = parseFloat(v); };
  const deduct = amt => { _balance = Math.max(0, parseFloat((_balance - parseFloat(amt)).toFixed(2))); };
  const credit = amt => { _balance = parseFloat((_balance + parseFloat(amt)).toFixed(2)); };

  return { fetch, subscribeWS, get, set, deduct, credit };
})();

/* ============================================================
   5. AUTH REACTOR
   Central listener for auth events.
   Wires login form, demo button, and enter-key.
   Mirrors Aviator AuthReactor._wireAuthForm() exactly.
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
          // Demo endpoint unavailable — close gate and run locally
          console.warn('[AuthReactor] demo-login unavailable, running offline:', e.message);
          UI.hideAuthGate();
          UI.updateBalance(Wallet.get());
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
    UI.hideAuthGate();
    if (GameState.is(GameState.PHASES.PAUSED)) {
      Game.resume();
    }
  }

  function _onLogout() {
    console.log('[AuthReactor] User logged out');
    WSBus.disconnect();
    Game.pause();
    UI.showAuthGate('Sign in to keep playing.');
    UI.updateBalance(0);
  }

  function _onExpired() {
    console.warn('[AuthReactor] Session expired');
    WSBus.disconnect();
    Game.pause();
    UI.showAuthGate('Your session expired. Please sign in again.');
    UI.updateBalance(0);
  }

  return { init };
})();

/* ============================================================
   6. CRASH ROUND MANAGER
   Wraps SpeedBetAPI.games.* with per-round id tracking.
   ============================================================ */
const CrashRound = (() => {
  let _roundId    = null;
  let _roundNum   = null;
  let _commitHash = null;
  let _cashedOut  = false;

  async function fetchCurrentRound(slug) {
    if (!SpeedBetAPI.isAuthed()) return null;
    try {
      const data  = await SpeedBetAPI.games.currentRound(slug);
      _roundNum   = data.roundNumber;
      _commitHash = data.commitHash || null;
      if (_commitHash && UI.els.fairVal) UI.els.fairVal.textContent = _commitHash;
      return data;
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR') {
        console.warn('[CrashRound] fetchCurrentRound failed:', e.message);
      }
      return null;
    }
  }

  async function placeBet(slug, stake) {
    // Country stake floor/ceiling — single source of truth is the
    // SkyBet bridge, which carries the value the user's registered
    // country defines. Reject before we spend a network round-trip.
    { const _c = CB.checkStake(stake); if (!_c.ok) { try { UI.setBetStatus && UI.setBetStatus(0, _c.reason, '#e63946'); } catch (e) {} throw new Error(_c.reason); } }

    const data = await SpeedBetAPI.games.play(slug, { stake });
    _roundId   = data.id;
    _cashedOut = false;
    // Server is authoritative — reconcile wallet
    if (data.walletBalance !== undefined) {
      Wallet.set(parseFloat(data.walletBalance));
      UI.updateBalance(Wallet.get());
    }
    return data;
  }

  async function cashout(slug, multiplier) {
    if (_cashedOut || !_roundId) return null;
    const data = await SpeedBetAPI.games.cashout(slug, {
      roundId:   _roundId,
      cashoutAt: multiplier,
    });
    _cashedOut = true;
    return data;
  }

  async function revealSeed(slug) {
    if (!_roundId) return null;
    try {
      return await SpeedBetAPI.games.revealSeed(slug, _roundId);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR') {
        console.warn('[CrashRound] revealSeed failed:', e.message);
      }
      return null;
    }
  }

  function subscribeToState(slug, onTick, onCrash) {
    WSBus.subscribe(`/topic/${slug}/state`, msg => {
      try {
        const payload = JSON.parse(msg.body);
        if (payload.state === 'RUNNING')  onTick(parseFloat(payload.multiplier), payload.roundNumber);
        else if (payload.state === 'CRASHED') onCrash(payload);
      } catch { /* ignore */ }
    });
  }

  function reset() {
    _roundId    = null;
    _roundNum   = null;
    _commitHash = null;
    _cashedOut  = false;
  }

  const getRoundId    = () => _roundId;
  const getCommitHash = () => _commitHash;
  const isCashedOut   = () => _cashedOut;

  return {
    fetchCurrentRound, placeBet, cashout, revealSeed,
    subscribeToState, reset,
    getRoundId, getCommitHash, isCashedOut,
  };
})();

/* ============================================================
   7. RNG — local animation only; server is authoritative
   ============================================================ */
const RNG = (() => {
  function spin() {
    if (window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (arr[0] % 36) + 1;
    }
    let r;
    do { r = Math.floor(Math.random() * 37); } while (r === 0 || r > 36);
    return r;
  }
  return { spin };
})();

/* ============================================================
   8. COLOR MAPPING SYSTEM
   ============================================================ */
const ColorMap = (() => {
  const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  function getColor(n) { return RED_NUMBERS.has(n) ? 'red' : 'black'; }
  function isRed(n)    { return RED_NUMBERS.has(n); }
  return { getColor, isRed, RED_NUMBERS };
})();

/* ============================================================
   9. BETTING ENGINE
   ============================================================ */
const BettingEngine = (() => {
  const MARKETS = {
    red:   { label: 'Red',        payout: 1.95, match: n => ColorMap.isRed(n) },
    black: { label: 'Black',      payout: 1.95, match: n => !ColorMap.isRed(n) },
    odd:   { label: 'Odd',        payout: 1.95, match: n => n % 2 !== 0 },
    even:  { label: 'Even',       payout: 1.95, match: n => n % 2 === 0 },
    low:   { label: 'Low 1–18',   payout: 1.95, match: n => n <= 18 },
    high:  { label: 'High 19–36', payout: 1.95, match: n => n > 18 },
    d1:    { label: '1–12',       payout: 2.8,  match: n => n <= 12 },
    d2:    { label: '13–24',      payout: 2.8,  match: n => n > 12 && n <= 24 },
    d3:    { label: '25–36',      payout: 2.8,  match: n => n > 24 },
  };
  for (let i = 1; i <= 36; i++) {
    MARKETS[`n${i}`] = { label: `#${i}`, payout: 32, match: n => n === i };
  }

  let activeBets = {};

  function place(key, amount)  { if (!MARKETS[key]) return false; activeBets[key] = amount; return true; }
  function remove(key)         { delete activeBets[key]; }
  function toggle(key, amount) {
    if (activeBets[key]) { remove(key); return false; }
    place(key, amount); return true;
  }
  function clear()         { activeBets = {}; }
  function hasBets()       { return Object.keys(activeBets).length > 0; }
  function getActiveBets() { return { ...activeBets }; }
  function getTotalStake() { return Object.values(activeBets).reduce((s, a) => s + a, 0); }

  function evaluate(winningNumber) {
    const results = [];
    let totalReturn = 0;
    for (const [key, stake] of Object.entries(activeBets)) {
      const market = MARKETS[key];
      const won    = market.match(winningNumber);
      const payout = won ? stake * market.payout : 0;
      totalReturn += payout;
      results.push({ key, label: market.label, stake, won, payout, multiplier: market.payout });
    }
    return { results, totalReturn, totalStake: getTotalStake() };
  }

  return { MARKETS, place, remove, toggle, clear, hasBets, getActiveBets, getTotalStake, evaluate };
})();

/* ============================================================
   10. GAME STATE MANAGER
   ============================================================ */
const GameState = (() => {
  const PHASES = { WAITING: 'waiting', DRAWING: 'drawing', RESULT: 'result', PAUSED: 'paused' };
  let current = PHASES.WAITING;
  function set(phase) { current = phase; }
  function get()      { return current; }
  function is(phase)  { return current === phase; }
  return { PHASES, set, get, is };
})();

/* ============================================================
   11. UI CONTROLLER
   ============================================================ */
const UI = (() => {
  const els = {
    balance:       document.getElementById('balance'),
    roundNum:      document.getElementById('roundNum'),
    phaseBanner:   document.getElementById('phaseBanner'),
    phaseText:     document.getElementById('phaseText'),
    machineGlass:  document.getElementById('machineContainer')?.querySelector('.machine-glass'),
    mainOrb:       document.getElementById('mainOrb'),
    orbNumber:     document.getElementById('orbNumber'),
    orbGlowRing:   document.getElementById('orbGlowRing'),
    timerCircle:   document.getElementById('timerCircle'),
    timerNumber:   document.getElementById('timerNumber'),
    baseSlot:      document.getElementById('baseSlot'),
    slotNumber:    document.getElementById('slotNumber'),
    historyList:   document.getElementById('historyList'),
    hotNums:       document.getElementById('hotNums'),
    coldNums:      document.getElementById('coldNums'),
    numberGrid:    document.getElementById('numberGrid'),
    spinBtn:       document.getElementById('spinBtn'),
    clearBtn:      document.getElementById('clearBtn'),
    stakeInput:    document.getElementById('stakeInput'),
    announcement:  document.getElementById('announcement'),
    annInner:      document.getElementById('annInner'),
    resultDisplay: document.getElementById('resultDisplay'),
    autoToggle:    document.getElementById('autoToggle'),
    fairVal:       document.getElementById('fairVal'),
    seedReveal:    document.getElementById('seedReveal'),
    authGate:      document.getElementById('authGate'),
    authGateMsg:   document.getElementById('authGateMsg'),
    authEmail:     document.getElementById('authEmail'),
    authPassword:  document.getElementById('authPassword'),
    btnLogin:      document.getElementById('btnLogin'),
    btnDemoUser:   document.getElementById('btnDemoUser'),
    authError:     document.getElementById('authError'),
  };

  const CIRC = 326.726;

  function updateBalance(amount) {
    if (els.balance) els.balance.textContent = '₵' + parseFloat(amount).toFixed(2);
  }

  function flashBalance(won) {
    if (!els.balance) return;
    els.balance.classList.remove('win-bump', 'lose-bump');
    void els.balance.offsetWidth;
    els.balance.classList.add(won ? 'win-bump' : 'lose-bump');
  }

  function setPhase(phase, extra) {
    if (!els.phaseBanner) return;
    els.phaseBanner.className = 'phase-banner ' + phase;
    const labels = {
      betting:       'PLACE YOUR BETS',
      drawing:       'DRAWING...',
      'result-win':  extra || 'WINNER!',
      'result-lose': 'BETTER LUCK NEXT ROUND',
      paused:        'GAME PAUSED',
    };
    if (els.phaseText) els.phaseText.textContent = labels[phase] || phase.toUpperCase();
  }

  function setTimer(seconds, total) {
    if (!els.timerCircle) return;
    const pct    = seconds / total;
    const offset = CIRC * (1 - pct);
    els.timerCircle.style.strokeDashoffset = offset;
    if (els.timerNumber) els.timerNumber.textContent = seconds;
    const urgent = seconds <= 5;
    els.timerCircle.classList.toggle('urgent', urgent);
    if (els.timerNumber) els.timerNumber.classList.toggle('urgent', urgent);
  }

  function showDrawing() {
    if (!els.machineGlass) return;
    els.machineGlass.classList.add('drawing');
    els.machineGlass.classList.remove('glow-red', 'glow-black', 'glow-win');
    if (els.orbNumber)   els.orbNumber.textContent = '?';
    if (els.mainOrb)     els.mainOrb.className     = 'main-orb';
    if (els.orbGlowRing) els.orbGlowRing.className = 'orb-glow-ring';
    if (els.slotNumber)  els.slotNumber.textContent = '—';
    if (els.baseSlot)    els.baseSlot.classList.remove('lit');
  }

  function flickerNumber(cb) {
    let count = 0;
    const max = 10;
    const iv  = setInterval(() => {
      const fake = RNG.spin();
      if (els.orbNumber) {
        els.orbNumber.textContent = fake;
        els.orbNumber.classList.remove('flicker');
        void els.orbNumber.offsetWidth;
        els.orbNumber.classList.add('flicker');
      }
      if (els.machineGlass) {
        els.machineGlass.classList.remove('shaking');
        void els.machineGlass.offsetWidth;
        els.machineGlass.classList.add('shaking');
      }
      count++;
      if (count >= max) { clearInterval(iv); setTimeout(cb, 200); }
    }, 250);
  }

  function revealResult(num, color) {
    if (els.machineGlass) els.machineGlass.classList.remove('drawing', 'shaking');
    if (els.orbNumber)    els.orbNumber.textContent = num;
    if (els.mainOrb)      els.mainOrb.classList.add('orb-' + color);
    if (els.orbGlowRing)  els.orbGlowRing.classList.add('active-' + color);
    if (els.machineGlass) els.machineGlass.classList.add('glow-' + color);
    if (els.slotNumber)   els.slotNumber.textContent = num;
    if (els.baseSlot)     els.baseSlot.classList.add('lit');

    const numBtn = document.getElementById('numBtn-' + num);
    if (numBtn) {
      numBtn.classList.add('result-highlight');
      setTimeout(() => numBtn.classList.remove('result-highlight'), 1200);
    }

    const dozen = num <= 12 ? 'Dozen 1' : num <= 24 ? 'Dozen 2' : 'Dozen 3';
    updateResultChip('rc-number', `#${num}`,                   color === 'red' ? 'active-red' : 'active-black');
    updateResultChip('rc-color',  color === 'red' ? 'Red' : 'Black', color === 'red' ? 'active-red' : 'active-black');
    updateResultChip('rc-parity', num % 2 === 0 ? 'Even' : 'Odd',   'active-neutral');
    updateResultChip('rc-range',  num <= 18 ? 'Low' : 'High',        'active-neutral');
    updateResultChip('rc-dozen',  dozen,                              'active-neutral');
  }

  function updateResultChip(id, text, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = 'result-chip ' + cls;
  }

  function showAnnouncement(type, text) {
    if (!els.announcement) return;
    els.announcement.classList.remove('hidden');
    if (els.annInner) {
      els.annInner.className = 'ann-inner ' + type;
      els.annInner.innerHTML = text;
    }
    setTimeout(() => els.announcement.classList.add('hidden'), 3000);
  }

  function flashBetResult(key, won) {
    const btn = document.getElementById('mkt-' + key) || document.getElementById('numBtn-' + key.replace('n', ''));
    if (!btn) return;
    btn.classList.remove('flash-win', 'flash-lose');
    void btn.offsetWidth;
    btn.classList.add(won ? 'flash-win' : 'flash-lose');
    setTimeout(() => btn.classList.remove('flash-win', 'flash-lose'), 1000);
  }

  function clearAllBetUI() {
    document.querySelectorAll('.mkt-btn.active, .num-btn.active').forEach(b => {
      b.classList.remove('active', 'flash-win', 'flash-lose');
    });
  }

  function setMktActive(key, active) {
    const btn = document.getElementById('mkt-' + key);
    if (btn) btn.classList.toggle('active', active);
  }

  function setNumActive(n, active) {
    const btn = document.getElementById('numBtn-' + n);
    if (btn) btn.classList.toggle('active', active);
  }

  function enableBetting(enabled) {
    document.querySelectorAll('.mkt-btn, .num-btn, .stake-chip, .stake-input').forEach(b => {
      b.disabled = !enabled;
    });
    if (els.spinBtn)  els.spinBtn.disabled  = !enabled;
    if (els.clearBtn) els.clearBtn.disabled = !enabled;
  }

  function resetMachine() {
    if (!els.machineGlass) return;
    els.machineGlass.classList.remove('drawing', 'shaking', 'glow-red', 'glow-black', 'glow-win');
    if (els.mainOrb)     els.mainOrb.className     = 'main-orb';
    if (els.orbGlowRing) els.orbGlowRing.className = 'orb-glow-ring';
    if (els.orbNumber)   els.orbNumber.textContent = '?';
    if (els.slotNumber)  els.slotNumber.textContent = '—';
    if (els.baseSlot)    els.baseSlot.classList.remove('lit');
    if (els.seedReveal)  els.seedReveal.textContent = '';
    ['rc-number','rc-color','rc-parity','rc-range','rc-dozen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = id === 'rc-number' ? '?' : '—'; el.className = 'result-chip'; }
    });
  }

  function addHistory(num, color) {
    if (!els.historyList) return;
    const empty = els.historyList.querySelector('.history-empty');
    if (empty) empty.remove();

    const parity = num % 2 === 0 ? 'EVEN' : 'ODD';
    const range  = num <= 18 ? 'LOW' : 'HIGH';
    const dozen  = num <= 12 ? 'D1' : num <= 24 ? 'D2' : 'D3';

    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <div class="hist-ball ${color}">${num}</div>
      <div class="hist-meta">
        <div class="hist-tags">
          <span class="hist-tag">${color.toUpperCase()}</span>
          <span class="hist-tag">${parity}</span>
          <span class="hist-tag">${range}</span>
          <span class="hist-tag">${dozen}</span>
        </div>
      </div>`;
    els.historyList.insertBefore(row, els.historyList.firstChild);
    while (els.historyList.children.length > 10) {
      els.historyList.removeChild(els.historyList.lastChild);
    }
  }

  function updateHotCold(freqMap) {
    const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
    const hot    = sorted.slice(0, 4);
    const cold   = sorted.slice(-4).reverse();
    const render = (arr, cls) => arr.map(([n]) => `<div class="hc-num ${cls}">${n}</div>`).join('');
    if (els.hotNums)  els.hotNums.innerHTML  = hot.length  ? render(hot,  'hot')  : '—';
    if (els.coldNums) els.coldNums.innerHTML = cold.length ? render(cold, 'cold') : '—';
  }

  function buildNumberGrid() {
    if (!els.numberGrid) return;
    els.numberGrid.innerHTML = '';
    for (let i = 1; i <= 36; i++) {
      const btn = document.createElement('button');
      btn.className   = 'num-btn ' + (ColorMap.isRed(i) ? 'is-red' : 'is-black');
      btn.id          = 'numBtn-' + i;
      btn.textContent = i;
      btn.onclick     = () => Game.onNumClick(i);
      els.numberGrid.appendChild(btn);
    }
  }

  // ── Auth gate ──────────────────────────────────────────────
  function showAuthGate(message = 'Please sign in to play.') {
    if (!els.authGate) return;
    if (els.authGateMsg) els.authGateMsg.textContent = message;
    els.authGate.classList.remove('hidden');
    enableBetting(false);
    setPhase('paused');
  }

  function hideAuthGate() {
    if (!els.authGate) return;
    els.authGate.classList.add('hidden');
    enableBetting(true);
  }

  function getStake()     { return Math.max(1, parseFloat(els.stakeInput?.value) || 10); }
  function isAutoOn()     { return els.autoToggle?.checked || false; }
  function setRoundNum(n) { if (els.roundNum) els.roundNum.textContent = n; }

  return {
    els, updateBalance, flashBalance, setPhase, setTimer,
    showDrawing, flickerNumber, revealResult,
    showAnnouncement, flashBetResult, clearAllBetUI,
    setMktActive, setNumActive, enableBetting, resetMachine,
    addHistory, updateHotCold, buildNumberGrid,
    showAuthGate, hideAuthGate,
    getStake, isAutoOn, setRoundNum,
  };
})();

/* ============================================================
   12. ANIMATION CONTROLLER
   ============================================================ */
const AnimController = (() => {
  function spawnParticles(cx, cy, count, color) {
    for (let i = 0; i < count; i++) {
      const p     = document.createElement('div');
      p.className = 'particle';
      const size  = 4 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const dist  = 60 + Math.random() * 120;
      p.style.cssText = `
        left:${cx}px; top:${cy}px;
        width:${size}px; height:${size}px;
        background:${color};
        --tx:${Math.cos(angle) * dist}px;
        --ty:${Math.sin(angle) * dist - 60}px;
        --dur:${0.6 + Math.random() * 0.8}s;
        animation-delay:${Math.random() * 0.2}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  function _getCenter() {
    const machine = document.querySelector('.machine-glass');
    if (!machine) return { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    const rect = machine.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }

  function bigWinEffect() {
    const { cx, cy } = _getCenter();
    spawnParticles(cx, cy, 40, '#f0c040');
    setTimeout(() => spawnParticles(cx, cy, 30, '#22ff88'), 300);
    setTimeout(() => spawnParticles(cx, cy, 30, '#cc88ff'), 600);
    const m = document.querySelector('.machine-glass');
    if (m) { m.classList.remove('glow-red', 'glow-black'); m.classList.add('glow-win'); }
  }

  function winEffect() {
    const { cx, cy } = _getCenter();
    spawnParticles(cx, cy, 20, '#22ff88');
    setTimeout(() => spawnParticles(cx, cy, 15, '#f0c040'), 200);
  }

  function loseEffect() {
    const m = document.querySelector('.machine-glass');
    if (!m) return;
    m.style.filter = 'brightness(0.6) saturate(0.3)';
    setTimeout(() => m.style.filter = '', 500);
  }

  return { bigWinEffect, winEffect, loseEffect, spawnParticles };
})();

/* ============================================================
   13. BACKGROUND CANVAS
   ============================================================ */
const Background = (() => {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return { init: () => {} };
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], orbs = [];

  function init() {
    resize();
    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 1.5,
      a: Math.random(), speed: 0.002 + Math.random() * 0.003,
    }));
    orbs = [
      { x: W * 0.2, y: H * 0.3, r: 120, color: 'rgba(80,30,180,',  speed: 0.008 },
      { x: W * 0.8, y: H * 0.7, r: 100, color: 'rgba(180,30,80,',  speed: 0.006 },
      { x: W * 0.5, y: H * 0.5, r: 80,  color: 'rgba(30,80,180,',  speed: 0.01  },
    ];
    requestAnimationFrame(tick);
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  let t = 0;
  function tick() {
    t += 0.01;
    ctx.clearRect(0, 0, W, H);
    orbs.forEach(o => {
      const x = o.x + Math.sin(t * o.speed * 100) * 30;
      const y = o.y + Math.cos(t * o.speed * 80)  * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, o.r);
      g.addColorStop(0, o.color + '0.06)');
      g.addColorStop(1, o.color + '0)');
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    });
    stars.forEach(s => {
      s.a += s.speed;
      const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.a));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,160,255,${alpha})`; ctx.fill();
    });
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  return { init };
})();

/* ============================================================
   14. PAYOUT CALCULATOR
   ============================================================ */
const PayoutCalc = {
  calculate(stake, multiplier) { return parseFloat((stake * multiplier).toFixed(2)); },
  profit(stake, multiplier)    { return this.calculate(stake, multiplier) - stake; },
};

/* ============================================================
   15. MAIN GAME CONTROLLER
   Mirrors Aviator Game — init / pause / resume / networking.
   ============================================================ */
const Game = (() => {
  let round     = 1;
  let timerVal  = 15;
  let timerMax  = 15;
  let timerIv   = null;
  let savedBets = null;
  let _paused   = false;

  const freq = {};
  for (let i = 1; i <= 36; i++) freq[i] = 0;

  /* ── networking ──────────────────────────────────────────── */
  async function _startNetworking() {
    WSBus.connect(() => Wallet.subscribeWS());
    await Wallet.fetch();
    await CrashRound.fetchCurrentRound(CONFIG.GAME_SLUG);

    // Server-authoritative state pushes
    CrashRound.subscribeToState(
      CONFIG.GAME_SLUG,
      (serverMultiplier) => {
        // Auto-cashout from server multiplier tick
        if (CONFIG.AUTO_CASHOUT && serverMultiplier >= CONFIG.AUTO_CASHOUT && !CrashRound.isCashedOut()) {
          _triggerCashout(serverMultiplier);
        }
      },
      (payload) => {
        // Server crash / reveal
        if (payload.serverSeed && UI.els.seedReveal) {
          UI.els.seedReveal.textContent = payload.serverSeed;
        }
      }
    );
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    UI.buildNumberGrid();
    Background.init();
    UI.setRoundNum(round);

    // Register auth reactivity before any network calls
    AuthReactor.init();

    if (!SpeedBetAPI.isAuthed()) {
      // Guest mode — show gate, background still runs
      UI.updateBalance(0);
      UI.showAuthGate('Sign in to play.');
      GameState.set(GameState.PHASES.PAUSED);
      _paused = true;
      return;
    }

    await _startNetworking();
    startBettingPhase();

    document.querySelectorAll('.stake-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.stake-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  /* ── Pause / Resume (called by AuthReactor) ──────────────── */
  function pause() {
    _paused = true;
    clearInterval(timerIv);
    GameState.set(GameState.PHASES.PAUSED);
    UI.setPhase('paused');
    UI.enableBetting(false);
    BettingEngine.clear();
    CrashRound.reset();
  }

  async function resume() {
    _paused = false;
    await _startNetworking();
    startBettingPhase();
  }

  /* ── Cashout helper (shared: manual + auto) ──────────────── */
  async function _triggerCashout(multiplier) {
    if (CrashRound.isCashedOut()) return;
    try {
      const result = await CrashRound.cashout(CONFIG.GAME_SLUG, multiplier);
      if (result) {
        // Server is authoritative — reconcile balance
        if (result.newBalance !== undefined) {
          Wallet.set(parseFloat(result.newBalance));
        } else if (result.walletBalance !== undefined) {
          Wallet.set(parseFloat(result.walletBalance));
        } else {
          Wallet.credit(parseFloat(result.payout));
        }
        UI.updateBalance(Wallet.get());
        UI.flashBalance(true);
        UI.showAnnouncement('win', `CASHED OUT! +₵${parseFloat(result.payout).toFixed(2)}`);
      }
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') return; // AuthReactor handles this
      console.error('[Game] Cashout failed:', e.message);
      UI.showAnnouncement('lose', 'Cashout failed — please try again');
    }
  }

  /* ── Betting Phase ───────────────────────────────────────── */
  function startBettingPhase() {
    if (_paused) return;
    GameState.set(GameState.PHASES.WAITING);
    timerVal = timerMax = 15 + Math.floor(Math.random() * 6);

    UI.resetMachine();
    UI.setPhase('betting');
    UI.enableBetting(true);
    UI.setTimer(timerVal, timerMax);

    CrashRound.fetchCurrentRound(CONFIG.GAME_SLUG);

    if (UI.isAutoOn() && savedBets) {
      for (const [key, amt] of Object.entries(savedBets)) {
        BettingEngine.place(key, amt);
        if (key.startsWith('n')) UI.setNumActive(parseInt(key.slice(1)), true);
        else                     UI.setMktActive(key, true);
      }
    } else {
      BettingEngine.clear();
      UI.clearAllBetUI();
    }

    timerIv = setInterval(tickTimer, 1000);
  }

  function tickTimer() {
    if (_paused) { clearInterval(timerIv); return; }
    timerVal--;
    UI.setTimer(timerVal, timerMax);
    if (timerVal <= 0) { clearInterval(timerIv); startDraw(); }
  }

  /* ── Drawing Phase ───────────────────────────────────────── */
  async function startDraw() {
    if (_paused) return;
    GameState.set(GameState.PHASES.DRAWING);
    UI.setPhase('drawing');
    UI.enableBetting(false);

    savedBets = { ...BettingEngine.getActiveBets() };

    if (BettingEngine.hasBets()) {
      const stake = BettingEngine.getTotalStake();
      // Optimistic debit before server confirms
      Wallet.deduct(stake);
      UI.updateBalance(Wallet.get());
      try {
        await CrashRound.placeBet(CONFIG.GAME_SLUG, stake);
        // CrashRound.placeBet reconciles wallet from server response
      } catch (e) {
        // Refund optimistic debit on failure
        Wallet.credit(stake);
        UI.updateBalance(Wallet.get());
        if (e.message === 'SESSION_EXPIRED') return;
        console.error('[Game] placeBet failed:', e.message);
        startBettingPhase();
        UI.showAnnouncement('lose', 'Bet placement failed — please try again');
        return;
      }
    }

    const winNum   = RNG.spin();
    const winColor = ColorMap.getColor(winNum);

    UI.showDrawing();
    UI.flickerNumber(() => revealAndEvaluate(winNum, winColor));
  }

  /* ── Result Phase ────────────────────────────────────────── */
  async function revealAndEvaluate(winNum, winColor) {
    if (_paused) return;
    GameState.set(GameState.PHASES.RESULT);

    freq[winNum]++;
    UI.addHistory(winNum, winColor);
    UI.updateHotCold(freq);
    UI.revealResult(winNum, winColor);

    const { results, totalReturn, totalStake } = BettingEngine.evaluate(winNum);
    const netGain = totalReturn - totalStake;

    results.forEach(r => UI.flashBetResult(r.key, r.won));

    // Settle with server; fall back to local calc on error
    let serverBalance = null;
    if (BettingEngine.hasBets() || totalStake > 0) {
      try {
        const settled = await SpeedBetAPI.games.settle(CONFIG.GAME_SLUG, {
          roundId:     CrashRound.getRoundId(),
          winNumber:   winNum,
          totalReturn,
          totalStake,
          results,
        });
        serverBalance = parseFloat(settled.newBalance ?? settled.walletBalance ?? settled.balance);
      } catch (e) {
        if (e.message !== 'SESSION_EXPIRED') {
          console.warn('[Game] settle API failed — using local calc:', e.message);
        }
      }
    }

    if (serverBalance !== null && !isNaN(serverBalance)) {
      Wallet.set(serverBalance);
    } else if (totalStake > 0) {
      // Local fallback: credit winnings (stake already debited optimistically)
      if (totalReturn > 0) Wallet.credit(totalReturn);
    }
    UI.updateBalance(Wallet.get());
    if (totalStake > 0) UI.flashBalance(netGain >= 0);

    const won    = totalReturn > 0;
    const bigWin = results.some(r => r.won && r.multiplier >= 32);

    if (bigWin) {
      AnimController.bigWinEffect();
      UI.showAnnouncement('big-win', `🎉 JACKPOT!<br><span style="font-size:18px">+₵${totalReturn.toFixed(2)}</span>`);
      UI.setPhase('result-win', `+₵${totalReturn.toFixed(2)}`);
    } else if (won) {
      AnimController.winEffect();
      UI.showAnnouncement('win', `WIN! +₵${totalReturn.toFixed(2)}`);
      UI.setPhase('result-win', `WIN +₵${totalReturn.toFixed(2)}`);
    } else if (totalStake > 0) {
      AnimController.loseEffect();
      UI.showAnnouncement('lose', 'NO WIN');
      UI.setPhase('result-lose');
    } else {
      UI.setPhase('result-lose');
    }

    UI.setRoundNum(++round);

    // Reveal provably-fair seed now that round is over
    if (CrashRound.getRoundId()) {
      const seedData = await CrashRound.revealSeed(CONFIG.GAME_SLUG);
      if (seedData?.serverSeed && UI.els.seedReveal) {
        UI.els.seedReveal.textContent = seedData.serverSeed;
      }
    }

    // Re-fetch authoritative balance after settlement
    setTimeout(async () => {
      try { await Wallet.fetch(); } catch { /* ignore */ }
    }, 800);

    setTimeout(startBettingPhase, 4500);
  }

  /* ── Public event handlers ───────────────────────────────── */
  function onNumClick(n) {
    if (!GameState.is(GameState.PHASES.WAITING)) return;
    const active = BettingEngine.toggle('n' + n, UI.getStake());
    UI.setNumActive(n, active);
  }

  function onMarketClick(key) {
    if (!GameState.is(GameState.PHASES.WAITING)) return;
    const active = BettingEngine.toggle(key, UI.getStake());
    UI.setMktActive(key, active);
  }

  function manualSpin() {
    if (!GameState.is(GameState.PHASES.WAITING)) return;
    clearInterval(timerIv);
    UI.setTimer(0, timerMax);
    startDraw();
  }

  function clearAllBets() {
    if (!GameState.is(GameState.PHASES.WAITING)) return;
    BettingEngine.clear();
    savedBets = null;
    UI.clearAllBetUI();
  }

  async function onCashoutClick() {
    if (GameState.is(GameState.PHASES.DRAWING)) {
      const currentMult = parseFloat(document.getElementById('crashMultiplier')?.textContent) || 1.0;
      await _triggerCashout(currentMult);
    }
  }

  return { init, pause, resume, onNumClick, onMarketClick, manualSpin, clearAllBets, onCashoutClick };
})();

/* ============================================================
   GLOBAL BINDINGS
   ============================================================ */
function toggleMarket(key) { Game.onMarketClick(key); }
function manualSpin()       { Game.manualSpin(); }
function clearAllBets()     { Game.clearAllBets(); }
function setStake(v)        { const el = document.getElementById('stakeInput'); if (el) el.value = v; }
function onCashoutClick()   { Game.onCashoutClick(); }

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => Game.init());