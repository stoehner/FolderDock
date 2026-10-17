import { describe, expect, it } from 'vitest'
import { parseImageDimensions } from './imageMeta'

function pngBuf(w: number, h: number): Buffer {
  const b = Buffer.alloc(33)
  b.writeUInt32BE(0x89504e47, 0)
  b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

describe('parseImageDimensions', () => {
  it('parses PNG IHDR', () => {
    expect(parseImageDimensions(pngBuf(1920, 1080), '.png')).toEqual({ width: 1920, height: 1080 })
  })
  it('rejects truncated PNG', () => {
    expect(parseImageDimensions(Buffer.alloc(10), '.png')).toBeNull()
  })
  it('parses GIF logical screen size', () => {
    const b = Buffer.alloc(10)
    b.write('GIF89a', 0, 'ascii')
    b.writeUInt16LE(640, 6)
    b.writeUInt16LE(480, 8)
    expect(parseImageDimensions(b, '.gif')).toEqual({ width: 640, height: 480 })
  })
  it('parses BMP header', () => {
    const b = Buffer.alloc(30)
    b.write('BM', 0, 'ascii')
    b.writeInt32LE(300, 18)
    b.writeInt32LE(-200, 22)
    expect(parseImageDimensions(b, '.bmp')).toEqual({ width: 300, height: 200 })
  })
  it('parses JPEG SOF0 markers', () => {
    const b = Buffer.alloc(32)
    b[0] = 0xff
    b[1] = 0xd8
    b[2] = 0xff
    b[3] = 0xc0
    b.writeUInt16BE(16, 4)
    b.writeUInt16BE(720, 7)
    b.writeUInt16BE(1280, 9)
    expect(parseImageDimensions(b, '.jpg')).toEqual({ width: 1280, height: 720 })
  })
  it('parses WEBP VP8X canvas size', () => {
    const b = Buffer.alloc(30)
    b.write('RIFF', 0, 'ascii')
    b.write('WEBP', 8, 'ascii')
    b.write('VP8X', 12, 'ascii')
    const w = 1023
    const h = 767
    b[24] = (w - 1) & 0xff
    b[25] = ((w - 1) >> 8) & 0xff
    b[26] = ((w - 1) >> 16) & 0xff
    b[27] = (h - 1) & 0xff
    b[28] = ((h - 1) >> 8) & 0xff
    b[29] = ((h - 1) >> 16) & 0xff
    expect(parseImageDimensions(b, '.webp')).toEqual({ width: 1023, height: 767 })
  })
  it('parses SVG width/height then viewBox fallback', () => {
    expect(parseImageDimensions(Buffer.from('<svg width="100px" height="50"></svg>'), '.svg')).toEqual({
      width: 100,
      height: 50
    })
    expect(parseImageDimensions(Buffer.from('<svg viewBox="0 0 300 150"></svg>'), '.svg')).toEqual({
      width: 300,
      height: 150
    })
  })
  it('returns null for unknown data', () => {
    expect(parseImageDimensions(Buffer.from('hello'), '.png')).toBeNull()
  })
})
