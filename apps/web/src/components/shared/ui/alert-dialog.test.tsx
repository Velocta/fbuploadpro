/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
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

beforeAll(ensureDomShims);

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
    render(<TestAlertDialog onAction={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeTruthy();
    const cancel = screen.getByRole("button", { name: "Keep post" });
    expect(screen.getByRole("button", { name: "Delete post" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeNull();
  });

  it("Cancel closes without action; Action fires and closes", () => {
    const onAction = vi.fn();
    render(<TestAlertDialog onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep post" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
