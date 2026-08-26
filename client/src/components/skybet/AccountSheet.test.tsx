import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AccountSheet } from "./AccountSheet";

function renderAccountSheet() {
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <AccountSheet open onOpenChange={vi.fn()} />
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

describe("AccountSheet", () => {
  it("opens the first-party authentication dialog from the sign-in control", async () => {
    const user = userEvent.setup();
    renderAccountSheet();

    await user.click(screen.getByRole("button", { name: "Sign in to SKYBET" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("routes drawer destinations to the available account and activity sections", async () => {
    const user = userEvent.setup();
    renderAccountSheet();

    await user.click(screen.getByRole("button", { name: /Referral rewards/ }));
    expect(window.location.pathname).toBe("/activity");
    expect(window.location.hash).toBe("#rewards");
  });
});
