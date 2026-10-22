/**
 * Textarea — shadcn base, adapted to the same field contract as Input
 * (token hairline, aria-invalid error state, focus-visible ring baseline).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-sm border border-line bg-canvas px-3 py-2 text-body text-ink transition-colors duration-fast outline-none placeholder:text-ink-dim focus-visible:border-brand-gold disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-brand-rose",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
