import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";

function TestDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>Change the caption.</DialogDescription>
        </DialogHeader>
        <label>
          Caption <input aria-label="Caption" />
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens on trigger click, moves focus inside, Esc closes and focus returns", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Edit post");
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
    // Focus moved into the dialog on open.
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Closing returns focus to the trigger.
    expect(trigger).toHaveFocus();
  });

  it("traps Tab focus inside the dialog (focus trap cycles both ways)", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog");
    // Tab through every focusable element repeatedly: focus never escapes.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    // Shift+Tab cycles backwards, still inside.
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("close button closes the dialog and returns focus", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Cancel (DialogClose) closes the dialog", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.type(screen.getByLabelText("Caption"), "Draft caption");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("spec 142 F04/F05: phone gutters, dvh-bounded scrolling panel, 44px close", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-x-4");
    expect(dialog.className).toContain("max-h-dvh");
    expect(dialog.className).toContain("overflow-y-auto");
    expect(dialog.className).toContain("sm:max-w-lg");
    expect(dialog.className).not.toMatch(/-\[/);
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("size-11");
  });

  it("keyboard-only user can open the dialog with Enter on the trigger", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Open dialog" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
