'use client';

import React from 'react';
import type { FacebookAccountView } from '@fbuploadpro/contracts';

export interface AccountListProps {
  accounts: FacebookAccountView[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  onDisconnectAccount: (accountId: string) => void;
  onDiscoverPages: (accountId: string) => void;
  onConnectNew: () => void;
}

export function AccountList({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onDisconnectAccount,
  onDiscoverPages,
  onConnectNew,
}: AccountListProps) {
  const getStatusBadge = (status: FacebookAccountView['status']) => {
    switch (status) {
      case 'active':
        return { label: 'Active', bg: '#e6f4ea', text: '#137333' };
      case 'expired':
        return { label: 'Expired (Re-auth)', bg: '#fce8e6', text: '#c5221f' };
      case 'disconnected':
      default:
        return { label: 'Disconnected', bg: '#f1f3f4', text: '#5f6368' };
    }
  };

  const formatExpiry = (tokenExpiresAt: Date | string | null | undefined) => {
    if (!tokenExpiresAt) return 'Long-lived';
    const expires = new Date(tokenExpiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expired';
    return `${diffDays} days remaining`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#202124' }}>
          Connected Facebook Accounts ({accounts.length})
        </h2>
        <button
          type="button"
          onClick={onConnectNew}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#1877f2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Connect Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px dashed #dadce0',
            borderRadius: '8px',
            color: '#5f6368',
          }}
        >
          <p style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
            No Facebook accounts connected yet.
          </p>
          <button
            type="button"
            onClick={onConnectNew}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: '#1877f2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Connect Your First Facebook Account
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {accounts.map((acc) => {
            const isSelected = acc.id === selectedAccountId;
            const badge = getStatusBadge(acc.status);

            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc.id)}
                style={{
                  backgroundColor: '#ffffff',
                  border: isSelected
                    ? '2px solid #1877f2'
                    : '1px solid #dadce0',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  boxShadow: isSelected
                    ? '0 2px 8px rgba(24,119,242,0.15)'
                    : '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: '#202124',
                      }}
                    >
                      {acc.displayName}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#70757a',
                      }}
                    >
                      ID: {acc.fbAccountId}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: badge.bg,
                      color: badge.text,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: '#5f6368',
                    marginBottom: '1rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #f1f3f4',
                  }}
                >
                  <div>
                    <span>Pages: </span>
                    <strong style={{ color: '#202124' }}>
                      {acc.connectedPagesCount}
                    </strong>
                  </div>
                  <div>
                    <span>Expiry: </span>
                    <strong style={{ color: '#202124' }}>
                      {formatExpiry(acc.tokenExpiresAt)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscoverPages(acc.id);
                    }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: '#e8f0fe',
                      color: '#1a73e8',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔍 Discover Pages
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Disconnect "${acc.displayName}"? This will detach its linked pages.`
                        )
                      ) {
                        onDisconnectAccount(acc.id);
                      }
                    }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: '#fce8e6',
                      color: '#c5221f',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
