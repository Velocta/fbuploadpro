/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

beforeAll(ensureDomShims);

describe("Tabs (ARIA tabs pattern)", () => {
  it("renders tabs with roving selection and arrow-key movement", async () => {
    render(
      <Tabs defaultValue="queue">
        <TabsList aria-label="Sections">
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">Queue panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>
    );
    const queue = screen.getByRole("tab", { name: "Queue" });
    const history = screen.getByRole("tab", { name: "History" });
    expect(queue.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Queue panel");
    queue.focus();
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    await waitFor(() => expect(history.getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByRole("tabpanel").textContent).toBe("History panel");
  });

  it("clicking a tab selects it", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    // Radix tabs activate on mouse down (the ARIA tabs pattern's
    // automatic-activation behaviour), which a bare click event skips.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel B");
  });
});
