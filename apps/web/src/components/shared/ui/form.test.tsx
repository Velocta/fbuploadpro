import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Field, FormErrorSummary } from "./form";

describe("Input / Textarea", () => {
  it("input renders with the 40px field contract and placeholder", () => {
    render(<Input aria-label="Name" placeholder="Your name" />);
    const input = screen.getByLabelText("Name");
    expect(input.className).toContain("h-10");
    expect(input).toHaveAttribute("placeholder", "Your name");
  });

  it("typing into the input updates its value (controlled behaviour)", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Name" placeholder="Your name" />);
    const input = screen.getByLabelText("Name");
    await user.click(input);
    await user.type(input, "Boss");
    expect(input).toHaveValue("Boss");
  });

  it("disabled input cannot be typed into", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Name" disabled />);
    const input = screen.getByLabelText("Name");
    expect(input).toBeDisabled();
    await user.type(input, "Nope");
    expect(input).toHaveValue("");
  });

  it("textarea renders multiline with token classes and accepts typed text", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Caption" rows={4} />);
    const area = screen.getByLabelText("Caption");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area.className).toContain("min-h-16");
    await user.type(area, "Line one");
    expect(area).toHaveValue("Line one");
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
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("handle-hint");
    expect(describedBy).toContain("handle-error");
    expect(screen.getByText("Handle is already taken")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Letters and numbers only")).toBeInTheDocument();
  });

  it("Field without error leaves aria-invalid unset", () => {
    render(
      <Field id="city" label="City">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("City")).not.toHaveAttribute("aria-invalid");
  });

  it("a failed submit pattern never clears typed input", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Field id="handle" label="Page handle">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText(/Page handle/);
    await user.type(input, "boss-page");
    expect(input).toHaveValue("boss-page");
    // The error state arrives (as after a failed submit): input is preserved.
    rerender(
      <Field id="handle" label="Page handle" error="Handle is already taken">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText(/Page handle/)).toHaveValue("boss-page");
    expect(screen.getByLabelText(/Page handle/)).toHaveAttribute("aria-invalid", "true");
  });

  it("summary lists errors as links to their fields and can receive focus", () => {
    render(
      <FormErrorSummary
        errors={[
          { fieldId: "handle", message: "Handle is already taken" },
          { fieldId: "city", message: "City is required" },
        ]}
      />
    );
    const summary = screen.getByRole("alert");
    expect(summary).toHaveAttribute("tabindex", "-1");
    const link = screen.getByRole("link", { name: "Handle is already taken" });
    expect(link).toHaveAttribute("href", "#handle");
    // The pattern: on submit failure the consumer moves focus to the summary.
    (summary as HTMLElement).focus();
    expect(summary).toHaveFocus();
  });

  it("summary renders nothing with no errors", () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
