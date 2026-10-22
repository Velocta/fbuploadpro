"use client";

/**
 * Switch — shadcn base on Radix Switch. Adapted per matrix §14: a switch is
 * a single on/off that takes effect IMMEDIATELY (no Save) — never place one
 * inside a submit form. Sizes are spacing-scale values giving a 24px-tall
 * target at the default size (UI Rule 8 floor).
 */
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer inline-flex shrink-0 items-center rounded-full border border-line-strong bg-subtle outline-none transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[size=default]:h-6 data-[size=default]:w-11 data-[size=sm]:h-5 data-[size=sm]:w-9",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-neutral-white shadow-card ring-0 transition-transform duration-fast data-[state=unchecked]:translate-x-0.5",
          size === "sm" ? "size-4 data-[state=checked]:translate-x-4" : "size-5 data-[state=checked]:translate-x-5"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
