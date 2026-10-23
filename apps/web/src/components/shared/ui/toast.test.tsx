/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ensureDomShims } from "./test-utils";
import { Toast, toast } from "./toast";

beforeAll(ensureDomShims);

describe("Toast (single Sonner-based system)", () => {
  it("mounts the one toaster region when the first toast fires", async () => {
    const { container } = render(<Toast />);
    act(() => {
      toast("Saved");
    });
    expect(await screen.findByText("Saved")).toBeTruthy();
    // Exactly one Sonner toaster region exists in the document.
    expect(container.querySelectorAll("[data-sonner-toaster]").length + document.querySelectorAll("[data-sonner-toaster]").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-sonner-toaster]")).toHaveLength(1);
  });

  it("spec 142 F05: toast action and cancel buttons are 44px tall", async () => {
    render(<Toast />);
    act(() => {
      toast("Post removed", {
        action: { label: "Undo", onClick: () => undefined },
        cancel: { label: "Dismiss", onClick: () => undefined },
      });
    });
    const undo = await screen.findByRole("button", { name: "Undo" });
    expect(undo.className).toContain("h-11");
    const dismiss = await screen.findByRole("button", { name: "Dismiss" });
    expect(dismiss.className).toContain("h-11");
  });

  it("shows a non-critical result toast with its message", async () => {
    render(<Toast />);
    act(() => {
      toast.success("Post queued");
    });
    expect(await screen.findByText("Post queued")).toBeTruthy();
  });
});
