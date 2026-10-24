/**
 * @vitest-environment jsdom
 * Spec 148 component tests — mocked ClipperBridge (never the shell):
 * gate vs. workspace rendering, Start disabled without a probe, each
 * stage rendering, failure message + Details, clip rows with excerpt +
 * reason Tags, import dialog folder list.
 */
import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClipperView } from '@/components/clipper/clipper-view';
import type { ClipperBridge, RuntimeStatus } from '@/lib/desktop/clipper-bridge';
import type { ClipJob, ClipSelection } from '@fbuploadpro/contracts';

function readyClip(overrides: Partial<ClipSelection> = {}): ClipSelection {
  return {
    id: 'clip-01',
    startSeconds: 25,
    endSeconds: 50,
    durationSeconds: 25,
    excerpt: 'What happened next?',
    reasons: ['question', 'punchline'],
    score: 55,
    aiRanked: false,
    exportStatus: 'exported',
    ...overrides,
  };
}

function jobWith(overrides: Partial<ClipJob>): ClipJob {
  return {
    id: 'job-1',
    schemaVersion: 1,
    sourceName: 'talk.mp4',
    sourcePathHash: '9-abc',
    sourceDurationSeconds: 600,
    model: 'base',
    clipCount: 5,
    aspect: 'vertical',
    status: 'ready',
    stagePercent: 100,
    clips: [],
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockBridge(overrides: Partial<ClipperBridge> = {}): ClipperBridge {
  const base: ClipperBridge = {
    getShellInfo: vi.fn(async () => ({ bridgeVersion: '1.0.0' })),
    pickSource: vi.fn(async () => null),
    pickOutputFolder: vi.fn(async () => null),
    probeSource: vi.fn(async () => ({ durationSeconds: 600, sizeBytes: 1000, width: 1920, height: 1080, hasAudio: true })),
    getRuntimeStatus: vi.fn(async (): Promise<RuntimeStatus> => ({
      ffmpegReady: true,
      whisperReady: true,
      models: { tiny: 'installed', base: 'installed', small: 'not-installed' },
    })),
    ensureModel: vi.fn(async () => undefined),
    hasAiKey: vi.fn(async () => false),
    aiRerank: vi.fn(async () => []),
    listJobs: vi.fn(() => []),
    getJob: vi.fn(() => null),
    saveJob: vi.fn(() => undefined),
    deleteJob: vi.fn(async () => undefined),
    markInterruptedJobs: vi.fn(() => undefined),
    registerSession: vi.fn(() => undefined),
    getSession: vi.fn(() => undefined),
    runJob: vi.fn(async (job: ClipJob) => ({ job })),
    exportClips: vi.fn(async (job: ClipJob) => job),
    cancelJob: vi.fn(async () => undefined),
  };
  return { ...base, ...overrides };
}

function renderView(bridge: ClipperBridge, forceDesktop = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClipperView subdomain="acme" forceDesktop={forceDesktop} bridge={bridge} />
    </QueryClientProvider>,
  );
}

const FOLDERS_BODY = {
  folders: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      parentId: null,
      name: 'Shorts',
      itemCount: 3,
      subfolderCount: 0,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  unorganizedCount: 0,
};

describe('ClipperView gate', () => {
  it('renders the desktop-only gate in a plain browser context', () => {
    renderView(makeMockBridge(), false);
    expect(screen.getByTestId('clipper-gate')).toBeInTheDocument();
    expect(screen.getByTestId('clipper-gate-message')).toHaveTextContent('Clipper runs in the FBUploadPro desktop app.');
    expect(screen.queryByTestId('clipper-workspace')).not.toBeInTheDocument();
    // No download URL and no fake button anywhere in the gate.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('ClipperWorkspace', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        if (typeof url === 'string' && url.includes('/media/folders')) {
          return new Response(JSON.stringify(FOLDERS_BODY), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the setup form in a forced-desktop context with Start disabled and no source', async () => {
    renderView(makeMockBridge());
    expect(await screen.findByTestId('clipper-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('clipper-job-setup')).toBeInTheDocument();
    expect(screen.getByTestId('clipper-start-btn')).toBeDisabled();
    expect(screen.getByTestId('clipper-pick-source-btn')).toBeInTheDocument();
    expect(screen.getByTestId('clipper-pick-output-btn')).toBeInTheDocument();
  });

  it('disables the AI switch with an explanation when no key is configured', async () => {
    renderView(makeMockBridge());
    const aiSwitch = await screen.findByTestId('clipper-ai-switch');
    expect(aiSwitch).toBeDisabled();
    expect(screen.getByText(/No AI key is stored in the desktop app/)).toBeInTheDocument();
  });

  it('renders each active stage with percent and elapsed time', async () => {
    const transcribing = jobWith({ status: 'transcribing', stagePercent: 0, elapsedSeconds: 42 });
    const bridge = makeMockBridge({
      listJobs: vi.fn(() => [transcribing]),
      getJob: vi.fn(() => transcribing),
    });
    renderView(bridge);
    await screen.findByTestId('clipper-job-list');
    await userEvent.click(screen.getByTestId(`clipper-job-select-${transcribing.id}`));
    expect(await screen.findByTestId('clipper-stage-label')).toHaveTextContent('Transcribing');
    expect(screen.getByTestId('clipper-stage-percent')).toHaveTextContent('0%');
    expect(screen.getByTestId('clipper-elapsed')).toHaveTextContent(/0:4[23] elapsed/);
    expect(screen.getByTestId('clipper-cancel-btn')).toBeInTheDocument();
  });

  it('renders a failure message with a Details expander', async () => {
    const failed = jobWith({
      status: 'failed',
      stagePercent: 0,
      error: { code: 'NO_SPEECH_DETECTED', message: 'No speech was found in this video.', detail: 'wordCount=12' },
    });
    const bridge = makeMockBridge({
      listJobs: vi.fn(() => [failed]),
      getJob: vi.fn(() => failed),
    });
    renderView(bridge);
    await screen.findByTestId('clipper-job-list');
    await userEvent.click(screen.getByTestId(`clipper-job-select-${failed.id}`));
    expect(await screen.findByTestId('clipper-job-error')).toHaveTextContent('No speech was found in this video.');
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByTestId(`clipper-job-retry-${failed.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`clipper-job-new-${failed.id}`)).toBeInTheDocument();
  });

  it('shows clip rows with excerpt, reason Tags, and import actions', async () => {
    const ready = jobWith({ status: 'ready', clips: [readyClip(), readyClip({ id: 'clip-02', startSeconds: 75, endSeconds: 100, excerpt: 'Why did the rocket orbit shift today?', reasons: ['question', 'topic-change'], exportStatus: 'pending' })] });
    const bridge = makeMockBridge({
      listJobs: vi.fn(() => [ready]),
      getJob: vi.fn(() => ready),
    });
    renderView(bridge);
    await screen.findByTestId('clipper-job-list');
    await userEvent.click(screen.getByTestId(`clipper-job-select-${ready.id}`));
    const row = await screen.findByTestId('clipper-clip-row-clip-01');
    expect(within(row).getByTestId('clipper-clip-excerpt-clip-01')).toHaveTextContent('What happened next?');
    expect(within(row).getByTestId('clipper-clip-reason-clip-01-question')).toHaveTextContent('Asks a question');
    expect(within(row).getByTestId('clipper-clip-reason-clip-01-punchline')).toHaveTextContent('Punchline');
    expect(screen.getByTestId('clipper-import-btn-clip-01')).toHaveTextContent('Import into library');
    expect(screen.getByTestId('clipper-export-btn')).toBeInTheDocument();
  });

  it('opens the import dialog and lists existing folders', async () => {
    const ready = jobWith({ status: 'ready', clips: [readyClip()] });
    const bridge = makeMockBridge({
      listJobs: vi.fn(() => [ready]),
      getJob: vi.fn(() => ready),
    });
    renderView(bridge);
    await screen.findByTestId('clipper-job-list');
    await userEvent.click(screen.getByTestId(`clipper-job-select-${ready.id}`));
    await userEvent.click(await screen.findByTestId('clipper-import-btn-clip-01'));
    expect(await screen.findByTestId('clipper-import-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('clipper-import-file')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('clipper-import-folder-select'));
    await waitFor(() => expect(screen.getByText('Shorts')).toBeInTheDocument());
    expect(screen.getByTestId('clipper-import-btn')).toBeDisabled();
  });

  it('offers Retry only for retryable failures', async () => {
    const interrupted = jobWith({
      status: 'failed',
      error: { code: 'INTERRUPTED', message: 'This job was interrupted. You can retry it.' },
    });
    const bridge = makeMockBridge({
      listJobs: vi.fn(() => [interrupted]),
      getJob: vi.fn(() => interrupted),
    });
    renderView(bridge);
    await screen.findByTestId('clipper-job-list');
    expect(screen.getByTestId(`clipper-job-retry-${interrupted.id}`)).toBeInTheDocument();
  });
});
