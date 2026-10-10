'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  forwardRef,
  cloneElement,
  isValidElement,
  Children,
} from 'react';
import { PALETTE, THEME, SPACING, RADII, TYPOGRAPHY } from '../../lib/theme';
import { Tooltip } from './tooltip';

// ============================================================================
// CONSTANTS & COOKIE HELPERS
// ============================================================================

export const SIDEBAR_COOKIE_NAME = 'sidebar_state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const SIDEBAR_WIDTH = '256px';
export const SIDEBAR_WIDTH_ICON = '48px';
export const SIDEBAR_WIDTH_MOBILE = '280px';
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

function getCookieState(): boolean | null {
  if (typeof document === 'undefined') return null;
  const regex = new RegExp(String.raw`(^|;\s*)${SIDEBAR_COOKIE_NAME}=([^;]*)`);
  const match = regex.exec(document.cookie);
  if (!match?.[2]) return null;
  return match[2] === 'expanded' || match[2] === 'true';
}

function setCookieState(expanded: boolean) {
  if (typeof document === 'undefined') return;
  const val = expanded ? 'expanded' : 'collapsed';
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${val}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    localStorage.setItem(SIDEBAR_COOKIE_NAME, val);
  } catch {
    // localStorage may be disabled or restricted
  }
}

// ============================================================================
// SIDEBAR CONTEXT & HOOK
// ============================================================================

export interface SidebarContextValue {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((value: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

// ============================================================================
// 1. SIDEBAR PROVIDER
// ============================================================================

export interface SidebarProviderProps {
  defaultOpen?: boolean | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children: React.ReactNode;
}

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
}: Readonly<SidebarProviderProps>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(() => {
    const cookieVal = getCookieState();
    return cookieVal ?? defaultOpen;
  });

  const [openMobile, setOpenMobile] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Responsive mobile media query listener (<768px)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => {
      const mobile = mql.matches;
      setIsMobile(mobile);
      if (!mobile) {
        setOpenMobile(false);
      }
    };
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const isOpen = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (value: boolean | ((val: boolean) => boolean)) => {
      const resolved = typeof value === 'function' ? value(isOpen) : value;
      if (controlledOpen === undefined) {
        setUncontrolledOpen(resolved);
      }
      setCookieState(resolved);
      onOpenChange?.(resolved);
    },
    [controlledOpen, isOpen, onOpenChange]
  );

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  }, [isMobile, setOpen]);

  // Global keyboard shortcut: Cmd+B / Ctrl+B
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        !e.defaultPrevented
      ) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const state = isOpen ? 'expanded' : 'collapsed';

  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      state,
      open: isOpen,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, isOpen, setOpen, openMobile, isMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        className={className}
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            display: 'flex',
            minHeight: '100svh',
            width: '100%',
            position: 'relative',
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            ...style,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// ============================================================================
// 2. ROOT SIDEBAR COMPONENT (Two-Layer Fixed + Gap Architecture)
// ============================================================================

export type SidebarSide = 'left' | 'right';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  side?: SidebarSide | undefined;
  variant?: SidebarVariant | undefined;
  collapsible?: SidebarCollapsible | undefined;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  {
    side = 'left',
    variant = 'sidebar',
    collapsible = 'icon',
    className,
    style,
    children,
    ...props
  },
  ref
) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobile || !openMobile || typeof window === 'undefined') return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMobile(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobile, openMobile, setOpenMobile]);

  if (collapsible === 'none') {
    return (
      <nav
        ref={ref}
        aria-label="Sidebar Navigation"
        data-slot="sidebar"
        data-sidebar="sidebar"
        data-state="expanded"
        data-collapsible="none"
        data-variant={variant}
        data-side={side}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          height: '100svh',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          borderRight:
            side === 'left'
              ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
              : undefined,
          borderLeft:
            side === 'right'
              ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
              : undefined,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </nav>
    );
  }

  // Mobile Sheet Drawer Presentation (<768px)
  if (isMobile) {
    let mobileTransform = 'translateX(0)';
    if (!openMobile) {
      mobileTransform = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    }

    return (
      <>
        {openMobile && (
          <div
            data-slot="sidebar-backdrop"
            onClick={() => setOpenMobile(false)}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(2px)',
              transition: 'opacity 150ms ease',
            }}
          />
        )}
        <nav
          ref={ref}
          aria-label="Sidebar Navigation"
          data-slot="sidebar"
          data-sidebar="sidebar"
          data-mobile="true"
          data-state={openMobile ? 'open' : 'closed'}
          data-side={side}
          className={className}
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            [side]: 0,
            width: SIDEBAR_WIDTH_MOBILE,
            maxWidth: '85vw',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            borderRight:
              side === 'left'
                ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                : undefined,
            borderLeft:
              side === 'right'
                ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                : undefined,
            boxShadow: `var(--shadow-elevated, ${THEME.default.shadows.elevated})`,
            transform: mobileTransform,
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            visibility: openMobile ? 'visible' : 'hidden',
            boxSizing: 'border-box',
            ...style,
          }}
          {...props}
        >
          {children}
        </nav>
      </>
    );
  }

  // Desktop Two-Layer Architecture (Normal-flow gap + Fixed full-height container)
  let desktopWidth = SIDEBAR_WIDTH;
  if (collapsible === 'icon' && isCollapsed) {
    desktopWidth = SIDEBAR_WIDTH_ICON;
  } else if (collapsible === 'offcanvas' && isCollapsed) {
    desktopWidth = '0px';
  }

  const isFloating = variant === 'floating';

  return (
    <nav
      ref={ref}
      aria-label="Sidebar Navigation"
      data-state={state}
      data-collapsible={collapsible}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
      className={className}
      style={{
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      {/* 1. Normal-flow width spacer that pushes SidebarInset smoothly */}
      <div
        data-slot="sidebar-gap"
        style={{
          width: desktopWidth,
          minWidth: desktopWidth,
          transition: 'width 200ms linear, min-width 200ms linear',
          flexShrink: 0,
        }}
      />

      {/* 2. Fixed full-height container with overflow: visible so tooltips & popovers never clip */}
      <div
        data-slot="sidebar-container"
        data-side={side}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [side]: collapsible === 'offcanvas' && isCollapsed ? `calc(${SIDEBAR_WIDTH} * -1)` : 0,
          width: desktopWidth,
          height: '100svh',
          zIndex: 30,
          display: 'flex',
          transition: 'left 200ms linear, right 200ms linear, width 200ms linear',
          padding: isFloating || variant === 'inset' ? SPACING.sm : 0,
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            borderRight:
              side === 'left' && !isFloating && variant !== 'inset'
                ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                : undefined,
            borderLeft:
              side === 'right' && !isFloating && variant !== 'inset'
                ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                : undefined,
            border: isFloating
              ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
              : undefined,
            borderRadius: isFloating ? RADII.md : undefined,
            boxShadow: isFloating
              ? `var(--shadow-card, ${THEME.default.shadows.card})`
              : undefined,
            position: 'relative',
            overflow: 'visible',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </nav>
  );
});

// ============================================================================
// 3. STRUCTURAL SECTIONS (Header, Content, Footer, Inset, Input)
// ============================================================================

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarHeader = forwardRef<HTMLDivElement, SidebarHeaderProps>(
  function SidebarHeader({ className, style, children, ...props }, ref) {
    return (
      <header
        ref={ref}
        data-slot="sidebar-header"
        data-sidebar="header"
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          padding: SPACING.sm,
          boxSizing: 'border-box',
          flexShrink: 0,
          ...style,
        }}
        {...props}
      >
        {children}
      </header>
    );
  }
);

export interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarContent = forwardRef<HTMLDivElement, SidebarContentProps>(
  function SidebarContent({ className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    return (
      <div
        ref={ref}
        data-slot="sidebar-content"
        data-sidebar="content"
        className={className}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
          overflowY: isCollapsed ? 'visible' : 'auto',
          overflowX: isCollapsed ? 'visible' : 'hidden',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarFooter = forwardRef<HTMLDivElement, SidebarFooterProps>(
  function SidebarFooter({ className, style, children, ...props }, ref) {
    return (
      <footer
        ref={ref}
        data-slot="sidebar-footer"
        data-sidebar="footer"
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          padding: SPACING.sm,
          boxSizing: 'border-box',
          flexShrink: 0,
          ...style,
        }}
        {...props}
      >
        {children}
      </footer>
    );
  }
);

export interface SidebarInsetProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarInset = forwardRef<HTMLDivElement, SidebarInsetProps>(
  function SidebarInset({ className, style, children, ...props }, ref) {
    return (
      <main
        ref={ref}
        data-slot="sidebar-inset"
        className={className}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: '100svh',
          width: '100%',
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </main>
    );
  }
);

export interface SidebarInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SidebarInput = forwardRef<HTMLInputElement, SidebarInputProps>(
  function SidebarInput({ className, style, ...props }, ref) {
    return (
      <input
        ref={ref}
        data-slot="sidebar-input"
        data-sidebar="input"
        className={className}
        style={{
          height: '32px',
          width: '100%',
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.sm,
          padding: `0 ${SPACING.sm}`,
          fontSize: '0.875rem',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      />
    );
  }
);

// ============================================================================
// 4. GROUP PRIMITIVES
// ============================================================================

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarGroup = forwardRef<HTMLDivElement, SidebarGroupProps>(
  function SidebarGroup({ className, style, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="sidebar-group"
        data-sidebar="group"
        className={className}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
          padding: SPACING.sm,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean | undefined;
}

export const SidebarGroupLabel = forwardRef<HTMLDivElement, SidebarGroupLabelProps>(
  function SidebarGroupLabel({ asChild = false, className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    const labelStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '32px',
      flexShrink: 0,
      borderRadius: RADII.sm,
      padding: `0 ${SPACING.sm}`,
      fontSize: '0.75rem',
      fontWeight: TYPOGRAPHY.weights.medium,
      color: `var(--text-dim, ${THEME.default.text.muted})`,
      transition: 'margin 200ms linear, opacity 200ms linear',
      marginTop: isCollapsed ? '-32px' : 0,
      opacity: isCollapsed ? 0 : 1,
      pointerEvents: isCollapsed ? 'none' : undefined,
      overflow: 'hidden',
      userSelect: 'none',
      boxSizing: 'border-box',
      ...style,
    };

    if (asChild && isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cloneElement(children as React.ReactElement<any>, {
        'data-slot': 'sidebar-group-label',
        'data-sidebar': 'group-label',
        style: labelStyle,
      });
    }

    return (
      <div
        ref={ref}
        data-slot="sidebar-group-label"
        data-sidebar="group-label"
        className={className}
        style={labelStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export interface SidebarGroupActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean | undefined;
}

export const SidebarGroupAction = forwardRef<HTMLButtonElement, SidebarGroupActionProps>(
  function SidebarGroupAction({ asChild = false, className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';
    const [isHovered, setIsHovered] = useState(false);

    if (isCollapsed) return null;

    const actionStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: RADII.xs,
      border: 'none',
      backgroundColor: isHovered
        ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
        : 'transparent',
      color: isHovered
        ? `var(--text-main, ${THEME.default.text.primary})`
        : `var(--text-dim, ${THEME.default.text.muted})`,
      cursor: 'pointer',
      padding: 0,
      transition: 'all 0.12s ease',
      ...style,
    };

    if (asChild && isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cloneElement(children as React.ReactElement<any>, {
        'data-slot': 'sidebar-group-action',
        'data-sidebar': 'group-action',
        style: actionStyle,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-group-action"
        data-sidebar="group-action"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={actionStyle}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export interface SidebarGroupContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarGroupContent = forwardRef<HTMLDivElement, SidebarGroupContentProps>(
  function SidebarGroupContent({ className, style, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-group-content"
        data-sidebar="group-content"
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          fontSize: '0.875rem',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// 5. COLLAPSIBLE DISCLOSURE PRIMITIVES (Collapsible, Trigger, Content)
// ============================================================================

export interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggle: () => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

export function useCollapsible(): CollapsibleContextValue {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error('useCollapsible must be used within a Collapsible');
  }
  return context;
}

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  disabled?: boolean | undefined;
  asChild?: boolean | undefined;
}

export const Collapsible = forwardRef<HTMLDivElement, CollapsibleProps>(function Collapsible(
  {
    open: controlledOpen,
    defaultOpen = true,
    onOpenChange,
    disabled = false,
    asChild = false,
    className,
    style,
    children,
    ...props
  },
  ref
) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (disabled) return;
      if (controlledOpen === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlledOpen, disabled, onOpenChange]
  );

  const toggle = useCallback(() => {
    handleOpenChange(!isOpen);
  }, [handleOpenChange, isOpen]);

  const contextValue = useMemo<CollapsibleContextValue>(
    () => ({
      open: isOpen,
      onOpenChange: handleOpenChange,
      toggle,
    }),
    [isOpen, handleOpenChange, toggle]
  );

  const dataState = isOpen ? 'open' : 'closed';

  if (asChild && isValidElement(children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (
      <CollapsibleContext.Provider value={contextValue}>
        {cloneElement(children as React.ReactElement<any>, {
          'data-slot': 'collapsible',
          'data-state': dataState,
        })}
      </CollapsibleContext.Provider>
    );
  }

  return (
    <CollapsibleContext.Provider value={contextValue}>
      <div
        ref={ref}
        data-slot="collapsible"
        data-state={dataState}
        className={className}
        style={style}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
});

export interface CollapsibleTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean | undefined;
}

export const CollapsibleTrigger = forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  function CollapsibleTrigger({ asChild = false, onClick, children, ...props }, ref) {
    const { open, toggle } = useCollapsible();
    const dataState = open ? 'open' : 'closed';

    if (asChild && isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const childElement = children as React.ReactElement<any>;
      return cloneElement(childElement, {
        'data-slot': 'collapsible-trigger',
        'data-state': dataState,
        'aria-expanded': open,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          toggle();
          childElement.props.onClick?.(e);
          onClick?.(e);
        },
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="collapsible-trigger"
        data-state={dataState}
        aria-expanded={open}
        onClick={(e) => {
          toggle();
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CollapsibleContent = forwardRef<HTMLDivElement, CollapsibleContentProps>(
  function CollapsibleContent({ className, style, children, ...props }, ref) {
    const { open } = useCollapsible();

    if (!open) return null;

    return (
      <div
        ref={ref}
        data-slot="collapsible-content"
        data-state="open"
        className={className}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// 6. MENU PRIMITIVES
// ============================================================================

export interface SidebarMenuProps extends React.HTMLAttributes<HTMLUListElement> {}

export const SidebarMenu = forwardRef<HTMLUListElement, SidebarMenuProps>(
  function SidebarMenu({ className, style, children, ...props }, ref) {
    return (
      <ul
        ref={ref}
        role="menu"
        data-slot="sidebar-menu"
        data-sidebar="menu"
        className={className}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          width: '100%',
          minWidth: 0,
          ...style,
        }}
        {...props}
      >
        {children}
      </ul>
    );
  }
);

export interface SidebarMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {}

export const SidebarMenuItem = forwardRef<HTMLLIElement, SidebarMenuItemProps>(
  function SidebarMenuItem({ className, style, children, ...props }, ref) {
    return (
      <li
        ref={ref}
        role="none"
        data-slot="sidebar-menu-item"
        data-sidebar="menu-item"
        className={className}
        style={{
          position: 'relative',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          width: '100%',
          ...style,
        }}
        {...props}
      >
        {children}
      </li>
    );
  }
);

export type SidebarMenuButtonSize = 'default' | 'sm' | 'md' | 'lg';
export type SidebarMenuButtonVariant = 'default' | 'outline';

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean | undefined;
  variant?: SidebarMenuButtonVariant | undefined;
  size?: SidebarMenuButtonSize | undefined;
  tooltip?: string | undefined;
  leftIcon?: React.ReactNode | undefined;
  rightIcon?: React.ReactNode | undefined;
  asChild?: boolean | undefined;
}

export const SidebarMenuButton = forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  function SidebarMenuButton(
    {
      isActive = false,
      variant = 'default',
      size = 'default',
      tooltip,
      leftIcon,
      rightIcon,
      asChild = false,
      className,
      style,
      children,
      ...props
    },
    ref
  ) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';
    const [isHovered, setIsHovered] = useState(false);

    let height = '32px';
    if (size === 'sm') {
      height = '28px';
    } else if (size === 'lg') {
      height = '48px';
    }
    const fontSize = size === 'sm' ? '0.75rem' : '0.875rem';

    let bg = 'transparent';
    let textColor = `var(--text-sub, ${THEME.default.text.secondary})`;
    let iconColor = `var(--text-sub, ${THEME.default.text.secondary})`;
    if (isActive) {
      bg = `var(--bg-active, ${THEME.default.surfaces.active})`;
      textColor = `var(--text-main, ${THEME.default.text.primary})`;
      iconColor = PALETTE.primary;
    } else if (isHovered) {
      bg = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
      textColor = `var(--text-main, ${THEME.default.text.primary})`;
      iconColor = `var(--text-main, ${THEME.default.text.primary})`;
    }

    let borderStyle = 'none';
    if (variant === 'outline') {
      borderStyle = `1px solid ${
        isActive ? PALETTE.primary : `var(--border-subtle, ${THEME.default.borders.hairline})`
      }`;
    }

    // In collapsed icon mode (48px rail with 8px group/header/footer padding = 32px inner slot):
    // Button becomes a 32x32 square; size="lg" uses padding: 0 so a 32x32 avatar/logo fills it cleanly.
    const buttonWidth = isCollapsed ? '32px' : '100%';
    const buttonHeight = isCollapsed ? '32px' : height;
    let buttonPadding = `0 ${SPACING.sm}`;
    if (isCollapsed) {
      buttonPadding = size === 'lg' ? '0px' : SPACING.sm;
    }

    // Determine rendered children when leftIcon is not used
    const childArray = Children.toArray(children);
    const collapsedDirectChild =
      isCollapsed && !leftIcon && childArray.length > 1 ? childArray[0] : children;

    const buttonStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      gap: isCollapsed ? 0 : SPACING.sm,
      width: buttonWidth,
      height: buttonHeight,
      margin: isCollapsed ? '0 auto' : 0,
      padding: buttonPadding,
      borderRadius: RADII.sm,
      border: borderStyle,
      backgroundColor: bg,
      color: textColor,
      fontSize,
      fontWeight: isActive ? TYPOGRAPHY.weights.medium : TYPOGRAPHY.weights.regular,
      cursor: 'pointer',
      textAlign: 'left',
      textDecoration: 'none',
      boxSizing: 'border-box',
      position: 'relative',
      transition: 'width 200ms linear, height 200ms linear, padding 200ms linear, background-color 120ms ease, color 120ms ease',
      outline: 'none',
      overflow: 'hidden',
      ...style,
    };

    const innerContent = (
      <>
        {isActive && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: isCollapsed ? '0px' : '2px',
              top: '6px',
              bottom: '6px',
              width: '3px',
              borderRadius: RADII.xs,
              backgroundColor: PALETTE.primary,
            }}
          />
        )}

        {leftIcon ? (
          <>
            <span
              data-sidebar-icon="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '16px',
                height: '16px',
                color: iconColor,
              }}
            >
              {leftIcon}
            </span>

            {!isCollapsed && (
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {children}
              </span>
            )}

            {!isCollapsed && rightIcon && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginLeft: 'auto',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                {rightIcon}
              </span>
            )}
          </>
        ) : (
          collapsedDirectChild
        )}
      </>
    );

    const buttonElement =
      asChild && isValidElement(children) ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cloneElement(children as React.ReactElement<any>, {
          'data-slot': 'sidebar-menu-button',
          'data-sidebar': 'menu-button',
          'data-size': size,
          'data-active': isActive ? 'true' : 'false',
          'data-collapsed': isCollapsed ? 'true' : 'false',
          role: 'menuitem',
          'aria-current': isActive ? 'page' : undefined,
          style: buttonStyle,
        })
      ) : (
        <button
          ref={ref}
          type="button"
          role="menuitem"
          data-slot="sidebar-menu-button"
          data-sidebar="menu-button"
          data-size={size}
          data-active={isActive ? 'true' : 'false'}
          data-collapsed={isCollapsed ? 'true' : 'false'}
          aria-current={isActive ? 'page' : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={className}
          style={buttonStyle}
          {...props}
        >
          {innerContent}
        </button>
      );

    if (isCollapsed && tooltip) {
      return (
        <Tooltip content={tooltip} side="right">
          {buttonElement}
        </Tooltip>
      );
    }

    return buttonElement;
  }
);

export interface SidebarMenuActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showOnHover?: boolean | undefined;
  asChild?: boolean | undefined;
}

export const SidebarMenuAction = forwardRef<HTMLButtonElement, SidebarMenuActionProps>(
  function SidebarMenuAction(
    { showOnHover = false, asChild = false, className, style, children, onClick, ...props },
    ref
  ) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';
    const [isHovered, setIsHovered] = useState(false);

    if (isCollapsed) return null;

    const actionStyle: React.CSSProperties = {
      position: 'absolute',
      right: SPACING.xs,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: RADII.xs,
      border: 'none',
      backgroundColor: isHovered
        ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
        : 'transparent',
      color: isHovered
        ? `var(--text-main, ${THEME.default.text.primary})`
        : `var(--text-dim, ${THEME.default.text.muted})`,
      opacity: showOnHover && !isHovered ? 0 : 1,
      cursor: 'pointer',
      padding: 0,
      transition: 'all 0.12s ease',
      ...style,
    };

    if (asChild && isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cloneElement(children as React.ReactElement<any>, {
        'data-slot': 'sidebar-menu-action',
        'data-sidebar': 'menu-action',
        style: actionStyle,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-menu-action"
        data-sidebar="menu-action"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={actionStyle}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export interface SidebarMenuBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const SidebarMenuBadge = forwardRef<HTMLSpanElement, SidebarMenuBadgeProps>(
  function SidebarMenuBadge({ className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    if (isCollapsed) return null;

    return (
      <span
        ref={ref}
        data-slot="sidebar-menu-badge"
        data-sidebar="menu-badge"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '18px',
          minWidth: '18px',
          padding: `0 ${SPACING.xs}`,
          borderRadius: RADII.xs, // Crisp 4px corner, strictly NOT a pill badge
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.medium,
          fontFeatureSettings: TYPOGRAPHY.tabularNums,
          lineHeight: 1,
          boxSizing: 'border-box',
          marginLeft: 'auto',
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

export interface SidebarMenuSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  showIcon?: boolean | undefined;
}

export const SidebarMenuSkeleton = forwardRef<HTMLDivElement, SidebarMenuSkeletonProps>(
  function SidebarMenuSkeleton({ showIcon = false, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-menu-skeleton"
        data-sidebar="menu-skeleton"
        className={className}
        style={{
          display: 'flex',
          height: '32px',
          alignItems: 'center',
          gap: SPACING.sm,
          borderRadius: RADII.sm,
          padding: `0 ${SPACING.sm}`,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {showIcon && (
          <div
            data-sidebar="menu-skeleton-icon"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: RADII.xs,
              backgroundColor: `var(--bg-hover, ${THEME.default.surfaces.hover})`,
              flexShrink: 0,
            }}
          />
        )}
        <div
          data-sidebar="menu-skeleton-text"
          style={{
            height: '16px',
            flex: 1,
            maxWidth: '75%',
            borderRadius: RADII.xs,
            backgroundColor: `var(--bg-hover, ${THEME.default.surfaces.hover})`,
          }}
        />
      </div>
    );
  }
);

// ============================================================================
// 7. SUBMENU PRIMITIVES
// ============================================================================

export interface SidebarMenuSubProps extends React.HTMLAttributes<HTMLUListElement> {}

export const SidebarMenuSub = forwardRef<HTMLUListElement, SidebarMenuSubProps>(
  function SidebarMenuSub({ className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    if (isCollapsed) return null;

    return (
      <ul
        ref={ref}
        role="menu"
        data-slot="sidebar-menu-sub"
        data-sidebar="menu-sub"
        className={className}
        style={{
          listStyle: 'none',
          margin: `2px ${SPACING.md} 2px 14px`,
          padding: `2px 0 2px 10px`,
          borderLeft: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: 0,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </ul>
    );
  }
);

export interface SidebarMenuSubItemProps extends React.LiHTMLAttributes<HTMLLIElement> {}

export const SidebarMenuSubItem = forwardRef<HTMLLIElement, SidebarMenuSubItemProps>(
  function SidebarMenuSubItem({ className, style, children, ...props }, ref) {
    return (
      <li
        ref={ref}
        role="none"
        data-slot="sidebar-menu-sub-item"
        data-sidebar="menu-sub-item"
        className={className}
        style={{
          position: 'relative',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          width: '100%',
          ...style,
        }}
        {...props}
      >
        {children}
      </li>
    );
  }
);

export interface SidebarMenuSubButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean | undefined;
  size?: 'sm' | 'md' | undefined;
  asChild?: boolean | undefined;
}

export const SidebarMenuSubButton = forwardRef<HTMLButtonElement, SidebarMenuSubButtonProps>(
  function SidebarMenuSubButton(
    { isActive = false, size = 'md', asChild = false, className, style, children, ...props },
    ref
  ) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';
    const [isHovered, setIsHovered] = useState(false);

    if (isCollapsed) return null;

    let bg = 'transparent';
    let textColor = `var(--text-sub, ${THEME.default.text.secondary})`;
    if (isActive) {
      bg = `var(--bg-active, ${THEME.default.surfaces.active})`;
      textColor = `var(--text-main, ${THEME.default.text.primary})`;
    } else if (isHovered) {
      bg = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
      textColor = `var(--text-main, ${THEME.default.text.primary})`;
    }

    const subButtonStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: SPACING.sm,
      width: '100%',
      minWidth: 0,
      height: '28px',
      padding: `0 ${SPACING.sm}`,
      borderRadius: RADII.sm,
      border: 'none',
      backgroundColor: bg,
      color: textColor,
      fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
      fontWeight: isActive ? TYPOGRAPHY.weights.medium : TYPOGRAPHY.weights.regular,
      cursor: 'pointer',
      textAlign: 'left',
      textDecoration: 'none',
      boxSizing: 'border-box',
      transition: 'all 0.12s ease',
      outline: 'none',
      overflow: 'hidden',
      ...style,
    };

    if (asChild && isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cloneElement(children as React.ReactElement<any>, {
        'data-slot': 'sidebar-menu-sub-button',
        'data-sidebar': 'menu-sub-button',
        'data-size': size,
        'data-active': isActive ? 'true' : 'false',
        role: 'menuitem',
        'aria-current': isActive ? 'page' : undefined,
        style: subButtonStyle,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        data-slot="sidebar-menu-sub-button"
        data-sidebar="menu-sub-button"
        data-size={size}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={subButtonStyle}
        {...props}
      >
        <span
          style={{
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {children}
        </span>
      </button>
    );
  }
);

// ============================================================================
// 8. RAIL, TRIGGER & SEPARATOR
// ============================================================================

export interface SidebarRailProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarRail = forwardRef<HTMLButtonElement, SidebarRailProps>(
  function SidebarRail({ className, style, ...props }, ref) {
    const { toggleSidebar, state } = useSidebar();
    const isCollapsed = state === 'collapsed';

    return (
      <button
        ref={ref}
        type="button"
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle Sidebar Rail"
        title="Toggle Sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          right: '-8px',
          bottom: 0,
          width: '16px',
          border: 'none',
          padding: 0,
          cursor: isCollapsed ? 'e-resize' : 'w-resize',
          backgroundColor: 'transparent',
          zIndex: 20,
          outline: 'none',
          ...style,
        }}
        {...props}
      />
    );
  }
);

export interface SidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarTrigger = forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  function SidebarTrigger({ className, style, onClick, ...props }, ref) {
    const { toggleSidebar, state } = useSidebar();
    const [isHovered, setIsHovered] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        aria-label="Toggle Sidebar"
        aria-expanded={state === 'expanded'}
        onClick={(e) => {
          toggleSidebar();
          onClick?.(e);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: RADII.sm,
          border: 'none',
          backgroundColor: isHovered
            ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
            : 'transparent',
          color: isHovered
            ? `var(--text-main, ${THEME.default.text.primary})`
            : `var(--text-sub, ${THEME.default.text.secondary})`,
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.12s ease',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
    );
  }
);

export interface SidebarSeparatorProps
  extends React.HTMLAttributes<HTMLHRElement> {}

export const SidebarSeparator = forwardRef<HTMLHRElement, SidebarSeparatorProps>(
  function SidebarSeparator({ className, style, ...props }, ref) {
    return (
      <hr
        ref={ref}
        data-sidebar="separator"
        data-slot="sidebar-separator"
        className={className}
        style={{
          height: '1px',
          width: 'auto',
          border: 'none',
          backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
          margin: `${SPACING.xs} ${SPACING.sm}`,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      />
    );
  }
);
