'use client'

import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const HERO_SELECTOR = '[data-hero-ambient-root]'

export function HeroPointerAmbient() {
  const reduceMotion = useReducedMotion()
  const [spot, setSpot] = useState({ x: 50, y: 42 })
  const raf = useRef<number | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)

  const flush = useCallback(() => {
    raf.current = null
    const next = pending.current
    if (!next) return
    pending.current = null
    setSpot(next)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const onMove = (event: MouseEvent) => {
      const root = document.querySelector<HTMLElement>(HERO_SELECTOR)
      if (!root) return
      const rect = root.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
      pending.current = { x, y }
      if (raf.current == null) {
        raf.current = window.requestAnimationFrame(flush)
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current != null) {
        window.cancelAnimationFrame(raf.current)
        raf.current = null
      }
      pending.current = null
    }
  }, [reduceMotion, flush])

  if (reduceMotion) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[-8]"
      style={{
        background: `radial-gradient(520px circle at ${spot.x}% ${spot.y}%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 58%)`,
      }}
    />
  )
}
