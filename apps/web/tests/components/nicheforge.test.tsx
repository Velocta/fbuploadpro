/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildReportMarkdown, type NicheforgeRunRecord } from '@fbuploadpro/contracts';
import { NicheForgeView } from '@/components/nicheforge/nicheforge-view';
import { KeysPanel } from '@/components/nicheforge/keys-panel';
import { RunDetail } from '@/components/nicheforge/run-detail';
import { RunForm } from '@/components/nicheforge/run-form';
import { RunProgress } from '@/components/nicheforge/run-progress';
import { ReportView } from '@/components/nicheforge/report-view';
import { NicheForgeWorkspace } from '@/components/nicheforge/nicheforge-workspace';
import {
  defaultProviderHandler,
  makeStubSlot,
  StubNicheforgeBridge,
} from '../helpers/nicheforge-stub-bridge';

const completedRun: NicheforgeRunRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Mug research',
  provider: 'gemini',
  modelId: 'gemini-2.5-flash',
  promptVersion: '1',
  status: 'done',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:01:00Z',
  completedAt: '2026-10-24T00:01:00Z',
  videos: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      url: 'https://www.youtube.com/watch?v=aaa111',
      platform: 'youtube',
      status: 'done',
      failureReason: null,
      failureDetail: null,
      metadata: { url: 'https://www.youtube.com/watch?v=aaa111', platform: 'youtube', title: 'Why this mug is grumpy', channel: 'Mug Life', durationSeconds: 42 },
      transcript: 'hello world',
      transcriptLanguage: 'en',
      transcriptTruncated: false,
      breakdown: {
        hook: 'The mug complains in the first second',
        hookType: 'bold-claim',
        structure: ['Hook: complaint', 'Payoff: sip'],
        pacing: 'Fast cuts, no dead air.',
        topic: 'Office coffee',
        format: 'short-form vertical',
        whyItWorked: 'It names a shared annoyance immediately. The payoff lands fast.',
        replicableTakeaways: ['Open on the complaint, not the setup.'],
        transcriptAvailable: true,
        transcriptTruncated: false,
        confidence: 'high',
        confidenceReason: 'Full transcript analysed.',
      },
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      url: 'https://youtu.be/gone123',
      platform: 'youtube',
      status: 'failed',
      failureReason: 'DOWNLOAD_FAILED',
      failureDetail: 'This video could not be downloaded. It may have been removed, made private, or need a login to view.',
      metadata: null,
      transcript: null,
      transcriptLanguage: null,
      transcriptTruncated: false,
      breakdown: null,
    },
  ],
  report: {
    recurringHooks: [{ hookType: 'bold-claim', count: 1, exampleVideoIds: ['22222222-2222-4222-8222-222222222222'] }],
    commonFormats: [{ format: 'short-form vertical', count: 1 }],
    lengthInsights: ['Videos cluster under 60 seconds.'],
    postingPatterns: [],
    topicClusters: [{ topic: 'Office coffee', videoIds: ['22222222-2222-4222-8222-222222222222'] }],
    actionablePlaybook: [{ kind: 'do', text: 'Open on the complaint.', sourceVideoIds: ['22222222-2222-4222-8222-222222222222'] }],
    coverage: { attempted: 2, analysed: 1, transcriptBased: 1, metadataOnly: 0 },
    modelId: 'gemini-2.5-flash',
    provider: 'gemini',
    promptVersion: '1',
    generatedAt: '2026-10-24T00:01:00Z',
  },
  reportError: null,
};

describe('NicheForge gate', () => {
  it('renders only the placeholder in a browser context', async () => {
    render(<NicheForgeView subdomain="demo" />);
    expect(await screen.findByTestId('nicheforge-gate')).toBeInTheDocument();
    expect(screen.getByTestId('nicheforge-gate-message')).toHaveTextContent('NicheForge is a desktop-only feature');
    expect(screen.queryByTestId('nicheforge-workspace')).not.toBeInTheDocument();
    expect(screen.queryByTestId('key-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('run-form')).not.toBeInTheDocument();
  });

  it('renders the workspace in a desktop context', async () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    render(<NicheForgeView subdomain="demo" forceDesktop bridge={bridge} />);
    expect(await screen.findByTestId('nicheforge-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('keys-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('nicheforge-gate')).not.toBeInTheDocument();
  });
});

describe('KeysPanel', () => {
  it('masks the key, shows only the last 4, and clears the form after storing', async () => {
    const user = userEvent.setup();
    const bridge = new StubNicheforgeBridge({ keys: [], provider: defaultProviderHandler });
    const onChanged = vi.fn();
    render(<KeysPanel bridge={bridge} slots={[]} onChanged={onChanged} />);
    await user.type(screen.getByTestId('key-form-label'), 'Main Gemini key');
    await user.type(screen.getByTestId('key-form-key'), 'AIzaSySecretKeyMaterial1234');
    expect(screen.getByTestId('key-form-key')).toHaveAttribute('type', 'password');
    await user.click(screen.getByTestId('key-form-toggle-visibility'));
    expect(screen.getByTestId('key-form-key')).toHaveAttribute('type', 'text');
    await user.click(screen.getByTestId('key-form-submit'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.getByTestId('key-form-key')).toHaveValue('');
    const slots = await bridge.listKeySlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].maskedSuffix).toBe('1234');
    expect(slots[0]).not.toHaveProperty('key');
  });

  it('shows masked rows with validation states', async () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    render(<KeysPanel bridge={bridge} slots={[makeStubSlot({ n: 1, lastValidation: 'valid' })]} onChanged={() => undefined} />);
    expect(screen.getByTestId('key-masked')).toHaveTextContent('••••abcd');
    expect(screen.getByTestId('key-validation')).toHaveTextContent('Valid');
  });
});

describe('RunForm', () => {
  it('shows per-URL intake errors and disables Analyse', async () => {
    const user = userEvent.setup();
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    const slots = await bridge.listKeySlots();
    render(<RunForm slots={slots} runActive={false} readinessReady onStart={() => undefined} />);
    await user.type(screen.getByTestId('run-form-urls'), 'https://x.com/a/status/1');
    expect(await screen.findByTestId('run-form-url-error')).toHaveTextContent('Only YouTube, TikTok, Instagram and Facebook');
    expect(screen.getByTestId('run-form-submit')).toBeDisabled();
    expect(screen.getByTestId('run-form-disabled-reason')).toBeInTheDocument();
  });

  it('previews the platform per URL and enables Analyse for valid input', async () => {
    const user = userEvent.setup();
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    const slots = await bridge.listKeySlots();
    const onStart = vi.fn();
    render(<RunForm slots={slots} runActive={false} readinessReady onStart={onStart} />);
    await user.type(screen.getByTestId('run-form-urls'), 'https://www.youtube.com/watch?v=aaa111');
    expect(await screen.findByTestId('run-form-preview')).toHaveTextContent('youtube');
    expect(screen.getByTestId('run-form-submit')).toBeEnabled();
    await user.click(screen.getByTestId('run-form-submit'));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][0].inputs[0].platform).toBe('youtube');
  });

  it('explains the disabled reason when no key exists', () => {
    render(<RunForm slots={[]} runActive={false} readinessReady onStart={() => undefined} />);
    expect(screen.getByTestId('run-form-submit')).toBeDisabled();
    expect(screen.getByTestId('run-form-disabled-reason')).toHaveTextContent('Add an AI key');
  });
});

describe('RunProgress and RunDetail', () => {
  it('renders each video state and failure reasons', () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    render(<RunProgress run={{ ...completedRun, status: 'analysing' }} onCancel={() => undefined} />);
    expect(screen.getByTestId('run-progress-summary')).toHaveTextContent('1 of 2 videos done');
    expect(screen.getByText(/could not be downloaded/)).toBeInTheDocument();
  });

  it('renders breakdowns, report sections and failure reasons in detail', () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    render(<RunDetail run={completedRun} bridge={bridge} onDelete={() => undefined} onReRun={() => undefined} />);
    expect(screen.getByText(/The mug complains in the first second/)).toBeInTheDocument();
    expect(screen.getByText(/Open on the complaint, not the setup/)).toBeInTheDocument();
    expect(screen.getByText(/could not be downloaded/)).toBeInTheDocument();
    expect(screen.getByTestId('report-coverage')).toHaveTextContent('1 of 2 videos analysed');
  });
});

describe('ReportView copy', () => {
  it('writes the exact Markdown and shows Copied feedback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    render(<ReportView run={completedRun} bridge={bridge} />);
    await user.click(screen.getByTestId('report-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildReportMarkdown(completedRun)));
    expect(screen.getByTestId('report-copy')).toHaveTextContent('Copied');
  });
});

describe('Workspace delete flow', () => {
  it('asks for confirmation before deleting a run', async () => {
    const user = userEvent.setup();
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    bridge.runs.set(completedRun.id, structuredClone(completedRun));
    bridge.index.push({
      id: completedRun.id,
      title: completedRun.title,
      status: 'done',
      createdAt: completedRun.createdAt,
      videoCount: 2,
      successCount: 1,
    });
    render(<NicheForgeWorkspace bridge={bridge} />);
    const row = await screen.findByTestId('run-row');
    expect(within(row).getByText('Mug research')).toBeInTheDocument();
    await user.click(within(row).getByTestId('run-row-delete'));
    expect(await screen.findByTestId('run-delete-dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete run' }));
    await waitFor(() => expect(screen.queryByTestId('run-row')).not.toBeInTheDocument());
    expect(await bridge.listKeySlots()).toHaveLength(1);
  });
});
