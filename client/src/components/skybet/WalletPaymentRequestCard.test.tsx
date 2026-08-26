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
      myRequests: { useQuery: () => ({ data: [] }) },
      submitDeposit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      submitWithdrawal: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

afterEach(cleanup);

describe("WalletPaymentRequestCard", () => {
  it("shows the TRC20 method, approved fixed deposit amounts, and gateway setup state", () => {
    render(<WalletPaymentRequestCard />);
    expect(screen.getByText("TRC20 deposit address")).toBeInTheDocument();
    expect(screen.getByText("Aqùapay local GHS")).toBeInTheDocument();
    expect(screen.getByText("Setup pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GH₵ 2,000" })).toBeInTheDocument();
    expect(screen.getByLabelText("Payment screenshot")).toBeInTheDocument();
  });

  it("switches to a no-screenshot withdrawal request form", () => {
    render(<WalletPaymentRequestCard />);
    fireEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    expect(screen.getByLabelText("Withdrawal amount (GHS)")).toBeInTheDocument();
    expect(screen.getByLabelText("Payout destination")).toBeInTheDocument();
    expect(screen.queryByLabelText("Payment screenshot")).not.toBeInTheDocument();
  });
});
