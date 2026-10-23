/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "./card";

describe("Card", () => {
  it("renders the full card structure on token classes", () => {
    render(
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Queue</CardTitle>
            <CardDescription>Upcoming posts</CardDescription>
          </div>
          <CardAction>
            <button type="button">Add</button>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Queue")).toBeTruthy();
    expect(screen.getByText("Upcoming posts")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
    const card = screen.getByText("Queue").closest('[data-slot="card"]');
    expect(card?.className).toContain("bg-panel");
    expect(card?.className).toContain("border-line");
  });
});
