import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { HSV } from '../lib/color'
import { isHexColor } from '../../../shared/art-values'

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

const PANEL_WIDTH = 238
const PANEL_HEIGHT = 208

export interface PanelRect {
  left: number
  top: number
  bottom: number
}

export function ColorPickerPanel({
  hex,
  hsv,
  rect,
  triggerRef,
  onHexChange,
  onHsvChange,
  onApply,
  onClose
}: {
  hex: string
  hsv: HSV
  rect: PanelRect | null
  triggerRef: RefObject<HTMLButtonElement | null>
  onHexChange: (hex: string) => void
  onHsvChange: (next: HSV) => void
  onApply: () => void
  onClose: () => void
}) {
  const squareRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (panelRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [onClose, triggerRef])

  function squareAt(clientX: number, clientY: number): void {
    const el = squareRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onHsvChange({
      ...hsv,
      s: clamp01((clientX - r.left) / r.width),
      v: clamp01(1 - (clientY - r.top) / r.height)
    })
  }

  function hueAt(clientX: number): void {
    const el = hueRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onHsvChange({ ...hsv, h: clamp01((clientX - r.left) / r.width) * 360 })
  }

  let left = 0
  let top = 0
  if (rect) {
    left = Math.max(10, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 10))
    top = rect.bottom + 6
    if (top + PANEL_HEIGHT > window.innerHeight - 10) top = Math.max(10, rect.top - PANEL_HEIGHT - 6)
  }

  return createPortal(
    <div
      className="cp-panel"
      ref={panelRef}
      style={rect ? { left, top } : { visibility: 'hidden' }}
      data-testid="color-picker-panel"
    >
      <div
        ref={squareRef}
        className="cp-square"
        style={{ background: `hsl(${Math.round(hsv.h)} 100% 50%)` }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          squareAt(e.clientX, e.clientY)
        }}
        onPointerMove={e => {
          if (e.buttons === 1) squareAt(e.clientX, e.clientY)
        }}
      >
        <div className="cp-white" />
        <div className="cp-black" />
        <div className="cp-cursor" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <div
        ref={hueRef}
        className="cp-hue"
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          hueAt(e.clientX)
        }}
        onPointerMove={e => {
          if (e.buttons === 1) hueAt(e.clientX)
        }}
      >
        <div className="cp-hue-cursor" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="cp-row">
        <input
          className="hex-input"
          value={hex}
          placeholder="#ffffff"
          aria-label="Custom hex color"
          onChange={e => onHexChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onApply()
            if (e.key === 'Escape') {
              e.stopPropagation()
              onClose()
            }
          }}
        />
        <button className="hex-apply" onClick={onApply} disabled={!isHexColor(hex)}>
          Apply
        </button>
      </div>
    </div>,
    document.body
  )
}
