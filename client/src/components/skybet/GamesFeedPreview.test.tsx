import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GamesFeedPreview } from "./GamesFeedPreview";

const feed = vi.hoisted(() => ({
  data: {
    source: "skybet-generated" as const,
    refreshedAt: "2026-08-29T12:00:00.000Z",
    refreshAfterSeconds: 30,
    message: "match market data. These are current fixtures and odds.",
    events: [
      { id: "football-generated", competition: "SKYBET Premier Division", teams: ["Orbit FC", "Valley Athletic"], score: null, startsAt: "2026-08-29T20:00:00.000Z", status: "Upcoming", isLive: false, markets: [{ label: "Home win", value: "2.10" }] },
      { id: "football-live", competition: "SKYBET Premier Division", teams: ["Amina Vale FC", "Nora Reed United"], score: "1 – 0", startsAt: "72'", status: "Live", isLive: true, markets: [{ label: "Home win", value: "1.55" }] },
    ],
  },
  refetch: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    games: { simulatedFeed: { useQuery: () => ({ data: feed.data, isLoading: false, isError: false, isFetching: false, refetch: feed.refetch }) } },
  },
}));

afterEach(() => {
  cleanup();
  feed.refetch.mockClear();
});

describe("GamesFeedPreview", () => {
  it("filters match markets without exposing market-selection actions", async () => {
    const user = userEvent.setup();
    render(<GamesFeedPreview />);

    expect(screen.getByText("Orbit FC")).toBeInTheDocument();
    expect(screen.getByText(/Amina Vale FC\s*1/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("internally managed fixtures");
    expect(screen.queryByRole("button", { name: /Add .* selection/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Live now" }));
    expect(screen.queryByText("Orbit FC")).not.toBeInTheDocument();
    expect(screen.getByText(/Amina Vale FC\s*1/)).toBeInTheDocument();
  });
});
