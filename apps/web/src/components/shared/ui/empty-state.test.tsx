/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";
import { Button } from "./button";

describe("EmptyState (typed, one primary action)", () => {
  it("first-use: headline, value line and one CTA", () => {
    render(
      <EmptyState
        type="first-use"
        title="No posts yet"
        description="Queue your first post and it will publish itself."
        action={<Button>Queue a post</Button>}
      />
    );
    const el = screen.getByRole("status");
    expect(el.getAttribute("data-type")).toBe("first-use");
    expect(screen.getByRole("heading", { name: "No posts yet" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("no-results echoes the active filters", () => {
    render(
      <EmptyState
        type="no-results"
        title="No posts match"
        activeFilters={["Status: Failed", "Platform: Facebook"]}
        action={<Button variant="outline">Clear filters</Button>}
      />
    );
    expect(screen.getByText(/Active filters:/).textContent).toContain("Status: Failed");
  });

  it("cleared renders a confirmation with no action", () => {
    render(<EmptyState type="cleared" title="Queue is clear" description="Everything has published." />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status").getAttribute("data-type")).toBe("cleared");
  });

  it("no-permission explains who can fix it", () => {
    render(
      <EmptyState
        type="no-permission"
        title="No access to this workspace"
        description="Ask the workspace owner to invite you."
      />
    );
    expect(screen.getByText(/workspace owner/)).toBeTruthy();
  });
});
