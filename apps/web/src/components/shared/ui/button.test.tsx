/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders a real button with the gold primary variant by default", () => {
    render(<Button>Publish</Button>);
    const btn = screen.getByRole("button", { name: "Publish" });
    expect(btn.getAttribute("data-variant")).toBe("default");
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("text-on-primary");
    expect(btn.className).toContain("h-10");
  });

  it("uses token classes only — no arbitrary values", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).not.toMatch(/-\[/);
  });

  it("fires onClick and is a non-submit button by default", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.getAttribute("type")).toBe("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading state: spinner geometry, aria-busy, activation blocked", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>
    );
    const btn = screen.getByRole("button", { name: /Saving/ });
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled-with-a-reason exposes the reason as its description", () => {
    render(<Button disabledReason="Connect a Page first">Schedule</Button>);
    const btn = screen.getByRole("button", { name: "Schedule" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe("Connect a Page first");
  });

  it("asChild renders the child element with button styling (single-click link)", () => {
    render(
      <Button asChild>
        <a href="/queue">Queue</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Queue" });
    expect(link.getAttribute("href")).toBe("/queue");
    expect(link.className).toContain("bg-primary");
  });
});
