"use client";

/**
 * Popover — shadcn base on Radix Popover: anchored, non-modal, interactive
 * secondary content (matrix §2). Esc closes and closing returns focus to
 * the trigger (Radix mechanics, UI Rule 18). Never use for critical or long
 * content — that is a Dialog or a page. Geometry (spec 142 F10): the
 * panel is capped at the Radix available width so it never exceeds the
 * viewport, and it carries collision padding by default.
 */
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-popover w-72 max-w-(--radix-popover-content-available-width) rounded-md border border-line bg-panel p-4 text-ink shadow-elevated outline-none",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-1 text-body", className)} {...props} />;
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-title" className={cn("font-medium", className)} {...props} />;
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="popover-description" className={cn("text-ink-sub", className)} {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverHeader, PopoverTitle, PopoverDescription };
