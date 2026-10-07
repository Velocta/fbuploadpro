'use client';

import React, { useState, useEffect } from 'react';
import type { DiscoveredPage } from '@fbuploadpro/contracts';

export interface PageDiscoveryModalProps {
  isOpen: boolean;
  accountId: string;
  accountDisplayName: string;
  discoveredPages: DiscoveredPage[];
  isLoading: boolean;
  onClose: () => void;
  onImportSelected: (selectedPageIds: string[]) => Promise<void>;
}

export function PageDiscoveryModal({
  isOpen,
  accountId: _accountId,
  accountDisplayName,
  discoveredPages,
  isLoading,
  onClose,
  onImportSelected,
}: PageDiscoveryModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Reset selection whenever modal opens or pages change
    setSelectedIds([]);
  }, [isOpen, discoveredPages]);

  if (!isOpen) return null;

  const toggleSelect = (fbPageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(fbPageId)
        ? prev.filter((id) => id !== fbPageId)
        : [...prev, fbPageId]
    );
  };

  const importablePages = discoveredPages.filter((p) => !p.isImported);

  const handleSelectAll = () => {
    if (selectedIds.length === importablePages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(importablePages.map((p) => p.fbPageId));
    }
  };

  const handleConfirmImport = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImportSelected(selectedIds);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #dadce0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#202124' }}>
              Discover Facebook Pages
            </h2>
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.875rem',
                color: '#5f6368',
              }}
            >
              Account: <strong>{accountDisplayName}</strong> (Pages only — Groups
              strictly excluded)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#5f6368',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {isLoading ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#5f6368',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              <p style={{ margin: 0 }}>
                Querying Facebook Graph API v26.0 for manageable pages...
              </p>
            </div>
          ) : discoveredPages.length === 0 ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: '#5f6368',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
              }}
            >
              <p style={{ margin: 0 }}>
                No manageable Facebook Pages found under this account.
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
                Ensure your Facebook profile has admin or editor roles on at least
                one Facebook Page.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid #f1f3f4',
                }}
              >
                <span style={{ fontSize: '0.875rem', color: '#5f6368' }}>
                  {discoveredPages.length} Facebook Page(s) discovered
                </span>
                {importablePages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1a73e8',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {selectedIds.length === importablePages.length
                      ? 'Deselect All'
                      : 'Select All New'}
                  </button>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {discoveredPages.map((page) => {
                  const isChecked =
                    page.isImported || selectedIds.includes(page.fbPageId);

                  return (
                    <div
                      key={page.fbPageId}
                      onClick={() => {
                        if (!page.isImported) toggleSelect(page.fbPageId);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #dadce0',
                        backgroundColor: page.isImported
                          ? '#f8f9fa'
                          : isChecked
                            ? '#f0f7ff'
                            : '#ffffff',
                        cursor: page.isImported ? 'default' : 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={page.isImported}
                          onChange={() => {
                            if (!page.isImported) toggleSelect(page.fbPageId);
                          }}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: page.isImported ? 'default' : 'pointer',
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: page.isImported ? '#70757a' : '#202124',
                              fontSize: '0.95rem',
                            }}
                          >
                            {page.pageName}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#5f6368',
                              marginTop: '0.2rem',
                            }}
                          >
                            {page.category || 'General Page'} &bull;{' '}
                            {page.followersCount.toLocaleString()} followers
                          </div>
                        </div>
                      </div>

                      {page.isImported ? (
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            backgroundColor: '#e6f4ea',
                            color: '#137333',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          Already Imported
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: isChecked ? '#1a73e8' : '#70757a',
                            fontWeight: 600,
                          }}
                        >
                          {isChecked ? 'Selected' : 'Available'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #dadce0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            backgroundColor: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffffff',
              border: '1px solid #dadce0',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#3c4043',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={selectedIds.length === 0 || isSubmitting}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor:
                selectedIds.length === 0 || isSubmitting
                  ? '#dadce0'
                  : '#1877f2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor:
                selectedIds.length === 0 || isSubmitting
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {isSubmitting
              ? 'Importing...'
              : `Import Selected (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
