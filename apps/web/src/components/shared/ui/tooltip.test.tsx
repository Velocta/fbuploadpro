import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

function TestTooltip() {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Info</button>
        </TooltipTrigger>
        <TooltipContent>Posts in the page timezone</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("shows brief non-interactive content on keyboard focus", async () => {
    const user = userEvent.setup();
    render(<TestTooltip />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Info" })).toHaveFocus();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("page timezone");
  });

  it("shows on hover and hides when the pointer leaves", async () => {
    const user = userEvent.setup();
    render(<TestTooltip />);
    const trigger = screen.getByRole("button", { name: "Info" });
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
