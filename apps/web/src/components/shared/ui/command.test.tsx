import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./command";
import { Button } from "./button";

function TestCommand({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <Command label="Test palette">
      <CommandInput placeholder="Search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem value="home" onSelect={onSelect}>
            Home
          </CommandItem>
          <CommandItem value="media" onSelect={onSelect}>
            Media Library
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem value="archived" disabled>
            Archived (unavailable)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

describe("Command", () => {
  it("renders groups, rows and shortcut hints; rows are 44px targets", () => {
    render(<TestCommand onSelect={() => {}} />);
    expect(screen.getByText("Go to")).toBeInTheDocument();
    const home = screen.getByRole("option", { name: /Home/ });
    expect(home).toBeInTheDocument();
    expect(home.className).toContain("min-h-11");
    expect(screen.getByText("⌘B")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Search…");
    expect(input.className).toContain("h-11");
  });

  it("filters with fuzzy matching and shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<TestCommand onSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText("Search…"), "med");
    expect(screen.getByRole("option", { name: /Media Library/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Home/ })).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "zzzz");
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("arrow keys move the selection and Enter activates the selected row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TestCommand onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Search…");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    const media = screen.getByRole("option", { name: /Media Library/ });
    expect(media).toHaveAttribute("data-selected", "true");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("media");
  });

  it("disabled rows are present with their reason and are never selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TestCommand onSelect={onSelect} />);
    const archived = screen.getByRole("option", { name: /Archived/ });
    expect(archived).toHaveAttribute("data-disabled", "true");
    await user.click(screen.getByPlaceholderText("Search…"));
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(archived).not.toHaveAttribute("data-selected", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("CommandDialog: opens, traps focus, Esc closes and focus returns to the invoker", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open palette</Button>
          <CommandDialog open={open} onOpenChange={setOpen}>
            <TestCommand onSelect={() => setOpen(false)} />
          </CommandDialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open palette" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
    // Phone geometry comes from the shared Dialog panel: 16px gutters.
    expect(dialog.className).toContain("inset-x-4");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
