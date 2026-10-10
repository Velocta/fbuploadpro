/**
 * @file index.ts
 * @description Root barrel export for reusable UI components in @fbuploadpro/web.
 */

// Forms & Actions (User Story 1)
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

// Surfaces & Overlays (User Story 2)
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from './card';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from './dialog';
export type {
  DialogProps,
  DialogTriggerProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogBodyProps,
  DialogFooterProps,
  DialogCloseProps,
} from './dialog';

// Navigation & Data (User Story 3)
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export type {
  TabsProps,
  TabItem,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
} from './tabs';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './table';
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
} from './table';

// Feedback & Status (User Story 4)
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

// Sidebar Navigation Suite (Spec 014 & Spec 025)
export {
  useSidebar,
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarInput,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  SidebarSeparator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useCollapsible,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from './sidebar';
export type {
  SidebarContextValue,
  SidebarProviderProps,
  SidebarProps,
  SidebarSide,
  SidebarVariant,
  SidebarCollapsible,
  SidebarHeaderProps,
  SidebarContentProps,
  SidebarFooterProps,
  SidebarInsetProps,
  SidebarInputProps,
  SidebarGroupProps,
  SidebarGroupLabelProps,
  SidebarGroupActionProps,
  SidebarGroupContentProps,
  SidebarMenuProps,
  SidebarMenuItemProps,
  SidebarMenuButtonProps,
  SidebarMenuButtonSize,
  SidebarMenuButtonVariant,
  SidebarMenuActionProps,
  SidebarMenuBadgeProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubButtonProps,
  SidebarRailProps,
  SidebarTriggerProps,
  SidebarSeparatorProps,
  CollapsibleContextValue,
  CollapsibleProps,
  CollapsibleTriggerProps,
  CollapsibleContentProps,
} from './sidebar';
