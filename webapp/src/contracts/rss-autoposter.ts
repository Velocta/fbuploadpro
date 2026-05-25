export type CanvasAspectRatio = '4:5' | '1:1' | '16:9'

export type RssTemplateLayerType =
  | 'image'
  | 'gradient'
  | 'shape'
  | 'text'
  | 'badge'
  | 'logo'
  | 'iconRow'

export type RssTextSegment = {
  match: 'regex'
  pattern: string
  fill: string
}

export type RssTextLayer = {
  id: string
  type: 'text'
  binding: 'rss.title' | 'rss.description' | 'brand.url' | 'page.name'
  x: number
  y: number
  width: number
  height: number
  visible?: boolean
  transform?: Array<string | { maxLines?: number }>
  baseStyle: {
    fontFamily?: string
    fontWeight?: number
    fontSize: number
    fill: string
    align?: 'left' | 'center' | 'right'
    lineHeight?: number
  }
  segments?: RssTextSegment[]
  fallbackSegment?: { fill: string }
}

export type RssImageLayer = {
  id: string
  type: 'image'
  binding: 'rss.imageUrl' | 'brand.logo'
  x: number
  y: number
  width: number
  height: number
  visible?: boolean
  fit?: 'cover' | 'contain'
  borderRadius?: number
  mask?: 'circle' | 'none'
}

export type RssGradientLayer = {
  id: string
  type: 'gradient'
  x: number
  y: number
  width: number
  height: number
  visible?: boolean
  from: string
  to: string
  direction?: 'vertical' | 'horizontal'
}

export type RssShapeLayer = {
  id: string
  type: 'shape'
  x: number
  y: number
  width: number
  height: number
  visible?: boolean
  fill: string
  borderColor?: string
  borderWidth?: number
}

export type RssBadgeLayer = {
  id: string
  type: 'badge'
  preset: 'breaking_news'
  x: number
  y: number
  visible?: boolean
}

export type RssLogoLayer = {
  id: string
  type: 'logo'
  binding: 'brand.logo'
  x: number
  y: number
  width: number
  height: number
  visible?: boolean
}

export type RssTemplateLayer =
  | RssImageLayer
  | RssGradientLayer
  | RssShapeLayer
  | RssTextLayer
  | RssBadgeLayer
  | RssLogoLayer

export type RssTemplateDefinition = {
  version: 1
  canvas: { aspectRatio: CanvasAspectRatio; backgroundColor?: string }
  layers: RssTemplateLayer[]
}

export type RssRenderVariables = {
  rss: {
    title: string
    description: string
    imageUrl: string
    link: string
  }
  brand: {
    url?: string
    logoUrl?: string
  }
  page: {
    name?: string
  }
}

export const FB_CAPTION_MAX_LENGTH = 63206
