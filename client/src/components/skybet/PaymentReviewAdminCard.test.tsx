import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PaymentReviewAdminCard } from "./PaymentReviewAdminCard";

const queue = [
  { request: { id: 1, publicReference: "DEP-100", amount: "200.00", requestType: "deposit", method: "crypto_trc20", status: "submitted" }, user: { id: 4, email: "customer@example.com" }, reviewer: null },
  { request: { id: 2, publicReference: "WDL-200", amount: "300.00", requestType: "withdrawal", method: "aquapay", status: "submitted", payoutDestination: "0240000000" }, user: { id: 5, email: "member@example.com" }, reviewer: null },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ paymentReview: { queue: { invalidate: vi.fn() } } }),
    paymentReview: {
      queue: { useQuery: () => ({ data: queue, isLoading: false }) },
      proofUrl: { useQuery: () => ({ data: undefined, isLoading: false }) },
      review: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setAccountHold: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    referrals: { searchUsers: { useQuery: () => ({ data: [], isLoading: false }) } },
  },
}));

afterEach(cleanup);

describe("PaymentReviewAdminCard", () => {
  it("filters the queue by the requested operational page", () => {
    const { rerender } = render(<PaymentReviewAdminCard requestType="deposit" />);
    expect(screen.getByText("DEP-100 · GH₵ 200.00")).toBeInTheDocument();
    expect(screen.queryByText("WDL-200 · GH₵ 300.00")).not.toBeInTheDocument();

    rerender(<PaymentReviewAdminCard requestType="withdrawal" />);
    expect(screen.getByText("WDL-200 · GH₵ 300.00")).toBeInTheDocument();
    expect(screen.queryByText("DEP-100 · GH₵ 200.00")).not.toBeInTheDocument();
  });
});
