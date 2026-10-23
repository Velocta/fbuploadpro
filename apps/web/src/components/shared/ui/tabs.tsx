"use client";

/**
 * Tabs — shadcn base on Radix Tabs: the ARIA tabs pattern is Radix's
 * (roving tabindex, arrow-key movement, Home/End, activation semantics —
 * matrix §30). Two list variants: `default` (segmented panel) and `line`
 * (gold underline on the active tab — the Binance active-underline accent).
 * Tabs are for 2–9 peer sections; they are never a pseudo-wizard (matrix §6).
 * Geometry (spec 142 F07): the list is viewport-bounded (`max-w-full`)
 * and scrolls horizontally when its tabs overflow, and triggers are
 * 44px tall.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("flex gap-2 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "inline-flex w-fit max-w-full items-center justify-center gap-1 overflow-x-auto text-ink-sub",
  {
    variants: {
      variant: {
        default: "h-13 rounded-md bg-subtle p-1",
        line: "border-b border-line bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-11 shrink-0 flex-1 items-center justify-center gap-1.5 rounded-sm border-b-2 border-transparent px-3 text-body font-medium whitespace-nowrap text-ink-sub transition-colors duration-fast outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-card",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
