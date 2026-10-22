"use client";

/**
 * Form primitives — the research form-error pattern at primitive level
 * (UI Rule 4 / UX Rule 23): on submit with errors, focus moves to an error
 * SUMMARY whose entries link to their fields and match the INLINE wording
 * exactly; each inline error sits under its field and states the fix; user
 * input is never cleared. Validation fires on blur, not on focus or first
 * keystroke (UI Rule 5).
 *
 * Field wires label-above (matrix §28), an always-visible hint, and the
 * inline error into the control's aria-describedby / aria-invalid.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
};

function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const controlProps: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean } = { id };
  if (describedBy) controlProps["aria-describedby"] = describedBy;
  if (error) controlProps["aria-invalid"] = true;
  const control = React.cloneElement(children, controlProps);
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body font-medium text-ink">
        {label}
        {optional ? <span className="text-ink-dim"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-metadata text-ink-sub">
          {hint}
        </p>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-metadata font-medium text-brand-rose">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormErrorSummaryProps = React.ComponentProps<"div"> & {
  errors: { fieldId: string; message: string }[];
  title?: string;
};

/**
 * Render when a submit produced errors, and move focus to it (ref callback
 * or an effect in the consumer: summaryRef.current?.focus()). Entries are
 * anchor links to the field ids, wording identical to the inline errors.
 */
const FormErrorSummary = React.forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  function FormErrorSummary({ errors, title = "Check the form", className, ...props }, ref) {
    if (errors.length === 0) return null;
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        data-slot="form-error-summary"
        className={cn(
          "rounded-md border border-brand-rose bg-panel px-4 py-3 text-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-rose",
          className
        )}
        {...props}
      >
        <p className="font-medium text-brand-rose">{title}</p>
        <ul className="mt-1 list-inside list-disc">
          {errors.map((e) => (
            <li key={e.fieldId}>
              <a href={`#${e.fieldId}`} className="underline underline-offset-4 hover:text-brand-rose">
                {e.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
);

export { Field, FormErrorSummary };
export type { FieldProps, FormErrorSummaryProps };
