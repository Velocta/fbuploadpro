import { describe, expect, it } from 'vitest';
import type { ConversionJob, DownloadJob } from '@fbuploadpro/contracts';
import {
  applyConversionProgress,
  applyDownloadProgress,
  cancelConversionJob,
  cancelDownloadJob,
  completeConversionJob,
  completeDownloadJob,
  createConversionJob,
  createDownloadJob,
  failConversionJob,
  markStaleConversionJobsOnLoad,
  markStaleDownloadJobsOnLoad,
  parsePersistedDownloadJob,
  retryConversionJob,
  retryDownloadJob,
  startConversionJob,
  startDownloadJob,
} from './job-machines';

function download(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    url: 'https://example.com/watch?v=1',
    title: 'Test',
    choice: { kind: 'preset', preset: 'best' },
    destinationFolder: '/tmp/videos',
    fileName: 'Test',
    status: 'queued',
    progress: null,
    errorCode: null,
    errorDetail: null,
    finalPath: null,
    finalSizeBytes: null,
    note: null,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

function conversion(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    sourcePath: '/tmp/videos/a.mp4',
    sourceName: 'a.mp4',
    sourceScopeId: 'scope-1',
    inputRelativePath: 'a.mp4',
    target: 'mp4',
    resolution: 'original',
    quality: 'balanced',
    outputFolder: '/tmp/videos',
    outputFileName: 'a (2).mp4',
    status: 'queued',
    progress: null,
    errorCode: null,
    errorDetail: null,
    finalPath: null,
    finalSizeBytes: null,
    note: null,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

function progress(phase: 'downloading' | 'converting' | 'postprocessing', percent: number | null) {
  return {
    operationId: 'run-1',
    phase,
    bytesProcessed: 0,
    totalBytes: null,
    speedBytesPerSecond: null,
    etaSeconds: null,
    percent,
    finalPath: null,
    finalSizeBytes: null,
    errorCode: null,
    errorDetail: null,
  };
}

describe('download job machine', () => {
  it('queued → downloading → postprocessing → completed', () => {
    let job = download();
    job = startDownloadJob(job);
    expect(job.status).toBe('downloading');
    job = applyDownloadProgress(job, progress('downloading', 50));
    expect(job.status).toBe('downloading');
    expect(job.progress?.percent).toBe(50);
    job = applyDownloadProgress(job, progress('postprocessing', null));
    expect(job.status).toBe('postprocessing');
    job = completeDownloadJob(job, '/tmp/videos/Test.mp4', 1234);
    expect(job.status).toBe('completed');
    expect(job.finalPath).toBe('/tmp/videos/Test.mp4');
    expect(job.finalSizeBytes).toBe(1234);
  });
  it('illegal transitions are no-ops', () => {
    const job = download({ status: 'completed', finalPath: '/tmp/x.mp4' });
    expect(startDownloadJob(job).status).toBe('completed');
    expect(applyDownloadProgress(job, progress('downloading', 10)).progress).toBeNull();
    expect(completeDownloadJob(job, '/tmp/other.mp4', 1).finalPath).toBe('/tmp/x.mp4');
  });
  it('terminal states are absorbing, including cancel-after-complete', () => {
    const done = download({ status: 'completed' });
    expect(cancelDownloadJob(done).status).toBe('completed');
    const failed = download({ status: 'failed', errorCode: 'unknown' });
    expect(cancelDownloadJob(failed).status).toBe('failed');
  });
  it('cancel is idempotent and distinct from failure', () => {
    const job = cancelDownloadJob(download({ status: 'downloading' }));
    expect(job.status).toBe('cancelled');
    expect(job.errorCode).toBe('cancelled');
    expect(cancelDownloadJob(job).status).toBe('cancelled');
  });
  it('failure keeps the code and a retry action path', () => {
    const failed = failConversionJob(conversion(), 'conversion_failed', 'boom');
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('conversion_failed');
    const retried = retryConversionJob(failed);
    expect(retried.id).not.toBe(failed.id);
    expect(retried.status).toBe('queued');
    expect(retried.target).toBe(failed.target);
  });
  it('retry-as-new-job keeps history inputs for downloads', () => {
    const failed = download({ status: 'failed', errorCode: 'network_failure' });
    const retried = retryDownloadJob(failed);
    expect(retried.id).not.toBe(failed.id);
    expect(retried.url).toBe(failed.url);
    expect(retried.choice).toEqual(failed.choice);
    expect(retried.status).toBe('queued');
  });
  it('create helpers produce valid queued jobs', () => {
    const job = createDownloadJob({ url: 'https://example.com/v', title: 'T', choice: { kind: 'preset', preset: 'best_720' }, destinationFolder: '/tmp', fileName: 'T' });
    expect(job.status).toBe('queued');
    expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
    const conv = createConversionJob({
      sourcePath: '/tmp/a.mp4', sourceName: 'a.mp4', sourceScopeId: 's', inputRelativePath: 'a.mp4',
      target: 'webm', resolution: '720p', quality: 'small', outputFolder: '/tmp', outputFileName: 'a.webm',
    });
    expect(conv.status).toBe('queued');
    expect(startConversionJob(conv).status).toBe('converting');
    expect(applyConversionProgress(startConversionJob(conv), progress('converting', 25)).progress?.percent).toBe(25);
    expect(completeConversionJob(conv, '/tmp/a.webm', 99, 'note').finalSizeBytes).toBe(99);
  });
  it('stale running jobs are re-marked failed/unknown on load', () => {
    const jobs = markStaleDownloadJobsOnLoad([download({ status: 'downloading' }), download({ status: 'completed' })]);
    expect(jobs[0].status).toBe('failed');
    expect(jobs[0].errorCode).toBe('unknown');
    expect(jobs[0].errorDetail).toContain('closed while this was running');
    expect(jobs[1].status).toBe('completed');
    const convs = markStaleConversionJobsOnLoad([conversion({ status: 'converting' })]);
    expect(convs[0].status).toBe('failed');
  });
  it('corrupt persisted records are rejected individually', () => {
    expect(parsePersistedDownloadJob({ ...download(), status: 'fetching' })).toBeNull();
    expect(parsePersistedDownloadJob(download())).not.toBeNull();
    expect(parsePersistedDownloadJob('garbage')).toBeNull();
  });
});
