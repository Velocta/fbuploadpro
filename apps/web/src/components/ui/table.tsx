import React, { forwardRef } from 'react';
import { SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children?: React.ReactNode;
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children?: React.ReactNode;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  tabular?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <table
        ref={ref}
        className={`fbu-table ${className}`}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: TYPOGRAPHY.fontFamily,
          fontSize: '0.875rem',
          textAlign: 'left',
          color: 'var(--text-main)',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
});
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(function TableHeader(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <thead
      ref={ref}
      className={`fbu-table-header ${className}`}
      style={{
        borderBottom: '1px solid var(--border-strong)',
        ...style,
      }}
      {...props}
    >
      {children}
    </thead>
  );
});
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(function TableBody(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <tbody
      ref={ref}
      className={`fbu-table-body ${className}`}
      style={{
        ...style,
      }}
      {...props}
    >
      {children}
    </tbody>
  );
});
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <tr
      ref={ref}
      className={`fbu-table-row ${className}`}
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        transition: 'background-color 0.1s ease',
        ...style,
      }}
      {...props}
    >
      {children}
    </tr>
  );
});
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <th
      ref={ref}
      className={`fbu-table-head ${className}`}
      style={{
        padding: `${SPACING.sm} ${SPACING.md}`,
        fontSize: '0.75rem',
        fontWeight: TYPOGRAPHY.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-sub)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
    </th>
  );
});
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { className = '', style, tabular = false, children, ...props },
  ref
) {
  return (
    <td
      ref={ref}
      className={`fbu-table-cell ${tabular ? 'tabular-nums' : ''} ${className}`}
      style={{
        padding: `${SPACING.sm} ${SPACING.md}`,
        fontSize: '0.875rem',
        color: 'var(--text-main)',
        lineHeight: 1.4,
        fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  );
});
TableCell.displayName = 'TableCell';
