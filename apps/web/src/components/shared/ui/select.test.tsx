import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "./select";

function TestSelect({ disabled = false }: { disabled?: boolean }) {
  return (
    <Select disabled={disabled}>
      <SelectTrigger aria-label="Platform">
        <SelectValue placeholder="Choose a platform" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Social</SelectLabel>
          <SelectItem value="facebook">Facebook</SelectItem>
          <SelectItem value="instagram">Instagram</SelectItem>
          <SelectItem value="pro" disabled>
            Pro
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("shows the placeholder, opens the listbox and selects an option by click", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    expect(trigger).toHaveTextContent("Choose a platform");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Instagram" }));
    expect(trigger).toHaveTextContent("Instagram");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("spec 142 F01/F02/F09: 44px trigger, 16px-below-sm text, 44px items, available-height panel", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    expect(trigger.className).toContain("h-11");
    expect(trigger.className).toContain("text-base");
    expect(trigger.className).toContain("sm:text-body");
    await user.click(trigger);
    const listbox = screen.getByRole("listbox");
    expect(listbox.className).toContain("max-h-(--radix-select-content-available-height)");
    expect(listbox.className).not.toContain("max-h-96");
    expect(screen.getByRole("option", { name: "Facebook" }).className).toContain("min-h-11");
  });

  it("keyboard: arrows move through options, Enter selects, value is announced on the trigger", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("Instagram");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Esc closes the listbox without changing the value", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Choose a platform");
  });

  it("disabled option is marked and skipped by keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    expect(screen.getByRole("option", { name: "Pro" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
  });

  it("a disabled select cannot be opened", async () => {
    const user = userEvent.setup();
    render(<TestSelect disabled />);
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
