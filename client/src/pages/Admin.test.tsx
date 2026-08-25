import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Admin from "./Admin";

const mockAuth = {
  user: {
    id: 1,
    openId: "admin-user",
    name: "Skybet Admin",
    email: "admin@skybet.example",
    loginMethod: "manus",
    role: "admin" as "admin" | "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  loading: false,
  error: null,
  isAuthenticated: true,
  logout: vi.fn(),
};

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      referrals: {
        activeRule: { invalidate: vi.fn() },
      },
    }),
    referrals: {
      activeRule: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      activeOverride: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      searchUsers: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
      saveDefaultRule: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      saveUserOverride: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

afterEach(() => {
  cleanup();
  mockAuth.user.role = "admin";
});

describe("Skybet Admin", () => {
  it("shows the operational workspace to administrators", () => {
    render(<Admin />);

    expect(screen.getByRole("heading", { name: "Operations with guardrails." })).toBeInTheDocument();
    expect(screen.getByLabelText("Programme default reward")).toHaveValue("10");
  });

  it("blocks customer roles from sensitive admin controls", () => {
    mockAuth.user.role = "user";
    render(<Admin />);

    expect(screen.getByRole("heading", { name: "Administrator access required" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Programme default reward")).not.toBeInTheDocument();
  });
});
