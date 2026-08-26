import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerAccountMenu } from "./CustomerAccountMenu";

const { authState, startLogin } = vi.hoisted(() => ({
  authState: { user: null as { name: string; email: string } | null, loading: false, logout: vi.fn() },
  startLogin: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/const", () => ({ startLogin }));

afterEach(() => {
  cleanup();
  authState.user = null;
  startLogin.mockClear();
  authState.logout.mockClear();
  window.history.pushState({}, "", "/");
});

describe("CustomerAccountMenu", () => {
  it("shows authentication choices and safe account destinations for a guest", async () => {
    const user = userEvent.setup();
    render(<CustomerAccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Deposit" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Sign in" }));
    expect(startLogin).toHaveBeenCalledTimes(1);
  });

  it("shows logout for a signed-in customer and routes payment entries to the gated wallet", async () => {
    const user = userEvent.setup();
    authState.user = { name: "Alex", email: "alex@example.com" };
    render(<CustomerAccountMenu />);

    await user.click(screen.getByRole("button", { name: "Alex" }));
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Deposit" }));
    expect(window.location.pathname).toBe("/wallet");
    expect(window.location.hash).toBe("#deposit");
  });
});
