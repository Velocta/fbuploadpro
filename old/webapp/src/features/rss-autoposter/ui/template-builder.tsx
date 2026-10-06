'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasAspectRatio, RssTemplateDefinition, RssTemplateLayer } from '@/contracts/rss-autoposter'
import { getCanvasDimensions } from '@/lib/rss-autoposter/presets'
import dynamic from 'next/dynamic'
import Image from 'next/image'

const KonvaStage = dynamic(
  () => import('./template-builder-stage').then((m) => m.TemplateBuilderStage),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-muted" /> },
)

type Props = {
  definition: RssTemplateDefinition
  onChange: (def: RssTemplateDefinition) => void
  canvasAspectRatio: CanvasAspectRatio
  onAspectRatioChange: (ratio: CanvasAspectRatio) => void
  sampleTitle?: string
  sampleDescription?: string
  sampleImageUrl?: string
  brandLogoUrl?: string
  brandSiteUrl?: string
}

export function TemplateBuilder({
  definition,
  onChange,
  canvasAspectRatio,
  onAspectRatioChange,
  sampleTitle,
  sampleDescription,
  sampleImageUrl,
  brandLogoUrl,
  brandSiteUrl,
}: Props) {
  const [presets, setPresets] = useState<{ key: string; label: string; definition: RssTemplateDefinition }[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    definition.layers[0]?.id ?? null,
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const selectedLayer = useMemo(
    () => definition.layers.find((l) => l.id === selectedLayerId) ?? null,
    [definition.layers, selectedLayerId],
  )

  const scale = 0.3
  const { width, height } = getCanvasDimensions(canvasAspectRatio)
  const hasSampleContent = Boolean(sampleTitle || sampleImageUrl)

  useEffect(() => {
    fetch('/api/v1/agency/facebook/rss-autoposter/presets')
      .then((r) => r.json())
      .then((d) => setPresets(d.presets || []))
      .catch(() => {})
  }, [])

  const runPreview = useCallback(async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/v1/agency/facebook/rss-autoposter/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateDefinition: definition,
          canvasAspectRatio,
          sampleTitle: sampleTitle || 'Sample headline for your RSS post',
          sampleDescription: sampleDescription || '',
          sampleImageUrl: sampleImageUrl || undefined,
          brandLogoUrl: brandLogoUrl || undefined,
          brandSiteUrl: brandSiteUrl || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreviewUrl(`data:image/png;base64,${data.pngBase64}`)
    } catch (e) {
      setPreviewUrl(null)
      setPreviewError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
      setPreviewPending(false)
    }
  }, [
    definition,
    canvasAspectRatio,
    sampleTitle,
    sampleDescription,
    sampleImageUrl,
    brandLogoUrl,
    brandSiteUrl,
  ])

  useEffect(() => {
    let cancelled = false
    const pendingTimer = window.setTimeout(() => {
      if (!cancelled) setPreviewPending(true)
    }, 0)
    const previewTimer = window.setTimeout(() => {
      if (!cancelled) void runPreview()
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(pendingTimer)
      window.clearTimeout(previewTimer)
    }
  }, [runPreview])

  function applyPreset(key: string) {
    const preset = presets.find((p) => p.key === key)
    if (!preset) return
    onChange(preset.definition)
    setSelectedLayerId(preset.definition.layers[0]?.id ?? null)
  }

  function updateLayer(layerId: string, patch: Partial<RssTemplateLayer>) {
    onChange({
      ...definition,
      layers: definition.layers.map((l) =>
        l.id === layerId ? ({ ...l, ...patch } as RssTemplateLayer) : l,
      ),
    })
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    const idx = definition.layers.findIndex((l) => l.id === layerId)
    if (idx < 0) return
    const next = idx + direction
    if (next < 0 || next >= definition.layers.length) return
    const layers = [...definition.layers]
    const removed = layers[idx]
    if (!removed) return
    layers.splice(idx, 1)
    layers.splice(next, 0, removed)
    onChange({ ...definition, layers })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_1fr_260px]">
      <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
        <Label>Aspect ratio</Label>
        <Select value={canvasAspectRatio} onValueChange={(v) => onAspectRatioChange(v as CanvasAspectRatio)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4:5">4:5 (1080×1350)</SelectItem>
            <SelectItem value="1:1">1:1 (1080×1080)</SelectItem>
            <SelectItem value="16:9">16:9 (1200×675)</SelectItem>
          </SelectContent>
        </Select>

        <Label className="pt-2">Presets</Label>
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Label className="pt-2">Layers</Label>
        <ScrollArea className="h-48">
          <div className="space-y-1 pr-2">
            {[...definition.layers].reverse().map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayerId(layer.id)}
                className={cn(
                  'w-full rounded-lg border px-2 py-1.5 text-left text-xs',
                  selectedLayerId === layer.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 bg-background/30',
                )}
              >
                {layer.type} — {layer.id}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-black/80 p-3">
          <KonvaStage
            width={width}
            height={height}
            scale={scale}
            layers={definition.layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={updateLayer}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Canvas layout only — final image uses server render
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label>Server preview</Label>
            <div className="flex items-center gap-2">
              {previewPending && !previewLoading ? (
                <span className="text-xs text-muted-foreground">Updating preview…</span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                onClick={runPreview}
                disabled={previewLoading}
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Rendering…
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
          </div>
          <div className="relative min-h-[200px] rounded-lg border border-border/30 bg-background/20">
            {previewLoading ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : previewError ? (
              <p className="p-4 text-sm text-destructive">{previewError}</p>
            ) : previewUrl ? (
              <Image
                src={previewUrl}
                alt="Template preview"
                width={360}
                height={360}
                className="mx-auto max-h-[420px] rounded-lg p-2"
                unoptimized
              />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {hasSampleContent
                  ? 'Adjust the template to generate a preview.'
                  : 'Connect or validate a feed sample to preview branded images.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
        <Label>Inspector</Label>
        {!selectedLayer ? (
          <p className="text-sm text-muted-foreground">Select a layer</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{selectedLayer.type}</p>
            {'x' in selectedLayer ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X</Label>
                    <Input
                      type="number"
                      className="rounded-lg"
                      value={selectedLayer.x}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, { x: Number(e.target.value) } as Partial<RssTemplateLayer>)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y</Label>
                    <Input
                      type="number"
                      className="rounded-lg"
                      value={selectedLayer.y}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, { y: Number(e.target.value) } as Partial<RssTemplateLayer>)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">W</Label>
                    <Input
                      type="number"
                      className="rounded-lg"
                      value={'width' in selectedLayer ? selectedLayer.width : 0}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, {
                          width: Number(e.target.value),
                        } as Partial<RssTemplateLayer>)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">H</Label>
                    <Input
                      type="number"
                      className="rounded-lg"
                      value={'height' in selectedLayer ? selectedLayer.height : 0}
                      onChange={(e) =>
                        updateLayer(selectedLayer.id, {
                          height: Number(e.target.value),
                        } as Partial<RssTemplateLayer>)
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => moveLayer(selectedLayer.id, 1)}>
                    Up
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => moveLayer(selectedLayer.id, -1)}>
                    Down
                  </Button>
                </div>
              </>
            ) : null}
            {selectedLayer.type === 'text' && 'baseStyle' in selectedLayer ? (
              <>
                <div>
                  <Label className="text-xs">Font size</Label>
                  <Input
                    type="number"
                    className="rounded-lg"
                    value={selectedLayer.baseStyle.fontSize}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        baseStyle: {
                          ...selectedLayer.baseStyle,
                          fontSize: Number(e.target.value),
                        },
                      } as Partial<RssTemplateLayer>)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Text color</Label>
                  <Input
                    type="color"
                    value={selectedLayer.baseStyle.fill}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        baseStyle: { ...selectedLayer.baseStyle, fill: e.target.value },
                      } as Partial<RssTemplateLayer>)
                    }
                  />
                </div>
              </>
            ) : null}
            {selectedLayer.type === 'shape' && 'fill' in selectedLayer ? (
              <div>
                <Label className="text-xs">Fill</Label>
                <Input
                  type="color"
                  value={selectedLayer.fill.startsWith('#') ? selectedLayer.fill : '#000000'}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { fill: e.target.value } as Partial<RssTemplateLayer>)
                  }
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
