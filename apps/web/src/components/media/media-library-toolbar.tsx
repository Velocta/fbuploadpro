'use client';

import React, { useState } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import type {
  MediaViewMode,
  MediaTypeFilterKey,
  AspectRatioFilterKey,
  CaptionStatusFilterKey,
  SortOptionKey,
} from './media-types';
import {
  MEDIA_TYPE_LABELS,
  ASPECT_RATIO_SHORT_VALUES,
  CAPTION_STATUS_SHORT_VALUES,
  SORT_OPTION_SHORT_VALUES,
  type ActiveDropdownKey,
} from './media-library-filters';

const TYPE_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'image', label: 'Images' },
] as const;

const RATIO_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All ratios' },
  { key: '9:16', label: '9:16 Vertical' },
  { key: '16:9', label: '16:9 Landscape' },
  { key: '1:1', label: '1:1 Square' },
  { key: '4:5', label: '4:5 Portrait' },
] as const;

const CAPTION_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All captions' },
  { key: 'has_caption', label: 'Has caption' },
  { key: 'empty_caption', label: 'Missing caption' },
] as const;

const SORT_DROPDOWN_OPTIONS = [
  { key: 'created_at:desc', label: 'Newest first' },
  { key: 'created_at:asc', label: 'Oldest first' },
  { key: 'name:asc', label: 'Name (A–Z)' },
  { key: 'file_size:desc', label: 'Largest size' },
] as const;

export interface ToolbarDropdownItem<T extends string> {
  key: T;
  label: string;
}

export interface ToolbarDropdownProps<T extends string> {
  testId: string;
  label: string;
  displayValue: string;
  isUnderlined?: boolean;
  isOpen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  options: readonly ToolbarDropdownItem<T>[];
  selectedKey: T;
  optionTestIdPrefix: string;
  onToggle: () => void;
  onSelect: (key: T) => void;
  onClose: () => void;
}

export function ToolbarDropdown<T extends string>({
  testId,
  label,
  displayValue,
  isUnderlined = false,
  isOpen,
  containerRef,
  options,
  selectedKey,
  optionTestIdPrefix,
  onToggle,
  onSelect,
  onClose,
}: Readonly<ToolbarDropdownProps<T>>) {
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.medium,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: isUnderlined ? `var(--text-main, ${THEME.default.text.primary})` : 'inherit',
            borderBottom: isUnderlined ? `2px solid ${PALETTE.primary}` : 'none',
            paddingBottom: '2px',
          }}
        >
          {displayValue}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '26px',
            left: 0,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
            borderRadius: RADII.xs,
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 30,
            minWidth: '120px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              data-testid={`${optionTestIdPrefix}-option-${opt.key}`}
              tabIndex={0}
              onClick={() => {
                onSelect(opt.key);
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(opt.key);
                  onClose();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              style={{
                padding: '6px 10px',
                textAlign: 'left',
                backgroundColor:
                  selectedKey === opt.key
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                border: 'none',
                borderRadius: RADII.xs,
                color:
                  selectedKey === opt.key
                    ? `var(--text-main, ${THEME.default.text.primary})`
                    : `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight:
                  selectedKey === opt.key
                    ? TYPOGRAPHY.weights.medium
                    : TYPOGRAPHY.weights.regular,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface MediaToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  scopeTagLabel: string;
  mediaTypeFilter: MediaTypeFilterKey;
  onMediaTypeChange: (type: MediaTypeFilterKey) => void;
  aspectRatioFilter: AspectRatioFilterKey;
  onAspectRatioChange: (ratio: AspectRatioFilterKey) => void;
  captionStatusFilter: CaptionStatusFilterKey;
  onCaptionStatusChange: (status: CaptionStatusFilterKey) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  sortOption: SortOptionKey;
  onSortChange: (sort: SortOptionKey) => void;
  viewMode: MediaViewMode;
  onChangeViewMode: (mode: MediaViewMode) => void;
  activeDropdown: ActiveDropdownKey;
  onToggleDropdown: (dropdown: NonNullable<ActiveDropdownKey>) => void;
  onCloseDropdown: () => void;
  dropdownRefs: Record<NonNullable<ActiveDropdownKey>, React.RefObject<HTMLDivElement | null>>;
}

export function MediaToolbar({
  searchInput,
  onSearchChange,
  scopeTagLabel,
  mediaTypeFilter,
  onMediaTypeChange,
  aspectRatioFilter,
  onAspectRatioChange,
  captionStatusFilter,
  onCaptionStatusChange,
  activeFilterCount,
  onClearFilters,
  sortOption,
  onSortChange,
  viewMode,
  onChangeViewMode,
  activeDropdown,
  onToggleDropdown,
  onCloseDropdown,
  dropdownRefs,
}: Readonly<MediaToolbarProps>) {
  return (
    <div
      data-testid="media-explorer-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        paddingBottom: SPACING.md,
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        flexWrap: 'wrap',
      }}
    >
      {/* Zone 1 — GLOBAL (left): the search field only */}
      <div
        data-testid="media-toolbar-zone-1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.xs,
          flex: '1 1 240px',
          maxWidth: '360px',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          data-testid="media-search-input"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files and captions…"
          aria-label="Search files and captions"
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.875rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            padding: '4px 0',
          }}
        />
      </div>

      {/* Divider 1: Between Zone 1 (Global Search) and Zone 2 (Local Scoped Controls) */}
      <hr
        data-testid="media-toolbar-divider-1"
        aria-orientation="vertical"
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
          border: 'none',
          margin: 0,
          flexShrink: 0,
        }}
      />

      {/* Zone 2 — LOCAL (middle): controls that apply ONLY to the current view */}
      <div
        data-testid="media-toolbar-zone-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexWrap: 'wrap',
        }}
      >
        {/* Scope Tag Anchor */}
        <span
          data-testid="media-scope-tag"
          style={{
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            paddingRight: '4px',
          }}
        >
          {scopeTagLabel}
        </span>

        {/* Labeled Dropdown 1: Type */}
        <ToolbarDropdown
          testId="media-type-select"
          label="Type: "
          displayValue={MEDIA_TYPE_LABELS[mediaTypeFilter]}
          isUnderlined={mediaTypeFilter !== 'all'}
          isOpen={activeDropdown === 'type'}
          containerRef={dropdownRefs.type}
          options={TYPE_DROPDOWN_OPTIONS}
          selectedKey={mediaTypeFilter}
          optionTestIdPrefix="type"
          onToggle={() => onToggleDropdown('type')}
          onSelect={onMediaTypeChange}
          onClose={onCloseDropdown}
        />

        {/* Labeled Dropdown 2: Ratio */}
        <ToolbarDropdown
          testId="media-aspect-ratio-select"
          label="Ratio: "
          displayValue={ASPECT_RATIO_SHORT_VALUES[aspectRatioFilter]}
          isUnderlined={aspectRatioFilter !== 'all'}
          isOpen={activeDropdown === 'ratio'}
          containerRef={dropdownRefs.ratio}
          options={RATIO_DROPDOWN_OPTIONS}
          selectedKey={aspectRatioFilter}
          optionTestIdPrefix="aspect-ratio"
          onToggle={() => onToggleDropdown('ratio')}
          onSelect={onAspectRatioChange}
          onClose={onCloseDropdown}
        />

        {/* Labeled Dropdown 3: Captions */}
        <ToolbarDropdown
          testId="media-caption-status-select"
          label="Captions: "
          displayValue={CAPTION_STATUS_SHORT_VALUES[captionStatusFilter]}
          isUnderlined={captionStatusFilter !== 'all'}
          isOpen={activeDropdown === 'caption'}
          containerRef={dropdownRefs.caption}
          options={CAPTION_DROPDOWN_OPTIONS}
          selectedKey={captionStatusFilter}
          optionTestIdPrefix="caption-status"
          onToggle={() => onToggleDropdown('caption')}
          onSelect={onCaptionStatusChange}
          onClose={onCloseDropdown}
        />

        {/* Dynamic Filter Clear Badge */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            data-testid="clear-filters-btn"
            onClick={onClearFilters}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '2px 6px',
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>
              {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} · Clear
            </span>
          </button>
        )}
      </div>

      {/* Divider 2: Between Zone 2 (Local Filters) and Zone 3 (Sort & View Mode) */}
      <hr
        data-testid="media-toolbar-divider-2"
        aria-orientation="vertical"
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
          border: 'none',
          margin: 0,
          flexShrink: 0,
        }}
      />

      {/* Zone 3 — SORT + VIEW (right) */}
      <div
        data-testid="media-toolbar-zone-3"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        {/* Labeled Sort Dropdown */}
        <ToolbarDropdown
          testId="media-sort-select"
          label="Sort: "
          displayValue={SORT_OPTION_SHORT_VALUES[sortOption]}
          isOpen={activeDropdown === 'sort'}
          containerRef={dropdownRefs.sort}
          options={SORT_DROPDOWN_OPTIONS}
          selectedKey={sortOption}
          optionTestIdPrefix="sort"
          onToggle={() => onToggleDropdown('sort')}
          onSelect={onSortChange}
          onClose={onCloseDropdown}
        />

        {/* Bare Grid/Table Toggle Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-testid="view-mode-grid-btn"
            aria-label="Grid view"
            onClick={() => onChangeViewMode('grid')}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px',
              color:
                viewMode === 'grid'
                  ? PALETTE.primary
                  : `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="view-mode-table-btn"
            aria-label="Table view"
            onClick={() => onChangeViewMode('table')}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px',
              color:
                viewMode === 'table'
                  ? PALETTE.primary
                  : `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
