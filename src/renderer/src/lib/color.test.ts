import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex } from './color'

describe('color conversions', () => {
  it('converts known colors to hsv', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 })
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 })
  })

  it('converts hsv to hex', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000')
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00')
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#ffffff')
    expect(hsvToHex({ h: 300, s: 0.5, v: 1 })).toBe('#ff80ff')
  })

  it('round-trips hsv through hex within quantization error', () => {
    const samples = [
      { h: 30, s: 0.2, v: 0.9 },
      { h: 210, s: 0.75, v: 0.6 },
      { h: 359, s: 0.99, v: 0.5 }
    ]
    for (const hsv of samples) {
      const back = hexToHsv(hsvToHex(hsv))
      expect(back).not.toBeNull()
      if (!back) continue
      expect(Math.abs(back.h - hsv.h)).toBeLessThan(4)
      expect(Math.abs(back.s - hsv.s)).toBeLessThan(0.02)
      expect(Math.abs(back.v - hsv.v)).toBeLessThan(0.02)
    }
  })

  it('rejects invalid hexes', () => {
    expect(hexToHsv('nope')).toBeNull()
    expect(hexToHsv('#fff')).toBeNull()
    expect(hexToHsv('')).toBeNull()
  })

  it('clamps out-of-range hsv inputs', () => {
    expect(hsvToHex({ h: 400, s: 1.5, v: 1 })).toBe('#ff0000')
    expect(hsvToHex({ h: -20, s: -1, v: 1 })).toBe('#ffffff')
  })
})
