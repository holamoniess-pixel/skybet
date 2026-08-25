import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUserSearch } from "./AdminUserSearch";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  refetch: vi.fn(),
  state: { isError: false },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    referrals: {
      searchUsers: {
        useQuery: (input: unknown) => {
          mocks.query(input);
          return {
            data: mocks.state.isError ? undefined : [{ id: 42, name: "Amina Owusu", email: "amina@example.com", openId: "demo-42", role: "user", lastSignedIn: new Date() }],
            isLoading: false,
            isError: mocks.state.isError,
            refetch: mocks.refetch,
          };
        },
      },
    },
  },
}));

afterEach(() => {
  cleanup();
  mocks.query.mockClear();
  mocks.refetch.mockClear();
  mocks.state.isError = false;
});

describe("AdminUserSearch", () => {
  it("filters account lookup and selects the returned user", async () => {
    const user = userEvent.setup();
    const onSelectUser = vi.fn();
    render(<AdminUserSearch onSelectUser={onSelectUser} />);

    await user.type(screen.getByLabelText("Search Skybet users"), "Amina");
    await user.click(screen.getByRole("button", { name: /all/i }));
    await user.click(screen.getByRole("button", { name: /Amina Owusu/ }));

    expect(mocks.query).toHaveBeenLastCalledWith({ query: "Amina", role: "all" });
    expect(onSelectUser).toHaveBeenCalledWith(42);
  });

  it("shows retry guidance when account search fails", async () => {
    const user = userEvent.setup();
    mocks.state.isError = true;
    render(<AdminUserSearch onSelectUser={vi.fn()} />);

    expect(screen.getByText("Account search is unavailable. Check the connection and try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
