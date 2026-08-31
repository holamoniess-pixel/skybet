import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletPaymentRequestCard } from "./WalletPaymentRequestCard";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 1, role: "user" } }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ payments: { myRequests: { invalidate: vi.fn() } } }),
    payments: {
      methods: { useQuery: () => ({ data: [
        { method: "crypto_trc20", displayName: "Crypto deposit", network: "TRC20", destination: "TQCHL828z5VyKGRkw3jUThrURnG9tpsS6G", status: "enabled" },
        { method: "aquapay", displayName: "Aqùapay local GHS", network: null, destination: null, status: "disabled" },
      ] }) },
      gatewayStatus: { useQuery: () => ({ data: { provider: "Aqùapay", status: "unconfigured", configuredSecrets: { apiUrl: false, apiKey: false, webhookSecret: false } } }) },
      myRequests: { useQuery: () => ({ data: [] }) },
      submitDeposit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      startAquaPayDeposit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      submitWithdrawal: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

afterEach(cleanup);

describe("WalletPaymentRequestCard", () => {
  it("shows the TRC20 method, approved fixed deposit amounts, and payment methods", () => {
    render(<WalletPaymentRequestCard />);
    expect(screen.getByText("Crypto wallet address")).toBeInTheDocument();
    expect(screen.getByText("TQCHL828z5VyKGRkw3jUThrURnG9tpsS6G")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy TRC20 wallet address" })).toBeInTheDocument();
    expect(screen.getByText("Automatic Mobile Money")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GH₵ 2,000" })).toBeInTheDocument();
    expect(screen.getByLabelText("Payment screenshot")).toBeInTheDocument();
  });

  it("switches to a Mobile Money-number-only withdrawal request form", () => {
    render(<WalletPaymentRequestCard />);
    fireEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    expect(screen.getByLabelText("Withdrawal amount (GHS)")).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile Money number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Payment screenshot")).not.toBeInTheDocument();
  });
});
