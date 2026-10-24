import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from "./popover";
import { Button } from "./button";

function TestPopover({
  layer,
}: Readonly<{ layer?: "popover" | "overlayTop" | undefined }> = {}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Details</Button>
      </PopoverTrigger>
      <PopoverContent layer={layer}>
        <PopoverHeader>
          <PopoverTitle>Post details</PopoverTitle>
          <PopoverDescription>Scheduled for tomorrow.</PopoverDescription>
        </PopoverHeader>
        <label>
          Note <input aria-label="Note" />
        </label>
      </PopoverContent>
    </Popover>
  );
}

describe("Popover", () => {
  it("opens anchored content on click; Esc closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    const trigger = screen.getByRole("button", { name: "Details" });
    await user.click(trigger);
    const content = screen.getByText("Post details").closest('[data-slot="popover-content"]') as HTMLElement;
    expect(content).not.toBeNull();
    expect(screen.getByText("Scheduled for tomorrow.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Post details")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("can lift the panel to the top overlay layer for triggers inside modal surfaces", async () => {
    const user = userEvent.setup();
    render(<TestPopover layer="overlayTop" />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const content = screen.getByText("Post details").closest('[data-slot="popover-content"]') as HTMLElement;
    expect(content.dataset.layer).toBe("overlayTop");
    expect(content.className).toContain("z-overlay-top");
    expect(content.className).not.toContain("z-popover");
  });

  it("spec 142 F10: panel is capped at the Radix available width", async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const content = screen.getByText("Post details").closest('[data-slot="popover-content"]') as HTMLElement;
    expect(content.className).toContain("max-w-(--radix-popover-content-available-width)");
    expect(content.className).toContain("w-72");
  });

  it("interactive content inside the popover is reachable and typeable", async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const note = screen.getByLabelText("Note");
    await user.click(note);
    await user.type(note, "Follow up");
    expect(note).toHaveValue("Follow up");
  });

  it("clicking the trigger again closes the popover (toggle)", async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    const trigger = screen.getByRole("button", { name: "Details" });
    await user.click(trigger);
    expect(screen.getByText("Post details")).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByText("Post details")).not.toBeInTheDocument();
  });
});
