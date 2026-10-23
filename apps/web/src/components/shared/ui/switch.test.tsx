/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders as a switch and toggles immediately on click", () => {
    render(<Switch aria-label="Auto-post" />);
    const sw = screen.getByRole("switch", { name: "Auto-post" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(sw.getAttribute("data-state")).toBe("checked");
  });

  it("small size renders the compact track", () => {
    render(<Switch aria-label="Compact" size="sm" />);
    expect(screen.getByRole("switch", { name: "Compact" }).getAttribute("data-size")).toBe("sm");
  });
});
