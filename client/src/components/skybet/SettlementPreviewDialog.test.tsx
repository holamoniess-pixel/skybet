import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettlementPreviewDialog } from "./SettlementPreviewDialog";

describe("SettlementPreviewDialog", () => {
  it("shows the supplied trophy and preserves the no-credit preview boundary", () => {
    render(<SettlementPreviewDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Gold trophy supplied for SKYBET settlement celebration")).toBeInTheDocument();
    expect(screen.getByText("Bonus balance")).toBeInTheDocument();
    expect(screen.getByText("Preview only. No balance, bonus, or payout has changed.")).toBeInTheDocument();
  });

  it("closes through the explicit preview control", () => {
    const onOpenChange = vi.fn();
    render(<SettlementPreviewDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
