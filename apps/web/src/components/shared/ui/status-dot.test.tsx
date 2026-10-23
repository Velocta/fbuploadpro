/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusDot } from "./status-dot";

describe("StatusDot (colour + icon + text, OD-3)", () => {
  it("operational renders dot, icon and text together", () => {
    render(<StatusDot status="operational" />);
    const el = screen.getByRole("status", { name: "Operational" });
    expect(el.getAttribute("data-status")).toBe("operational");
    expect(el.textContent).toContain("Operational");
    expect(el.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(el.className).toContain("text-signal-operational");
  });

  it("each status has a distinct default label", () => {
    const { rerender } = render(<StatusDot status="queued" />);
    expect(screen.getByRole("status").textContent).toContain("Queued");
    rerender(<StatusDot status="critical" />);
    expect(screen.getByRole("status").textContent).toContain("Critical");
    rerender(<StatusDot status="idle" />);
    expect(screen.getByRole("status").textContent).toContain("Idle");
  });

  it("custom label overrides the text but keeps the status identity", () => {
    render(<StatusDot status="critical" label="Connection expired" />);
    const el = screen.getByRole("status", { name: "Connection expired" });
    expect(el.getAttribute("data-status")).toBe("critical");
  });
});
