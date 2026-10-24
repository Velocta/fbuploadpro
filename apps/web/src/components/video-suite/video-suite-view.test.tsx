import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoSuiteGate } from './video-suite-gate';
import { VideoSuiteView } from './video-suite-view';

describe('VideoSuiteGate', () => {
  it('shows the placeholder with a text-only desktop note and NO link', () => {
    const { container } = render(<VideoSuiteGate />);
    expect(screen.getByTestId('video-suite-gate')).toBeInTheDocument();
    expect(screen.getByText('Video Suite')).toBeInTheDocument();
    expect(screen.getByTestId('video-suite-gate-note')).toHaveTextContent('coming soon');
    // A dead or placeholder download link would be a spec violation.
    expect(container.querySelector('a')).toBeNull();
  });
  it('shows no workspace controls in the browser state', () => {
    render(<VideoSuiteGate />);
    expect(screen.queryByText('Downloader')).toBeNull();
    expect(screen.queryByText('Converter')).toBeNull();
    expect(screen.queryByLabelText('Video link')).toBeNull();
  });
});

describe('VideoSuiteView', () => {
  it('renders the gate in a plain browser context', () => {
    render(<VideoSuiteView subdomain="e2e" />);
    expect(screen.getByTestId('video-suite-gate')).toBeInTheDocument();
  });
  it('renders the workspace with the rights note when forced to desktop', async () => {
    render(<VideoSuiteView subdomain="e2e" forceDesktop />);
    expect(screen.getByTestId('video-suite-workspace')).toBeInTheDocument();
    // Await the async readiness settle so no state update lands outside act().
    await screen.findByText('Video tools had a problem.');
    expect(
      screen.getByText('Only download videos you have the right to use — your own content, or content the owner has allowed you to reuse.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Downloader')).toBeInTheDocument();
    expect(screen.getByText('Converter')).toBeInTheDocument();
  });
});
