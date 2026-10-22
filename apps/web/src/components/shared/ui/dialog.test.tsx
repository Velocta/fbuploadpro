/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
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

beforeAll(ensureDomShims);

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
  it("opens on trigger, traps labelled content, Esc closes and focus returns", async () => {
    render(<TestDialog />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Edit post");
    expect(screen.getByLabelText("Caption")).toBeTruthy();
    // Focus moved into the dialog on open.
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Closing returns focus to the trigger.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("close button closes the dialog", () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
