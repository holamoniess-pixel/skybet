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
            source: "preview",
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
    auth: {
      me: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      logout: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
    },
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
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
    expect(screen.getByRole("heading", { name: "Featured virtual matches" })).toBeInTheDocument();
    expect(document.querySelectorAll(".sky-hero-slide")).toHaveLength(10);
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

  it("reveals additional preview markets and keeps the preview slip available after selection", async () => {
    const user = userEvent.setup();
    renderHome();

    expect(screen.getAllByRole("button", { name: "Show 3 more preview markets" })).not.toHaveLength(0);
    await user.click(screen.getAllByRole("button", { name: "Show 3 more preview markets" }).at(0)!);
    await user.click(screen.getByRole("button", { name: "Over 2.5 goals1.96" }));

    expect(document.querySelector('[aria-label="Open preview slip with one selection"]')).toBeTruthy();
    expect(screen.getAllByText("Harbour City vs Northvale FC · Over 2.5 goals")).not.toHaveLength(0);
  });

  it("routes the primary hero action to its dedicated live view", async () => {
    const user = userEvent.setup();
    renderHome();

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

  it("shows the compact balance-and-bonus treatment and the customer-service email", () => {
    renderHome();

    expect(screen.getByLabelText("SKYBET")).toBeInTheDocument();
    expect(screen.getByText("GH₵ 0.00")).toBeInTheDocument();
    expect(screen.getByText("Bonus: GH₵ 0.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email SKYBET customer service" })).toHaveAttribute("href", "mailto:Skybet0553@gmail.com");
  });

  it("allows the games feed to be refreshed from the preview control", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Refresh games feed" }));

    expect(mockFeedRefetch).toHaveBeenCalledTimes(1);
  });

  it("routes the mobile account action to the dedicated account page", async () => {
    const user = userEvent.setup();
    renderHome();

    const accountButtons = screen.getAllByRole("button", { name: "Account" });
    await user.click(accountButtons.at(-1)!);

    expect(window.location.pathname).toBe("/account");
  });

  it("keeps a compact round Preview Slip action and exposes authored-code entry inside the sheet", async () => {
    const user = userEvent.setup();
    renderHome();

    expect(screen.getByRole("button", { name: "Open preview slip" })).toHaveClass("sky-preview-slip-fab");
    await user.click(screen.getByRole("button", { name: "Open preview slip" }));
    expect(screen.getByRole("textbox", { name: "Enter an authored preview code" })).toBeInTheDocument();
  });

  it("provides keyboard-accessible manual controls for the ten-frame hero rotation", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Next hero image" }));

    expect(document.querySelectorAll(".sky-hero-slide-active")[0]).toBe(document.querySelectorAll(".sky-hero-slide")[1]);
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("routes discovery and support controls to their dedicated customer destinations", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: /Rewards.*Referral progress/ }));
    expect(window.location.pathname).toBe("/activity");
    expect(window.location.hash).toBe("#rewards");

    window.history.pushState({}, "", "/");
    await user.click(screen.getByRole("button", { name: "Visit the SKYBET help centre" }));
    expect(window.location.pathname).toBe("/account");
    expect(window.location.hash).toBe("#support");
  });

  it("restores a known local preview code into the non-transactional slip and guides an unknown code", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: "Open preview slip" }));
    const eventCode = screen.getByRole("textbox", { name: "Enter an authored preview code" });

    await user.type(eventCode, "SKY-LIVE-01");
    await user.click(screen.getByRole("button", { name: "Load code" }));
    expect(window.location.pathname).toBe("/");
    expect(screen.getByText("Review your selection")).toBeInTheDocument();
    expect(screen.getByText(/Loaded Harbour City into your local Preview slip/)).toBeInTheDocument();

    await user.clear(eventCode);
    await user.type(eventCode, "not-a-preview-event");
    await user.click(screen.getByRole("button", { name: "Load code" }));
    expect(screen.getByText(/No preview event was found for/)).toBeInTheDocument();
  });
});
