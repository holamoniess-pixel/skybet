import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GamesFeedPreview } from "./GamesFeedPreview";

const feed = vi.hoisted(() => ({
  data: {
    source: "preview" as const,
    refreshedAt: "2026-08-25T12:00:00.000Z",
    refreshAfterSeconds: 30,
    events: [
      { id: "football-preview", sport: "Football", competition: "Virtual Premier · Today", teams: ["Orbit FC", "Valley Athletic"], startsAt: "20:00", status: "Starts today", isLive: false, markets: [{ label: "Orbit FC", value: "2.04" }] },
      { id: "court-preview", sport: "Tennis", competition: "Virtual Court · Tonight", teams: ["Amina Vale", "Nora Reed"], startsAt: "21:15", status: "Best of three", isLive: false, markets: [{ label: "Amina Vale", value: "1.71" }] },
    ],
  },
  refetch: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    games: {
      mockFeed: {
        useQuery: () => ({ data: feed.data, isLoading: false, isError: false, isFetching: false, refetch: feed.refetch }),
      },
    },
    sportsData: {
      status: { useQuery: () => ({ data: { state: "unconfigured", provider: null, refreshStrategy: "provider-sse-or-server-polling", message: "Live sports data will appear after an approved provider is configured securely." } }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  feed.refetch.mockClear();
});

describe("GamesFeedPreview", () => {
  it("filters the virtual catalogue by its sport categories", async () => {
    const user = userEvent.setup();
    const onMarketSelect = vi.fn();
    render(<GamesFeedPreview onMarketSelect={onMarketSelect} />);

    expect(screen.getByText("Orbit FC")).toBeInTheDocument();
    expect(screen.getByText("Amina Vale")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Live sports data will appear after an approved provider is configured securely.");
    await user.click(screen.getByRole("button", { name: "Football" }));
    expect(screen.getByText("Orbit FC")).toBeInTheDocument();
    expect(screen.queryByText("Amina Vale")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Orbit FC preview selection" }));
    expect(onMarketSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "football-preview" }), "Orbit FC", "2.04");
  });
});
