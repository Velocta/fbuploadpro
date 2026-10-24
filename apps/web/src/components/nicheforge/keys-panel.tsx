'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  isBridgeSafeModelId,
  type NicheforgeKeySlot,
  type NicheforgeProvider,
} from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shared/ui/select';
import { Alert, AlertDescription } from '@/components/shared/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shared/ui/alert-dialog';
import type { NicheforgeBridge } from '@/lib/nicheforge/bridge-adapter';

const keyFormSchema = z
  .object({
    provider: z.enum(['gemini', 'openai-compatible']),
    label: z.string().trim().min(1, 'Give this key a label.').max(100),
    key: z.string().min(1, 'Paste your AI key.').max(500),
    baseUrl: z.string().trim().optional(),
    modelId: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.provider === 'openai-compatible' && (v.baseUrl === undefined || v.baseUrl === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'A base URL is required for OpenAI-compatible providers.' });
    }
    if (v.baseUrl !== undefined && v.baseUrl !== '' && !/^https:\/\//.test(v.baseUrl)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'Base URL must start with https://.' });
    }
    if (v.modelId !== undefined && v.modelId !== '' && !isBridgeSafeModelId(v.modelId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modelId'],
        message: 'Model names may only contain letters, numbers, dots, dashes and underscores.',
      });
    }
  });

type KeyFormValues = z.infer<typeof keyFormSchema>;

export interface KeysPanelProps {
  bridge: NicheforgeBridge;
  slots: NicheforgeKeySlot[];
  onChanged: () => void;
}

function validationLabel(slot: NicheforgeKeySlot): string {
  switch (slot.lastValidation) {
    case 'valid':
      return 'Valid';
    case 'invalid':
      return 'Invalid — check the key';
    case 'unreachable':
      return 'Could not reach provider';
    case 'quota-exhausted':
      return 'Out of quota';
    default:
      return 'Not checked yet';
  }
}

export function KeysPanel({ bridge, slots, onChanged }: Readonly<KeysPanelProps>) {
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keyFormSchema),
    mode: 'onTouched',
    defaultValues: { provider: 'gemini', label: '', key: '', baseUrl: '', modelId: '' },
  });
  const provider = form.watch('provider');

  async function handleValidSubmit(values: KeyFormValues) {
    setFormError(null);
    try {
      await bridge.storeKey({
        provider: values.provider as NicheforgeProvider,
        label: values.label,
        key: values.key,
        baseUrl: values.baseUrl === '' ? undefined : values.baseUrl,
        modelId: values.modelId === '' ? undefined : values.modelId,
      });
      // The key is discarded from form state immediately after storing.
      form.reset({ provider: values.provider, label: '', key: '', baseUrl: '', modelId: '' });
      setShowKey(false);
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this key.');
    }
  }

  async function handleValidate(slot: NicheforgeKeySlot) {
    setValidatingId(slot.id);
    try {
      const result = await bridge.validateKey(slot);
      await bridge.updateKeySlot({ ...slot, lastValidation: result, lastValidatedAt: new Date().toISOString() });
      onChanged();
    } catch {
      // Validation failure is advisory; the badge stays as-is.
    } finally {
      setValidatingId(null);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    await bridge.deleteKey(deleteId);
    setDeleteId(null);
    onChanged();
  }

  async function handleMove(slot: NicheforgeKeySlot, direction: -1 | 1) {
    const ids = slots.map((s) => s.id);
    const index = ids.indexOf(slot.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    next[index] = ids[target];
    next[target] = ids[index];
    await bridge.reorderKeySlots(next);
    onChanged();
  }

  return (
    <Card data-testid="keys-panel">
      <CardHeader>
        <CardTitle>AI keys</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-body text-ink-sub">
          NicheForge uses your own AI key. Keys are stored encrypted on this device and are only sent to your AI
          provider — never to FBUploadPro servers. Keys are shown masked, with only the last 4 characters visible.
        </p>
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <form
          onSubmit={form.handleSubmit(handleValidSubmit)}
          className="flex flex-col gap-3"
          data-testid="key-form"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="key-form-provider" className="text-metadata font-medium text-ink">
              Provider
            </label>
            <Select
              value={provider}
              onValueChange={(v) => form.setValue('provider', v as KeyFormValues['provider'], { shouldValidate: true })}
            >
              <SelectTrigger id="key-form-provider" data-testid="key-form-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="key-form-label" className="text-metadata font-medium text-ink">
              Label
            </label>
            <Input id="key-form-label" data-testid="key-form-label" placeholder="Main Gemini key" {...form.register('label')} />
            {form.formState.errors.label ? (
              <p className="text-metadata text-signal-critical">{form.formState.errors.label.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="key-form-key" className="text-metadata font-medium text-ink">
              API key
            </label>
            <div className="flex gap-2">
              <Input
                id="key-form-key"
                data-testid="key-form-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                placeholder="Paste your key"
                {...form.register('key')}
              />
              <Button type="button" variant="outline" onClick={() => setShowKey((v) => !v)} data-testid="key-form-toggle-visibility">
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            {form.formState.errors.key ? (
              <p className="text-metadata text-signal-critical">{form.formState.errors.key.message}</p>
            ) : null}
          </div>
          {provider === 'openai-compatible' ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="key-form-base-url" className="text-metadata font-medium text-ink">
                  Base URL
                </label>
                <Input
                  id="key-form-base-url"
                  data-testid="key-form-base-url"
                  placeholder="https://api.example.com/v1"
                  {...form.register('baseUrl')}
                />
                {form.formState.errors.baseUrl ? (
                  <p className="text-metadata text-signal-critical">{form.formState.errors.baseUrl.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="key-form-model" className="text-metadata font-medium text-ink">
                  Model (optional)
                </label>
                <Input id="key-form-model" data-testid="key-form-model" placeholder="Model id for this provider" {...form.register('modelId')} />
                {form.formState.errors.modelId ? (
                  <p className="text-metadata text-signal-critical">{form.formState.errors.modelId.message}</p>
                ) : null}
              </div>
            </>
          ) : null}
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting} data-testid="key-form-submit">
              Add key
            </Button>
          </div>
        </form>

        {slots.length === 0 ? (
          <p className="text-body text-ink-sub" data-testid="keys-empty">
            No keys yet. Add a key to start researching.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="keys-list">
            {slots.map((slot, index) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-2 border-t border-line pt-2" data-testid="key-row">
                <span className="text-body font-medium text-ink">{slot.label}</span>
                <span className="text-metadata text-ink-sub">{slot.provider}</span>
                <span className="text-body text-ink-sub" data-testid="key-masked">
                  ••••{slot.maskedSuffix}
                </span>
                <span className="text-metadata text-ink-sub" data-testid="key-validation">
                  {validationLabel(slot)}
                </span>
                {slot.cooldownUntil !== null && new Date(slot.cooldownUntil) > new Date() ? (
                  <span className="text-metadata text-ink-sub">Cooling down</span>
                ) : null}
                <span className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validatingId === slot.id}
                    onClick={() => handleValidate(slot)}
                    data-testid="key-validate"
                  >
                    {validatingId === slot.id ? 'Checking…' : 'Validate'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => handleMove(slot, -1)}
                    aria-label="Move key up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === slots.length - 1}
                    onClick={() => handleMove(slot, 1)}
                    aria-label="Move key down"
                  >
                    ↓
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDeleteId(slot.id)} data-testid="key-delete">
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-metadata text-ink-sub">
          Validation is a cheap check and advisory only — an unvalidated key can still run. If every key runs out of
          quota mid-run, the run keeps what it finished and tells you why.
        </p>
      </CardContent>
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent data-testid="key-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this key?</AlertDialogTitle>
            <AlertDialogDescription>
              The key will be removed from this device’s encrypted storage. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep key</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
