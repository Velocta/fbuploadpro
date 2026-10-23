/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
  TableBatchBar,
} from "./table";
import { Button } from "./button";

describe("Table + batch bar pattern (UI Rule 10)", () => {
  it("renders a real table with a sticky header", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Post</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Morning reel</TableCell>
            <TableCell>Scheduled</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Post" }).className).toContain("sticky");
    expect(screen.getByRole("cell", { name: "Morning reel" })).toBeTruthy();
  });

  it("toolbar renders global actions", () => {
    render(
      <TableToolbar>
        <Button>New post</Button>
      </TableToolbar>
    );
    expect(screen.getByRole("button", { name: "New post" })).toBeTruthy();
  });

  it("batch bar states the count, renders bulk actions and clears", () => {
    const onClear = vi.fn();
    render(
      <TableBatchBar selectedCount={3} onClearSelection={onClear}>
        <Button size="sm">Schedule</Button>
      </TableBatchBar>
    );
    const bar = screen.getByRole("region", { name: "3 selected" });
    expect(bar.textContent).toContain("3 selected");
    expect(screen.getByRole("button", { name: "Schedule" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("batch bar renders nothing with an empty selection", () => {
    const { container } = render(
      <TableBatchBar selectedCount={0}>
        <span>hidden</span>
      </TableBatchBar>
    );
    expect(container.innerHTML).toBe("");
  });

  it("selected row exposes its state via data attribute", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>Chosen</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("data-state")).toBe("selected");
    expect(row.className).toContain("data-[state=selected]:bg-active");
  });
});
