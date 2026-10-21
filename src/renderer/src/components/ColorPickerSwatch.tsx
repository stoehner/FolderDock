import { useState } from 'react'
import { customArtFor } from '../lib/art'
import { isHexColor } from '../../../shared/art-values'

function normalizeHex(raw: string): string {
  const t = raw.trim()
  return t.startsWith('#') ? t : `#${t}`
}

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
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const typed = normalizeHex(text)
  const valid = isHexColor(typed)
  const preview = custom ? customArtFor(value as string) : open && valid ? customArtFor(typed) : undefined

  function apply(): void {
    if (!valid) return
    onPick(typed)
    setOpen(false)
  }

  return (
    <span className="swatch-group">
      <button
        className={`swatch custom${small ? ' small' : ''}${custom ? ' selected' : ''}`}
        style={preview ? { background: preview.art } : undefined}
        onClick={() => {
          setText(custom ? (value as string) : '')
          setOpen(o => !o)
        }}
        title="Custom color - enter a hex code"
        aria-label="Custom color"
        aria-expanded={open}
      />
      {open ? (
        <span className="swatch-entry">
          <input
            className="hex-input"
            value={text}
            autoFocus
            placeholder="#4f9fd8"
            aria-label="Custom hex color"
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') apply()
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <button className="hex-apply" onClick={apply} disabled={!valid}>
            Apply
          </button>
        </span>
      ) : null}
    </span>
  )
}
