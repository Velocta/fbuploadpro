/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a decorative pulse block the consumer sizes to final geometry", () => {
    const { container } = render(<Skeleton className="h-10 w-40" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("aria-hidden")).toBe("true");
    expect(el?.className).toContain("animate-pulse");
    expect(el?.className).toContain("h-10");
  });
});
