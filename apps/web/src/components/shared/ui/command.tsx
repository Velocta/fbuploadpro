"use client";

/**
 * Command — shadcn base on `cmdk` (spec 130 §5.6 / OD130-2 = A:
 * Shahzeb adopted the `cmdk` dependency for this primitive), adapted
 * to this repo's foundation:
 * - Styling: token-backed utilities only (panel surface, ink text,
 *   hairline separators, hover/active token steps) — no shadcn theme
 *   classes, no arbitrary values, no literals.
 * - Targets (UI Rule 8 / spec 142): every row is a 44px minimum hit
 *   area (`min-h-11`), the search input is 44px tall; the selected
 *   row is never colour alone — cmdk marks it `data-selected` and the
 *   row also carries `aria-selected` from cmdk's listbox semantics.
 * - Five states (UI Rule 16): default, typing/filtering (cmdk's
 *   built-in fuzzy filter), empty (`CommandEmpty` — the consumer
 *   renders the typed state), loading (the consumer renders skeleton
 *   rows at final geometry inside `CommandList`), and
 *   disabled-with-reason (`CommandItem disabled` renders dimmed and
 *   non-activatable; the reason is the consumer's visible text).
 * - Keyboard (matrix §11 / §30): cmdk owns arrow-key movement, Enter
 *   activation and typeahead filtering; `CommandDialog` composes the
 *   shared Dialog primitive, so focus moves in on open, Tab is
 *   trapped, Esc closes, and closing returns focus to the invoker.
 * - Motion: the Dialog primitive's token motion only; cmdk adds no
 *   travel animation of its own, and `prefers-reduced-motion` is
 *   honoured by the token layer (UX-28).
 */
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-panel text-ink",
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command palette",
  description = "Search for a destination or action",
  children,
  className,
  trigger,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  /**
   * Optional in-dialog trigger. When the palette is opened
   * programmatically instead (a global chord, an external button),
   * there is no in-dialog trigger and the opener owns focus return
   * to the invoker (the palette host does exactly that).
   */
  trigger?: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        showCloseButton={false}
        className={cn("overflow-hidden p-0 sm:max-w-xl", className)}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b border-line px-3">
      <SearchIcon className="size-4 shrink-0 text-ink-dim" aria-hidden />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-11 w-full bg-transparent text-lg text-ink outline-none placeholder:text-ink-dim disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-80 overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  );
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" {...props} />;
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-ink [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-metadata [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-dim",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-line", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-11 cursor-default items-center gap-2 rounded-sm px-3 py-2 text-body text-ink outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-hover [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-metadata tracking-caption text-ink-dim", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
