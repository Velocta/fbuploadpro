'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import type {
  FolderResponse,
  MediaItemResponse,
  StorageQuotaResponse,
  CaptionTemplateResponse,
} from '@fbuploadpro/contracts';
import { StorageMeter } from '../../../../components/media/storage-meter';
import { FolderSidebar } from '../../../../components/media/folder-sidebar';
import { UploadModal } from '../../../../components/media/upload-modal';
import { MediaGrid } from '../../../../components/media/media-grid';
import { MediaPreviewModal } from '../../../../components/media/media-preview-modal';
import { CaptionModal } from '../../../../components/media/caption-modal';

interface MediaPageProps {
  params: { subdomain: string } | Promise<{ subdomain: string }>;
}

export default function TenantMediaPage({ params }: MediaPageProps) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(params as Promise<{ subdomain: string }>)
      : (params as { subdomain: string });
  const subdomain = resolvedParams?.subdomain || 'default';

  // Core Data State
  const [quota, setQuota] = useState<StorageQuotaResponse | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState<boolean>(true);

  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [unorganizedCount, setUnorganizedCount] = useState<number>(0);

  const [mediaItems, setMediaItems] = useState<MediaItemResponse[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);

  const [captionTemplates, setCaptionTemplates] = useState<CaptionTemplateResponse[]>([]);

  // Filtering State
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'unorganized' | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'video' | 'image' | ''>('');

  // Modals State
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isCaptionOpen, setIsCaptionOpen] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<MediaItemResponse | null>(null);

  // Load Quota
  const loadQuota = useCallback(async () => {
    try {
      setIsLoadingQuota(true);
      const res = await fetch(`/api/tenant/${subdomain}/media/quota`);
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch (_err) {
      // Graceful fallback
    } finally {
      setIsLoadingQuota(false);
    }
  }, [subdomain]);

  // Load Folders
  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setUnorganizedCount(data.unorganizedCount || 0);
      }
    } catch (_err) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Load Caption Templates
  const loadCaptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/captions`);
      if (res.ok) {
        const data = await res.json();
        setCaptionTemplates(data || []);
      }
    } catch (_err) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Load Media Items
  const loadMediaItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      const queryParams = new URLSearchParams();
      if (selectedFolderId) {
        queryParams.set('folderId', selectedFolderId);
      }
      if (selectedTag) {
        queryParams.set('tag', selectedTag);
      }
      if (mediaTypeFilter) {
        queryParams.set('mediaType', mediaTypeFilter);
      }
      if (searchQuery.trim()) {
        queryParams.set('search', searchQuery.trim());
      }
      queryParams.set('limit', '50');

      const res = await fetch(`/api/tenant/${subdomain}/media?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMediaItems(data.items || []);
        setTotalCount(data.total || 0);
      }
    } catch (_err) {
      // Graceful fallback
    } finally {
      setIsLoadingItems(false);
    }
  }, [subdomain, selectedFolderId, selectedTag, mediaTypeFilter, searchQuery]);

  useEffect(() => {
    loadQuota();
    loadFolders();
    loadCaptions();
  }, [loadQuota, loadFolders, loadCaptions]);

  useEffect(() => {
    loadMediaItems();
  }, [loadMediaItems]);

  // Aggregate Available Tags from loaded items and templates
  const availableTags = Array.from(
    new Set([
      ...mediaItems.flatMap((i) => i.tags || []),
      ...captionTemplates.flatMap((c) => c.tags || []),
    ])
  );

  // Folder Actions
  const handleCreateFolder = async (name: string, color: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        await loadFolders();
      }
    } catch (_err) {
      // Handled
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        await Promise.all([loadFolders(), loadMediaItems()]);
      }
    } catch (_err) {
      // Handled
    }
  };

  // Caption Actions
  const handleCreateTemplate = async (template: { title: string; content: string; tags: string[] }) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/captions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (res.ok) {
      await loadCaptions();
    }
  };

  const handleUpdateTemplate = async (
    templateId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/captions/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await loadCaptions();
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/captions/${templateId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadCaptions();
    }
  };

  // Purge Media Item Action
  const handleDeleteMediaItem = async (item: MediaItemResponse) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/${item.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await Promise.all([loadQuota(), loadFolders(), loadMediaItems()]);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>
            Media Library
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            Store and organize high-resolution assets for publishing campaigns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsCaptionOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: '#334155',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <span>📝</span>
            <span>Caption Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            + Upload Asset
          </button>
        </div>
      </div>

      {/* Storage Utilization Meter */}
      <StorageMeter quota={quota} isLoading={isLoadingQuota} />

      {/* Main Workspace Layout (Sidebar + Grid) */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Left Folder & Tag Navigation */}
        <FolderSidebar
          folders={folders}
          unorganizedCount={unorganizedCount}
          totalCount={totalCount}
          selectedFolderId={selectedFolderId}
          selectedTag={selectedTag}
          availableTags={availableTags}
          onSelectFolder={setSelectedFolderId}
          onSelectTag={setSelectedTag}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Right Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.8125rem',
                minWidth: '220px',
                outline: 'none',
              }}
            />

            {/* Media Type Filter */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setMediaTypeFilter('')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: mediaTypeFilter === '' ? '#2563eb' : '#f1f5f9',
                  color: mediaTypeFilter === '' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setMediaTypeFilter('video')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: mediaTypeFilter === 'video' ? '#2563eb' : '#f1f5f9',
                  color: mediaTypeFilter === 'video' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Videos
              </button>
              <button
                type="button"
                onClick={() => setMediaTypeFilter('image')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: mediaTypeFilter === 'image' ? '#2563eb' : '#f1f5f9',
                  color: mediaTypeFilter === 'image' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Images
              </button>
            </div>
          </div>

          {/* Media Grid */}
          <MediaGrid
            items={mediaItems}
            isLoading={isLoadingItems}
            onSelectItem={setPreviewItem}
          />
        </div>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subdomain={subdomain}
        folders={folders}
        currentFolderId={typeof selectedFolderId === 'string' && selectedFolderId !== 'unorganized' ? selectedFolderId : null}
        onUploadSuccess={async () => {
          await Promise.all([loadQuota(), loadFolders(), loadMediaItems()]);
        }}
      />

      <CaptionModal
        isOpen={isCaptionOpen}
        onClose={() => setIsCaptionOpen(false)}
        templates={captionTemplates}
        onCreateTemplate={handleCreateTemplate}
        onUpdateTemplate={handleUpdateTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <MediaPreviewModal
        item={previewItem}
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        onDelete={handleDeleteMediaItem}
      />
    </div>
  );
}
