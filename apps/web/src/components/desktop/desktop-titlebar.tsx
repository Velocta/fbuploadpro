'use client';

import React, { useEffect, useState } from 'react';
import {
  isDesktopApp,
  isMacDesktop,
  sendDesktopWindowAction,
  openExternalUrl,
} from '@fbuploadpro/contracts';
import { PALETTE, TYPOGRAPHY } from '@/lib/theme';

export interface DesktopTitleBarProps {
  /** Optional override for testing or manual preview */
  forceVisible?: boolean;
  /** Optional platform override for testing ('mac' | 'windows' | 'linux') */
  platformOverride?: 'mac' | 'windows' | 'linux';
}

export function DesktopTitleBar({ forceVisible = false, platformOverride }: Readonly<DesktopTitleBarProps>) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const desktop = forceVisible || isDesktopApp();
    const mac = platformOverride ? platformOverride === 'mac' : isMacDesktop();
    setIsDesktop(desktop);
    setIsMac(mac);
    setMounted(true);

    if (desktop) {
      document.documentElement.style.setProperty('--desktop-titlebar-height', '36px');
      document.documentElement.dataset.desktop = 'true';
    }

    // Intercept target="_blank" external links inside desktop shell to prevent navigating the embedded webview
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      const isTargetBlank = target.getAttribute('target') === '_blank';
      if (!href) return;

      const isHttp = href.startsWith('http://') || href.startsWith('https://');
      if (isHttp && isTargetBlank) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) {
            e.preventDefault();
            void openExternalUrl(href);
          }
        } catch {
          // ignore invalid URLs
        }
      }
    };

    if (desktop) {
      document.addEventListener('click', handleDocumentClick, true);
    }

    return () => {
      document.documentElement.style.removeProperty('--desktop-titlebar-height');
      delete document.documentElement.dataset.desktop;
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [forceVisible, platformOverride]);

  // When forceVisible is passed (e.g. in tests using renderToStaticMarkup), render directly
  const shouldRender = forceVisible || (mounted && isDesktop);
  if (!shouldRender) {
    return null;
  }

  const effectiveIsMac = platformOverride ? platformOverride === 'mac' : isMac;

  const handleAction = (action: 'minimize' | 'toggle_maximize' | 'close') => (e: React.MouseEvent) => {
    e.stopPropagation();
    void sendDesktopWindowAction(action);
  };

  const handleDoubleClick = () => {
    void sendDesktopWindowAction('toggle_maximize');
  };

  return (
    <header
      data-testid="desktop-titlebar"
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '36px',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: `var(--bg-canvas, ${PALETTE.background})`,
        borderBottom: `1px solid var(--border-subtle, ${PALETTE.neutral})`,
        userSelect: 'none',
        padding: effectiveIsMac ? '0 12px' : '0 0 0 12px',
        boxSizing: 'border-box',
        fontFamily: TYPOGRAPHY.fontFamily,
      }}
    >
      {effectiveIsMac ? (
        // macOS Traffic Lights on the Left
        <>
          <div
            data-testid="desktop-traffic-lights"
            data-tauri-drag-region="false"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <button
              type="button"
              data-testid="desktop-close-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('close')}
              aria-label="Close window"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: PALETTE.accent3,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            <button
              type="button"
              data-testid="desktop-minimize-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('minimize')}
              aria-label="Minimize window"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: PALETTE.primary,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            <button
              type="button"
              data-testid="desktop-maximize-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('toggle_maximize')}
              aria-label="Maximize or restore window"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: PALETTE.accent4,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          </div>

          <div
            data-tauri-drag-region
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              justifyContent: 'center',
              marginRight: '60px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-sub, #9ca3af)',
              letterSpacing: '0.02em',
            }}
          >
            <span>FBUploadPro</span>
          </div>
        </>
      ) : (
        // Windows / Linux Layout: Brand on Left, Controls on Right
        <>
          <div
            data-testid="desktop-brand-title"
            data-tauri-drag-region
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-sub, #9ca3af)',
              letterSpacing: '0.02em',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: PALETTE.primary,
                color: PALETTE.background,
                fontSize: '10px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
              }}
            >
              FB
            </div>
            <span>FBUploadPro</span>
          </div>

          {/* Draggable spacer */}
          <div data-tauri-drag-region style={{ flex: 1, height: '100%' }} />

          {/* Windows / Linux Window Control Buttons */}
          <div
            data-testid="desktop-window-controls"
            data-tauri-drag-region="false"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <button
              type="button"
              data-testid="desktop-minimize-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('minimize')}
              aria-label="Minimize window"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-sub, #9ca3af)',
                width: '42px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect y="4.5" width="10" height="1" />
              </svg>
            </button>

            <button
              type="button"
              data-testid="desktop-maximize-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('toggle_maximize')}
              aria-label="Maximize or restore window"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-sub, #9ca3af)',
                width: '42px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="1.5" y="1.5" width="7" height="7" />
              </svg>
            </button>

            <button
              type="button"
              data-testid="desktop-close-btn"
              data-tauri-drag-region="false"
              onClick={handleAction('close')}
              aria-label="Close window"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-sub, #9ca3af)',
                width: '42px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
              </svg>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
