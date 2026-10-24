import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./pagination";

describe("Pagination", () => {
  it("marks the current page and labels prev/next", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="?page=1" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?page=2" isActive>
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="?page=3" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(screen.getByRole("navigation", { name: "pagination" })).toBeInTheDocument();
    const current = screen.getByRole("link", { name: "2" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("href", "?page=1");
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("href", "?page=3");
  });

  it("spec 142 F15/F01: content wraps and centres; links inherit compact 36px Button geometry", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="?page=2">2</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    const content = document.querySelector('[data-slot="pagination-content"]') as HTMLElement;
    expect(content.className).toContain("flex-wrap");
    expect(content.className).toContain("justify-center");
    expect(screen.getByRole("link", { name: "2" }).className).toContain("size-control");
  });

  it("page links are real anchors a keyboard user can Tab to and activate", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="?page=2" onClick={onNavigate}>
              2
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    await user.tab();
    const link = screen.getByRole("link", { name: "2" });
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
