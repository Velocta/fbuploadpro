/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState, EMPTY_STATE_TYPES } from "./empty-state";
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

  it("not-found: the union carries the cause and it renders with exactly one way back", () => {
    expect(EMPTY_STATE_TYPES).toContain("not-found");
    render(
      <EmptyState
        type="not-found"
        title="This page is not here"
        description="The page you are looking for may have moved or no longer exists."
        action={<Button>Go to dashboard</Button>}
      />
    );
    const el = screen.getByRole("status");
    expect(el.getAttribute("data-type")).toBe("not-found");
    expect(screen.getByRole("heading", { name: "This page is not here" })).toBeTruthy();
    expect(screen.getByText(/may have moved/)).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
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
