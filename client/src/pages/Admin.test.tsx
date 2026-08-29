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
      games: {
        simulatedFeed: { useQuery: () => ({ data: { events: [] }, isLoading: false }) },
      },
      wagers: {
        place: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      },
      useUtils: () => ({
      commissions: {
        activeRule: { invalidate: vi.fn() },
        activeOverride: { invalidate: vi.fn() },
      },
      paymentReview: {
        queue: { invalidate: vi.fn() },
      },
      referrals: {
        activeRule: { invalidate: vi.fn() },
      },
      bonusPolicies: {
        activeRule: { invalidate: vi.fn() },
        activeOverride: { invalidate: vi.fn() },
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
    bonusPolicies: {
      activeRule: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      activeOverride: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      saveDefaultRule: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      saveUserOverride: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    commissions: {
      activeRule: { useQuery: () => ({ data: undefined, isLoading: false }) },
      activeOverride: { useQuery: () => ({ data: undefined, isLoading: false }) },
      saveDefaultRule: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveUserOverride: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    paymentReview: {
      queue: { useQuery: () => ({ data: [], isLoading: false }) },
      proofUrl: { useQuery: () => ({ data: undefined, isLoading: false }) },
      review: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setAccountHold: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    sportsData: {
      scoreboard: { useQuery: () => ({ data: { events: [], fetchedAt: "2026-08-27T00:00:00.000Z", stale: false }, isLoading: false }) },
      status: { useQuery: () => ({ data: { state: "preview-unofficial", provider: "ESPN" }, isLoading: false }) },
    },
    adminManagement: {
      customerSummary: { useQuery: () => ({ data: undefined, isLoading: false }) },
      permissions: { useQuery: () => ({ data: { isOwner: true }, isLoading: false }) },
      listAdministrators: { useQuery: () => ({ data: [], isLoading: false }) },
      createAdministrator: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setAdministratorAccess: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  mockAuth.user.role = "admin";
  window.history.pushState({}, "", "/admin");
});

describe("Skybet Admin", () => {
  it("shows the operational workspace to administrators", () => {
    render(<Admin />);

    expect(screen.getByRole("heading", { name: "Operations with guardrails." })).toBeInTheDocument();
    expect(screen.getByText("Customer accounts")).toBeInTheDocument();
    expect(screen.getByText("Bonuses & rewards")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /deposits/i })).toHaveAttribute("href", "/admin/deposits");
  });

  it("blocks customer roles from sensitive admin controls", () => {
    mockAuth.user.role = "user";
    render(<Admin />);

    expect(screen.getByRole("heading", { name: "Administrator access required" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Global commission percentage")).not.toBeInTheDocument();
  });

  it("renders focused customer, bonus, match-preview, and owner-management pages", () => {
    window.history.pushState({}, "", "/admin/customers");
    const { rerender } = render(<Admin />);
    expect(screen.getByRole("heading", { name: "Find a customer before you act." })).toBeInTheDocument();

    window.history.pushState({}, "", "/admin/bonuses");
    rerender(<Admin />);
    expect(screen.getByRole("heading", { name: "Set policy, not customer funds." })).toBeInTheDocument();
    expect(screen.getByText("Bonus ledger policy")).toBeInTheDocument();

    window.history.pushState({}, "", "/admin/matches");
    rerender(<Admin />);
    expect(screen.getByRole("heading", { name: "Generated fixtures with transparent forecasts." })).toBeInTheDocument();
    expect(screen.getByText("Simulation scores, fixtures & forecasts")).toBeInTheDocument();

    window.history.pushState({}, "", "/admin/administrators");
    rerender(<Admin />);
    expect(screen.getByRole("heading", { name: "Manage administrator access." })).toBeInTheDocument();
    expect(screen.getByText("Add administrator")).toBeInTheDocument();
  });
});
