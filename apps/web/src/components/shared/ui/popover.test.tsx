/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from "./popover";
import { Button } from "./button";

beforeAll(ensureDomShims);

describe("Popover", () => {
  it("opens anchored content; Esc closes and returns focus to the trigger", async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Details</Button>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Post details</PopoverTitle>
            <PopoverDescription>Scheduled for tomorrow.</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    );
    const trigger = screen.getByRole("button", { name: "Details" });
    fireEvent.click(trigger);
    const content = screen.getByText("Post details").closest('[data-slot="popover-content"]') as HTMLElement;
    expect(content).not.toBeNull();
    fireEvent.keyDown(content, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Post details")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
