/* ============================================================================
   SkyBet — GAMES BRIDGE
   ----------------------------------------------------------------------------
   Injected by GameRunner into the <head> of EVERY arcade game before that
   game's own script runs. It is the only channel between the React app and
   the sandboxed game iframes.

   It solves three problems the games had:

   1. TOKEN MISMATCH
      Games read localStorage['sb_token']; the React app wrote 'accessToken'.
      A signed-in player was anonymous the moment a game loaded, so every
      authed call 401'd and the game fell back to its login gate. Everything
      now shares one key: 'skybet_token'.

   2. HARDCODED '$'
      Every game printed dollars regardless of market. The bridge exposes
      SkyBet.sym() and SkyBet.fmt(), and the game sources have been
      rewritten to call them.

   3. NO STAKE FLOOR
      Nothing stopped a 0.01 stake. SkyBet.minStake() carries the
      per-country floor in, and SkyBet.checkStake() gives games a single
      validator with a ready-to-display message.

   The iframe is sandboxed with a null origin, so it CANNOT read the parent's
   localStorage. GameRunner therefore serialises the live values into this
   file's CB_BOOT payload at injection time, and refreshes them over
   postMessage whenever the user's country or session changes.
   ========================================================================== */

(function () {
  'use strict';

  /* CB_BOOT is replaced by GameRunner with a real JSON payload before this
     script is injected. The literal below is only the shape/fallback used if
     a game is opened directly (e.g. /games/aviator/index.html in a new tab). */
  var BOOT = window.__SKYBET_BOOT__ || {
    token: null,
    user: null,
    country: 'GH',
    currency: 'GHS',
    symbol: 'GH₵',
    locale: 'en-GH',
    minStake: 1,
    maxStake: 10000,
    stakeSteps: [1, 5, 10, 20, 50, 100],
    guest: false,
    guestBalance: 0,
  };

  var state = {
    token: BOOT.token || null,
    user: BOOT.user || null,
    country: BOOT.country || 'GH',
    currency: BOOT.currency || 'GHS',
    symbol: BOOT.symbol || 'GH₵',
    locale: BOOT.locale || 'en-GH',
    minStake: typeof BOOT.minStake === 'number' ? BOOT.minStake : 1,
    maxStake: typeof BOOT.maxStake === 'number' ? BOOT.maxStake : 10000,
    stakeSteps: BOOT.stakeSteps || [1, 5, 10, 20, 50, 100],
    guest: !!BOOT.guest,
    guestBalance: BOOT.guestBalance || 0,
  };

  var listeners = [];

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { /* a bad listener must not break the game */ }
    }
    // Let games that prefer events over callbacks hook in too.
    try {
      window.dispatchEvent(new CustomEvent('skybet:update', { detail: state }));
    } catch (e) { /* ignore */ }
  }

  /* ── Storage fallback ──────────────────────────────────────────────────
     When a game is opened standalone (not through GameRunner) the iframe
     sandbox doesn't apply and localStorage IS readable — so try it. Inside
     the sandbox this throws or returns null, which is fine: BOOT already
     carries the values. */
  function lsGet(key) {
    try {
      var v = window.localStorage.getItem(key);
      return v && v !== 'undefined' && v !== 'null' ? v : null;
    } catch (e) {
      return null;
    }
  }

  if (!state.token) state.token = lsGet('skybet_token');
  if (!state.user) {
    try { state.user = JSON.parse(lsGet('skybet_user') || 'null'); } catch (e) { /* ignore */ }
  }

  /* ── Formatting ─────────────────────────────────────────────────────── */

  function sym() {
    return state.symbol;
  }

  function fmt(amount, decimals) {
    var d = typeof decimals === 'number' ? decimals : 2;
    var n = typeof amount === 'number' && isFinite(amount) ? amount : parseFloat(amount) || 0;
    var body;
    try {
      body = n.toLocaleString(state.locale, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
    } catch (e) {
      body = n.toFixed(d);
    }
    return state.symbol + body;
  }

  /** Compact form for busy tickers: GH₵1.2K */
  function fmtCompact(amount) {
    var n = Math.abs(amount);
    if (n >= 1000000) return state.symbol + (amount / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return state.symbol + (amount / 1000).toFixed(1) + 'K';
    return fmt(amount);
  }

  /* ── Stake rules ────────────────────────────────────────────────────── */

  function minStake() { return state.minStake; }
  function maxStake() { return state.maxStake; }
  function stakeSteps() { return state.stakeSteps.slice(); }

  /**
   * Validate a stake. Returns { ok, reason } — `reason` is already phrased
   * for display, in the player's own currency.
   */
  function checkStake(amount) {
    var n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) {
      return { ok: false, reason: 'Enter a stake amount.' };
    }
    if (n < state.minStake) {
      return { ok: false, reason: 'Minimum stake is ' + fmt(state.minStake) + '.' };
    }
    if (n > state.maxStake) {
      return { ok: false, reason: 'Maximum stake is ' + fmt(state.maxStake) + '.' };
    }
    return { ok: true, reason: null };
  }

  function clampStake(amount) {
    var n = parseFloat(amount);
    if (!isFinite(n)) return state.minStake;
    return Math.min(state.maxStake, Math.max(state.minStake, n));
  }

  /* ── Session ────────────────────────────────────────────────────────── */

  function getToken() { return state.token; }
  function isAuthed() { return !!state.token || state.guest; }
  function isGuest() { return state.guest; }
  function getUser() { return state.user; }

  /** Ask the parent app to open the login screen. */
  function requestLogin() {
    post({ type: 'skybet:request-login' });
  }

  /** Ask the parent app to open the deposit screen. */
  function requestDeposit() {
    post({ type: 'skybet:request-deposit' });
  }

  /** Tell the parent a guest won/lost play money so the shell can track it. */
  function reportGuestDelta(delta) {
    if (!state.guest) return;
    state.guestBalance = Math.max(0, state.guestBalance + delta);
    post({ type: 'skybet:guest-delta', delta: delta });
    emit();
  }

  function guestBalance() { return state.guestBalance; }

  function post(msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) { /* sandboxed without allow-same-origin — nothing to do */ }
  }

  /* ── Live updates from the shell ────────────────────────────────────── */

  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.type !== 'skybet:sync' || !d.payload) return;
    var p = d.payload;
    if (p.token !== undefined) state.token = p.token;
    if (p.user !== undefined) state.user = p.user;
    if (p.country) state.country = p.country;
    if (p.currency) state.currency = p.currency;
    if (p.symbol) state.symbol = p.symbol;
    if (p.locale) state.locale = p.locale;
    if (typeof p.minStake === 'number') state.minStake = p.minStake;
    if (typeof p.maxStake === 'number') state.maxStake = p.maxStake;
    if (p.stakeSteps) state.stakeSteps = p.stakeSteps;
    if (typeof p.guest === 'boolean') state.guest = p.guest;
    if (typeof p.guestBalance === 'number') state.guestBalance = p.guestBalance;
    emit();
  });

  /** Subscribe to country/session changes. Returns an unsubscribe function. */
  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    try { fn(state); } catch (e) { /* ignore */ }
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ── Public surface ─────────────────────────────────────────────────── */

  var SkyBet = {
    // identity / money
    sym: sym,
    fmt: fmt,
    fmtCompact: fmtCompact,
    country: function () { return state.country; },
    currency: function () { return state.currency; },
    locale: function () { return state.locale; },

    // stakes
    minStake: minStake,
    maxStake: maxStake,
    stakeSteps: stakeSteps,
    checkStake: checkStake,
    clampStake: clampStake,

    // session
    getToken: getToken,
    isAuthed: isAuthed,
    isGuest: isGuest,
    getUser: getUser,
    requestLogin: requestLogin,
    requestDeposit: requestDeposit,
    reportGuestDelta: reportGuestDelta,
    guestBalance: guestBalance,

    // reactivity
    onChange: onChange,

    // raw snapshot, for debugging in the console
    _state: state,
  };

  window.SkyBet = SkyBet;
  // Short alias — the rewritten game sources call CB.fmt()/CB.sym().
  window.CB = SkyBet;

  /* ── Sweep the static markup ────────────────────────────────────────────
     Game HTML files ship with placeholder balances like "$1,000.00" baked
     into the markup. Rewriting every one by hand across ten games is
     brittle, so on DOM ready we swap a leading '$' for the local symbol in
     any element carrying a money-ish class or a data-cb-money attribute.
     Runtime updates go through CB.fmt() and don't rely on this at all. */
  function sweepStaticMoney() {
    if (state.symbol === '$') return;
    var sel = '[data-cb-money], .balance-val, .balance-value, .bal-val, ' +
              '.win-amount, .bet-amount, .stake-val, .payout-val';
    var nodes;
    try { nodes = document.querySelectorAll(sel); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;          // only touch leaf nodes
      var t = el.textContent || '';
      if (t.charAt(0) === '$') el.textContent = state.symbol + t.slice(1);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sweepStaticMoney);
  } else {
    sweepStaticMoney();
  }
  window.addEventListener('skybet:update', sweepStaticMoney);
})();
