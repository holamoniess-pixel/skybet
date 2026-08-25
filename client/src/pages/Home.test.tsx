import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "./Home";

const { mockFeedRefetch } = vi.hoisted(() => ({ mockFeedRefetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    games: {
      mockFeed: {
        useQuery: () => ({
          data: {
            source: "simulated",
            refreshedAt: "2026-08-25T12:00:00.000Z",
            refreshAfterSeconds: 30,
            events: [],
          },
          isLoading: false,
          isError: false,
          isFetching: false,
          refetch: mockFeedRefetch,
        }),
      },
    },
  },
}));

function renderHome() {
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <Home />
    </ThemeProvider>
  );
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
  });
});

afterEach(() => {
  cleanup();
  mockFeedRefetch.mockClear();
  window.history.pushState({}, "", "/");
});

describe("Skybet Home", () => {
  it("renders the live match centre as the initial catalogue state", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "Live centre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harbour City2.18" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cedar Waves1.68" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Virtual match previews" })).toBeInTheDocument();
  });

  it("switches to the upcoming event view", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "upcoming" }));

    expect(screen.getByRole("heading", { name: "Upcoming events" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riverside Athletic1.92" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Harbour City2.18" })).not.toBeInTheDocument();
  });

  it("keeps market selection available from the compact event card", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Harbour City2.18" }));

    expect(screen.getByText("Review your selection")).toBeInTheDocument();
    expect(screen.getAllByText("Harbour City vs Northvale FC · Harbour City")).not.toHaveLength(0);
  });

  it("routes the account-first header action and primary hero action to their dedicated views", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Open account controls" }));
    expect(window.location.pathname).toBe("/account");

    window.history.pushState({}, "", "/");
    await user.click(screen.getByRole("button", { name: "Open live board" }));
    expect(window.location.pathname).toBe("/live");
  });

  it("changes the home match view from a mobile sport-discovery shortcut", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getAllByRole("button", { name: "Basketball" }).at(0)!);

    expect(screen.getByRole("heading", { name: "Upcoming events" })).toBeInTheDocument();
  });

  it("routes the visible preview balance control to the account view", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Preview balance" }));

    expect(window.location.pathname).toBe("/account");
  });

  it("allows the simulated feed to be refreshed from the preview control", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Refresh simulated games feed" }));

    expect(mockFeedRefetch).toHaveBeenCalledTimes(1);
  });

  it("routes the mobile account action to the dedicated account page", async () => {
    const user = userEvent.setup();
    renderHome();

    const accountButtons = screen.getAllByRole("button", { name: "Account" });
    await user.click(accountButtons.at(-1)!);

    expect(window.location.pathname).toBe("/account");
  });
});
