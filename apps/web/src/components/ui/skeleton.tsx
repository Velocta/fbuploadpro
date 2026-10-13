import React from 'react';
import { RADII } from '@/lib/theme';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}: Readonly<SkeletonProps>) {
  const getRadius = () => {
    switch (variant) {
      case 'circle':
        return RADII.full;
      case 'rect':
        return RADII.sm; // 6px
      case 'text':
      default:
        return RADII.xs; // 4px
    }
  };

  const getDefaultHeight = () => {
    switch (variant) {
      case 'circle':
        return width || '40px';
      case 'rect':
        return '120px';
      case 'text':
      default:
        return '1rem';
    }
  };

  const getResolvedWidth = () => {
    if (width !== undefined) {
      return typeof width === 'number' ? `${width}px` : width;
    }
    if (variant === 'circle') {
      return height || '40px';
    }
    return '100%';
  };

  const resolvedWidth = getResolvedWidth();
  const resolvedHeight = height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : getDefaultHeight();

  return (
    <div
      className={`fbu-skeleton fbu-skeleton-${variant} fbu-skeleton-shimmer ${className}`}
      aria-hidden="true"
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
        borderRadius: getRadius(),
        display: 'block',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    />
  );
}
