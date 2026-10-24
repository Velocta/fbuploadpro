'use client';

import React, { useState } from 'react';
import { buildReportMarkdown, reportFilename, type NicheforgeRunRecord } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import type { NicheforgeBridge } from '@/lib/nicheforge/bridge-adapter';

export interface ReportViewProps {
  run: NicheforgeRunRecord;
  bridge: NicheforgeBridge;
}

export function ReportView({ run, bridge }: Readonly<ReportViewProps>) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const report = run.report;

  async function handleCopy() {
    const markdown = buildReportMarkdown(run);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = markdown;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      } catch {
        setCopyError('Could not copy the report. Select the text manually.');
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaveMessage(null);
    try {
      const result = await bridge.saveMarkdownReport(reportFilename(run.title), buildReportMarkdown(run));
      if (result.cancelled) return;
      setSaveMessage(result.saved ? 'Report saved.' : 'Report was not saved.');
    } catch {
      setSaveMessage('Could not save the report.');
    }
  }

  return (
    <Card data-testid="report-view">
      <CardHeader>
        <CardTitle>Pattern report</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report === null ? (
          <p className="text-body text-ink-sub" data-testid="report-missing">
            The pattern report could not be generated, but the video breakdowns above are complete.
          </p>
        ) : (
          <div className="flex flex-col gap-3" data-testid="report-content">
            <p className="text-body text-ink-sub" data-testid="report-coverage">
              Coverage: {report.coverage.analysed} of {report.coverage.attempted} videos analysed (
              {report.coverage.transcriptBased} with captions, {report.coverage.metadataOnly} from details only).
            </p>
            {report.recurringHooks.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Recurring hooks</h3>
                <ul className="flex flex-col gap-1">
                  {report.recurringHooks.map((h) => (
                    <li key={h.hookType} className="text-body text-ink-sub">
                      {h.hookType} — seen in {h.count} {h.count === 1 ? 'video' : 'videos'}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {report.commonFormats.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Common formats</h3>
                <ul className="flex flex-col gap-1">
                  {report.commonFormats.map((f) => (
                    <li key={f.format} className="text-body text-ink-sub">
                      {f.format} ({f.count})
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {report.lengthInsights.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Length insights</h3>
                <ul className="flex flex-col gap-1">
                  {report.lengthInsights.map((item) => (
                    <li key={item} className="text-body text-ink-sub">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {report.postingPatterns.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Posting patterns</h3>
                <p className="text-metadata text-ink-sub">Only what this run’s videos support — not a channel schedule.</p>
                <ul className="flex flex-col gap-1">
                  {report.postingPatterns.map((item) => (
                    <li key={item} className="text-body text-ink-sub">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {report.topicClusters.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Topic clusters</h3>
                <ul className="flex flex-col gap-1">
                  {report.topicClusters.map((t) => (
                    <li key={t.topic} className="text-body text-ink-sub">
                      {t.topic} ({t.videoIds.length} {t.videoIds.length === 1 ? 'video' : 'videos'})
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {report.actionablePlaybook.length > 0 ? (
              <section>
                <h3 className="text-body font-semibold text-ink">Playbook</h3>
                <ul className="flex flex-col gap-1">
                  {report.actionablePlaybook.map((item) => (
                    <li key={`${item.kind}-${item.text}`} className="text-body text-ink-sub">
                      {item.kind === 'do' ? 'Do' : 'Don’t'}: {item.text}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <p className="text-metadata text-ink-sub" data-testid="report-provenance">
              Generated with {report.provider} model {report.modelId}, prompt version {report.promptVersion}.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleCopy} data-testid="report-copy">
            {copied ? 'Copied' : 'Copy report'}
          </Button>
          <Button type="button" variant="outline" onClick={handleSave} data-testid="report-save">
            Save as Markdown
          </Button>
        </div>
        {copyError ? (
          <p className="text-metadata text-signal-critical" data-testid="report-copy-error">
            {copyError}
          </p>
        ) : null}
        {saveMessage ? (
          <p className="text-metadata text-ink-sub" data-testid="report-save-message">
            {saveMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
