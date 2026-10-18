import { deflateSync, inflateSync } from 'node:zlib'

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

export function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png')
  let w = 0
  let h = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  let off = 8
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    off += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
  if (interlace !== 0) throw new Error('interlaced png not supported')
  if (colorType !== 6 && colorType !== 2) throw new Error(`unsupported color type ${colorType}`)
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(w * h * 4)
  let prev = Buffer.alloc(stride)
  let cur = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p]
    p++
    raw.copy(cur, 0, p, p + stride)
    p += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      switch (filter) {
        case 0:
          break
        case 1:
          cur[x] = (cur[x] + a) & 0xff
          break
        case 2:
          cur[x] = (cur[x] + b) & 0xff
          break
        case 3:
          cur[x] = (cur[x] + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          cur[x] = (cur[x] + pr) & 0xff
          break
        }
        default:
          throw new Error(`unknown filter ${filter}`)
      }
    }
    for (let x = 0; x < w; x++) {
      const s = x * bpp
      const d = (y * w + x) * 4
      out[d] = cur[s]
      out[d + 1] = cur[s + 1]
      out[d + 2] = cur[s + 2]
      out[d + 3] = colorType === 6 ? cur[s + 3] : 255
    }
    const t = prev
    prev = cur
    cur = t
  }
  return { width: w, height: h, rgba: out }
}

export function packIco(entries) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(entries.length * 16)
  let offset = 6 + entries.length * 16
  entries.forEach((e, i) => {
    const o = i * 16
    dir[o] = e.size >= 256 ? 0 : e.size
    dir[o + 1] = e.size >= 256 ? 0 : e.size
    dir[o + 2] = 0
    dir[o + 3] = 0
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(e.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += e.png.length
  })
  return Buffer.concat([head, dir, ...entries.map(e => e.png)])
}

export function resizePremultiplied(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4)
  const scale = srcSize / dstSize
  for (let y = 0; y < dstSize; y++) {
    const sy0 = y * scale
    const sy1 = (y + 1) * scale
    for (let x = 0; x < dstSize; x++) {
      const sx0 = x * scale
      const sx1 = (x + 1) * scale
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let coverage = 0
      const iy0 = Math.floor(sy0)
      const iy1 = Math.min(srcSize, Math.ceil(sy1))
      const ix0 = Math.floor(sx0)
      const ix1 = Math.min(srcSize, Math.ceil(sx1))
      for (let yy = iy0; yy < iy1; yy++) {
        const cy = Math.min(sy1, yy + 1) - Math.max(sy0, yy)
        if (cy <= 0) continue
        for (let xx = ix0; xx < ix1; xx++) {
          const cx = Math.min(sx1, xx + 1) - Math.max(sx0, xx)
          if (cx <= 0) continue
          const wgt = cy * cx
          const i = (yy * srcSize + xx) * 4
          const al = src[i + 3] / 255
          r += src[i] * al * wgt
          g += src[i + 1] * al * wgt
          b += src[i + 2] * al * wgt
          a += src[i + 3] * wgt
          coverage += wgt
        }
      }
      const o = (y * dstSize + x) * 4
      const am = coverage > 0 ? a / coverage : 0
      out[o + 3] = Math.round(am)
      if (am > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      } else {
        out[o] = 0
        out[o + 1] = 0
        out[o + 2] = 0
      }
    }
  }
  return out
}
