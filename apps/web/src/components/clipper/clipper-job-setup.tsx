'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CLIP_MODEL_INFO, ClipJobCreateSchema, type ClipModel } from '@fbuploadpro/contracts';
import type { z } from 'zod';
import {
  Button,
  Card,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/shared/ui';
import type { PickedFolder, PickedSource, ProbeResult, RuntimeStatus } from '@/lib/desktop/clipper-bridge';
import { CLIP_LIMITS } from '@fbuploadpro/contracts';

export type ClipperJobSetupValues = z.infer<typeof ClipJobCreateSchema>;

export interface ClipperJobSetupProps {
  runtime: RuntimeStatus | null;
  runtimeError: string | null;
  hasAiKey: boolean | null;
  source: PickedSource | null;
  probe: ProbeResult | null;
  probeError: string | null;
  probing: boolean;
  output: PickedFolder | null;
  onPickSource: () => void;
  onPickOutput: () => void;
  onStart: (values: ClipperJobSetupValues) => void;
  starting: boolean;
  aiEnabled: boolean;
  onAiEnabledChange: (enabled: boolean) => void;
  aiProvider: 'openai' | 'anthropic' | 'openai-compatible';
  onAiProviderChange: (provider: 'openai' | 'anthropic' | 'openai-compatible') => void;
  aiModel: string;
  onAiModelChange: (model: string) => void;
  aiBaseUrl: string;
  onAiBaseUrlChange: (baseUrl: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'unknown length';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return 'unknown size';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Job setup: source picker (probe on pick), model / clip-count / aspect
 * selects (RHF + ClipJobCreateSchema), output-folder picker, AI re-rank
 * switch (disabled with an explanation when no key is configured — the
 * key itself is never entered here; it lives in the shell's encrypted
 * storage). Start stays disabled until probing succeeds.
 */
export function ClipperJobSetup(props: Readonly<ClipperJobSetupProps>) {
  const form = useForm<ClipperJobSetupValues>({
    resolver: zodResolver(ClipJobCreateSchema),
    defaultValues: { model: 'base', clipCount: 5, aspect: 'vertical' },
  });
  const selectedModel = form.watch('model') as ClipModel;
  const startDisabled =
    props.starting || props.probing || !props.source || !props.probe || !props.output || props.runtime === null;
  const modelState = props.runtime ? props.runtime.models[selectedModel] : null;
  const modelBlocked = modelState === 'corrupt' || props.runtime?.ffmpegReady === false || props.runtime?.whisperReady === false;

  return (
    <Card data-testid="clipper-job-setup" className="flex flex-col gap-4 px-4 py-4">
      <h2 className="text-body font-semibold text-ink">New clip job</h2>
      {props.runtimeError && (
        <p data-testid="clipper-runtime-error" role="alert" className="text-body text-brand-rose">
          {props.runtimeError}
        </p>
      )}
      {props.runtime && !props.runtime.ffmpegReady && (
        <p role="alert" className="text-body text-brand-rose">
          The video tools are not ready in this desktop app yet, so jobs cannot start.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" data-testid="clipper-pick-source-btn" onClick={props.onPickSource} disabled={props.probing}>
          {props.source ? 'Choose a different video' : 'Choose a video'}
        </Button>
        {props.probing && <p className="text-body text-ink-sub">Checking your video…</p>}
        {props.probeError && (
          <p data-testid="clipper-probe-error" role="alert" className="text-body text-brand-rose">
            {props.probeError}
          </p>
        )}
        {props.source && props.probe && (
          <p data-testid="clipper-source-summary" className="text-body text-ink-sub">
            {props.source.name} · {formatDuration(props.probe.durationSeconds)} · {formatSize(props.probe.sizeBytes)}
            {props.probe.width && props.probe.height ? ` · ${props.probe.width}×${props.probe.height}` : ''}
          </p>
        )}
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(props.onStart)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transcription model</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="clipper-model-select">
                      <SelectValue placeholder="Choose a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CLIP_MODEL_INFO) as ClipModel[]).map((model) => (
                        <SelectItem key={model} value={model}>
                          {CLIP_MODEL_INFO[model].label} — {CLIP_MODEL_INFO[model].sizeNote}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {props.runtime && modelState && modelState !== 'installed' && (
                  <p className="text-body text-ink-sub">
                    {modelState === 'not-installed'
                      ? 'This model downloads on first use (about 145 MB for Base) with progress shown.'
                      : modelState === 'downloading'
                        ? 'This model is downloading.'
                        : 'This model failed its safety check and will be re-downloaded.'}
                  </p>
                )}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clipCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How many clips</FormLabel>
                <FormControl>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger data-testid="clipper-count-select">
                      <SelectValue placeholder="Choose a count" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: CLIP_LIMITS.MAX_CLIPS }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? 'clip' : 'clips'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="aspect"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Clip shape</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="clipper-aspect-select">
                      <SelectValue placeholder="Choose a shape" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertical">Vertical 9:16 (1080×1920, centre-cropped)</SelectItem>
                      <SelectItem value="original">Original (same shape as your video)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" data-testid="clipper-pick-output-btn" onClick={props.onPickOutput}>
              {props.output ? 'Choose a different output folder' : 'Choose an output folder'}
            </Button>
            {props.output && (
              <p data-testid="clipper-output-summary" className="text-body text-ink-sub">
                Clips will be saved to the folder you chose.
              </p>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Switch
              data-testid="clipper-ai-switch"
              checked={props.aiEnabled}
              onCheckedChange={props.onAiEnabledChange}
              disabled={props.hasAiKey !== true}
              aria-label="Re-rank clips with AI"
            />
            <div className="flex flex-col gap-1">
              <span className="text-body font-medium text-ink">Re-rank clips with AI (optional)</span>
              {props.hasAiKey === true ? (
                <span className="text-body text-ink-sub">
                  Uses your stored AI key. Only transcript text is sent to your own provider — never video or audio.
                </span>
              ) : (
                <span className="text-body text-ink-sub">
                  No AI key is stored in the desktop app, so this stays off. Local picks still work.
                </span>
              )}
            </div>
          </div>
          {props.aiEnabled && props.hasAiKey === true && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-body font-medium text-ink" htmlFor="clipper-ai-provider">AI provider</label>
                <Select value={props.aiProvider} onValueChange={(v) => props.onAiProviderChange(v as ClipperJobSetupProps['aiProvider'])}>
                  <SelectTrigger id="clipper-ai-provider" data-testid="clipper-ai-provider-select">
                    <SelectValue placeholder="Choose a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-body font-medium text-ink" htmlFor="clipper-ai-model">AI model</label>
                <Input
                  id="clipper-ai-model"
                  data-testid="clipper-ai-model-input"
                  value={props.aiModel}
                  onChange={(e) => props.onAiModelChange(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
              {props.aiProvider === 'openai-compatible' && (
                <div className="flex flex-col gap-2">
                  <label className="text-body font-medium text-ink" htmlFor="clipper-ai-base-url">Provider base URL (https)</label>
                  <Input
                    id="clipper-ai-base-url"
                    data-testid="clipper-ai-base-url-input"
                    value={props.aiBaseUrl}
                    onChange={(e) => props.onAiBaseUrlChange(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              )}
            </div>
          )}
          <Button type="submit" data-testid="clipper-start-btn" disabled={startDisabled || modelBlocked}>
            {props.starting ? 'Starting…' : 'Start job'}
          </Button>
          {props.source && props.probe && !props.output && (
            <p className="text-body text-ink-sub">Choose an output folder to start.</p>
          )}
        </form>
      </Form>
    </Card>
  );
}
