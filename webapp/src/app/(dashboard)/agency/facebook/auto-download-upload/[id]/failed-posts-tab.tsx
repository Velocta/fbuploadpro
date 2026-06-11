'use client'

import { AlertCircle, Calendar, CheckCircle2, Copy, ExternalLink, Hash, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export type FailedJob = {
  job_id: string
  reel_id: string
  reel_caption: string | null
  status: string
  last_error_code: string | null
  last_error_message: string | null
  updated_at: string
}

export function FailedPostsTab({ failedJobs }: { failedJobs: FailedJob[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (failedJobs.length === 0) {
    return (
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center shadow-2xl backdrop-blur-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5 mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No Failed Posts Found</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            All systems are operating normally. There are no failed publish attempts recorded for this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-destructive/10 to-orange-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <h3 className="text-lg font-semibold">Failed Posts & Reasons</h3>
            <p className="text-sm text-muted-foreground">
              Review failures and their associated error details.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {failedJobs.map((job) => {
            const formattedDate = new Date(job.updated_at).toLocaleString()
            return (
              <div
                key={job.job_id}
                className="rounded-xl border border-border/50 bg-background/40 p-4 transition-all hover:border-destructive/20 hover:bg-background/60"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive" className="capitalize text-[10px] px-2 py-0.5">
                        {job.status.replace(/_/g, ' ')}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <Hash className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[120px]" title={job.reel_id}>
                          Reel: {job.reel_id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(job.reel_id, `reel-${job.job_id}`)}
                          className="hover:text-primary transition-colors p-0.5"
                          title="Copy Reel ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copiedId === `reel-${job.job_id}` && (
                          <span className="text-[10px] text-emerald-500">Copied!</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span className="text-muted-foreground/30">|</span>
                        <span className="truncate max-w-[120px]" title={job.job_id}>
                          Job: {job.job_id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(job.job_id, `job-${job.job_id}`)}
                          className="hover:text-primary transition-colors p-0.5"
                          title="Copy Job ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copiedId === `job-${job.job_id}` && (
                          <span className="text-[10px] text-emerald-500">Copied!</span>
                        )}
                      </div>
                    </div>

                    {job.reel_caption && (
                      <p className="text-sm font-medium text-foreground line-clamp-2 italic bg-muted/20 rounded-lg p-2 border border-border/20">
                        "{job.reel_caption}"
                      </p>
                    )}

                    <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive uppercase tracking-wide">
                        <Info className="h-3.5 w-3.5" />
                        Code: {job.last_error_code || 'UNKNOWN_ERROR'}
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed break-words font-mono">
                        {job.last_error_message || 'No failure message provided by Graph API.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formattedDate}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
