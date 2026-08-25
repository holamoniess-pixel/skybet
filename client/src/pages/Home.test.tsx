import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "./Home";

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
});

describe("Skybet Home", () => {
  it("renders the live match centre as the initial catalogue state", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "Live centre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harbour City2.18" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cedar Waves1.68" })).toBeInTheDocument();
  });

  it("switches to the upcoming event view", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "upcoming" }));

    expect(screen.getByRole("heading", { name: "Upcoming events" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riverside Athletic1.92" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Harbour City2.18" })).not.toBeInTheDocument();
  });

  it("opens the selection sheet after a market is chosen", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Harbour City2.18" }));

    expect(screen.getByText("Review your selection")).toBeInTheDocument();
    expect(screen.getAllByText("Harbour City vs Northvale FC · Harbour City")).not.toHaveLength(0);
  });

  it("opens the account centre from the mobile navigation component", async () => {
    const user = userEvent.setup();
    renderHome();

    const accountButtons = screen.getAllByRole("button", { name: "Account" });
    await user.click(accountButtons.at(-1)!);

    expect(screen.getByText("Account centre")).toBeInTheDocument();
    expect(screen.getByText("Safer play")).toBeInTheDocument();
  });
});
