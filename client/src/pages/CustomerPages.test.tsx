import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActivityPage, EventDetailPage } from "./CustomerPages";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    games: { simulatedFeed: { useQuery: () => ({ data: { events: [] }, isLoading: false }) } },
    wagers: { place: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) } },
    account: { referralProfile: { useQuery: () => ({ data: { referralCode: "SKYTEST", referralsCount: 0, rewardsCredited: "0.00", currency: "GHS" } }) } },
    auth: {
      me: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      logout: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
    },
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
  },
}));

function renderEventDetail() {
  window.history.pushState({}, "", "/event/live-skyline");
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <EventDetailPage />
    </ThemeProvider>
  );
}

function renderActivity() {
  window.history.pushState({}, "", "/activity");
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <ActivityPage />
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
  window.history.pushState({}, "", "/");
});

describe("Skybet event detail", () => {
  it("opens the non-transactional selection sheet from an event market", async () => {
    const user = userEvent.setup();
    renderEventDetail();

    await user.click(screen.getByRole("button", { name: "Harbour City2.18" }));

    expect(screen.getByText("Review your selection")).toBeInTheDocument();
    expect(screen.getAllByText("Harbour City vs Northvale FC · Harbour City")).not.toHaveLength(0);
  });
});

describe("SKYBET referral preview", () => {
  it("shows confirmation after copying the referral link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderActivity();

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Referral link copied.")).toBeInTheDocument();
  });

  it("shows recovery guidance when copying the referral link is blocked", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    renderActivity();

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(screen.getByText("We could not copy the link. You can select it manually instead.")).toBeInTheDocument();
  });
});
