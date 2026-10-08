import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StatusDot } from '../../src/components/ui/status-dot';
import { Tag } from '../../src/components/ui/tag';
import { Skeleton } from '../../src/components/ui/skeleton';
import { Alert } from '../../src/components/ui/alert';
import { Tooltip } from '../../src/components/ui/tooltip';

describe('Feedback & Signals Suite', () => {
  it('renders unboxed 6px luminous StatusDot across all states', () => {
    const operational = renderToString(<StatusDot status="operational" />);
    expect(operational).toContain('fbu-status-dot');
    expect(operational).toContain('Operational');
    expect(operational).toContain('width:6px;height:6px');

    const critical = renderToString(<StatusDot status="critical" label="System Offline" />);
    expect(critical).toContain('System Offline');
  });

  it('renders rectilinear 4px Tag component', () => {
    const html = renderToString(<Tag variant="success">Active</Tag>);
    expect(html).toContain('fbu-tag-success');
    expect(html).toContain('border-radius:4px');
    expect(html).toContain('Active');
  });

  it('renders Skeleton placeholder with aria-hidden', () => {
    const html = renderToString(<Skeleton width="120px" height="24px" variant="rect" />);
    expect(html).toContain('fbu-skeleton');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('width:120px');
  });

  it('renders Alert callout with semantic role and message', () => {
    const html = renderToString(
      <Alert severity="error" title="Upload Failed" message="Rate limit exceeded on Facebook API." />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Upload Failed');
    expect(html).toContain('Rate limit exceeded on Facebook API.');
  });

  it('renders Tooltip trigger element', () => {
    const html = renderToString(
      <Tooltip content="Edit settings">
        <button type="button">Settings</button>
      </Tooltip>
    );
    expect(html).toContain('Settings');
  });
});
