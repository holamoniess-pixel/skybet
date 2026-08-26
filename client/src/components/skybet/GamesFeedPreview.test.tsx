import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GamesFeedPreview } from "./GamesFeedPreview";

const feed = vi.hoisted(() => ({
  data: {
    source: "espn-unofficial-preview" as const,
    attribution: "Data sourced from ESPN" as const,
    league: "eng.1" as const,
    refreshedAt: "2026-08-25T12:00:00.000Z",
    refreshAfterSeconds: 120,
    stale: false,
    message: "Best-effort scores and fixtures preview. Not official betting odds and not an ESPN partnership.",
    events: [
      { id: "football-preview", competition: "English Premier League", homeTeam: "Orbit FC", awayTeam: "Valley Athletic", homeScore: null, awayScore: null, startsAt: "20:00", status: "Starts today", isLive: false },
      { id: "football-live", competition: "English Premier League", homeTeam: "Amina Vale FC", awayTeam: "Nora Reed United", homeScore: "1", awayScore: "0", startsAt: "72'", status: "72'", isLive: true },
    ],
  },
  refetch: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    sportsData: {
      status: { useQuery: () => ({ data: { state: "preview-configured", provider: "ESPN unofficial site API", refreshStrategy: "server-cache-on-demand", message: "Best-effort scores and fixtures preview sourced from ESPN. Not official betting odds, not an ESPN partnership, and not used for wagers or settlement." } }) },
      scoreboard: { useQuery: () => ({ data: feed.data, isLoading: false, isError: false, isFetching: false, refetch: feed.refetch }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  feed.refetch.mockClear();
});

describe("GamesFeedPreview", () => {
  it("filters the ESPN preview without exposing market-selection actions", async () => {
    const user = userEvent.setup();
    render(<GamesFeedPreview />);

    expect(screen.getByText("Orbit FC")).toBeInTheDocument();
    expect(screen.getByText(/Amina Vale FC\s*1/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Not official betting odds");
    expect(screen.queryByRole("button", { name: /Add .* preview selection/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Live now" }));
    expect(screen.queryByText("Orbit FC")).not.toBeInTheDocument();
    expect(screen.getByText(/Amina Vale FC\s*1/)).toBeInTheDocument();
  });
});
