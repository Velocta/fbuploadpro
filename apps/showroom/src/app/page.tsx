'use client';

import React, { useState, useEffect } from 'react';
import { FormControlsShowcase } from './components/form-controls-showcase';
import { SurfacesShowcase } from './components/surfaces-showcase';
import { FeedbackShowcase } from './components/feedback-showcase';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, StatusDot } from '@web/components/ui';

export default function ShowroomDashboard() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeSection, setActiveSection] = useState('forms');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div
      id="showroom-root"
      data-theme={theme}
      className={theme}
      style={{
        minHeight: '100vh',
        backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#000000',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          borderBottom: `1px solid ${theme === 'dark' ? 'var(--border-subtle, #1f242d)' : '#eaecef'}`,
          backgroundColor: theme === 'dark' ? 'var(--bg-panel, #0c0d10)' : '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-main)',
              }}
            >
              FBUploadPro <span style={{ color: 'var(--primary)' }}>UI Showroom</span>
            </span>
            <span style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
            <StatusDot status="operational" label="Spec 008 Verified" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub)' }}>
              Theme: <strong style={{ color: 'var(--text-main)' }}>{theme.toUpperCase()}</strong>
            </span>
            <Button size="sm" variant="secondary" onClick={toggleTheme}>
              {theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              margin: '0 0 8px 0',
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
            }}
          >
            Reusable Component Suite Sandbox
          </h1>
          <p style={{ margin: 0, color: 'var(--text-sub)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
            Interactive testing harness for Binance Precision Dual-Theme UI components. Pure native React 19 primitives with zero mock code in production.
          </p>
        </div>

        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList style={{ marginBottom: '28px' }}>
            <TabsTrigger value="forms">Form & Action Controls (US1)</TabsTrigger>
            <TabsTrigger value="surfaces">Surfaces & Navigation (US2 & US3)</TabsTrigger>
            <TabsTrigger value="feedback">Status Signals & Feedback (US4)</TabsTrigger>
            <TabsTrigger value="all">Full Suite Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="forms">
            <FormControlsShowcase />
          </TabsContent>

          <TabsContent value="surfaces">
            <SurfacesShowcase />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackShowcase />
          </TabsContent>

          <TabsContent value="all">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              <FormControlsShowcase />
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <SurfacesShowcase />
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <FeedbackShowcase />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
