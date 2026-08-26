import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerAuthDialog } from "./CustomerAuthDialog";

describe("CustomerAuthDialog", () => {
  it("shows email/password login and toggles to confirmed sign-up", () => {
    render(<CustomerAuthDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    expect(screen.getByLabelText("Ghana phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("submits first-party sign-up data and closes after success", async () => {
    const onOpenChange = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    render(<CustomerAuthDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.com" } });
    fireEvent.change(screen.getByLabelText("Ghana phone number"), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secure-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", expect.objectContaining({ method: "POST" })));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fetchMock.mockRestore();
  });
});
