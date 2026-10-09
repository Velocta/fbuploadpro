import React, { cloneElement, useId, useState } from 'react';
import { RADII, SPACING, TYPOGRAPHY } from '../../lib/theme';

export interface TooltipProps {
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactElement<any>;
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  defaultOpen?: boolean;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  open,
  defaultOpen = false,
}: TooltipProps) {
  const tooltipId = useId();
  const [uncontrolledVisible, setUncontrolledVisible] = useState(defaultOpen);
  const isVisible = open !== undefined ? open : uncontrolledVisible;
  const setIsVisible = (val: boolean) => {
    if (open === undefined) {
      setUncontrolledVisible(val);
    }
  };

  const getPositionStyles = (): React.CSSProperties => {
    switch (side) {
      case 'bottom':
        return {
          top: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: '50%',
          right: 'calc(100% + 6px)',
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: '50%',
          left: 'calc(100% + 6px)',
          transform: 'translateY(-50%)',
        };
      case 'top':
      default:
        return {
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
        };
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsVisible(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childProps = children.props as Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trigger = cloneElement(children, {
    'aria-describedby': isVisible ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      setIsVisible(true);
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      setIsVisible(false);
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      setIsVisible(true);
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      setIsVisible(false);
      childProps.onBlur?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      handleKeyDown(e);
      childProps.onKeyDown?.(e);
    },
  } as any);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {trigger}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 10000,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            padding: `4px ${SPACING.sm}`,
            borderRadius: RADII.xs,
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-main)',
            fontSize: '0.75rem',
            fontFamily: TYPOGRAPHY.fontFamily,
            fontWeight: TYPOGRAPHY.weights.regular,
            boxShadow: 'var(--shadow-elevated)',
            lineHeight: 1.25,
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
