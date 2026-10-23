/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Field, FormErrorSummary } from "./form";

describe("Input / Textarea", () => {
  it("input renders with the 40px field contract and placeholder", () => {
    render(<Input aria-label="Name" placeholder="Your name" />);
    const input = screen.getByLabelText("Name");
    expect(input.className).toContain("h-10");
    expect(input.getAttribute("placeholder")).toBe("Your name");
  });

  it("textarea renders multiline with token classes", () => {
    render(<Textarea aria-label="Caption" rows={4} />);
    const area = screen.getByLabelText("Caption");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area.className).toContain("min-h-16");
  });
});

describe("Field + FormErrorSummary (form error pattern)", () => {
  it("Field wires label above, hint and inline error into the control ARIA", () => {
    render(
      <Field id="handle" label="Page handle" hint="Letters and numbers only" error="Handle is already taken">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText(/Page handle/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("handle-hint");
    expect(describedBy).toContain("handle-error");
    expect(screen.getByText("Handle is already taken").getAttribute("role")).toBe("alert");
    expect(screen.getByText("Letters and numbers only")).toBeTruthy();
  });

  it("Field without error leaves aria-invalid unset", () => {
    render(
      <Field id="city" label="City">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("City").getAttribute("aria-invalid")).toBeNull();
  });

  it("summary lists errors as links to their fields and is focusable", () => {
    render(
      <FormErrorSummary
        errors={[
          { fieldId: "handle", message: "Handle is already taken" },
          { fieldId: "city", message: "City is required" },
        ]}
      />
    );
    const summary = screen.getByRole("alert");
    expect(summary.getAttribute("tabindex")).toBe("-1");
    const link = screen.getByRole("link", { name: "Handle is already taken" });
    expect(link.getAttribute("href")).toBe("#handle");
  });

  it("summary renders nothing with no errors", () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
