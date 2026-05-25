'use client'

import { Stage, Layer, Rect, Text } from 'react-konva'
import type { RssTemplateLayer } from '@/contracts/rss-autoposter'

type Props = {
  width: number
  height: number
  scale: number
  layers: RssTemplateLayer[]
  selectedLayerId: string | null
  onSelectLayer: (id: string) => void
  onUpdateLayer: (id: string, patch: Partial<RssTemplateLayer>) => void
}

export function TemplateBuilderStage({
  width,
  height,
  scale,
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: Props) {
  const displayW = width * scale
  const displayH = height * scale

  return (
    <Stage width={displayW} height={displayH} scaleX={scale} scaleY={scale}>
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#111111" listening={false} />
        {layers.map((layer) => {
          if (layer.visible === false) return null
          if (!('x' in layer) || !('y' in layer)) return null
          const w = 'width' in layer ? layer.width : 100
          const h = 'height' in layer ? layer.height : 40
          const isSelected = layer.id === selectedLayerId
          const fill =
            layer.type === 'text'
              ? 'rgba(59,130,246,0.15)'
              : layer.type === 'image'
                ? 'rgba(34,197,94,0.2)'
                : 'rgba(250,204,21,0.2)'

          return (
            <Rect
              key={layer.id}
              x={layer.x}
              y={layer.y}
              width={w}
              height={h}
              fill={fill}
              stroke={isSelected ? '#3b82f6' : '#64748b'}
              strokeWidth={isSelected ? 3 : 1}
              draggable
              onClick={() => onSelectLayer(layer.id)}
              onTap={() => onSelectLayer(layer.id)}
              onDragEnd={(e) => {
                onUpdateLayer(layer.id, {
                  x: Math.round(e.target.x()),
                  y: Math.round(e.target.y()),
                } as Partial<RssTemplateLayer>)
              }}
            />
          )
        })}
        {layers
          .filter((l) => l.type === 'text' && 'x' in l)
          .map((layer) => (
            <Text
              key={`${layer.id}-label`}
              x={layer.x + 4}
              y={layer.y + 4}
              text={layer.type === 'text' ? layer.binding : ''}
              fontSize={14}
              fill="#94a3b8"
              listening={false}
            />
          ))}
      </Layer>
    </Stage>
  )
}
