import { customArtFor } from '../lib/art'
import { isHexColor } from '../../../shared/art-values'

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
  return (
    <span className={`swatch-wrap${small ? ' small' : ''}`}>
      <span
        className={`swatch custom${custom ? ' selected' : ''}`}
        style={custom ? { background: customArtFor(value as string).art } : undefined}
        aria-hidden="true"
      />
      <input
        type="color"
        className="swatch-input"
        value={custom ? (value as string) : '#7ca8c9'}
        onChange={e => onPick(e.target.value)}
        aria-label="Custom color"
      />
    </span>
  )
}
