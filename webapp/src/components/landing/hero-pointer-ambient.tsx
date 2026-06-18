'use client'

import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const HERO_SELECTOR = '[data-hero-ambient-root]'

export function HeroPointerAmbient() {
  const reduceMotion = useReducedMotion()
  const ambientRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (reduceMotion) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const flush = () => {
      raf.current = null
      const next = pending.current
      if (!next || !ambientRef.current) return
      pending.current = null
      ambientRef.current.style.setProperty('--spot-x', `${next.x}%`)
      ambientRef.current.style.setProperty('--spot-y', `${next.y}%`)
    }

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
  }, [reduceMotion])

  if (reduceMotion) return null

  return (
    <div
      ref={ambientRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[-8]"
      style={{
        background: `radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 42%), color-mix(in oklab, var(--primary) 8%, transparent), transparent 58%)`,
      } as React.CSSProperties}
    />
  )
}

