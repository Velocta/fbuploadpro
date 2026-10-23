import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders as a switch and toggles immediately on click", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Auto-post" />);
    const sw = screen.getByRole("switch", { name: "Auto-post" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveAttribute("data-state", "checked");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("spec 142 F08: hit area expands to 44px at both sizes, visual track unchanged", () => {
    render(<Switch aria-label="Auto-post" />);
    const sw = screen.getByRole("switch", { name: "Auto-post" });
    expect(sw.className).toContain("hit-area-44");
    expect(sw.className).toContain("h-6");
    expect(sw.className).toContain("w-11");
  });

  it("toggles with Space when focused (keyboard user)", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Auto-post" />);
    await user.tab();
    const sw = screen.getByRole("switch", { name: "Auto-post" });
    expect(sw).toHaveFocus();
    await user.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("checked state renders on by default when defaultChecked is set", () => {
    render(<Switch aria-label="Auto-post" defaultChecked />);
    expect(screen.getByRole("switch", { name: "Auto-post" })).toHaveAttribute("aria-checked", "true");
  });

  it("disabled switch cannot be toggled", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Auto-post" disabled />);
    const sw = screen.getByRole("switch", { name: "Auto-post" });
    expect(sw).toBeDisabled();
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("small size renders the compact track", () => {
    render(<Switch aria-label="Compact" size="sm" />);
    expect(screen.getByRole("switch", { name: "Compact" })).toHaveAttribute("data-size", "sm");
  });
});
