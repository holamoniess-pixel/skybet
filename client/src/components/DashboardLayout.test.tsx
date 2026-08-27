import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DashboardLayout from "./DashboardLayout";

const authState = vi.hoisted(() => ({ loading: false, user: null as null | { role: "user" | "admin" } }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ ...authState, logout: vi.fn() }) }));
vi.mock("./AdminLoginForm", () => ({ AdminLoginForm: () => <form aria-label="Local administrator sign-in form"><button type="submit">Sign in</button></form> }));

afterEach(cleanup);

describe("DashboardLayout administrator gate", () => {
  it("shows the separate administrator sign-in form instead of a dead-end sidebar when a customer opens /admin", () => {
    authState.user = { role: "user" };
    render(<DashboardLayout><p>Protected workspace</p></DashboardLayout>);

    expect(screen.getByRole("heading", { name: "Sign in as administrator" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "Local administrator sign-in form" })).toBeTruthy();
    expect(screen.queryByText("Protected workspace")).toBeNull();
  });
});
