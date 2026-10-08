# UI Component Interface Contracts & Accessibility Specifications

**Feature**: Essential Reusable UI Components  
**Directory**: `specs/008-reusable-ui-components/contracts`  
**Date**: 2026-10-08  

---

## 1. Export Interface Contract (`apps/web/src/components/ui/index.ts`)

Every component must be cleanly exported from the root barrel `apps/web/src/components/ui/`:

```typescript
// Forms & Actions
export { Button } from './button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button';

export { Input } from './input';
export type { InputProps } from './input';

export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

export { Checkbox } from './checkbox';
export type { CheckboxProps } from './checkbox';

export { Switch } from './switch';
export type { SwitchProps } from './switch';

export { Select } from './select';
export type { SelectProps, SelectOption } from './select';

// Surfaces & Overlays
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export type { CardProps } from './card';

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './dialog';
export type { DialogProps } from './dialog';

// Navigation & Data
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export type { TabsProps, TabItem } from './tabs';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
export type { TableProps } from './table';

// Feedback & Status
export { StatusDot } from './status-dot';
export type { StatusDotProps, StatusType } from './status-dot';

export { Tag } from './tag';
export type { TagProps, TagVariant } from './tag';

export { Skeleton } from './skeleton';
export type { SkeletonProps, SkeletonVariant } from './skeleton';

export { Alert } from './alert';
export type { AlertProps, AlertSeverity } from './alert';

export { Tooltip } from './tooltip';
export type { TooltipProps } from './tooltip';
```

---

## 2. Accessibility & Keyboard Interaction Contracts

| Component | ARIA Role & Attributes | Keyboard Handlers | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **`Button`** | `role="button"`, `aria-busy="true"` (when loading), `aria-disabled="true"` | `Enter`, `Space` | Activates action; ignores rapid multi-clicks when loading/disabled. |
| **`Input`** | `aria-invalid="true"` (on error), `aria-describedby="[error-id]"` | `Tab` | Traps no focus; focus halo displays clearly; Esc clears if search. |
| **`Checkbox`** | `role="checkbox"`, `aria-checked="true\|false"` | `Space` | Toggles state; focus outlines 4px rectilinear box. |
| **`Switch`** | `role="switch"`, `aria-checked="true\|false"` | `Space`, `Enter` | Toggles state; announces status change to screen readers. |
| **`Dialog`** | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` | `Escape`, `Tab` (trapped) | Traps tab focus inside dialog; Escape key closes; body scroll locked. |
| **`Tabs`** | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` | `ArrowLeft`, `ArrowRight`, `Home`, `End` | Shifts focus between tabs; updates active panel. |
| **`StatusDot`** | `aria-label="[Status: Operational]"` | N/A | Accessible text read by screen reader; visual 6px luminous dot. |
| **`Alert`** | `role="alert"` (for errors), `role="status"` (for info/success) | N/A | Screen reader immediately announces alert content. |
| **`Tooltip`** | `role="tooltip"`, `aria-describedby` on trigger | `Escape` | Dismisses on Escape; appears on focus or hover. |

---

## 3. Theme Variable Contracts

All components strictly consume CSS Custom Properties declared in `apps/web/src/app/globals.css`:
- Canvas / Base: `var(--bg-canvas)`
- Surfaces: `var(--bg-panel)`, `var(--bg-subtle)`, `var(--bg-hover)`, `var(--bg-active)`
- Hairlines & Borders: `var(--border-subtle)` (`#1f242d` dark / `#eaecef` light), `var(--border-strong)`
- Brand Colors: `var(--primary)` (`#fad734`), `var(--accent-1)` (`#b29527`), `var(--accent-3)` (`#f6465d`), `var(--accent-4)` (`#2ebd85`)
- Typography: `var(--text-main)` (`#ffffff` dark / `#000000` light), `var(--text-sub)`, `var(--text-dim)`, `var(--text-on-primary)` (`#000000`)
- Radii: `var(--radius-xs)` (4px), `var(--radius-sm)` (6px), `var(--radius-md)` (8px)
- Focus Rings: `var(--ring-focus)` (`rgba(250, 215, 52, 0.35)`)
