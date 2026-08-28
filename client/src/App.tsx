import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import { AccountPage, ActivityPage, EventDetailPage, GamesPage, LivePage, SearchPage, SportsPage } from "./pages/CustomerPages";
import { AccountWorkspacePage } from "./pages/AccountWorkspacePage";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/signup"} component={SignUp} />
      <Route path={"/"}><ProtectedRoute><Home /></ProtectedRoute></Route>
      <Route path={"/live"}><ProtectedRoute><LivePage /></ProtectedRoute></Route>
      <Route path={"/sports"}><ProtectedRoute><SportsPage /></ProtectedRoute></Route>
      <Route path={"/games"}><ProtectedRoute><GamesPage /></ProtectedRoute></Route>
      <Route path={"/event/:id"}><ProtectedRoute><EventDetailPage /></ProtectedRoute></Route>
      <Route path={"/search"}><ProtectedRoute><SearchPage /></ProtectedRoute></Route>
      <Route path={"/activity"}><ProtectedRoute><ActivityPage /></ProtectedRoute></Route>
      <Route path={"/account"}><ProtectedRoute><AccountPage /></ProtectedRoute></Route>
      <Route path={"/profile"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/settings"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/bets"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/bets/running"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/bets/history"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/wallet"}><ProtectedRoute><AccountWorkspacePage /></ProtectedRoute></Route>
      <Route path={"/admin"} component={Admin} />
      <Route path={"/admin/:section"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
