import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
  content?: React.ReactNode;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  items?: TabItem[];
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: React.ReactNode;
}

interface TabsContextValue {
  selectedValue: string;
  setSelectedValue: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  items,
  children,
  className = '',
  style,
}: Readonly<TabsProps>) {
  const initialValue = defaultValue || items?.[0]?.id || '';
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);
  const selectedValue = controlledValue ?? uncontrolledValue;

  const handleSelect = useCallback(
    (val: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
    },
    [controlledValue, onValueChange]
  );

  const contextValue = useMemo(
    () => ({ selectedValue, setSelectedValue: handleSelect }),
    [selectedValue, handleSelect]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={`fbu-tabs ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          fontFamily: TYPOGRAPHY.fontFamily,
          ...style,
        }}
      >
        {items && items.length > 0 ? (
          <>
            <TabsList>
              {items.map((item) => (
                <TabsTrigger key={item.id} value={item.id} disabled={Boolean(item.disabled)}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {items.map((item) => (
              <TabsContent key={item.id} value={item.id}>
                {item.content}
              </TabsContent>
            ))}
          </>
        ) : (
          children
        )}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', style, children, ...props }: Readonly<TabsListProps>) {
  return (
    <div
      role="tablist"
      className={`fbu-tabs-list ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        gap: SPACING.md,
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  disabled = false,
  className = '',
  style,
  children,
  ...props
}: Readonly<TabsTriggerProps>) {
  const ctx = useContext(TabsContext);
  const isSelected = ctx?.selectedValue === value;

  const handleClick = () => {
    if (disabled) return;
    ctx?.setSelectedValue(value);
  };

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`panel-${value}`}
      disabled={disabled}
      onClick={handleClick}
      className={`fbu-tabs-trigger ${isSelected ? 'is-active' : ''} ${className}`}
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        padding: `${SPACING.sm} ${SPACING.xs}`,
        marginBottom: '-1px',
        borderBottom: isSelected ? `2px solid ${PALETTE.primary}` : '2px solid transparent',
        color: isSelected ? 'var(--text-main)' : 'var(--text-sub)',
        fontWeight: isSelected ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
        fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'color 0.15s ease, border-color 0.15s ease',
        outline: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className = '',
  style,
  children,
  ...props
}: Readonly<TabsContentProps>) {
  const ctx = useContext(TabsContext);
  const isSelected = ctx?.selectedValue === value;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={`fbu-tabs-content ${className}`}
      style={{
        paddingTop: SPACING.lg,
        outline: 'none',
        color: 'var(--text-main)',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
