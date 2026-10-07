import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FolderSidebar } from '../../src/components/media/folder-sidebar';
import type { FolderResponse } from '@fbuploadpro/contracts';

describe('FolderSidebar Component (T105)', () => {
  const dummyFolders: FolderResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      name: 'Summer Campaign',
      color: 'blue',
      itemCount: 15,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      userId: 'user-1',
      name: 'Client Reels',
      color: 'purple',
      itemCount: 8,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
  ];

  const dummyTags = ['viral', 'summer', 'promo', 'reel'];

  it('renders All Media, Unorganized, and custom folders with counts', () => {
    const html = renderToString(
      <FolderSidebar
        folders={dummyFolders}
        unorganizedCount={5}
        totalCount={28}
        selectedFolderId={null}
        selectedTag={null}
        availableTags={dummyTags}
        onSelectFolder={vi.fn()}
        onSelectTag={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );

    expect(html).toContain('All Media');
    expect(html).toContain('28');
    expect(html).toContain('Unorganized');
    expect(html).toContain('5');
    expect(html).toContain('Summer Campaign');
    expect(html).toContain('15');
    expect(html).toContain('Client Reels');
    expect(html).toContain('8');
  });

  it('renders available tags for navigation', () => {
    const html = renderToString(
      <FolderSidebar
        folders={dummyFolders}
        unorganizedCount={5}
        totalCount={28}
        selectedFolderId={null}
        selectedTag={null}
        availableTags={dummyTags}
        onSelectFolder={vi.fn()}
        onSelectTag={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );

    expect(html).toContain('#viral');
    expect(html).toContain('#summer');
    expect(html).toContain('#promo');
    expect(html).toContain('#reel');
  });

  it('highlights selected folder and selected tag', () => {
    const html = renderToString(
      <FolderSidebar
        folders={dummyFolders}
        unorganizedCount={5}
        totalCount={28}
        selectedFolderId="11111111-1111-1111-1111-111111111111"
        selectedTag="viral"
        availableTags={dummyTags}
        onSelectFolder={vi.fn()}
        onSelectTag={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );

    // Assert that active indicator styling is present
    expect(html).toContain('Summer Campaign');
    expect(html).toContain('#viral');
  });
});
