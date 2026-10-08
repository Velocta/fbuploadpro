'use client';

import React, { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Select,
} from '@web/components/ui';

export function FormControlsShowcase() {
  // Global control toggles for testing
  const [isLoading, setIsLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showError, setShowError] = useState(false);

  // Form values
  const [inputValue, setInputValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('SecretToken123');
  const [textareaValue, setTextareaValue] = useState(
    'Auto-scheduled publishing batch for Facebook Reels campaign.'
  );
  const [checkedBox, setCheckedBox] = useState(true);
  const [switchActive, setSwitchActive] = useState(true);
  const [selectedPage, setSelectedPage] = useState('page_1');

  const pageOptions = [
    { value: 'page_1', label: 'Primary Brand Page (1.2M Followers)' },
    { value: 'page_2', label: 'Global Media Network (450K Followers)' },
    { value: 'page_3', label: 'Regional Outpost Beta (Inactive)', disabled: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Interactive State Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-sub)' }}>
          State Overrides:
        </span>
        <Switch
          label="Simulate Loading"
          checked={isLoading}
          onCheckedChange={setIsLoading}
        />
        <Switch
          label="Simulate Disabled"
          checked={isDisabled}
          onCheckedChange={setIsDisabled}
        />
        <Switch
          label="Simulate Errors"
          checked={showError}
          onCheckedChange={setShowError}
        />
      </div>

      {/* 1. Buttons Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Button Actions (WCAG AAA 14.86:1 Primary)
        </h3>

        {/* Variants row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Button variant="primary" isLoading={isLoading} disabled={isDisabled}>
            Primary Action
          </Button>
          <Button variant="secondary" isLoading={isLoading} disabled={isDisabled}>
            Secondary Action
          </Button>
          <Button variant="ghost" isLoading={isLoading} disabled={isDisabled}>
            Ghost Action
          </Button>
          <Button variant="danger" isLoading={isLoading} disabled={isDisabled}>
            Danger Action
          </Button>
          <Button variant="link" isLoading={isLoading} disabled={isDisabled}>
            Link Action
          </Button>
        </div>

        {/* Sizes row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Button size="sm" variant="secondary" isLoading={isLoading} disabled={isDisabled}>
            Small (30px)
          </Button>
          <Button size="md" variant="primary" isLoading={isLoading} disabled={isDisabled}>
            Medium (38px)
          </Button>
          <Button size="lg" variant="secondary" isLoading={isLoading} disabled={isDisabled}>
            Large (44px)
          </Button>
        </div>

        {/* Icon Slots */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="primary"
            isLoading={isLoading}
            disabled={isDisabled}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Create Slot
          </Button>
          <Button
            variant="secondary"
            isLoading={isLoading}
            disabled={isDisabled}
            rightIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            }
          >
            Next Step
          </Button>
        </div>
      </section>

      {/* 2. Text Input Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Text & Search Inputs
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <Input
            label="Page Search"
            placeholder="Search Facebook page by title..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isDisabled}
            error={showError ? 'Search query timed out on Graph API' : undefined}
            helperText="Matches published pages and linked Instagram accounts"
            leftIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />

          <Input
            isPassword
            label="Facebook Access Token"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            disabled={isDisabled}
            error={showError ? 'Access token has expired or is invalid' : undefined}
            helperText="Encrypted using AES-256-GCM before database write"
          />
        </div>
      </section>

      {/* 3. Textarea Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Multi-line Textarea
        </h3>

        <Textarea
          label="Default Reel Caption Template"
          maxLength={280}
          showCount
          rows={3}
          value={textareaValue}
          onChange={(e) => setTextareaValue(e.target.value)}
          disabled={isDisabled}
          error={showError ? 'Caption exceeds allowed Facebook character count limit' : undefined}
          helperText="Variables {date}, {slot_title}, and {tags} are automatically interpolated"
        />
      </section>

      {/* 4. Binary Toggles & Dropdowns */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Selection & Binary Controls
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Checkbox
              label="Auto-purge R2 media after publication"
              description="Immediately deallocates storage blocks from Cloudflare bucket."
              checked={checkedBox}
              onCheckedChange={setCheckedBox}
              disabled={isDisabled}
            />
            <Switch
              label="Real-time Cron Worker Dispatch"
              description="Triggers edge V8 isolates every 60 seconds."
              checked={switchActive}
              onCheckedChange={setSwitchActive}
              disabled={isDisabled}
            />
          </div>

          <div>
            <Select
              label="Active Publishing Target"
              options={pageOptions}
              value={selectedPage}
              onValueChange={setSelectedPage}
              disabled={isDisabled}
              error={showError ? 'Must select an authorized production page' : undefined}
              helperText="Managed by Page Admin permissions"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
