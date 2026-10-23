/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tag } from "./tag";

describe("Tag", () => {
  it("renders a static category label", () => {
    render(<Tag>Reels</Tag>);
    const tag = screen.getByText("Reels");
    expect(tag.getAttribute("data-variant")).toBe("default");
    expect(tag.className).toContain("bg-primary");
  });

  it("removable tag exposes a real remove button", () => {
    const onRemove = vi.fn();
    render(
      <Tag onRemove={onRemove} removeLabel="Remove Reels filter">
        Reels
      </Tag>
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Reels filter" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("spec 142 F05: remove glyph stays 16px but its hit area expands to 44px", () => {
    render(
      <Tag onRemove={() => undefined} removeLabel="Remove Reels filter">
        Reels
      </Tag>
    );
    const remove = screen.getByRole("button", { name: "Remove Reels filter" });
    expect(remove.className).toContain("size-4");
    expect(remove.className).toContain("hit-area-44");
  });
});
