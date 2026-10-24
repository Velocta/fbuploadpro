'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NicheforgeKeySlot, NicheforgeRunIndexEntry, NicheforgeRunRecord } from '@fbuploadpro/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/ui/alert';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
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
import { createRunController, runResearchRun, type RunController } from '@/lib/nicheforge/run-pipeline';
import { deleteRunRecord, DamagedRunError, getRun, listRuns, reconcileInterruptedRuns, searchRuns } from '@/lib/nicheforge/run-store';
import { getTauriNicheforgeBridge } from '@/lib/nicheforge/tauri-bridge-adapter';
import { KeysPanel } from './keys-panel';
import { RunDetail } from './run-detail';
import { RunForm, type RunStartInput } from './run-form';
import { RunProgress } from './run-progress';
import { RunsList } from './runs-list';

export interface NicheForgeWorkspaceProps {
  bridge?: NicheforgeBridge;
}

export function NicheForgeWorkspace({ bridge }: Readonly<NicheForgeWorkspaceProps>) {
  const resolvedBridge = bridge ?? getTauriNicheforgeBridge();
  const [scopeState, setScopeState] = useState<'loading' | 'needs-pick' | 'ready' | 'error'>('loading');
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ binaryReady: boolean; storageReady: boolean } | null>(null);
  const [slots, setSlots] = useState<NicheforgeKeySlot[]>([]);
  const [entries, setEntries] = useState<NicheforgeRunIndexEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<NicheforgeRunRecord | 'damaged' | null>(null);
  const [damagedIds, setDamagedIds] = useState<Set<string>>(new Set());
  const [activeRun, setActiveRun] = useState<NicheforgeRunRecord | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [initialUrls, setInitialUrls] = useState('');
  const [formKey, setFormKey] = useState('initial');
  const controllerRef = useRef<RunController | null>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const all = await listRuns(resolvedBridge);
      setEntries(all);
      setListError(null);
    } catch {
      setListError('The research list could not be read. Your saved runs are still on this device — try reopening NicheForge.');
    }
  }, [resolvedBridge]);

  const refreshKeys = useCallback(async () => {
    try {
      setSlots(await resolvedBridge.listKeySlots());
    } catch {
      // Keys list failure surfaces on the next action; the panel stays usable.
    }
  }, [resolvedBridge]);

  const initAfterScope = useCallback(async () => {
    try {
      const ready = await resolvedBridge.checkReadiness();
      setReadiness(ready);
    } catch {
      setReadiness({ binaryReady: false, storageReady: false });
    }
    await reconcileInterruptedRuns(resolvedBridge);
    await refreshKeys();
    await refreshRuns();
  }, [resolvedBridge, refreshKeys, refreshRuns]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolvedBridge.resolveStoreScope();
        if (cancelled) return;
        if ('needsPick' in resolved) {
          setScopeState('needs-pick');
          return;
        }
        setScopeState('ready');
        await initAfterScope();
      } catch (err) {
        if (cancelled) return;
        setScopeState('error');
        setScopeError(err instanceof Error ? err.message : 'The research store could not be opened.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedBridge, initAfterScope]);

  async function handlePickFolder() {
    setScopeError(null);
    try {
      const picked = await resolvedBridge.pickStoreFolder();
      if ('cancelled' in picked) return;
      setScopeState('ready');
      await initAfterScope();
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : 'Could not choose a folder.');
    }
  }

  async function handleStart(input: RunStartInput) {
    setBanner(null);
    const controller = createRunController();
    controllerRef.current = controller;
    const result = await runResearchRun(input, resolvedBridge, controller, (run) => {
      setActiveRun({ ...run });
    });
    controllerRef.current = null;
    if (result.outcome === 'gate-failed') {
      setBanner(result.detail);
      setActiveRun(null);
      return;
    }
    setActiveRun(null);
    await refreshRuns();
    setSelectedId(result.run.id);
    setSelectedRun(result.run);
  }

  function handleCancel() {
    controllerRef.current?.cancel();
    void resolvedBridge.cancelCurrentOperation();
  }

  async function handleSelect(id: string) {
    setSelectedId(id);
    setBanner(null);
    if (activeRun !== null && activeRun.id === id) {
      setSelectedRun(activeRun);
      return;
    }
    try {
      setSelectedRun(await getRun(resolvedBridge, id));
    } catch (err) {
      if (err instanceof DamagedRunError) {
        setDamagedIds((prev) => new Set(prev).add(id));
        setSelectedRun('damaged');
      } else {
        setBanner('That research run could not be opened.');
      }
    }
  }

  async function handleDeleteConfirmed() {
    if (deleteId === null) return;
    try {
      await deleteRunRecord(resolvedBridge, deleteId);
    } catch {
      setBanner('That research run could not be deleted.');
    }
    setDeleteId(null);
    if (selectedId === deleteId) {
      setSelectedId(null);
      setSelectedRun(null);
    }
    setDamagedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteId);
      return next;
    });
    await refreshRuns();
  }

  function handleReRun(run: NicheforgeRunRecord) {
    setInitialUrls(run.videos.map((v) => v.url).join('\n'));
    setFormKey(`rerun-${run.id}-${Date.now()}`);
    setSelectedId(null);
    setSelectedRun(null);
  }

  const visibleEntries = searchRuns(entries, search);
  const readinessReady = readiness !== null && readiness.binaryReady && readiness.storageReady;
  const selectedIsActive = selectedRun !== null && selectedRun !== 'damaged' && activeRun !== null && activeRun.id === selectedRun.id;

  if (scopeState === 'loading') {
    return (
      <div data-testid="nicheforge-workspace" className="flex flex-col gap-4 px-6 py-6">
        <p className="text-body text-ink-sub">Opening your research…</p>
      </div>
    );
  }

  if (scopeState === 'needs-pick' || scopeState === 'error') {
    return (
      <div data-testid="nicheforge-workspace" className="flex flex-col gap-4 px-6 py-6">
        <Card data-testid="nicheforge-store-setup">
          <CardHeader>
            <CardTitle>Choose a folder for your research</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body text-ink-sub">
              NicheForge keeps research on this device only. Choose a folder where your research runs and keys list
              will be stored. You can pick the same folder again after restarting the app.
            </p>
            {scopeError ? (
              <Alert variant="destructive">
                <AlertDescription>{scopeError}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <Button onClick={handlePickFolder} data-testid="nicheforge-pick-folder">
                Choose folder
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="nicheforge-workspace" className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl leading-heading font-semibold text-ink">NicheForge</h1>
        <p className="text-body text-ink-sub">
          Study public videos and learn what makes them work — with your own AI key, on your own device.
        </p>
      </div>
      {readiness !== null && !readiness.binaryReady ? (
        <Alert data-testid="nicheforge-not-ready">
          <AlertTitle>Desktop tools not ready</AlertTitle>
          <AlertDescription>
            The video download tool is still setting up. Runs cannot start until it is ready.
          </AlertDescription>
        </Alert>
      ) : null}
      {banner ? (
        <Alert variant="destructive" data-testid="nicheforge-banner">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      {listError ? (
        <Alert variant="destructive" data-testid="nicheforge-list-error">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}
      <KeysPanel bridge={resolvedBridge} slots={slots} onChanged={refreshKeys} />
      <RunForm
        key={formKey}
        slots={slots}
        runActive={activeRun !== null}
        readinessReady={readinessReady}
        initialUrls={initialUrls}
        onStart={handleStart}
      />
      {activeRun ? <RunProgress run={activeRun} onCancel={handleCancel} /> : null}
      {selectedRun === 'damaged' ? (
        <Card data-testid="run-damaged">
          <CardHeader>
            <CardTitle>Damaged research run</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body text-ink-sub">
              This research run’s saved file is damaged and cannot be opened. You can delete it to remove it from the
              list.
            </p>
            <div>
              <Button variant="outline" onClick={() => selectedId !== null && setDeleteId(selectedId)} data-testid="run-damaged-delete">
                Delete damaged run
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {selectedRun !== null && selectedRun !== 'damaged' && !selectedIsActive ? (
        <RunDetail run={selectedRun} bridge={resolvedBridge} onDelete={(id) => setDeleteId(id)} onReRun={handleReRun} />
      ) : null}
      {/* When the selected run is the active run, the standalone progress
          card above already shows it — rendering a second one would
          duplicate the live view. */}
      <RunsList
        entries={visibleEntries}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        damagedIds={damagedIds}
        onSelect={handleSelect}
        onDelete={(id) => setDeleteId(id)}
        onStartNew={() => {
          setInitialUrls('');
          setFormKey(`new-${Date.now()}`);
        }}
      />
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent data-testid="run-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this research run?</AlertDialogTitle>
            <AlertDialogDescription>
              The run and its report will be permanently removed from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep run</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>Delete run</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
