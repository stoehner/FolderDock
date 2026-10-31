import { useRef, useState } from 'react'
import { customArtFor } from '../lib/art'
import { isHexColor } from '../../../shared/art-values'
import { MAX_SAVED_COLORS } from '../../../shared/prefs'
import { usePrefs } from '../state/prefs'
import { ico } from '../lib/icons'
import { hexToHsv, hsvToHex, type HSV } from '../lib/color'
import { ColorPickerPanel, type PanelRect } from './ColorPicker'

function normalizeHex(raw: string): string {
  const t = raw.trim()
  return t.startsWith('#') ? t : `#${t}`
}

const WHITE: HSV = { h: 0, s: 0, v: 1 }

export function ColorPickerSwatch({
  value,
  onPick,
  small
}: {
  value: string | undefined
  onPick: (hex: string) => void
  small?: boolean
}) {
  const custom = value !== undefined && isHexColor(value)
  const customColors = usePrefs(s => s.prefs.customColors)
  const patch = usePrefs(s => s.patch)
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState<string>(custom ? value : '#ffffff')
  const [hsv, setHsv] = useState<HSV>(WHITE)
  const [rect, setRect] = useState<PanelRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const valid = isHexColor(normalizeHex(hex))

  function remember(h: string): void {
    if (!customColors.includes(h)) patch({ customColors: [h, ...customColors].slice(0, MAX_SAVED_COLORS) })
  }

  function apply(h: string): void {
    const norm = normalizeHex(h)
    if (!isHexColor(norm)) return
    onPick(norm)
    remember(norm)
    setOpen(false)
  }

  function togglePanel(e: React.MouseEvent<HTMLButtonElement>): void {
    if (open) {
      setOpen(false)
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    setRect({ left: r.left, top: r.top, bottom: r.bottom })
    const startHex = custom ? (value as string) : '#ffffff'
    setHex(startHex)
    setHsv(hexToHsv(startHex) ?? WHITE)
    setOpen(true)
  }

  function hexChanged(text: string): void {
    setHex(text)
    const norm = normalizeHex(text)
    if (isHexColor(norm)) setHsv(hexToHsv(norm) ?? WHITE)
  }

  function hsvChanged(next: HSV): void {
    setHsv(next)
    setHex(hsvToHex(next))
  }

  return (
    <span className="swatch-group">
      {customColors.map(c => (
        <span className="saved-swatch" key={c}>
          <button
            className="swatch small"
            style={{ background: customArtFor(c).art }}
            onClick={() => apply(c)}
            aria-label={`Saved color ${c}`}
          />
          <button
            className="saved-delete"
            onClick={() => patch({ customColors: customColors.filter(x => x !== c) })}
            aria-label={`Delete saved color ${c}`}
          >
            {ico('x')}
          </button>
        </span>
      ))}
      <button
        ref={triggerRef}
        className={`swatch custom${small ? ' small' : ''}${custom ? ' selected' : ''}`}
        style={custom || (open && valid) ? { background: customArtFor(custom ? (value as string) : normalizeHex(hex)).art } : undefined}
        onClick={togglePanel}
        aria-label="Custom color"
        aria-expanded={open}
      />
      {open ? (
        <ColorPickerPanel
          hex={hex}
          hsv={hsv}
          rect={rect}
          triggerRef={triggerRef}
          onHexChange={hexChanged}
          onHsvChange={hsvChanged}
          onApply={() => apply(hex)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </span>
  )
}
