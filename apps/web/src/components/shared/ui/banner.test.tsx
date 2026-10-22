/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Banner } from "./banner";

describe("Banner", () => {
  it("critical banner is an alert with title, description and its fix action", () => {
    render(
      <Banner
        variant="critical"
        title="Facebook connection expired"
        description="Reconnect to keep publishing."
        action={<button type="button">Reconnect</button>}
      />
    );
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-variant")).toBe("critical");
    expect(banner.textContent).toContain("Facebook connection expired");
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeTruthy();
  });

  it("info banner is a status, and dismiss fires onDismiss", () => {
    const onDismiss = vi.fn();
    render(<Banner variant="info" title="Scheduled" onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss banner" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
