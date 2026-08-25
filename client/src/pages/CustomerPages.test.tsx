import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { EventDetailPage } from "./CustomerPages";

function renderEventDetail() {
  window.history.pushState({}, "", "/event/live-skyline");
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <EventDetailPage />
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
