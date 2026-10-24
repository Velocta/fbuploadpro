'use client';

import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  isBridgeSafeModelId,
  NICHEFORGE_MAX_URLS,
  parseVideoUrlBlock,
  type NicheforgeKeySlot,
  type NicheforgeProvider,
  type NicheforgeVideoInput,
} from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shared/ui/select';
import { Alert, AlertDescription } from '@/components/shared/ui/alert';

const runFormSchema = z.object({
  title: z.string().trim().max(100, 'Title must be 100 characters or fewer.').optional(),
  urls: z.string().min(1, 'Paste at least one video link.'),
  provider: z.enum(['gemini', 'openai-compatible']),
  modelId: z.string().trim().optional(),
}).superRefine((v, ctx) => {
  if (v.modelId !== undefined && v.modelId !== '' && !isBridgeSafeModelId(v.modelId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['modelId'],
      message: 'Model names may only contain letters, numbers, dots, dashes and underscores.',
    });
  }
});

type RunFormValues = z.infer<typeof runFormSchema>;

export interface RunStartInput {
  title?: string;
  inputs: NicheforgeVideoInput[];
  provider: NicheforgeProvider;
  modelId?: string;
}

export interface RunFormProps {
  slots: NicheforgeKeySlot[];
  runActive: boolean;
  readinessReady: boolean;
  initialUrls?: string;
  onStart: (input: RunStartInput) => void;
}

export function RunForm({ slots, runActive, readinessReady, initialUrls = '', onStart }: Readonly<RunFormProps>) {
  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    mode: 'onTouched',
    defaultValues: { title: '', urls: initialUrls, provider: 'gemini', modelId: '' },
  });
  const urlsValue = form.watch('urls');
  const provider = form.watch('provider');

  const parsed = useMemo(() => parseVideoUrlBlock(urlsValue), [urlsValue]);
  const keysForProvider = slots.filter((s) => s.provider === provider);
  const overLimit = parsed.inputs.length > NICHEFORGE_MAX_URLS;

  let disabledReason: string | null = null;
  if (runActive) disabledReason = 'A research run is already active.';
  else if (!readinessReady) disabledReason = 'The desktop tools are not ready yet.';
  else if (keysForProvider.length === 0) disabledReason = 'Add an AI key for this provider first.';
  else if (parsed.inputs.length === 0) disabledReason = 'Paste at least one supported video link.';
  else if (parsed.errors.length > 0) disabledReason = 'Fix the unsupported links below.';
  else if (overLimit) disabledReason = `NicheForge analyses up to ${NICHEFORGE_MAX_URLS} videos per run.`;

  function handleValidSubmit(values: RunFormValues) {
    const fresh = parseVideoUrlBlock(values.urls);
    onStart({
      ...(values.title !== undefined && values.title !== '' ? { title: values.title } : {}),
      inputs: fresh.inputs.slice(0, NICHEFORGE_MAX_URLS),
      provider: values.provider as NicheforgeProvider,
      ...(values.modelId !== undefined && values.modelId !== '' ? { modelId: values.modelId } : {}),
    });
  }

  return (
    <Card data-testid="run-form">
      <CardHeader>
        <CardTitle>New research run</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-body text-ink-sub">
          Videos are analysed and then removed from this device — only the report is kept. Paste 1–20 YouTube,
          TikTok, Instagram or Facebook video links, one per line.
        </p>
        <form onSubmit={form.handleSubmit(handleValidSubmit)} className="flex flex-col gap-3" data-testid="run-form-element">
          <div className="flex flex-col gap-1">
            <label htmlFor="run-form-title" className="text-metadata font-medium text-ink">
              Title (optional)
            </label>
            <Input id="run-form-title" data-testid="run-form-title" placeholder="Research run" {...form.register('title')} />
            {form.formState.errors.title ? (
              <p className="text-metadata text-signal-critical">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="run-form-provider" className="text-metadata font-medium text-ink">
              Provider
            </label>
            <Select
              value={provider}
              onValueChange={(v) => form.setValue('provider', v as RunFormValues['provider'], { shouldValidate: true })}
            >
              <SelectTrigger id="run-form-provider" data-testid="run-form-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="run-form-model" className="text-metadata font-medium text-ink">
              Model (optional — defaults to the provider default)
            </label>
            <Input id="run-form-model" data-testid="run-form-model" placeholder="Leave blank for the default model" {...form.register('modelId')} />
            {form.formState.errors.modelId ? (
              <p className="text-metadata text-signal-critical">{form.formState.errors.modelId.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="run-form-urls" className="text-metadata font-medium text-ink">
              Video links (one per line)
            </label>
            <Textarea
              id="run-form-urls"
              data-testid="run-form-urls"
              rows={6}
              placeholder={'https://www.youtube.com/watch?v=…\nhttps://www.tiktok.com/@…/video/…'}
              {...form.register('urls')}
            />
            {form.formState.errors.urls ? (
              <p className="text-metadata text-signal-critical">{form.formState.errors.urls.message}</p>
            ) : null}
          </div>
          {parsed.inputs.length > 0 ? (
            <ul className="flex flex-col gap-1" data-testid="run-form-preview">
              {parsed.inputs.map((input) => (
                <li key={input.url} className="text-metadata text-ink-sub">
                  {input.platform} — {input.url}
                </li>
              ))}
            </ul>
          ) : null}
          {parsed.duplicateCount > 0 ? (
            <p className="text-metadata text-ink-sub" data-testid="run-form-duplicates">
              {parsed.duplicateCount} duplicate {parsed.duplicateCount === 1 ? 'link' : 'links'} removed.
            </p>
          ) : null}
          {parsed.errors.map((error) => (
            <p key={`${error.line}-${error.url}`} className="text-metadata text-signal-critical" data-testid="run-form-url-error">
              Line {error.line}: {error.detail}
            </p>
          ))}
          {overLimit ? (
            <Alert variant="destructive">
              <AlertDescription>NicheForge analyses up to {NICHEFORGE_MAX_URLS} videos per run.</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1">
            <Button type="submit" disabled={disabledReason !== null} data-testid="run-form-submit">
              Analyse
            </Button>
            {disabledReason ? (
              <p className="text-metadata text-ink-sub" data-testid="run-form-disabled-reason">
                {disabledReason}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
