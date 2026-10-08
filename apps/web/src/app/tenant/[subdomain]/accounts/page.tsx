'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import type {
  FacebookAccountView,
  FacebookPageView,
  DiscoveredPage,
} from '@fbuploadpro/contracts';
import { AccountList } from '../../../../components/facebook/account-list';
import { PageDiscoveryModal } from '../../../../components/facebook/page-discovery-modal';
import Link from 'next/link';

interface AccountsPageProps {
  params: { subdomain: string } | Promise<{ subdomain: string }>;
}

export default function TenantAccountsPage({ params }: AccountsPageProps) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(params as Promise<{ subdomain: string }>)
      : (params as { subdomain: string });
  const subdomain = resolvedParams.subdomain;

  const [accounts, setAccounts] = useState<FacebookAccountView[]>([]);
  const [pages, setPages] = useState<FacebookPageView[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discovery Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDiscoveryAccountId, setActiveDiscoveryAccountId] = useState<string | null>(null);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [accRes, pagesRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/accounts`),
        fetch(`/api/tenant/${subdomain}/pages`),
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData.accounts || []);
        if (accData.accounts?.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accData.accounts[0].id);
        }
      }

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);
      }
    } catch (_e) {
      setErrorMessage('Failed to load accounts and pages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [subdomain, selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnectNew = () => {
    // Initiate OAuth flow targeting this workspace
    window.location.href = `/api/auth/facebook?subdomain=${encodeURIComponent(subdomain)}`;
  };

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts/${accountId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      } else {
        alert('Failed to disconnect account.');
      }
    } catch (_e) {
      alert('Error disconnecting account.');
    }
  };

  const handleDisconnectPage = async (pageId: string) => {
    if (!confirm('Are you sure you want to disconnect this Facebook Page?')) return;
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      } else {
        alert('Failed to disconnect page.');
      }
    } catch (_e) {
      alert('Error disconnecting page.');
    }
  };

  const handleDiscoverPages = async (accountId: string) => {
    setActiveDiscoveryAccountId(accountId);
    setIsModalOpen(true);
    setIsDiscovering(true);
    setDiscoveredPages([]);

    try {
      const res = await fetch(
        `/api/tenant/${subdomain}/accounts/${accountId}/pages/discover`
      );
      if (res.ok) {
        const data = await res.json();
        setDiscoveredPages(data.pages || []);
      } else {
        alert('Failed to discover pages for this account.');
      }
    } catch (_e) {
      alert('Error querying Facebook Graph API.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleImportSelected = async (selectedPageIds: string[]) => {
    if (!activeDiscoveryAccountId) return;
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: activeDiscoveryAccountId,
          selectedPageIds,
        }),
      });

      if (res.ok) {
        await loadData();
      } else {
        alert('Failed to import selected pages.');
      }
    } catch (_e) {
      alert('Error executing selective page import.');
    }
  };

  const activeAccount = accounts.find((a) => a.id === activeDiscoveryAccountId);

  const getPageStatusBadge = (status: FacebookPageView['status']) => {
    switch (status) {
      case 'active':
        return { label: 'Active', bg: '#e6f4ea', text: '#137333' };
      case 'fb_rate_limited':
        return { label: 'Rate Limited', bg: '#fef7e0', text: '#b06000' };
      case 'invalid_token':
        return { label: 'Invalid Token', bg: '#fce8e6', text: '#c5221f' };
      case 'disconnected':
      default:
        return { label: 'Disconnected', bg: '#f1f3f4', text: '#5f6368' };
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#202124' }}>
          Facebook Social Channels
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#5f6368', fontSize: '0.95rem' }}>
          Manage multi-account Facebook profiles and imported Facebook Pages for{' '}
          <strong>{subdomain}</strong>.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fce8e6',
            color: '#c5221f',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Account Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#5f6368' }}>
            Loading connected channels...
          </div>
        ) : (
          <AccountList
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onDisconnectAccount={handleDisconnectAccount}
            onDiscoverPages={handleDiscoverPages}
            onConnectNew={handleConnectNew}
          />
        )}
      </div>

      {/* Imported Pages Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #dadce0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
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
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#202124' }}>
              Imported Facebook Pages ({pages.length})
            </h2>
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.85rem',
                color: '#5f6368',
              }}
            >
              Target Pages active for video publishing (Groups strictly excluded).
            </p>
          </div>
        </div>

        {pages.length === 0 ? (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#5f6368',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              No Facebook Pages imported yet.
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              Click <strong>&quot;Discover Pages&quot;</strong> on any connected account
              above to select and import pages.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #dadce0',
                    color: '#5f6368',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ padding: '0.75rem 1.5rem' }}>Page Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Followers</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Source Account</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const badge = getPageStatusBadge(p.status);
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #f1f3f4',
                      }}
                    >
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <strong style={{ color: '#202124' }}>
                          {p.pageName}
                        </strong>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#70757a',
                            marginTop: '0.2rem',
                          }}
                        >
                          ID: {p.fbPageId}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#5f6368' }}>
                        {p.category || 'General'}
                      </td>
                      <td style={{ padding: '1rem', color: '#202124' }}>
                        {p.followersCount.toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem', color: '#5f6368' }}>
                        {p.accountDisplayName || '—'}
                      </td>
                      <td style={{ padding: '1rem' }}>
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
                      </td>
                      <td
                        style={{
                          padding: '1rem 1.5rem',
                          textAlign: 'right',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '0.5rem',
                        }}
                      >
                        <Link
                          href={`/tenant/${encodeURIComponent(subdomain)}/pages/${encodeURIComponent(p.id)}/insights`}
                          style={{
                            padding: '0.35rem 0.7rem',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          📊 Insights
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDisconnectPage(p.id)}
                          style={{
                            padding: '0.35rem 0.7rem',
                            backgroundColor: '#ffffff',
                            color: '#c5221f',
                            border: '1px solid #fad2cf',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Disconnect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discovery Modal */}
      <PageDiscoveryModal
        isOpen={isModalOpen}
        accountId={activeDiscoveryAccountId || ''}
        accountDisplayName={activeAccount?.displayName || 'Selected Account'}
        discoveredPages={discoveredPages}
        isLoading={isDiscovering}
        onClose={() => setIsModalOpen(false)}
        onImportSelected={handleImportSelected}
      />
    </div>
  );
}
