import 'server-only'

import { createCanvas, loadImage } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import type {
  RssRenderVariables,
  RssTemplateDefinition,
  RssTemplateLayer,
  RssTextLayer,
} from '@/contracts/rss-autoposter'
import { getCanvasDimensions } from '@/lib/rss-autoposter/presets'

function resolveBinding(
  binding: string,
  vars: RssRenderVariables
): string {
  switch (binding) {
    case 'rss.title':
      return vars.rss.title
    case 'rss.description':
      return vars.rss.description
    case 'rss.imageUrl':
      return vars.rss.imageUrl
    case 'brand.url':
      return vars.brand.url || ''
    case 'brand.logo':
      return vars.brand.logoUrl || ''
    case 'page.name':
      return vars.page.name || ''
    default:
      return ''
  }
}

function applyTextTransforms(text: string, layer: RssTextLayer): string {
  let out = text
  for (const t of layer.transform || []) {
    if (t === 'uppercase') out = out.toUpperCase()
    if (typeof t === 'object' && t.maxLines) {
      const lines = out.split(/\n+/).filter(Boolean)
      out = lines.slice(0, t.maxLines).join('\n')
    }
  }
  return out
}

function colorForWord(word: string, layer: RssTextLayer): string {
  for (const seg of layer.segments || []) {
    if (seg.match === 'regex') {
      try {
        const re = new RegExp(seg.pattern, 'i')
        if (re.test(word)) return seg.fill
      } catch {
        /* ignore bad regex */
      }
    }
  }
  return layer.fallbackSegment?.fill || layer.baseStyle.fill
}

async function drawTextLayer(
  ctx: SKRSContext2D,
  layer: RssTextLayer,
  vars: RssRenderVariables
) {
  const raw = resolveBinding(layer.binding, vars)
  const text = applyTextTransforms(raw, layer)
  const fontSize = layer.baseStyle.fontSize
  const fontWeight = layer.baseStyle.fontWeight || 700
  const fontFamily = layer.baseStyle.fontFamily || 'Arial'
  const lineHeight = (layer.baseStyle.lineHeight || 1.2) * fontSize
  const align = layer.baseStyle.align || 'left'

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'

  const words = text.split(/(\s+)/)
  const lines: string[][] = []
  let current: string[] = []
  let lineWidth = 0
  const maxWidth = layer.width

  for (const token of words) {
    if (token === '\n') {
      lines.push(current)
      current = []
      lineWidth = 0
      continue
    }
    const w = ctx.measureText(token).width
    if (lineWidth + w > maxWidth && current.length > 0) {
      lines.push(current)
      current = [token]
      lineWidth = w
    } else {
      current.push(token)
      lineWidth += w
    }
  }
  if (current.length) lines.push(current)

  let y = layer.y
  for (const line of lines) {
    let x = layer.x
    const lineText = line.join('')
    const totalW = ctx.measureText(lineText).width
    if (align === 'center') x = layer.x + (layer.width - totalW) / 2
    if (align === 'right') x = layer.x + layer.width - totalW

    for (const token of line) {
      if (!token.trim()) {
        x += ctx.measureText(token).width
        continue
      }
      ctx.fillStyle = colorForWord(token, layer)
      ctx.fillText(token, x, y)
      x += ctx.measureText(token).width
    }
    y += lineHeight
    if (y > layer.y + layer.height) break
  }
}

async function drawImageLayer(
  ctx: SKRSContext2D,
  layer: Extract<RssTemplateLayer, { type: 'image' }>,
  vars: RssRenderVariables
) {
  const url = resolveBinding(layer.binding, vars)
  if (!url) return
  try {
    const img = await loadImage(url)
    ctx.save()
    if (layer.mask === 'circle') {
      const r = Math.min(layer.width, layer.height) / 2
      ctx.beginPath()
      ctx.arc(layer.x + r, layer.y + r, r, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
    } else if (layer.borderRadius) {
      roundRect(ctx, layer.x, layer.y, layer.width, layer.height, layer.borderRadius)
      ctx.clip()
    }
    if (layer.fit === 'contain') {
      ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height)
    } else {
      const scale = Math.max(layer.width / img.width, layer.height / img.height)
      const sw = layer.width / scale
      const sh = layer.height / scale
      const sx = (img.width - sw) / 2
      const sy = (img.height - sh) / 2
      ctx.drawImage(img, sx, sy, sw, sh, layer.x, layer.y, layer.width, layer.height)
    }
    ctx.restore()
  } catch {
    /* skip failed image load */
  }
}

function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawGradientLayer(
  ctx: SKRSContext2D,
  layer: Extract<RssTemplateLayer, { type: 'gradient' }>
) {
  const grad =
    layer.direction === 'horizontal'
      ? ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y)
      : ctx.createLinearGradient(layer.x, layer.y, layer.x, layer.y + layer.height)
  grad.addColorStop(0, layer.from)
  grad.addColorStop(1, layer.to)
  ctx.fillStyle = grad
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height)
}

function drawShapeLayer(
  ctx: SKRSContext2D,
  layer: Extract<RssTemplateLayer, { type: 'shape' }>
) {
  ctx.fillStyle = layer.fill
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height)
  if (layer.borderColor && layer.borderWidth) {
    ctx.strokeStyle = layer.borderColor
    ctx.lineWidth = layer.borderWidth
    ctx.strokeRect(layer.x, layer.y, layer.width, layer.height)
  }
}

function drawBadgeLayer(ctx: SKRSContext2D, layer: Extract<RssTemplateLayer, { type: 'badge' }>) {
  if (layer.preset !== 'breaking_news') return
  const x = layer.x
  const y = layer.y
  ctx.save()
  ctx.fillStyle = '#E63946'
  ctx.fillRect(x, y + 28, 200, 44)
  ctx.fillStyle = '#1D3557'
  ctx.fillRect(x + 12, y + 52, 220, 44)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 28px Arial'
  ctx.fillText('BREAKING', x + 24, y + 34)
  ctx.fillText('NEWS', x + 36, y + 58)
  ctx.restore()
}

async function drawLogoLayer(
  ctx: SKRSContext2D,
  layer: Extract<RssTemplateLayer, { type: 'logo' }>,
  vars: RssRenderVariables
) {
  const url = vars.brand.logoUrl
  if (!url) return
  try {
    const img = await loadImage(url)
    ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height)
  } catch {
    /* skip */
  }
}

export async function renderRssTemplate(
  definition: RssTemplateDefinition,
  variables: RssRenderVariables
): Promise<Buffer> {
  const aspect = definition.canvas.aspectRatio || '4:5'
  const { width, height } = getCanvasDimensions(aspect)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = definition.canvas.backgroundColor || '#000000'
  ctx.fillRect(0, 0, width, height)

  const layers = [...(definition.layers || [])].filter((l) => l.visible !== false)

  for (const layer of layers) {
    switch (layer.type) {
      case 'image':
        await drawImageLayer(ctx, layer, variables)
        break
      case 'gradient':
        drawGradientLayer(ctx, layer)
        break
      case 'shape':
        drawShapeLayer(ctx, layer)
        break
      case 'text':
        await drawTextLayer(ctx, layer, variables)
        break
      case 'badge':
        drawBadgeLayer(ctx, layer)
        break
      case 'logo':
        await drawLogoLayer(ctx, layer, variables)
        break
      default:
        break
    }
  }

  return canvas.toBuffer('image/png')
}
