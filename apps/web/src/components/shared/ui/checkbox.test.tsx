/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders unchecked with a 24px target and toggles on click", () => {
    render(
      <label>
        <Checkbox aria-label="Select row" /> Row
      </label>
    );
    const box = screen.getByRole("checkbox", { name: "Select row" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(box.className).toContain("size-6");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("supports the indeterminate state", () => {
    render(<Checkbox aria-label="Select all" checked="indeterminate" />);
    expect(screen.getByRole("checkbox", { name: "Select all" }).getAttribute("aria-checked")).toBe("mixed");
  });

  it("disabled checkbox cannot be toggled", () => {
    render(<Checkbox aria-label="Locked" disabled />);
    const box = screen.getByRole("checkbox", { name: "Locked" });
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
  });
});
