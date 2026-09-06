import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store/index';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import LiveMatchesPage from './pages/LiveMatchesPage';
import BetSlipPage from './pages/BetSlipPage';
import WalletPage from './pages/WalletPage';
import DepositPage from './pages/DepositPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import AccountPage from './pages/AccountPage';
import CasinoPage from './pages/CasinoPage';
import PromosPage from './pages/PromosPage';
import AffiliatePage from './pages/AffiliatePage';
import AdminModal from './pages/AdminModal';
import GuestLandingPage from './pages/GuestLandingPage';
import FillInRegisterPage from './pages/FillInRegisterPage';
import { hasVisited } from './utils/session';

// GameRunner lives at src/games/GameRunner.tsx
import GameRunner from './games/GameRunner';

// ---------------------------------------------------------------------------
// Stub pages for footer links – replace with real pages when ready
// ---------------------------------------------------------------------------
const StubPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{title}</h1>
  </div>
);


/* ---------------------------------------------------------------------------
   FirstVisitGate
   ---------------------------------------------------------------------------
   Someone landing on SkyBet for the very first time via a direct link gets
   sent to /welcome instead of straight into the lobby, so they choose a
   country (and therefore a currency) before they see a single price.

   It only ever fires ONCE per browser:
     - a returning visitor (markVisited has run) passes straight through
     - a signed-in user passes straight through
     - an active guest passes straight through
     - the auth/legal routes are exempt, otherwise a shared /register link
       would bounce to /welcome and lose the referral code

   This answers the open question from earlier: a returning visitor never sees
   the guest screen again. It's a first-run experience, not a wall.
   ------------------------------------------------------------------------- */
const EXEMPT = [
  '/welcome', '/register', '/join', '/login', '/forgot-password',
  '/terms', '/privacy', '/cookies', '/responsible',
];

function FirstVisitGate({ children }: { children: React.ReactNode }) {
  const { user, isGuest, authReady } = useAppStore();
  const location = useLocation();

  // Don't decide anything until the session has been read back from storage,
  // or we'd redirect a logged-in user on every hard refresh.
  if (!authReady) return null;

  const exempt = EXEMPT.some((p) => location.pathname.startsWith(p));
  const needsWelcome = !user && !isGuest && !hasVisited() && !exempt;

  if (needsWelcome) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function App() {
  const theme = useAppStore((s) => s.theme);
  const hydrateSession = useAppStore((s) => s.hydrateSession);

  /* Rebuild the session from the persisted token on every page load. THIS is
     the fix for "log in, refresh, and you're logged out" — the token was
     always in storage, nothing ever read it back into the store. Runs once,
     before first paint of the routes. */
  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Keep data-theme in sync with the store at all times.
  // main.tsx sets it once before mount; this effect keeps it correct
  // if the store value ever diverges from the DOM attribute.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Guest landing + fill-in registration sit OUTSIDE <Layout> — they
              are full-bleed screens with no header, nav or footer. */}
          <Route path="/welcome" element={<GuestLandingPage />} />
          <Route path="/join"    element={<FillInRegisterPage />} />

          <Route element={<FirstVisitGate><Layout /></FirstVisitGate>}>
            {/* ── Core pages ── */}
            <Route path="/"          element={<HomePage />} />
            <Route path="/match/:id" element={<MatchDetailsPage />} />
            <Route path="/live"      element={<LiveMatchesPage />} />
            <Route path="/betslip"   element={<BetSlipPage />} />
            <Route path="/wallet"    element={<WalletPage />} />
            <Route path="/deposit"   element={<DepositPage />} />
            <Route path="/register"  element={<RegisterPage />} />
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/account"   element={<AccountPage />} />
            <Route path="/casino"    element={<CasinoPage />} />
            <Route path="/promos"    element={<PromosPage />} />
            <Route path="/affiliate" element={<AffiliatePage />} />

            {/* ── Footer quick links ── */}
            <Route path="/sports"      element={<StubPage title="Sports" />} />
            <Route path="/live-tv"     element={<StubPage title="Live TV" />} />
            <Route path="/jackpot"     element={<StubPage title="Jackpot" />} />

            {/* ── Footer company links ── */}
            <Route path="/about"       element={<StubPage title="About Us" />} />
            <Route path="/terms"       element={<StubPage title="Terms & Conditions" />} />
            <Route path="/privacy"     element={<StubPage title="Privacy Policy" />} />
            <Route path="/cookies"     element={<StubPage title="Cookie Policy" />} />
            <Route path="/responsible" element={<StubPage title="Responsible Gaming" />} />
            <Route path="/faq"         element={<StubPage title="FAQ" />} />

            {/* ── All games resolved via slug → GameRunner ── */}
            <Route path="/games/:slug" element={<GameRunner />} />
          </Route>
        </Routes>
        <AdminModal />
      </BrowserRouter>
    </>
  );
}

export default App;