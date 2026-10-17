import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const buildDir = join(root, 'build')
const dragDir = join(root, 'resources', 'drag')
mkdirSync(buildDir, { recursive: true })
mkdirSync(dragDir, { recursive: true })

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
function encodePng(w, h, rgba) {
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
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const lerp = (a, b, t) => a + (b - a) * t
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
const clamp01 = t => Math.max(0, Math.min(1, t))
const cov = (d, aa = 0.012) => clamp01(0.5 - d / aa)
const over = (col, rgb, t) => {
  t = clamp01(t)
  return [lerp(col[0], rgb[0], t), lerp(col[1], rgb[1], t), lerp(col[2], rgb[2], t), col[3]]
}

function sdRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const hx = (x1 - x0) / 2 - r
  const hy = (y1 - y0) / 2 - r
  const qx = Math.abs(x - cx) - hx
  const qy = Math.abs(y - cy) - hy
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}
function ptInTri(px, py, ax, ay, bx, by, cx, cy) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
  return !((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0)) ? 1 : 0
}

function appIconShader(u, v) {
  const R = 0.1
  const cover = cov(sdRoundRect(u, v, R, R, 1 - R, 1 - R, 0.18), 0.015)
  if (cover <= 0) return [0, 0, 0, 0]
  const t = clamp01((u + v) / 2)
  const top = hex(0x5fb3e6)
  const bot = hex(0x27649c)
  let col = [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t), 1]
  col = over(col, [1, 1, 1], 0.13 * cov(sdRoundRect(u, v, R, R, 1 - R, 0.52, 0.18), 0.07))
  const ang = -0.13
  const s = Math.sin(ang)
  const c = Math.cos(ang)
  const dx = u - 0.42
  const dy = v - 0.42
  const ru = 0.42 + dx * c - dy * s
  const rv = 0.42 + dx * s + dy * c
  const sheetC = cov(sdRoundRect(ru, rv, 0.25, 0.22, 0.63, 0.56, 0.02))
  col = over(col, [0.8, 0.88, 0.95], sheetC * 0.97)
  const tabC = cov(sdRoundRect(u, v, 0.2, 0.25, 0.52, 0.41, 0.06))
  const bodyC = cov(sdRoundRect(u, v, 0.17, 0.32, 0.83, 0.71, 0.06))
  col = over(col, [0.85, 0.925, 0.975], Math.max(tabC, bodyC))
  const frontC = cov(sdRoundRect(u, v, 0.17, 0.39, 0.83, 0.77, 0.06))
  col = over(col, [0.985, 0.995, 1], frontC)
  const l1 = cov(sdRoundRect(u, v, 0.3, 0.49, 0.66, 0.522, 0.016), 0.01)
  const l2 = cov(sdRoundRect(u, v, 0.3, 0.57, 0.58, 0.602, 0.016), 0.01)
  col = over(col, [0.38, 0.6, 0.79], Math.max(l1, l2) * frontC * 0.9)
  col[3] = cover
  return col
}

function docIconShader(u, v, top, bot, variant) {
  const R = 0.09
  const cover = cov(sdRoundRect(u, v, R, R, 1 - R, 1 - R, 0.17), 0.025)
  if (cover <= 0) return [0, 0, 0, 0]
  const tv = clamp01(v)
  let col = [lerp(top[0], bot[0], tv), lerp(top[1], bot[1], tv), lerp(top[2], bot[2], tv), 1]
  col = over(col, [1, 1, 1], 0.12 * cov(sdRoundRect(u, v, R, R, 1 - R, 0.5, 0.17), 0.07))
  const fold = 0.17
  const docC = cov(sdRoundRect(u, v, 0.28, 0.16, 0.74, 0.86, 0.04))
  const cut = ptInTri(u, v, 0.74 - fold, 0.16, 0.74, 0.16, 0.74, 0.16 + fold)
  const doc = docC * (1 - cut)
  col = over(col, [0.98, 0.99, 1], doc)
  const flap = ptInTri(u, v, 0.74 - fold, 0.16, 0.74, 0.16 + fold, 0.74 - fold, 0.16 + fold) * docC
  col = over(col, [0.79, 0.86, 0.91], flap * 0.92)
  if (variant === 'image') {
    const f1 = cov(sdRoundRect(u, v, 0.34, 0.3, 0.68, 0.66, 0.03))
    const f2 = cov(sdRoundRect(u, v, 0.37, 0.33, 0.65, 0.63, 0.02))
    const ring = clamp01(f1 - f2)
    const sun = cov(Math.hypot(u - 0.44, v - 0.395) - 0.032)
    const m1 = ptInTri(u, v, 0.38, 0.62, 0.5, 0.44, 0.6, 0.62)
    const m2 = ptInTri(u, v, 0.55, 0.62, 0.63, 0.5, 0.68, 0.62)
    const art = Math.max(Math.max(m1, m2), sun) * f2 * doc
    col = over(col, [0.28, 0.47, 0.63], art * 0.92)
    col = over(col, [1, 1, 1], ring * doc * 0.95)
  } else {
    const l1 = cov(sdRoundRect(u, v, 0.36, 0.34, 0.66, 0.378, 0.019), 0.01)
    const l2 = cov(sdRoundRect(u, v, 0.36, 0.46, 0.66, 0.498, 0.019), 0.01)
    const l3 = cov(sdRoundRect(u, v, 0.36, 0.58, 0.55, 0.618, 0.019), 0.01)
    const tint = [bot[0] * 0.55, bot[1] * 0.55, bot[2] * 0.6]
    col = over(col, tint, Math.max(l1, l2, l3) * doc * 0.85)
  }
  col[3] = cover
  return col
}

function render(size, shader, supersample = 4) {
  const rgba = Buffer.alloc(size * size * 4)
  const inv = 1 / (supersample * supersample)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const u = (x + (sx + 0.5) / supersample) / size
          const v = (y + (sy + 0.5) / supersample) / size
          const c = shader(u, v)
          r += c[0] * c[3]
          g += c[1] * c[3]
          b += c[2] * c[3]
          a += c[3]
        }
      }
      const i = (y * size + x) * 4
      const am = a * inv
      rgba[i] = am > 0 ? Math.round(((r * inv) / am) * 255) : 0
      rgba[i + 1] = am > 0 ? Math.round(((g * inv) / am) * 255) : 0
      rgba[i + 2] = am > 0 ? Math.round(((b * inv) / am) * 255) : 0
      rgba[i + 3] = Math.round(am * 255)
    }
  }
  return rgba
}

function resize(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4)
  const scale = srcSize / dstSize
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const x0 = Math.floor(x * scale)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scale))
      const y0 = Math.floor(y * scale)
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scale))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let yy = y0; yy < y1 && yy < srcSize; yy++) {
        for (let xx = x0; xx < x1 && xx < srcSize; xx++) {
          const i = (yy * srcSize + xx) * 4
          r += src[i] * src[i + 3]
          g += src[i + 1] * src[i + 3]
          b += src[i + 2] * src[i + 3]
          a += src[i + 3]
          n++
        }
      }
      const o = (y * dstSize + x) * 4
      const am = a / n
      out[o] = am > 0 ? Math.round(r / n / am) : 0
      out[o + 1] = am > 0 ? Math.round(g / n / am) : 0
      out[o + 2] = am > 0 ? Math.round(b / n / am) : 0
      out[o + 3] = Math.round(am)
    }
  }
  return out
}

function packIco(entries) {
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

const master = render(512, appIconShader, 4)
writeFileSync(join(buildDir, 'icon.png'), encodePng(512, 512, master))
const sizes = [256, 128, 64, 48, 32, 16]
const entries = sizes.map(s => ({ size: s, png: encodePng(s, s, resize(master, 512, s)) }))
writeFileSync(join(buildDir, 'icon.ico'), packIco(entries))

const dragDefs = [
  ['md', 0x63b5e8, 0x2e77b8, 'lines'],
  ['txt', 0x8fa3b3, 0x5a7183, 'lines'],
  ['pdf', 0xe08a77, 0xb34a37, 'lines'],
  ['file', 0x9db3c2, 0x5d7688, 'lines'],
  ['image', 0xb39ddb, 0x7a5fa8, 'image']
]
for (const [name, topH, botH, variant] of dragDefs) {
  const png = encodePng(64, 64, render(64, (u, v) => docIconShader(u, v, hex(topH), hex(botH), variant), 4))
  writeFileSync(join(dragDir, name + '.png'), png)
}
console.log('icons written to build/ and resources/drag/')
