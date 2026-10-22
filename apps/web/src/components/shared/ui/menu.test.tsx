/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "./menu";
import { Button } from "./button";

beforeAll(ensureDomShims);

describe("Menu (dropdown menu)", () => {
  it("opens on click, item click fires, Esc closes and returns focus", async () => {
    const onDuplicate = vi.fn();
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>Post</MenuLabel>
          <MenuItem onSelect={onDuplicate}>Duplicate</MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive">Delete</MenuItem>
        </MenuContent>
      </Menu>
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    // Radix menus open on pointer down, not on the synthesized click.
    fireEvent.pointerDown(trigger);
    const item = screen.getByRole("menuitem", { name: "Duplicate" });
    fireEvent.click(item);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(trigger);
    const menu = screen.getByRole("menu");
    expect(menu).toBeTruthy();
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
