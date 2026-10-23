import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";
import { Button } from "./button";

function TestAlertDialog({ onAction }: { onAction: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete…</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>The post will be removed from the queue.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep post</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>Delete post</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialog (destructive pattern)", () => {
  it("verb-named confirm, focus starts on Cancel, Esc does NOT dismiss", async () => {
    const user = userEvent.setup();
    render(<TestAlertDialog onAction={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "Keep post" });
    expect(screen.getByRole("button", { name: "Delete post" })).toBeInTheDocument();
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    // Destructive confirmations are not Esc-dismissible in this design system.
    expect(screen.queryByRole("alertdialog")).toBeInTheDocument();
  });

  it("Cancel closes without action and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TestAlertDialog onAction={onAction} />);
    const trigger = screen.getByRole("button", { name: "Delete…" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Keep post" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("Action fires and closes", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TestAlertDialog onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    await user.click(screen.getByRole("button", { name: "Delete post" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keyboard-only: Enter on Cancel (the initial focus) dismisses safely", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TestAlertDialog onAction={onAction} />);
    const trigger = screen.getByRole("button", { name: "Delete…" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });
});
