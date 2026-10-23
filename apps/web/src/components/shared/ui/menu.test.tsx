import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "./menu";
import { Button } from "./button";

function TestMenu({
  onDuplicate,
  onDelete,
}: {
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Post</MenuLabel>
        <MenuItem onSelect={onDuplicate}>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </MenuItem>
        <MenuItem disabled>Archive</MenuItem>
      </MenuContent>
    </Menu>
  );
}

describe("Menu (dropdown menu)", () => {
  it("opens on click, item click fires, menu closes", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(<TestMenu onDuplicate={onDuplicate} />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("spec 142 F09: items are 44px rows and the panel uses Radix available height", async () => {
    const user = userEvent.setup();
    render(<TestMenu />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("max-h-(--radix-dropdown-menu-content-available-height)");
    expect(menu.className).not.toContain("max-h-96");
    expect(screen.getByRole("menuitem", { name: "Duplicate" }).className).toContain("min-h-11");
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("min-h-11");
  });

  it("Esc closes the menu and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<TestMenu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keyboard: ArrowDown on the trigger opens the menu; arrows move; Enter selects", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<TestMenu onDelete={onDelete} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("disabled item cannot be selected and does not close the menu", async () => {
    const user = userEvent.setup();
    render(<TestMenu />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const archive = screen.getByRole("menuitem", { name: "Archive" });
    expect(archive).toHaveAttribute("data-disabled");
    await user.click(archive);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
