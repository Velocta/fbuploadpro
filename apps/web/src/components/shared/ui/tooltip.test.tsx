/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

beforeAll(ensureDomShims);

describe("Tooltip", () => {
  it("shows brief non-interactive content on keyboard focus", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Info</button>
          </TooltipTrigger>
          <TooltipContent>Posts in the page timezone</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    const trigger = screen.getByRole("button", { name: "Info" });
    fireEvent.focus(trigger);
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toContain("page timezone");
  });
});
