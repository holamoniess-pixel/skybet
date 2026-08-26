import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    games: {
      mockFeed: {
        useQuery: () => ({
          data: { source: "preview", refreshedAt: "2026-08-25T12:00:00.000Z", refreshAfterSeconds: 30, events: [] },
          isLoading: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        }),
      },
    },
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

  it("renders the games route with its non-transactional preview boundary", () => {
    renderAt("/games");
    expect(screen.getByRole("heading", { name: "Virtual match board" })).toBeInTheDocument();
    expect(screen.getByText("Virtual games · preview catalogue")).toBeInTheDocument();
    expect(screen.getByText(/does not accept wagers, deposits, or payouts/i)).toBeInTheDocument();
  });

  it("renders the account controls route", () => {
    renderAt("/account");
    expect(screen.getByRole("heading", { name: "Your SKYBET controls" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email SKYBET customer service" })).toHaveAttribute("href", "mailto:Skybet0553@gmail.com");
  });
});
