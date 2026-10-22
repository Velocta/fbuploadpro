/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "./select";

beforeAll(ensureDomShims);

describe("Select", () => {
  it("opens the listbox and selects an option by click", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Platform">
          <SelectValue placeholder="Choose a platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Social</SelectLabel>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox", { name: "Platform" });
    expect(trigger.textContent).toContain("Choose a platform");
    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: "Instagram" });
    fireEvent.click(option);
    expect(trigger.textContent).toContain("Instagram");
  });

  it("disabled option cannot be selected", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Tier">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="pro" disabled>
            Pro
          </SelectItem>
        </SelectContent>
      </Select>
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Tier" }));
    expect(screen.getByRole("option", { name: "Pro" }).getAttribute("aria-disabled")).toBe("true");
  });
});
