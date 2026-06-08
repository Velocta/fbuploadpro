'use client'

import { useMemo, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SourcePlatform } from '@/lib/source-identity'
import {
  buildBulkSourcePastePreview,
  canApplyBulkSourcePastePreview,
  type BulkSourcePastePageTarget,
} from '@/lib/adu-bulk-source-paste'

export type BulkSourcePasteAssignment = {
  sourcePlatform: SourcePlatform
  sourceUsername: string
}

type BulkSourcePasteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  pages: BulkSourcePastePageTarget[]
  defaultPlatform: SourcePlatform
  onDefaultPlatformChange: (platform: SourcePlatform) => void
  existingByPageKey: Record<string, BulkSourcePasteAssignment | undefined>
  onApply: (assignmentByPageKey: Record<string, BulkSourcePasteAssignment>) => void
}

export function BulkSourcePasteDialog({
  open,
  onOpenChange,
  disabled = false,
  pages,
  defaultPlatform,
  onDefaultPlatformChange,
  existingByPageKey,
  onApply,
}: BulkSourcePasteDialogProps) {
  const [text, setText] = useState('')

  const emptyPageCount = useMemo(
    () =>
      pages.filter((page) => !existingByPageKey[page.key]?.sourceUsername?.trim()).length,
    [pages, existingByPageKey],
  )

  const preview = useMemo(
    () => buildBulkSourcePastePreview(text, pages, defaultPlatform, existingByPageKey),
    [text, pages, defaultPlatform, existingByPageKey],
  )

  const canApply = canApplyBulkSourcePastePreview(preview)

  function applyAssignment() {
    const mapped: Record<string, BulkSourcePasteAssignment> = {}
    for (const [pageKey, value] of Object.entries(preview.assignmentByPageKey)) {
      mapped[pageKey] = {
        sourcePlatform: value.sourcePlatform,
        sourceUsername: value.sourceUsername,
      }
    }
    onApply(mapped)
    setText('')
    onOpenChange(false)
  }

  function handleApplyClick() {
    if (!canApply) return
    applyAssignment()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || pages.length === 0}
        onClick={() => onOpenChange(true)}
      >
        <ClipboardPaste className="mr-2 h-4 w-4" />
        Paste sources
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste sources (random assign)</DialogTitle>
            <DialogDescription>
              One source per line. Sources are assigned randomly to empty page slots only.
              Lines that match a source already on a selected page are skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Format</p>
              <p>`platform|username` — e.g. `instagram|ronaldo`, `facebook|messi`</p>
              <p>Also supports `,` or `:` separators. Plain username uses default platform below.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Default platform (username-only lines)</Label>
              <Select
                value={defaultPlatform}
                onValueChange={(value: SourcePlatform) => onDefaultPlatformChange(value)}
              >
                <SelectTrigger className="h-9 w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sources</Label>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={'instagram|ronaldo\nfacebook|messi\ntiktok|creator'}
                rows={10}
                className="font-mono text-xs"
              />
            </div>

            {(preview.errors.length > 0 ||
              preview.warnings.length > 0 ||
              preview.overflowError ||
              preview.assignments.length > 0) && (
              <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3 text-xs">
                {preview.overflowError ? (
                  <p className="font-medium text-destructive">{preview.overflowError}</p>
                ) : null}

                {preview.sources.length > 0 ? (
                  <p className="text-muted-foreground">
                    {preview.sources.length} new source{preview.sources.length === 1 ? '' : 's'},{' '}
                    {emptyPageCount} empty page slot{emptyPageCount === 1 ? '' : 's'}.
                  </p>
                ) : null}

                {emptyPageCount === 0 && pages.length > 0 ? (
                  <p className="text-muted-foreground">
                    All selected pages already have sources. Paste only fills empty slots.
                  </p>
                ) : null}

                {preview.assignments.length > 0 ? (
                  <>
                    <p className="font-semibold text-foreground">
                      Assigned {preview.assignments.length} of {emptyPageCount} empty page
                      {emptyPageCount === 1 ? '' : 's'}
                    </p>
                    {preview.unassignedPageKeys.length > 0 ? (
                      <p className="text-muted-foreground">
                        Assign the remaining {preview.unassignedPageKeys.length} manually or paste
                        more sources before continuing.
                      </p>
                    ) : null}
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded border p-2">
                      {preview.assignments.map((row) => (
                        <p key={row.pageKey} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{row.pageName}</span>
                          {' — '}
                          {row.platform}|{row.username}
                        </p>
                      ))}
                    </div>
                  </>
                ) : null}

                {preview.errors.length > 0 ? (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {preview.errors.map((error) => (
                      <p key={`${error.lineNumber}-${error.message}`} className="text-destructive">
                        Line {error.lineNumber}: {error.message}
                      </p>
                    ))}
                  </div>
                ) : null}

                {preview.warnings.length > 0 ? (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {preview.warnings.map((warning) => (
                      <p key={warning} className="text-amber-600 dark:text-amber-400">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canApply} onClick={handleApplyClick}>
              Apply assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
