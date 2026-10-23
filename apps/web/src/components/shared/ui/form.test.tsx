/** @vitest-environment jsdom */
/** @vitest-environment jsdom */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Button } from "./button";
import {
  Field,
  Form,
  FormControl,
  FormDescription,
  FormErrorSummary,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormErrorSummaryEntry,
} from "./form";

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

  it("summary renders a form-level entry (no fieldId) as text, not a link", () => {
    render(<FormErrorSummary errors={[{ message: "Invalid email or password" }]} />);
    expect(screen.getByText("Invalid email or password")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Invalid email or password" })).toBeNull();
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

});

/* ------------------------------------------------------------------ */
/* The §3.8 standard, exercised the way surfaces consume it: RHF +     */
/* zod resolver, onTouched, summary + inline, focus-to-summary.        */
/* ------------------------------------------------------------------ */

const testSchema = z.object({
  handle: z.string().min(3, "Handle must be at least 3 characters"),
  city: z.string().min(1, "City is required"),
});
type TestValues = z.infer<typeof testSchema>;

function TestStandardForm({ onValid }: { onValid: (values: TestValues) => void | Promise<void> }) {
  const form = useForm<TestValues>({
    resolver: zodResolver(testSchema),
    mode: "onTouched",
    shouldFocusError: false,
    defaultValues: { handle: "", city: "" },
  });
  const [attempted, setAttempted] = React.useState(false);
  const summaryErrors: FormErrorSummaryEntry[] = (
    [
      ["handle", "test-handle"],
      ["city", "test-city"],
    ] as const
  ).flatMap(([name, fieldId]) => {
    const message = form.formState.errors[name]?.message;
    return message ? [{ fieldId, message: String(message) }] : [];
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setAttempted(true);
          await onValid(values);
        }, () => setAttempted(true))}
      >
        <FormField
          control={form.control}
          name="handle"
          render={({ field }) => (
            <FormItem id="test-handle">
              <FormLabel>Handle</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Letters and numbers only</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem id="test-city">
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {attempted ? <FormErrorSummary errors={summaryErrors} /> : null}
        <Button type="submit" loading={form.formState.isSubmitting}>
          Save
        </Button>
      </form>
    </Form>
  );
}

describe("Form standard (react-hook-form + zod, §3.8)", () => {
  it("validates on blur (onTouched) with the inline error wired to the control, no summary yet", async () => {
    const user = userEvent.setup();
    render(<TestStandardForm onValid={vi.fn()} />);
    const handle = screen.getByLabelText("Handle");
    await user.click(handle);
    await user.type(handle, "ab");
    await user.click(screen.getByLabelText("City")); // blur → touched → validate

    const inline = await screen.findByText("Handle must be at least 3 characters");
    expect(inline.getAttribute("role")).toBe("alert");
    expect(handle.getAttribute("aria-invalid")).toBe("true");
    expect(handle.getAttribute("aria-describedby")).toContain("test-handle-message");
    expect(handle.getAttribute("aria-describedby")).toContain("test-handle-description");
    // Blur errors stay inline — the summary is a submit-failure surface.
    expect(screen.queryByRole("alert", { name: "" })?.dataset.slot).not.toBe("form-error-summary");
    expect(document.querySelector('[data-slot="form-error-summary"]')).toBeNull();
  });

  it("failed submit moves focus to the summary, links match inline wording, input is preserved", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<TestStandardForm onValid={onValid} />);
    await user.type(screen.getByLabelText("Handle"), "ab");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const summary = await waitFor(() => {
      const el = document.querySelector('[data-slot="form-error-summary"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(summary.getAttribute("role")).toBe("alert");
    expect(document.activeElement).toBe(summary);
    // Summary entries link to their fields and match the inline wording exactly.
    const handleLink = screen.getByRole("link", { name: "Handle must be at least 3 characters" });
    expect(handleLink.getAttribute("href")).toBe("#test-handle");
    const cityLink = screen.getByRole("link", { name: "City is required" });
    expect(cityLink.getAttribute("href")).toBe("#test-city");
    expect(screen.getAllByText("Handle must be at least 3 characters")).toHaveLength(2);
    // A failed submit never clears what the user typed.
    expect((screen.getByLabelText("Handle") as HTMLInputElement).value).toBe("ab");
    expect(onValid).not.toHaveBeenCalled();
  });

  it("valid submit calls the handler with the typed values and shows no summary", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<TestStandardForm onValid={onValid} />);
    await user.type(screen.getByLabelText("Handle"), "boss-page");
    await user.type(screen.getByLabelText("City"), "Karachi");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onValid).toHaveBeenCalledWith({ handle: "boss-page", city: "Karachi" }));
    expect(document.querySelector('[data-slot="form-error-summary"]')).toBeNull();
  });

  it("submit button is disabled with aria-busy while the submit is pending", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(<TestStandardForm onValid={() => gate} />);
    await user.type(screen.getByLabelText("Handle"), "boss-page");
    await user.type(screen.getByLabelText("City"), "Karachi");
    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);

    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
    expect(button.getAttribute("aria-busy")).toBe("true");
    release();
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  });
});
