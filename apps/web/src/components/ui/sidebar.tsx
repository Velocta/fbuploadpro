'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  forwardRef,
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
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${SIDEBAR_COOKIE_NAME}=([^;]*)`));
  if (!match || !match[2]) return null;
  return match[2] === 'expanded';
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
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
}: SidebarProviderProps) {
  // Determine initial state: prop -> cookie -> true
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(() => {
    const cookieVal = getCookieState();
    return cookieVal !== null ? cookieVal : defaultOpen;
  });

  const [openMobile, setOpenMobile] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Responsive mobile media query listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
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

  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

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
        className={className}
        style={{
          display: 'flex',
          minHeight: '100vh',
          width: '100%',
          position: 'relative',
          backgroundColor: THEME.default.surfaces.canvas,
          color: THEME.default.text.primary,
          ...style,
        }}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// ============================================================================
// 2. ROOT SIDEBAR COMPONENT
// ============================================================================

export type SidebarSide = 'left' | 'right';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  side?: SidebarSide;
  variant?: SidebarVariant;
  collapsible?: SidebarCollapsible;
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

  // Desktop width computation
  let desktopWidth = SIDEBAR_WIDTH;
  if (collapsible === 'icon' && isCollapsed) {
    desktopWidth = SIDEBAR_WIDTH_ICON;
  } else if (collapsible === 'offcanvas' && isCollapsed) {
    desktopWidth = '0px';
  }

  // Variant styling adjustments
  const isFloating = variant === 'floating';
  const isInset = variant === 'inset';

  // Mobile drawer presentation
  if (isMobile) {
    return (
      <>
        {/* Mobile Backdrop */}
        {openMobile && (
          <div
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
        {/* Mobile Sheet Panel */}
        <aside
          ref={ref}
          role="navigation"
          aria-label="Sidebar Navigation"
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
            backgroundColor: THEME.default.surfaces.panel,
            borderRight: side === 'left' ? `1px solid ${THEME.default.borders.hairline}` : undefined,
            borderLeft: side === 'right' ? `1px solid ${THEME.default.borders.hairline}` : undefined,
            boxShadow: THEME.default.shadows.elevated,
            transform: openMobile
              ? 'translateX(0)'
              : side === 'left'
              ? 'translateX(-100%)'
              : 'translateX(100%)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            visibility: openMobile ? 'visible' : 'hidden',
            ...style,
          }}
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }

  // Desktop Presentation
  return (
    <aside
      ref={ref}
      role="navigation"
      aria-label="Sidebar Navigation"
      aria-expanded={!isCollapsed}
      data-state={state}
      data-collapsible={collapsible}
      data-variant={variant}
      className={className}
      style={{
        position: 'relative',
        width: desktopWidth,
        minWidth: desktopWidth,
        height: isFloating ? `calc(100vh - ${SPACING.xl})` : '100vh',
        margin: isFloating ? SPACING.md : 0,
        borderRadius: isFloating ? RADII.md : undefined,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: THEME.default.surfaces.panel,
        borderRight: side === 'left' ? `1px solid ${THEME.default.borders.hairline}` : undefined,
        borderLeft: side === 'right' ? `1px solid ${THEME.default.borders.hairline}` : undefined,
        boxShadow: isFloating ? THEME.default.shadows.card : undefined,
        transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), min-width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </aside>
  );
});

// ============================================================================
// 3. STRUCTURAL SECTIONS (Header, Content, Footer, Inset)
// ============================================================================

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarHeader = forwardRef<HTMLDivElement, SidebarHeaderProps>(
  function SidebarHeader({ className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    return (
      <header
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: isCollapsed ? `${SPACING.md} ${SPACING.xs}` : SPACING.md,
          borderBottom: `1px solid ${THEME.default.borders.hairline}`,
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
        className={className}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
          padding: isCollapsed ? `${SPACING.sm} ${SPACING.xs}` : `${SPACING.sm} ${SPACING.sm}`,
          overflowY: 'auto',
          overflowX: 'hidden',
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
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    return (
      <footer
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: isCollapsed ? `${SPACING.md} ${SPACING.xs}` : SPACING.md,
          borderTop: `1px solid ${THEME.default.borders.hairline}`,
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
        className={className}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
          backgroundColor: THEME.default.surfaces.canvas,
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
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: `${SPACING.xs} 0`,
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

export interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SidebarGroupLabel = forwardRef<HTMLDivElement, SidebarGroupLabelProps>(
  function SidebarGroupLabel({ className, style, children, ...props }, ref) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';

    if (isCollapsed) {
      return (
        <div
          ref={ref}
          style={{
            height: '1px',
            backgroundColor: THEME.default.borders.hairline,
            margin: `${SPACING.xs} ${SPACING.xs}`,
          }}
          aria-hidden="true"
        />
      );
    }

    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '28px',
          padding: `0 ${SPACING.sm}`,
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: THEME.default.text.muted,
          textTransform: 'uppercase',
          letterSpacing: TYPOGRAPHY.tracking.caption,
          userSelect: 'none',
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

export interface SidebarGroupActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarGroupAction = forwardRef<HTMLButtonElement, SidebarGroupActionProps>(
  function SidebarGroupAction({ className, style, children, ...props }, ref) {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: RADII.xs,
          border: 'none',
          backgroundColor: isHovered ? THEME.default.surfaces.hover : 'transparent',
          color: isHovered ? THEME.default.text.primary : THEME.default.text.muted,
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.12s ease',
          ...style,
        }}
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
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
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
// 5. MENU PRIMITIVES
// ============================================================================

export interface SidebarMenuProps extends React.HTMLAttributes<HTMLUListElement> {}

export const SidebarMenu = forwardRef<HTMLUListElement, SidebarMenuProps>(
  function SidebarMenu({ className, style, children, ...props }, ref) {
    return (
      <ul
        ref={ref}
        role="menu"
        className={className}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          width: '100%',
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

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SidebarMenuButton = forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  function SidebarMenuButton(
    {
      isActive = false,
      variant = 'default',
      size = 'md',
      tooltip,
      leftIcon,
      rightIcon,
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

    const height = size === 'sm' ? '30px' : size === 'lg' ? '40px' : '34px';
    const fontSize = size === 'sm' ? '0.75rem' : '0.875rem';

    // Surface & text styling per state
    let bg = 'transparent';
    let textColor = THEME.default.text.secondary;
    if (isActive) {
      bg = THEME.default.surfaces.active;
      textColor = THEME.default.text.primary;
    } else if (isHovered) {
      bg = THEME.default.surfaces.hover;
      textColor = THEME.default.text.primary;
    }

    const buttonElement = (
      <button
        ref={ref}
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: isCollapsed ? 0 : SPACING.sm,
          width: '100%',
          height,
          padding: isCollapsed ? 0 : `0 ${SPACING.sm}`,
          borderRadius: RADII.sm,
          border:
            variant === 'outline'
              ? `1px solid ${isActive ? PALETTE.primary : THEME.default.borders.hairline}`
              : 'none',
          backgroundColor: bg,
          color: textColor,
          fontSize,
          fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.regular,
          cursor: 'pointer',
          textAlign: 'left',
          textDecoration: 'none',
          boxSizing: 'border-box',
          position: 'relative',
          transition: 'all 0.12s ease',
          outline: 'none',
          ...style,
        }}
        {...props}
      >
        {/* Active bar indicator on left edge (subtle gold keystone) */}
        {isActive && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '2px',
              top: '6px',
              bottom: '6px',
              width: '3px',
              borderRadius: RADII.xs,
              backgroundColor: PALETTE.primary,
            }}
          />
        )}

        {leftIcon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: '18px',
              height: '18px',
              color: isActive ? PALETTE.primary : isHovered ? THEME.default.text.primary : THEME.default.text.secondary,
            }}
          >
            {leftIcon}
          </span>
        )}

        {!isCollapsed && (
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
        )}

        {!isCollapsed && rightIcon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: THEME.default.text.muted,
            }}
          >
            {rightIcon}
          </span>
        )}
      </button>
    );

    // If collapsed and tooltip provided, wrap in Tooltip from Spec 008
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
  showOnHover?: boolean;
}

export const SidebarMenuAction = forwardRef<HTMLButtonElement, SidebarMenuActionProps>(
  function SidebarMenuAction(
    { showOnHover = false, className, style, children, onClick, ...props },
    ref
  ) {
    const { state, isMobile } = useSidebar();
    const isCollapsed = !isMobile && state === 'collapsed';
    const [isHovered, setIsHovered] = useState(false);

    if (isCollapsed) return null;

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          position: 'absolute',
          right: SPACING.xs,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: RADII.xs,
          border: 'none',
          backgroundColor: isHovered ? THEME.default.surfaces.hover : 'transparent',
          color: isHovered ? THEME.default.text.primary : THEME.default.text.muted,
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.12s ease',
          ...style,
        }}
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
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '18px',
          minWidth: '18px',
          padding: `0 ${SPACING.xs}`,
          borderRadius: RADII.xs, // Crisp 4px corner, strictly NOT a pill badge
          backgroundColor: THEME.default.surfaces.subtle,
          border: `1px solid ${THEME.default.borders.hairline}`,
          color: THEME.default.text.secondary,
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.medium,
          fontFeatureSettings: TYPOGRAPHY.tabularNums,
          lineHeight: 1,
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

// ============================================================================
// 6. SUBMENU PRIMITIVES
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
        className={className}
        style={{
          listStyle: 'none',
          margin: `${SPACING.xs} 0 0 ${SPACING.lg}`,
          padding: `0 0 0 ${SPACING.sm}`,
          borderLeft: `1px solid ${THEME.default.borders.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
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
        className={className}
        style={{
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
  isActive?: boolean;
}

export const SidebarMenuSubButton = forwardRef<HTMLButtonElement, SidebarMenuSubButtonProps>(
  function SidebarMenuSubButton(
    { isActive = false, className, style, children, ...props },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);

    let bg = 'transparent';
    let textColor = THEME.default.text.secondary;
    if (isActive) {
      bg = THEME.default.surfaces.active;
      textColor = THEME.default.text.primary;
    } else if (isHovered) {
      bg = THEME.default.surfaces.hover;
      textColor = THEME.default.text.primary;
    }

    return (
      <button
        ref={ref}
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '28px',
          padding: `0 ${SPACING.sm}`,
          borderRadius: RADII.xs,
          border: 'none',
          backgroundColor: bg,
          color: textColor,
          fontSize: '0.8125rem',
          fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.regular,
          cursor: 'pointer',
          textAlign: 'left',
          textDecoration: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.12s ease',
          outline: 'none',
          ...style,
        }}
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
// 7. RAIL & TRIGGER
// ============================================================================

export interface SidebarRailProps extends React.HTMLAttributes<HTMLButtonElement> {}

export const SidebarRail = forwardRef<HTMLButtonElement, SidebarRailProps>(
  function SidebarRail({ className, style, ...props }, ref) {
    const { toggleSidebar } = useSidebar();
    const [isHovered, setIsHovered] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Toggle Sidebar Rail"
        onClick={toggleSidebar}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '4px',
          border: 'none',
          padding: 0,
          cursor: 'col-resize',
          backgroundColor: isHovered ? PALETTE.primary : 'transparent',
          transition: 'background-color 150ms ease',
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
          width: '34px',
          height: '34px',
          borderRadius: RADII.sm,
          border: `1px solid ${THEME.default.borders.hairline}`,
          backgroundColor: isHovered ? THEME.default.surfaces.hover : 'transparent',
          color: isHovered ? THEME.default.text.primary : THEME.default.text.secondary,
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
