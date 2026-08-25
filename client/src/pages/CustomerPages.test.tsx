import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActivityPage, EventDetailPage } from "./CustomerPages";

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
  it("shows confirmation after copying the preview referral link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderActivity();

    await user.click(screen.getByRole("button", { name: "Copy preview referral link" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Preview referral link copied.")).toBeInTheDocument();
  });

  it("shows recovery guidance when copying the preview referral link is blocked", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    renderActivity();

    await user.click(screen.getByRole("button", { name: "Copy preview referral link" }));

    expect(screen.getByText("We could not copy the link. You can select it manually instead.")).toBeInTheDocument();
  });
});
