import { describe, expect, it } from 'vitest'
import { looksBinary } from './binary'

describe('looksBinary', () => {
  it('flags NUL-containing buffers', () => {
    expect(looksBinary(Buffer.from([0x00, 0x01, 0x02]))).toBe(true)
  })
  it('accepts plain text', () => {
    expect(looksBinary(Buffer.from('plain utf8 text'))).toBe(false)
  })
})
