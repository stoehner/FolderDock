export interface ImageDimensions {
  width: number
  height: number
}

export function parseImageDimensions(buf: Buffer, ext: string): ImageDimensions | null {
  try {
    switch (ext.toLowerCase()) {
      case '.png':
        return parsePng(buf)
      case '.jpg':
      case '.jpeg':
        return parseJpeg(buf)
      case '.gif':
        return parseGif(buf)
      case '.bmp':
        return parseBmp(buf)
      case '.webp':
        return parseWebp(buf)
      case '.svg':
        return parseSvg(buf)
      default:
        return null
    }
  } catch {
    return null
  }
}

function parsePng(b: Buffer): ImageDimensions | null {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null
  if (b.readUInt32BE(12) !== 0x49484452) return null
  const width = b.readUInt32BE(16)
  const height = b.readUInt32BE(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function parseGif(b: Buffer): ImageDimensions | null {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return null
  const width = b.readUInt16LE(6)
  const height = b.readUInt16LE(8)
  return width > 0 && height > 0 ? { width, height } : null
}

function parseBmp(b: Buffer): ImageDimensions | null {
  if (b.length < 26 || b.toString('ascii', 0, 2) !== 'BM') return null
  const width = b.readInt32LE(18)
  const height = Math.abs(b.readInt32LE(22))
  return width > 0 && height > 0 ? { width, height } : null
}

function parseJpeg(b: Buffer): ImageDimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let off = 2
  while (off + 9 < b.length) {
    if (b.readUInt8(off) !== 0xff) {
      off++
      continue
    }
    const marker = b.readUInt8(off + 1)
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2
      continue
    }
    const len = b.readUInt16BE(off + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = b.readUInt16BE(off + 5)
      const width = b.readUInt16BE(off + 7)
      if (width > 0 && height > 0) return { width, height }
    }
    off += 2 + len
  }
  return null
}

function parseWebp(b: Buffer): ImageDimensions | null {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null
  const fourcc = b.toString('ascii', 12, 16)
  if (fourcc === 'VP8X' && b.length >= 30) {
    const width = 1 + (b.readUInt8(24) | (b.readUInt8(25) << 8) | (b.readUInt8(26) << 16))
    const height = 1 + (b.readUInt8(27) | (b.readUInt8(28) << 8) | (b.readUInt8(29) << 16))
    return { width, height }
  }
  if (fourcc === 'VP8 ' && b.length >= 30) {
    const width = b.readUInt16LE(26) & 0x3fff
    const height = b.readUInt16LE(28) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (fourcc === 'VP8L' && b.length >= 25) {
    const bits = b.readUInt32LE(21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  return null
}

function parseSvg(b: Buffer): ImageDimensions | null {
  const text = b.toString('utf8', 0, Math.min(b.length, 8192))
  const wAttr = text.match(/\bwidth\s*=\s*["']([\d.]+)\s*(?:px)?["']/i)
  const hAttr = text.match(/\bheight\s*=\s*["']([\d.]+)\s*(?:px)?["']/i)
  if (wAttr && hAttr) {
    const width = Number(wAttr[1])
    const height = Number(hAttr[1])
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) }
  }
  const vb = text.match(/\bviewBox\s*=\s*["']\s*[\d.eE+-]+\s+[\d.eE+-]+\s+([\d.eE+-]+)\s+([\d.eE+-]+)/i)
  if (vb) {
    const width = Number(vb[1])
    const height = Number(vb[2])
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) }
  }
  return null
}
