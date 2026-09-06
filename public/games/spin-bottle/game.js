/**
 * ═══════════════════════════════════════════════════════════════
 * SPIN DA BOTTLE — Casino Edition  (Backend-Integrated Build)
 * game.js  —  Aviator-pattern architecture
 *
 * Modules:
 *   1.  CONFIG          — endpoints, slugs, timing constants
 *   2.  SpeedBetAPI     — REST client (auth, wallet, games)
 *   3.  WSBus           — STOMP/SockJS WebSocket bus
 *   4.  Wallet          — optimistic local balance + server sync
 *   5.  BottleRound     — server round-id tracking + cashout
 *   6.  RNG             — provably-fair local fallback
 *   7.  AudioEngine     — Web Audio API procedural sounds
 *   8.  Renderer        — Canvas 2D (table + bottle)
 *   9.  PhysicsEngine   — spin easing + wobble
 *  10.  AnimController  — requestAnimationFrame loop
 *  11.  GameState       — central state manager
 *  12.  FakePlayers     — bystander simulation
 *  13.  UIHandler       — DOM updates, feedback
 *  14.  AuthReactor     — login / logout / session-expired
 *  15.  GameCore        — orchestrates everything
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. CONFIG
   ═══════════════════════════════════════════════════════════════ */
const CONFIG = {
  BASE:            'https://speedbetbackend-production.up.railway.app',
  WS_ENDPOINT:     '/ws',
  GAME_SLUG:       'spin-da-bottle',
  RECONNECT_DELAY: 3000,
  COUNTDOWN_SECS:  5,
};


/* ═══════════════════════════════════════════════════════════════
   2. SPEEDBET API SERVICE
   ═══════════════════════════════════════════════════════════════ */
const SpeedBetAPI = (() => {

  const TOKEN_KEY = 'skybet_token';
  const USER_KEY  = 'skybet_user';

  const getToken = () => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  };
  const setToken  = t => {
    if (!t || t === 'undefined') { console.error('[api] setToken invalid:', t); return; }
    localStorage.setItem(TOKEN_KEY, t);
  };
  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const getUser  = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser  = u  => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const isAuthed = () => !!getToken();

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
      return true;
    } catch {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return false;
    }
  }

  const _get  = (path, auth = false)       => _req(path, { method: 'GET' }, auth);
  const _post = (path, body, auth = false) => _req(path, { method: 'POST', body: JSON.stringify(body) }, auth);
  const _patch= (path, body, auth = false) => _req(path, { method: 'PATCH', body: JSON.stringify(body) }, auth);

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

  const wallet = {
    get:          ()          => _get('/api/wallet', true),
    transactions: (p=0, s=20) => _get(`/api/wallet/transactions?page=${p}&size=${s}`, true),
    withdraw:     payload     => _post('/api/wallet/withdraw', payload, true),
  };

  const games = {
    currentRound: game            => _get(`/api/games/${game}/current-round`, true),
    history:      (limit = 20)    => _get(`/api/games/history?limit=${limit}`, true),
    play:         (game, payload) => _post(`/api/games/${game}/play`, payload, true),
    result:       (game, payload) => _post(`/api/games/${game}/result`, payload, true),
  };

  const user = {
    me:     ()      => _get('/api/users/me', true),
    update: payload => _patch('/api/users/me', payload, true),
  };

  return {
    getToken, setToken, clearToken, getUser, setUser, isAuthed,
    auth, wallet, games, user,
  };
})();


/* ═══════════════════════════════════════════════════════════════
   3. WEBSOCKET BUS — STOMP over SockJS, auto-reconnect
   ═══════════════════════════════════════════════════════════════ */
const WSBus = (() => {
  let client = null, connected = false;
  const pending = {};

  function connect(onReady) {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
      console.warn('[WSBus] SockJS/Stomp not loaded — running offline');
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


/* ═══════════════════════════════════════════════════════════════
   4. WALLET MANAGER — optimistic local balance + server sync
   ═══════════════════════════════════════════════════════════════ */
const Wallet = (() => {
  let _balance = 1000.00;

  async function fetch() {
    if (!SpeedBetAPI.isAuthed()) return;
    try {
      const data = await SpeedBetAPI.wallet.get();
      _balance   = parseFloat(data.balance ?? data.amount ?? _balance);
      UIHandler.updateBalance(_balance);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
        console.warn('[Wallet] fetch:', e.message);
    }
  }

  function subscribeWS() {
    WSBus.subscribe('/topic/wallet/balance', msg => {
      try {
        const data = JSON.parse(msg.body);
        _balance   = parseFloat(data.balance ?? data.amount ?? _balance);
        UIHandler.updateBalance(_balance);
      } catch { /**/ }
    });
  }

  const get    = ()  => _balance;
  const set    = v   => { _balance = parseFloat(v); };
  const deduct = amt => { _balance = Math.max(0, parseFloat((_balance - amt).toFixed(2))); };
  const credit = amt => { _balance = parseFloat((_balance + parseFloat(amt)).toFixed(2)); };

  return { fetch, subscribeWS, get, set, deduct, credit };
})();


/* ═══════════════════════════════════════════════════════════════
   5. BOTTLE ROUND — server round-id tracking + result posting
   ═══════════════════════════════════════════════════════════════ */
const BottleRound = (() => {
  let _roundId    = null;
  let _settled    = false;

  async function fetchCurrentRound(slug) {
    if (!SpeedBetAPI.isAuthed()) return null;
    try {
      return await SpeedBetAPI.games.currentRound(slug);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
        console.warn('[BottleRound] fetchCurrentRound:', e.message);
      return null;
    }
  }

  /**
   * POST /api/games/{slug}/play  { stake, choice }
   * Returns GameRound { id, stake, choice, ... }
   */
  async function placeBet(slug, stake, choice) {
    // Country stake floor/ceiling — single source of truth is the
    // SkyBet bridge, which carries the value the user's registered
    // country defines. Reject before we spend a network round-trip.
    { const _c = CB.checkStake(stake); if (!_c.ok) { try { UI.setBetStatus && UI.setBetStatus(0, _c.reason, '#e63946'); } catch (e) {} throw new Error(_c.reason); } }

    const data = await SpeedBetAPI.games.play(slug, { stake, choice });
    _roundId  = data.id;
    _settled  = false;
    return data;
  }

  /**
   * POST /api/games/{slug}/result  { roundId, outcome, payout }
   * Returns confirmed payout.
   */
  async function settleRound(slug, outcome, payout) {
    if (_settled || !_roundId) return null;
    const data = await SpeedBetAPI.games.result(slug, {
      roundId: _roundId,
      outcome,
      payout,
    });
    _settled = true;
    return data;
  }

  function subscribeToState(slug, onOutcome) {
    WSBus.subscribe(`/topic/${slug}/state`, msg => {
      try {
        const payload = JSON.parse(msg.body);
        if (payload.state === 'RESULT') onOutcome(payload);
      } catch { /**/ }
    });
  }

  function reset() {
    _roundId = null;
    _settled = false;
  }

  const getRoundId = () => _roundId;
  const isSettled  = () => _settled;

  return { fetchCurrentRound, placeBet, settleRound, subscribeToState, reset, getRoundId, isSettled };
})();


/* ═══════════════════════════════════════════════════════════════
   6. RNG — Provably-fair local fallback
   ═══════════════════════════════════════════════════════════════ */
const RNG = (() => {
  /**
   * Distribution:
   *   0.000 – 0.485 → UP     (48.5%)
   *   0.485 – 0.970 → DOWN   (48.5%)
   *   0.970 – 1.000 → MIDDLE (3.0%) — house edge
   *
   * Player RTP = (0.485 + 0.485) × 2 = ~97%
   */

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

  async function generateOutcome() {
    const serverSeed = randomHex(16);
    const clientSeed = randomHex(8);
    const nonce      = Math.floor(Math.random() * 100000);
    const hash       = await hmacSHA256(serverSeed, clientSeed + nonce);
    const num        = parseInt(hash.substring(0, 8), 16);
    const r          = num / 0xffffffff;

    let outcome;
    if      (r < 0.485) outcome = 'UP';
    else if (r < 0.970) outcome = 'DOWN';
    else                outcome = 'MIDDLE';

    return { outcome, serverSeed, clientSeed, nonce: String(nonce), hash };
  }

  /**
   * Given an outcome, return the target bottle angle.
   * Bottle neck points UP at 0° (12 o'clock).
   *   UP     = near 0°   (±25° randomness)
   *   DOWN   = near 180° (±25° randomness)
   *   MIDDLE = near 90° or 270° (±15° randomness)
   */
  function getTargetAngle(outcome) {
    switch (outcome) {
      case 'UP':     return (Math.random() * 50) - 25;
      case 'DOWN':   return 180 + (Math.random() * 50) - 25;
      case 'MIDDLE': return (Math.random() > 0.5 ? 90 : 270) + (Math.random() * 30) - 15;
    }
  }

  return { generateOutcome, getTargetAngle };
})();


/* ═══════════════════════════════════════════════════════════════
   7. AUDIO ENGINE — Web Audio API Procedural Sounds
   ═══════════════════════════════════════════════════════════════ */
const AudioEngine = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { enabled = false; }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playSpinStart() {
    if (!enabled || !ctx) return;
    resume();
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const gain   = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 0.8;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  }

  function playTick() {
    if (!enabled || !ctx) return;
    resume();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
  }

  function playCountdown() {
    if (!enabled || !ctx) return;
    resume();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  }

  function playWin() {
    if (!enabled || !ctx) return;
    resume();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.3);
    });
  }

  function playLose() {
    if (!enabled || !ctx) return;
    resume();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  }

  function playHouse() {
    if (!enabled || !ctx) return;
    resume();
    [130, 155, 185].forEach(freq => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    });
  }

  function playClick() {
    if (!enabled || !ctx) return;
    resume();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
  }

  return { init, playSpinStart, playTick, playCountdown, playWin, playLose, playHouse, playClick };
})();


/* ═══════════════════════════════════════════════════════════════
   8. RENDERER — Canvas 2D Drawing
   ═══════════════════════════════════════════════════════════════ */
const Renderer = (() => {
  let canvas, ctx2d;
  const CX = 160, CY = 160, R = 148;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx2d  = canvas.getContext('2d');
  }

  function drawTable(highlightZone) {
    const c = ctx2d;
    c.clearRect(0, 0, 320, 320);

    const baseGrad = c.createRadialGradient(CX, CY, 0, CX, CY, R);
    baseGrad.addColorStop(0,   '#1a2638');
    baseGrad.addColorStop(0.7, '#111d2e');
    baseGrad.addColorStop(1,   '#0a1520');
    c.beginPath();
    c.arc(CX, CY, R, 0, Math.PI * 2);
    c.fillStyle = baseGrad;
    c.fill();

    c.save();
    c.beginPath();
    c.arc(CX, CY, R, Math.PI, 0);
    c.lineTo(CX, CY);
    c.closePath();
    c.fillStyle = highlightZone === 'UP'
      ? 'rgba(0, 210, 100, 0.22)'
      : 'rgba(0, 190, 90, 0.10)';
    c.fill();
    c.restore();

    c.save();
    c.beginPath();
    c.arc(CX, CY, R, 0, Math.PI);
    c.lineTo(CX, CY);
    c.closePath();
    c.fillStyle = highlightZone === 'DOWN'
      ? 'rgba(255, 55, 55, 0.22)'
      : 'rgba(220, 40, 40, 0.10)';
    c.fill();
    c.restore();

    c.beginPath();
    c.moveTo(CX - R, CY);
    c.lineTo(CX + R, CY);
    c.strokeStyle = highlightZone === 'MIDDLE'
      ? 'rgba(255, 215, 0, 0.7)'
      : 'rgba(255, 215, 0, 0.2)';
    c.lineWidth = highlightZone === 'MIDDLE' ? 5 : 3;
    c.stroke();

    c.fillStyle = 'rgba(255, 215, 0, 0.35)';
    c.font = 'bold 9px Rajdhani, sans-serif';
    c.letterSpacing = '2px';
    c.textAlign = 'center';
    c.fillText('HOUSE', CX + 90, CY - 5);
    c.fillText('ZONE',  CX + 90, CY + 11);

    c.font = 'bold 14px Rajdhani, sans-serif';
    c.letterSpacing = '3px';
    c.fillStyle = highlightZone === 'UP'
      ? 'rgba(0, 230, 120, 0.9)'
      : 'rgba(0, 210, 100, 0.45)';
    c.textAlign = 'center';
    c.fillText('▲ UP', CX, CY - 72);
    c.fillStyle = highlightZone === 'DOWN'
      ? 'rgba(255, 80, 80, 0.9)'
      : 'rgba(230, 60, 60, 0.45)';
    c.fillText('▼ DOWN', CX, CY + 85);

    [R * 0.95, R * 0.75, R * 0.45].forEach((r, i) => {
      c.beginPath();
      c.arc(CX, CY, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(255, 215, 0, ${0.05 - i * 0.01})`;
      c.lineWidth = 0.5;
      c.stroke();
    });

    c.beginPath();
    c.arc(CX, CY, R, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    c.lineWidth = 2;
    c.stroke();

    c.beginPath();
    c.arc(CX, CY, R - 4, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    c.lineWidth = 1;
    c.stroke();

    const sheenGrad = c.createRadialGradient(CX - 40, CY - 50, 0, CX, CY, R);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.beginPath();
    c.arc(CX, CY, R, 0, Math.PI * 2);
    c.fillStyle = sheenGrad;
    c.fill();
  }

  function drawBottle(angleDeg) {
    const c   = ctx2d;
    const rad = (angleDeg - 90) * Math.PI / 180;

    c.save();
    c.translate(CX, CY);
    c.rotate(rad);

    c.save();
    c.shadowColor    = 'rgba(0,0,0,0.5)';
    c.shadowBlur     = 12;
    c.shadowOffsetX  = 4;
    c.shadowOffsetY  = 4;

    const bw = 22, bh = 47;
    const nw = 13, nh = 52;

    const bodyGrad = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    bodyGrad.addColorStop(0,    'rgba(30, 80, 160, 0.9)');
    bodyGrad.addColorStop(0.25, 'rgba(100, 180, 255, 0.75)');
    bodyGrad.addColorStop(0.5,  'rgba(160, 220, 255, 0.65)');
    bodyGrad.addColorStop(0.75, 'rgba(80, 150, 220, 0.75)');
    bodyGrad.addColorStop(1,    'rgba(20, 60, 130, 0.9)');

    roundRect(c, -bw / 2, 6, bw, bh, 7);
    c.fillStyle = bodyGrad; c.fill();
    c.strokeStyle = 'rgba(140, 210, 255, 0.5)'; c.lineWidth = 0.8; c.stroke();

    c.beginPath();
    c.moveTo(-bw / 2, 10);
    c.bezierCurveTo(-bw / 2, 6, -nw / 2 - 2, 2, -nw / 2, -4);
    c.lineTo(nw / 2, -4);
    c.bezierCurveTo(nw / 2 + 2, 2, bw / 2, 6, bw / 2, 10);
    c.closePath();
    c.fillStyle = bodyGrad; c.fill();
    c.strokeStyle = 'rgba(140, 210, 255, 0.5)'; c.lineWidth = 0.8; c.stroke();

    const neckGrad = c.createLinearGradient(-nw / 2, 0, nw / 2, 0);
    neckGrad.addColorStop(0,   'rgba(30, 80, 160, 0.9)');
    neckGrad.addColorStop(0.3, 'rgba(120, 190, 255, 0.7)');
    neckGrad.addColorStop(0.7, 'rgba(100, 170, 240, 0.7)');
    neckGrad.addColorStop(1,   'rgba(25, 70, 140, 0.9)');

    roundRect(c, -nw / 2, -4 - nh, nw, nh, 4);
    c.fillStyle = neckGrad; c.fill();
    c.strokeStyle = 'rgba(140, 210, 255, 0.5)'; c.lineWidth = 0.8; c.stroke();

    const lipY = -4 - nh - 8;
    roundRect(c, -nw / 2 - 1.5, lipY, nw + 3, 10, 3);
    c.fillStyle = 'rgba(170, 225, 255, 0.85)'; c.fill();
    c.strokeStyle = 'rgba(200, 240, 255, 0.7)'; c.lineWidth = 0.7; c.stroke();

    c.restore();

    const shineGrad = c.createLinearGradient(-bw / 2, 0, -bw / 2 + 7, 0);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shineGrad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(c, -bw / 2 + 2, 10, 6, bh - 6, 3);
    c.fillStyle = shineGrad; c.fill();

    const neckShine = c.createLinearGradient(-nw / 2, 0, -nw / 2 + 5, 0);
    neckShine.addColorStop(0, 'rgba(255,255,255,0)');
    neckShine.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    neckShine.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(c, -nw / 2 + 1.5, -4 - nh + 4, 4, nh - 8, 2);
    c.fillStyle = neckShine; c.fill();

    c.fillStyle = 'rgba(255, 255, 255, 0.06)';
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.5;
    roundRect(c, -bw / 2 + 1, 16, bw - 2, 26, 2);
    c.fill(); c.stroke();

    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.font = '600 5.5px Rajdhani, sans-serif';
    c.textAlign = 'center';
    c.fillText('CASINO', 0, 28);
    c.fillText('EDITION', 0, 36);

    c.beginPath();
    c.ellipse(0, 53, bw / 2 - 3, 3.5, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(10, 40, 100, 0.6)'; c.fill();

    c.restore();

    c.beginPath();
    c.arc(CX, CY, 5, 0, Math.PI * 2);
    c.fillStyle = '#ffd700'; c.fill();
    c.beginPath();
    c.arc(CX, CY, 2.5, 0, Math.PI * 2);
    c.fillStyle = '#ffffff'; c.fill();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawFrame(angleDeg, highlightZone) {
    drawTable(highlightZone);
    drawBottle(angleDeg);
  }

  return { init, drawFrame };
})();


/* ═══════════════════════════════════════════════════════════════
   9. PHYSICS ENGINE — Spin Easing + Wobble
   ═══════════════════════════════════════════════════════════════ */
const PhysicsEngine = (() => {
  function createSpin(startAngle, targetAngle, duration) {
    const fullSpins       = (3 + Math.floor(Math.random() * 3)) * 360;
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;
    const currentOffset   = ((startAngle % 360) + 360) % 360;
    let delta = normalizedTarget - currentOffset;
    if (delta < 0) delta += 360;
    const totalDelta = fullSpins + delta;
    return { startAngle, totalDelta, duration, startTime: null };
  }

  function ease(t) {
    const base = 1 - Math.pow(1 - t, 4);
    if (t > 0.85) {
      const wobbleT = (t - 0.85) / 0.15;
      const decay   = 1 - wobbleT;
      const wobble  = Math.sin(wobbleT * Math.PI * 5) * 0.006 * decay;
      return base + wobble;
    }
    return base;
  }

  function evaluate(spin, now) {
    if (!spin.startTime) spin.startTime = now;
    const elapsed = now - spin.startTime;
    const t       = Math.min(elapsed / spin.duration, 1);
    const easedT  = ease(t);
    const angle   = spin.startAngle + spin.totalDelta * easedT;
    return { angle, progress: t, done: t >= 1 };
  }

  return { createSpin, evaluate };
})();


/* ═══════════════════════════════════════════════════════════════
   10. ANIMATION CONTROLLER
   ═══════════════════════════════════════════════════════════════ */
const AnimController = (() => {
  let rafId         = null;
  let activeSpin    = null;
  let onDone        = null;
  let lastTickAngle = 0;
  const TICK_INTERVAL_DEG = 45;

  function start(spin, doneCb) {
    activeSpin    = spin;
    onDone        = doneCb;
    lastTickAngle = GameState.get('currentAngle');
    if (rafId) cancelAnimationFrame(rafId);
    loop(performance.now());
  }

  function loop(now) {
    if (!activeSpin) return;
    const { angle, done } = PhysicsEngine.evaluate(activeSpin, now);

    const diff = Math.abs(angle - lastTickAngle);
    if (diff >= TICK_INTERVAL_DEG) {
      AudioEngine.playTick();
      lastTickAngle = angle;
    }

    GameState.set('currentAngle', angle);
    Renderer.drawFrame(angle, null);

    if (done) {
      GameState.set('currentAngle', activeSpin.startAngle + activeSpin.totalDelta);
      activeSpin = null;
      if (onDone) onDone();
    } else {
      rafId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null; activeSpin = null;
  }

  return { start, stop };
})();


/* ═══════════════════════════════════════════════════════════════
   11. GAME STATE — Central State Manager
   ═══════════════════════════════════════════════════════════════ */
const GameState = (() => {
  const state = {
    // Player
    balance:     1000,
    wins:        0,
    losses:      0,
    streak:      0,
    bestStreak:  0,
    totalWon:    0,
    totalLost:   0,

    // Current round
    choice:      null,      // 'UP' | 'DOWN'
    bet:         50,
    lastOutcome: null,      // 'UP' | 'DOWN' | 'MIDDLE'

    // Game phase
    phase: 'IDLE',          // 'IDLE' | 'WAITING' | 'SPINNING' | 'RESULT' | 'PAUSED'

    // Bottle physics
    currentAngle: 0,

    // History (last 15 results)
    history:     [],
    MAX_HISTORY: 15,

    // Provably-fair info for current round
    fairness: { serverSeed: '', clientSeed: '', nonce: '', hash: '' },

    // Free-bet rescue state
    freeBetGiven: false,
  };

  const get     = key => state[key];
  const set     = (key, val) => { state[key] = val; return val; };
  const getAll  = () => ({ ...state });

  function addHistory(outcome) {
    state.history.unshift(outcome);
    if (state.history.length > state.MAX_HISTORY) state.history.pop();
  }

  function applyResult(outcome, bet) {
    state.lastOutcome = outcome;
    const choice = state.choice;
    let won = false;

    if ((outcome === 'UP' && choice === 'UP') || (outcome === 'DOWN' && choice === 'DOWN')) {
      state.balance  += bet;
      state.wins++;
      state.streak++;
      state.totalWon += bet;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      won = true;
    } else {
      state.balance   -= bet;
      state.losses++;
      state.streak     = 0;
      state.totalLost += bet;
    }

    // Free-bet rescue
    let freeBonus = 0;
    if (state.balance < 10 && !state.freeBetGiven) {
      freeBonus       = 250;
      state.balance  += freeBonus;
      state.freeBetGiven = true;
    } else if (state.balance >= 100) {
      state.freeBetGiven = false;
    }

    addHistory(outcome);
    return { won, freeBonus };
  }

  function setFairness(info) {
    state.fairness = { ...state.fairness, ...info };
  }

  return { get, set, getAll, applyResult, addHistory, setFairness };
})();


/* ═══════════════════════════════════════════════════════════════
   12. FAKE PLAYERS — Bystander Simulation
   ═══════════════════════════════════════════════════════════════ */
const FakePlayers = (() => {
  const NAMES = [
    'lucky_spin', 'bottleking', 'up_only', 'midmaster', 'the_gambler',
    'neon_bet',   'rizzy',      'highroll', 'slick_dan',  'quiet_ace',
    'down_queen', 'spindoctor', 'mr_house', 'aces_high',  'spinwitch',
  ];
  let players = [];

  function init(outcome) {
    // ~65% of fakes bet on the correct outcome, rest guess randomly
    players = NAMES.map(n => {
      const r     = Math.random();
      const guess = r < 0.65
        ? outcome
        : (Math.random() < 0.5 ? 'UP' : 'DOWN');
      return {
        name:  n,
        bet:   Math.floor(Math.random() * 200 + 10),
        guess,
        shown: false,
      };
    });
  }

  function reveal(outcome) {
    players.forEach(p => {
      if (!p.shown) {
        p.shown = true;
        if (p.guess === outcome && outcome !== 'MIDDLE') {
          UIHandler.showBetTicker(p.name, p.guess, p.bet * 2, true);
        } else {
          UIHandler.showBetTicker(p.name, p.guess, p.bet, false);
        }
      }
    });
  }

  return { init, reveal };
})();


/* ═══════════════════════════════════════════════════════════════
   13. UI HANDLER — DOM Manipulation & Events
   ═══════════════════════════════════════════════════════════════ */
const UIHandler = (() => {
  const els = {};

  function init() {
    els.balanceVal   = document.getElementById('balance-val');
    els.winsVal      = document.getElementById('wins-val');
    els.streakVal    = document.getElementById('streak-val');
    els.resultDisp   = document.getElementById('result-display');
    els.resultText   = document.getElementById('result-text');
    els.histPills    = document.getElementById('history-pills');
    els.spinBtn      = document.getElementById('spin-btn');
    els.spinBtnText  = document.getElementById('spin-btn-text');
    els.betInput     = document.getElementById('bet-input');
    els.btnUp        = document.getElementById('btn-up');
    els.btnDown      = document.getElementById('btn-down');
    els.flashOvly    = document.getElementById('flash-overlay');
    els.upGlow       = document.getElementById('up-zone-glow');
    els.downGlow     = document.getElementById('down-zone-glow');
    els.betTicker    = document.getElementById('bet-ticker');
    els.phaseLabel   = document.getElementById('phase-label');
    els.countdownWrap= document.getElementById('countdown-wrap');
    els.countdownVal = document.getElementById('countdown-val');
    els.authGate     = document.getElementById('auth-gate');
    els.authGateMsg  = document.getElementById('auth-gate-msg');
    els.authEmail    = document.getElementById('auth-email');
    els.authPassword = document.getElementById('auth-password');
    els.btnLogin     = document.getElementById('btn-login');
    els.btnDemo      = document.getElementById('btn-demo');
    els.authError    = document.getElementById('auth-error');
    els.fairnessBtn  = document.getElementById('btn-fairness');
    els.fairnessModal= document.getElementById('fairness-modal');
    els.modalClose   = document.getElementById('modal-close');
    els.fServerSeed  = document.getElementById('f-server-seed');
    els.fClientSeed  = document.getElementById('f-client-seed');
    els.fNonce       = document.getElementById('f-nonce');
    els.fHash        = document.getElementById('f-hash');
    els.fOutcome     = document.getElementById('f-outcome');
  }

  function updateBalance(bal) {
    if (els.balanceVal) els.balanceVal.textContent = CB.sym() + parseFloat(bal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateStats() {
    const s = GameState.getAll();
    updateBalance(s.balance);
    if (els.winsVal)   els.winsVal.textContent   = s.wins;
    if (els.streakVal) els.streakVal.textContent  = s.streak >= 2 ? '🔥 ×' + s.streak : '—';
  }

  function setChoiceActive(choice) {
    els.btnUp?.classList.toggle('active',   choice === 'UP');
    els.btnDown?.classList.toggle('active', choice === 'DOWN');
  }

  function setSpinBtnLabel(text, disabled) {
    if (els.spinBtnText) els.spinBtnText.textContent = text;
    if (els.spinBtn)     els.spinBtn.disabled         = disabled;
  }

  function setPhaseText(text) {
    if (els.phaseLabel) els.phaseLabel.textContent = text;
  }

  function showCountdown(sec) {
    els.countdownWrap?.classList.add('visible');
    if (els.countdownVal) els.countdownVal.textContent = sec;
  }

  function updateCountdown(sec) {
    if (els.countdownVal) els.countdownVal.textContent = sec;
  }

  function hideCountdown() {
    els.countdownWrap?.classList.remove('visible');
  }

  function showResult(text, type) {
    if (els.resultText) els.resultText.textContent = text;
    if (els.resultDisp) els.resultDisp.className   = 'result-display show ' + type;
  }

  function hideResult() {
    if (els.resultDisp) els.resultDisp.className = 'result-display';
  }

  function flash(type) {
    if (!els.flashOvly) return;
    els.flashOvly.className = '';
    void els.flashOvly.offsetWidth;
    els.flashOvly.className = 'flash-overlay ' + type;
    setTimeout(() => { if (els.flashOvly) els.flashOvly.className = 'flash-overlay'; }, 800);
  }

  function showZoneGlow(zone) {
    els.upGlow?.classList.remove('active');
    els.downGlow?.classList.remove('active');
    if (zone === 'UP')   els.upGlow?.classList.add('active');
    if (zone === 'DOWN') els.downGlow?.classList.add('active');
  }

  function clearZoneGlows() {
    els.upGlow?.classList.remove('active');
    els.downGlow?.classList.remove('active');
  }

  function renderHistory(history) {
    if (!els.histPills) return;
    if (!history.length) {
      els.histPills.innerHTML = '<span class="history-empty">No spins yet</span>';
      return;
    }
    els.histPills.innerHTML = '';
    history.forEach(o => {
      const pill       = document.createElement('div');
      const cls        = o === 'UP' ? 'up' : o === 'DOWN' ? 'down' : 'mid';
      const lbl        = o === 'UP' ? '▲'  : o === 'DOWN' ? '▼'   : 'M';
      pill.className   = 'h-pill ' + cls;
      pill.textContent = lbl;
      pill.title       = o;
      els.histPills.appendChild(pill);
    });
  }

  /** Show a cashout-style ticker for fake players */
  function showBetTicker(name, side, amount, won) {
    if (!els.betTicker) return;
    const item       = document.createElement('div');
    item.className   = 'ticker-item ' + (won ? 'win' : 'lose');
    const arrow      = side === 'UP' ? '▲' : '▼';
    item.textContent = won
      ? `${name} ${arrow} won ${CB.sym()}${amount.toFixed(2)}`
      : `${name} ${arrow} lost ${CB.sym()}${amount.toFixed(2)}`;
    els.betTicker.prepend(item);
    setTimeout(() => item.remove(), 3500);
  }

  function getBet() {
    const raw = parseInt(els.betInput?.value, 10) || 1;
    const max = Wallet.get();
    const val = Math.max(1, Math.min(raw, max));
    if (els.betInput) els.betInput.value = val;
    return val;
  }

  function setBetValue(v) {
    const max = Wallet.get();
    if (els.betInput) els.betInput.value = Math.max(1, Math.min(Math.floor(v), max));
  }

  function updateFairnessModal(info, outcome, revealed) {
    if (els.fServerSeed) els.fServerSeed.textContent = info.serverSeed || '---';
    if (els.fClientSeed) els.fClientSeed.textContent = info.clientSeed || '---';
    if (els.fNonce)      els.fNonce.textContent       = info.nonce      || '---';
    if (els.fHash)       els.fHash.textContent        = info.hash       || '---';
    if (els.fOutcome)    els.fOutcome.textContent     = revealed ? outcome : 'Revealed after spin';
  }

  function showAuthGate(msg = 'Sign in to play.') {
    if (!els.authGate) return;
    if (els.authGateMsg) els.authGateMsg.textContent = msg;
    els.authGate.classList.remove('hidden');
    setSpinBtnLabel('SIGN IN TO PLAY', true);
  }

  function hideAuthGate() {
    els.authGate?.classList.add('hidden');
  }

  function setAuthError(msg) {
    if (els.authError) els.authError.textContent = msg || '';
  }

  function setAuthLoading(on) {
    if (els.btnLogin) els.btnLogin.disabled = on;
    if (els.btnDemo)  els.btnDemo.disabled  = on;
  }

  return {
    init, updateBalance, updateStats, setChoiceActive, setSpinBtnLabel,
    setPhaseText, showCountdown, updateCountdown, hideCountdown,
    showResult, hideResult, flash, showZoneGlow, clearZoneGlows,
    renderHistory, showBetTicker, getBet, setBetValue,
    updateFairnessModal, showAuthGate, hideAuthGate, setAuthError, setAuthLoading,
  };
})();


/* ═══════════════════════════════════════════════════════════════
   14. AUTH REACTOR
   ═══════════════════════════════════════════════════════════════ */
const AuthReactor = (() => {
  function init() {
    window.addEventListener('auth:login',   _onLogin);
    window.addEventListener('auth:logout',  _onLogout);
    window.addEventListener('auth:expired', _onExpired);
    _wireAuthForm();
  }

  function _wireAuthForm() {
    const btnLogin = document.getElementById('btn-login');
    const btnDemo  = document.getElementById('btn-demo');
    const pwField  = document.getElementById('auth-password');

    btnLogin?.addEventListener('click', async () => {
      const email    = document.getElementById('auth-email')?.value?.trim();
      const password = document.getElementById('auth-password')?.value;
      if (!email || !password) { UIHandler.setAuthError('Enter email and password.'); return; }
      UIHandler.setAuthError('');
      UIHandler.setAuthLoading(true);
      try {
        const data = await SpeedBetAPI.auth.login(email, password);
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
      } catch (e) {
        UIHandler.setAuthError(e.message || 'Login failed.');
      } finally {
        UIHandler.setAuthLoading(false);
      }
    });

    btnDemo?.addEventListener('click', async () => {
      UIHandler.setAuthError('');
      UIHandler.setAuthLoading(true);
      try {
        const data = await SpeedBetAPI.auth.demoLogin('USER');
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
      } catch (e) {
        console.warn('[Auth] demo-login unavailable, running offline:', e.message);
        UIHandler.hideAuthGate();
        UIHandler.updateBalance(Wallet.get());
        GameCore.resumeFromPause();
      } finally {
        UIHandler.setAuthLoading(false);
      }
    });

    pwField?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login')?.click();
    });
  }

  async function _onLogin() {
    WSBus.reconnect(() => Wallet.subscribeWS());
    await Wallet.fetch();
    UIHandler.hideAuthGate();
    UIHandler.updateBalance(Wallet.get());
    if (GameState.get('phase') === 'PAUSED') GameCore.resumeFromPause();
  }

  function _onLogout() {
    WSBus.disconnect();
    GameCore.pause();
    UIHandler.showAuthGate('Sign in to keep playing.');
    UIHandler.updateBalance(0);
  }

  function _onExpired() {
    WSBus.disconnect();
    GameCore.pause();
    UIHandler.showAuthGate('Your session expired. Please sign in again.');
    UIHandler.updateBalance(0);
  }

  return { init };
})();


/* ═══════════════════════════════════════════════════════════════
   15. GAME CORE — Orchestrates All Modules
   ═══════════════════════════════════════════════════════════════ */
const GameCore = (() => {
  let _countdownInterval = null;
  let _paused = false;

  /* ── Networking ─────────────────────────────────────── */
  async function _startNetworking() {
    WSBus.connect(() => Wallet.subscribeWS());
    await Wallet.fetch();
    await BottleRound.fetchCurrentRound(CONFIG.GAME_SLUG);

    // Server-pushed outcomes (authoritative reconciliation)
    BottleRound.subscribeToState(CONFIG.GAME_SLUG, payload => {
      // Server pushed an outcome — if we are still in SPINNING phase,
      // override our local outcome with the server's authoritative one.
      if (payload.outcome && GameState.get('phase') === 'SPINNING') {
        console.info('[WS] Server overriding outcome to:', payload.outcome);
        GameState.set('_serverOutcome', payload.outcome);
      }
    });
  }

  /* ── Pause / Resume ─────────────────────────────────── */
  function pause() {
    _paused = true;
    clearInterval(_countdownInterval);
    AnimController.stop();
    GameState.set('phase', 'PAUSED');
    UIHandler.setPhaseText('GAME PAUSED');
    UIHandler.setSpinBtnLabel('PAUSED', true);
    BottleRound.reset();
  }

  function resumeFromPause() {
    _paused = false;
    startWaiting();
  }

  /* ── WAITING phase ──────────────────────────────────── */
  async function startWaiting() {
    if (_paused) return;

    GameState.set('phase', 'WAITING');
    GameState.set('_serverOutcome', null);
    BottleRound.reset();

    // Generate provably-fair info (local fallback)
    const localInfo = await RNG.generateOutcome();
    GameState.setFairness({
      serverSeed: localInfo.serverSeed,
      clientSeed: localInfo.clientSeed,
      nonce:      localInfo.nonce,
      hash:       localInfo.hash,
    });
    UIHandler.updateFairnessModal(GameState.get('fairness'), null, false);

    // Fetch server round if authed
    if (SpeedBetAPI.isAuthed()) {
      try {
        const roundData = await BottleRound.fetchCurrentRound(CONFIG.GAME_SLUG);
        if (roundData?.serverSeed) {
          GameState.setFairness({ serverSeed: roundData.serverSeed });
          UIHandler.updateFairnessModal(GameState.get('fairness'), null, false);
        }
      } catch { /* stay local */ }
    }

    UIHandler.setPhaseText('PLACE YOUR BET');
    UIHandler.hideResult();
    UIHandler.clearZoneGlows();
    UIHandler.updateBalance(Wallet.get());
    UIHandler.renderHistory(GameState.get('history'));
    Renderer.drawFrame(GameState.get('currentAngle'), null);

    const choice = GameState.get('choice');
    UIHandler.setChoiceActive(choice);
    UIHandler.setSpinBtnLabel(
      choice ? `SPIN — ${choice}` : 'SELECT UP OR DOWN',
      !choice || !SpeedBetAPI.isAuthed()
    );

    // Countdown
    let sec = CONFIG.COUNTDOWN_SECS;
    UIHandler.showCountdown(sec);
    _countdownInterval = setInterval(() => {
      if (_paused) { clearInterval(_countdownInterval); return; }
      sec--;
      AudioEngine.playCountdown();
      if (sec <= 0) {
        clearInterval(_countdownInterval);
        UIHandler.hideCountdown();
      } else {
        UIHandler.updateCountdown(sec);
      }
    }, 1000);
  }

  /* ── Select UP or DOWN ──────────────────────────────── */
  function selectChoice(choice) {
    if (GameState.get('phase') !== 'WAITING' && GameState.get('phase') !== 'IDLE') return;
    AudioEngine.playClick();
    GameState.set('choice', choice);
    UIHandler.setChoiceActive(choice);
    const authed = SpeedBetAPI.isAuthed();
    UIHandler.setSpinBtnLabel(`SPIN — ${choice}`, !authed);
    UIHandler.hideResult();
    if (!authed) UIHandler.showAuthGate('Sign in to place bets.');
  }

  /* ── Trigger spin ───────────────────────────────────── */
  async function startSpin() {
    if (GameState.get('phase') === 'SPINNING') return;
    if (!SpeedBetAPI.isAuthed()) { UIHandler.showAuthGate('Sign in to place bets.'); return; }

    const bet    = UIHandler.getBet();
    const choice = GameState.get('choice');
    if (!choice || bet < 1 || bet > Wallet.get()) return;

    GameState.set('phase', 'SPINNING');
    UIHandler.setSpinBtnLabel('SPINNING...', true);
    UIHandler.hideResult();
    UIHandler.clearZoneGlows();
    clearInterval(_countdownInterval);
    UIHandler.hideCountdown();

    // Optimistic deduct
    Wallet.deduct(bet);
    UIHandler.updateBalance(Wallet.get());

    // Roll local outcome (server may override via WS push)
    const localRoll    = await RNG.generateOutcome();
    const localOutcome = localRoll.outcome;
    const targetAngle  = RNG.getTargetAngle(localOutcome);
    const duration     = 3400 + Math.random() * 1200;

    // Place bet on server (async — don't block the spin animation)
    if (SpeedBetAPI.isAuthed()) {
      SpeedBetAPI.games.play(CONFIG.GAME_SLUG, { stake: bet, choice })
        .then(data => {
          if (data?.id) BottleRound.reset(); // BottleRound tracks internally via placeBet
        })
        .catch(e => {
          if (e.message === 'SESSION_EXPIRED') return;
          console.warn('[GameCore] placeBet error:', e.message);
          // Refund optimistic deduct on hard failure
          Wallet.credit(bet);
          UIHandler.updateBalance(Wallet.get());
        });
    }

    // Init fake players using local outcome as approximation
    FakePlayers.init(localOutcome);

    AudioEngine.playSpinStart();

    const spin = PhysicsEngine.createSpin(GameState.get('currentAngle'), targetAngle, duration);
    AnimController.start(spin, () => {
      // Use server override if available, otherwise local
      const finalOutcome = GameState.get('_serverOutcome') || localOutcome;
      onSpinComplete(finalOutcome, bet);
    });
  }

  /* ── Spin complete ──────────────────────────────────── */
  async function onSpinComplete(outcome, bet) {
    GameState.set('phase', 'RESULT');

    const { won, freeBonus } = GameState.applyResult(outcome, bet);
    const payout = won ? bet * 2 : 0;

    // Redraw with highlight
    Renderer.drawFrame(GameState.get('currentAngle'), outcome);
    UIHandler.showZoneGlow(outcome);

    // Settle on server
    if (SpeedBetAPI.isAuthed()) {
      try {
        const result = await BottleRound.settleRound(CONFIG.GAME_SLUG, outcome, payout);
        // Reconcile with server-confirmed payout
        if (result?.payout !== undefined) {
          const serverPayout = parseFloat(result.payout);
          if (won) {
            // Remove optimistic credit (applyResult already added bet)
            Wallet.deduct(bet);
            Wallet.credit(serverPayout);
          }
          UIHandler.updateBalance(Wallet.get());
        }
        if (result?.walletBalance !== undefined) {
          Wallet.set(parseFloat(result.walletBalance));
          UIHandler.updateBalance(Wallet.get());
        }
      } catch (e) {
        if (e.message !== 'SESSION_EXPIRED' && e.message !== 'NETWORK_ERROR')
          console.warn('[GameCore] settleRound error:', e.message);
        // Re-fetch balance for reconciliation
        await Wallet.fetch();
      }
    }

    // Fairness reveal
    UIHandler.updateFairnessModal(GameState.get('fairness'), outcome, true);

    // Flash + sound + result text
    if (freeBonus > 0) {
      setTimeout(() => {
        UIHandler.showResult(`🎁 FREE BONUS +${CB.sym()}${freeBonus}!`, 'win');
        AudioEngine.playWin();
      }, 600);
    } else if (outcome === 'MIDDLE') {
      UIHandler.flash('house');
      AudioEngine.playHouse();
      UIHandler.showResult('⚡ MIDDLE — HOUSE WINS', 'house');
    } else if (won) {
      UIHandler.flash('win');
      AudioEngine.playWin();
      UIHandler.showResult(`${outcome === 'UP' ? '▲' : '▼'} ${outcome} WINS  +${CB.sym()}${bet}`, 'win');
    } else {
      UIHandler.flash('lose');
      AudioEngine.playLose();
      const actual = outcome === 'UP' ? '▲ UP' : '▼ DOWN';
      UIHandler.showResult(`${actual} — YOU LOSE  -${CB.sym()}${bet}`, 'lose');
    }

    UIHandler.updateStats();
    UIHandler.renderHistory(GameState.get('history'));

    // Reveal fake player outcomes with stagger
    setTimeout(() => FakePlayers.reveal(outcome), 400);

    // Re-fetch real balance for full reconciliation
    if (SpeedBetAPI.isAuthed()) {
      setTimeout(async () => {
        try { await Wallet.fetch(); } catch { /**/ }
      }, 900);
    }

    // Return to WAITING
    setTimeout(async () => {
      if (_paused) return;
      UIHandler.clearZoneGlows();
      Renderer.drawFrame(GameState.get('currentAngle'), null);
      if (!_paused) await startWaiting();
    }, 3000);
  }

  /* ── Event Wiring ───────────────────────────────────── */
  function _wireEvents() {
    document.getElementById('btn-up')?.addEventListener('click',   () => selectChoice('UP'));
    document.getElementById('btn-down')?.addEventListener('click', () => selectChoice('DOWN'));

    document.getElementById('spin-btn')?.addEventListener('click', () => {
      const phase = GameState.get('phase');
      if ((phase === 'WAITING' || phase === 'IDLE') && GameState.get('choice')) startSpin();
    });

    document.querySelectorAll('.qb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioEngine.playClick();
        const amt = btn.dataset.amount;
        if      (amt === 'half') UIHandler.setBetValue(Wallet.get() / 2);
        else if (amt === 'max')  UIHandler.setBetValue(Wallet.get());
        else                     UIHandler.setBetValue(parseInt(amt, 10));
      });
    });

    // Fairness modal
    const fairnessBtn  = document.getElementById('btn-fairness');
    const fairnessMod  = document.getElementById('fairness-modal');
    const modalClose   = document.getElementById('modal-close');
    fairnessBtn?.addEventListener('click', () => fairnessMod?.classList.add('visible'));
    modalClose?.addEventListener('click',  () => fairnessMod?.classList.remove('visible'));
    fairnessMod?.addEventListener('click', e => {
      if (e.target === fairnessMod) fairnessMod.classList.remove('visible');
    });

    // Keyboard shortcuts: Space = spin, U = UP, D = DOWN
    document.addEventListener('keydown', e => {
      const phase = GameState.get('phase');
      if (e.code === 'Space' && (phase === 'WAITING' || phase === 'IDLE') && GameState.get('choice')) {
        e.preventDefault(); startSpin();
      }
      if (e.code === 'KeyU' && phase !== 'SPINNING') selectChoice('UP');
      if (e.code === 'KeyD' && phase !== 'SPINNING') selectChoice('DOWN');
    });
  }

  /* ── Boot ───────────────────────────────────────────── */
  async function start() {
    const canvas = document.getElementById('game-canvas');
    Renderer.init(canvas);
    AudioEngine.init();
    UIHandler.init();
    AuthReactor.init();
    _wireEvents();

    Renderer.drawFrame(GameState.get('currentAngle'), null);
    UIHandler.updateStats();

    if (!SpeedBetAPI.isAuthed()) {
      UIHandler.showAuthGate('Sign in to place real bets.');
      // Game still runs visually
      GameState.set('phase', 'WAITING');
      UIHandler.setPhaseText('WAITING — SIGN IN TO BET');
      Renderer.drawFrame(GameState.get('currentAngle'), null);
      return;
    }

    await _startNetworking();
    await startWaiting();
  }

  return { start, pause, resumeFromPause };
})();


/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  GameCore.start();
});