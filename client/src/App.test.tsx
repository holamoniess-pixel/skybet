import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    sportsData: {
      status: { useQuery: () => ({ data: { state: "preview-configured", provider: "ESPN unofficial site API", refreshStrategy: "server-cache-on-demand", message: "Best-effort scores and fixtures preview sourced from ESPN. Not official betting odds, not an ESPN partnership, and not used for wagers or settlement." } }) },
      scoreboard: { useQuery: () => ({ data: { source: "espn-unofficial-preview", attribution: "Data sourced from ESPN", league: "eng.1", fetchedAt: "2026-08-25T12:00:00.000Z", refreshAfterSeconds: 120, stale: false, message: "Best-effort scores and fixtures preview. Not official betting odds and not an ESPN partnership.", events: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }) },
    },
    auth: {
      me: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      logout: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
    },
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
  },
}));

afterEach(() => cleanup());

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }),
  });
});

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("Skybet customer routes", () => {
  it("renders the sports discovery route", () => {
    renderAt("/sports");
    expect(screen.getByRole("heading", { name: "Upcoming events" })).toBeInTheDocument();
  });

  it("renders the games route with its ESPN score-preview boundary", () => {
    renderAt("/games");
    expect(screen.getByRole("heading", { name: "ESPN match preview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scores and fixtures" })).toBeInTheDocument();
    expect(screen.getByText("Data sourced from ESPN · independent preview")).toBeInTheDocument();
    expect(screen.getAllByText(/not official betting odds/i).length).toBeGreaterThan(0);
  });

  it("renders the account controls route", () => {
    renderAt("/account");
    expect(screen.getByRole("heading", { name: "Your SKYBET controls" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email SKYBET customer service" })).toHaveAttribute("href", "mailto:Skybet0553@gmail.com");
  });
});
