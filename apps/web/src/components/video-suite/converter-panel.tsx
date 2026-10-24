'use client';

import React, { useEffect, useState } from 'react';
import type { ConversionQuality, ConversionResolution, ConversionTarget, ConversionJob, LocalFile } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shared/ui/select';
import { Banner } from '@/components/shared/ui/banner';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { pickMediaFile, probeFile } from './bridge-client';
import { ConversionJobRow } from './job-rows';
import type { FolderRef } from './downloader-panel';

export interface ConverterSource {
  scopeId: string;
  relativePath: string;
  name: string;
  displayPath: string;
  width: number | null;
  height: number | null;
}

const TARGET_LABELS: Record<ConversionTarget, string> = {
  mp4: 'MP4 — H.264 + AAC (library and composer safe)',
  webm: 'WebM — VP9 + Opus',
  m4a: 'M4A audio — AAC',
  opus: 'Opus audio',
};

const QUALITY_LABELS: Record<ConversionQuality, string> = {
  high: 'High',
  balanced: 'Balanced',
  small: 'Small file',
};

export function ConverterPanel({
  folder,
  toolsReady,
  readinessDetail,
  prefill,
  onClearPrefill,
  jobs,
  onQueueConversion,
  onCancel,
  onRetry,
}: {
  folder: FolderRef | null;
  toolsReady: boolean;
  readinessDetail: string | null;
  prefill: LocalFile | null;
  onClearPrefill: () => void;
  jobs: ConversionJob[];
  onQueueConversion: (input: {
    source: ConverterSource;
    target: ConversionTarget;
    resolution: ConversionResolution;
    quality: ConversionQuality;
  }) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [source, setSource] = useState<ConverterSource | null>(null);
  const [target, setTarget] = useState<ConversionTarget>('mp4');
  const [resolution, setResolution] = useState<ConversionResolution>('original');
  const [quality, setQuality] = useState<ConversionQuality>('balanced');
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (prefill !== null) {
      setSource({
        scopeId: prefill.scopeId,
        relativePath: prefill.relativePath,
        name: prefill.name,
        displayPath: prefill.absolutePath,
        width: prefill.width,
        height: prefill.height,
      });
    }
  }, [prefill]);

  async function handlePickFile(): Promise<void> {
    setPickError(null);
    try {
      const picked = await pickMediaFile();
      if (picked === null) return; // Picker cancelled — a no-op, never an error.
      let dims = { width: null as number | null, height: null as number | null };
      try {
        const probe = await probeFile(picked.scopeId, '');
        dims = { width: probe.width, height: probe.height };
      } catch {
        dims = { width: null, height: null };
      }
      setSource({ scopeId: picked.scopeId, relativePath: '', name: picked.name, displayPath: picked.path, width: dims.width, height: dims.height });
    } catch {
      setPickError('Could not open the file picker. Try again.');
    }
  }

  const requestedHeight = resolution === 'original' ? null : resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
  const downscaleNote =
    source !== null && requestedHeight !== null && source.height !== null && requestedHeight > source.height
      ? `This source is ${source.height}p, so ${resolution} keeps the original ${source.height}p (never upscaled).`
      : null;

  return (
    <section aria-label="Converter" className="flex flex-col gap-4">
      <Card className="gap-4 px-4 py-4">
        <h2 className="text-lg leading-heading font-semibold text-ink">Converter</h2>
        {!toolsReady ? (
          <Banner
            variant="warning"
            title="The video tools aren't ready yet. Wait for setup to finish, then try again."
            {...(readinessDetail !== null ? { description: readinessDetail } : {})}
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-body font-medium text-ink">Source</span>
          {source !== null ? (
            <p className="truncate text-body text-ink" title={source.displayPath}>
              {source.name}
              {prefill !== null ? (
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => { setSource(null); onClearPrefill(); }}>
                  Clear
                </Button>
              ) : null}
            </p>
          ) : (
            <p className="text-body text-ink-sub">Pick a file, or use Convert on a file below.</p>
          )}
          <Button variant="secondary" size="sm" className="self-start" onClick={() => void handlePickFile()}>
            Pick a file…
          </Button>
          {pickError !== null ? (
            <p role="alert" className="text-body text-ink">
              {pickError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="video-suite-target" className="text-body font-medium text-ink">
            Target
          </label>
          <Select value={target} onValueChange={(value) => setTarget(value as ConversionTarget)}>
            <SelectTrigger id="video-suite-target" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TARGET_LABELS) as ConversionTarget[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {TARGET_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {target === 'm4a' && source !== null && source.height !== null ? (
            <p className="text-body text-ink-sub">
              M4A keeps the source video stream in this bridge version (it has no stream-drop option), so an M4A converted from a video is not an audio-only file. Opus drops the video stream; MP3 is not available in this bridge version.
            </p>
          ) : null}
        </div>
        {(target === 'mp4' || target === 'webm') && (
          <div className="flex flex-col gap-2">
            <label htmlFor="video-suite-resolution" className="text-body font-medium text-ink">
              Resolution
            </label>
            <Select value={resolution} onValueChange={(value) => setResolution(value as ConversionResolution)}>
              <SelectTrigger id="video-suite-resolution" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
              </SelectContent>
            </Select>
            {downscaleNote !== null ? <p className="text-body text-ink-sub">{downscaleNote}</p> : null}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="video-suite-quality" className="text-body font-medium text-ink">
            Quality
          </label>
          <Select value={quality} onValueChange={(value) => setQuality(value as ConversionQuality)}>
            <SelectTrigger id="video-suite-quality" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(QUALITY_LABELS) as ConversionQuality[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {QUALITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-body text-ink-sub">
            Output: {folder?.path ?? 'No folder chosen — choose a download folder first.'}
          </p>
          <Button
            disabled={source === null || folder === null || !toolsReady}
            className="self-start"
            onClick={() => {
              if (source !== null) onQueueConversion({ source, target, resolution, quality });
            }}
          >
            Convert
          </Button>
        </div>
      </Card>

      <Card className="gap-2 px-0 py-2">
        <h3 className="px-4 text-body font-semibold text-ink">Conversions</h3>
        {jobs.length === 0 ? (
          <EmptyState type="first-use" title="No conversions yet" description="Convert a downloaded file to MP4, WebM, or audio." />
        ) : (
          <ul className="flex flex-col">
            {jobs.map((job) => (
              <ConversionJobRow key={job.id} job={job} onCancel={onCancel} onRetry={onRetry} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
