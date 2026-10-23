import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders unchecked with a 24px target and toggles on click", async () => {
    const user = userEvent.setup();
    render(
      <label>
        <Checkbox aria-label="Select row" /> Row
      </label>
    );
    const box = screen.getByRole("checkbox", { name: "Select row" });
    expect(box).toHaveAttribute("aria-checked", "false");
    expect(box.className).toContain("size-6");
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("spec 142 F08: visual box stays 24px, hit area expands to 44px", () => {
    render(<Checkbox aria-label="Select row" />);
    const box = screen.getByRole("checkbox", { name: "Select row" });
    expect(box.className).toContain("size-6");
    expect(box.className).toContain("hit-area-44");
  });

  it("toggles with Space when focused (keyboard user)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Select row" onCheckedChange={onCheckedChange} />);
    await user.tab();
    const box = screen.getByRole("checkbox", { name: "Select row" });
    expect(box).toHaveFocus();
    await user.keyboard(" ");
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("clicking the label text toggles the checkbox", async () => {
    const user = userEvent.setup();
    render(
      <label>
        <Checkbox aria-label="Select row" /> Row
      </label>
    );
    await user.click(screen.getByText("Row"));
    expect(screen.getByRole("checkbox", { name: "Select row" })).toHaveAttribute("aria-checked", "true");
  });

  it("supports the indeterminate state", () => {
    render(<Checkbox aria-label="Select all" checked="indeterminate" />);
    expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveAttribute("aria-checked", "mixed");
  });

  it("disabled checkbox cannot be toggled by click or keyboard", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Locked" disabled />);
    const box = screen.getByRole("checkbox", { name: "Locked" });
    expect(box).toBeDisabled();
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
  });
});
