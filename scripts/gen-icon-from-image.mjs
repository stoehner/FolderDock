import fsSync from 'node:fs'
import path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, packIco, resizePremultiplied } from './png-codec.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcPath = join(root, 'brand', 'icon-source.png')
const buildDir = join(root, 'build')

const source = decodePng(fsSync.readFileSync(srcPath))
const { width: sw, height: sh, rgba } = source
console.log(`icon source: ${sw}x${sh}`)

const boosted = Buffer.from(rgba)
for (let i = 3; i < boosted.length; i += 4) {
  if (boosted[i] >= 240) boosted[i] = 255
}

let minX = sw
let minY = sh
let maxX = 0
let maxY = 0
for (let y = 0; y < sh; y++) {
  for (let x = 0; x < sw; x++) {
    if (boosted[(y * sw + x) * 4 + 3] > 8) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
const bw = maxX - minX + 1
const bh = maxY - minY + 1
const side = Math.max(bw, bh)
console.log(`artwork bbox: ${bw}x${bh}, square canvas: ${side}x${side}`)

const canvas = Buffer.alloc(side * side * 4, 0)
const ox = minX - Math.floor((side - bw) / 2)
const oy = minY - Math.floor((side - bh) / 2)
for (let y = 0; y < sh; y++) {
  const ty = y - oy
  if (ty < 0 || ty >= side) continue
  for (let x = 0; x < sw; x++) {
    const tx = x - ox
    if (tx < 0 || tx >= side) continue
    const s = (y * sw + x) * 4
    const d = (ty * side + tx) * 4
    canvas[d] = boosted[s]
    canvas[d + 1] = boosted[s + 1]
    canvas[d + 2] = boosted[s + 2]
    canvas[d + 3] = boosted[s + 3]
  }
}

fsSync.mkdirSync(buildDir, { recursive: true })
const luminance = rgba => {
  let sum = 0
  let weight = 0
  const px = rgba.length / 4
  for (let i = 0; i < px; i++) {
    const a = rgba[i * 4 + 3] / 255
    sum += (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) * a
    weight += a
  }
  return weight > 0 ? sum / weight : 0
}
const master = resizePremultiplied(canvas, side, 256)
const srcLum = luminance(canvas)
const outLum = luminance(master)
if (srcLum > 8 && (outLum / srcLum < 0.5 || outLum / srcLum > 2)) {
  throw new Error(`icon resize corrupted brightness (source ${srcLum.toFixed(1)}, output ${outLum.toFixed(1)})`)
}
const sizes = [256, 128, 64, 48, 32, 16]
const entries = sizes.map(size => {
  const png = encodePng(size, size, size === 256 ? master : resizePremultiplied(canvas, side, size))
  if (size === 16 || size === 256) {
    const debugDir = path.join(root, 'desktop-capture')
    fsSync.mkdirSync(debugDir, { recursive: true })
    fsSync.writeFileSync(path.join(debugDir, `icon-${size}.png`), png)
  }
  console.log(`  ${size}x${size}: ${png.length} bytes`)
  return { size, png }
})

fsSync.writeFileSync(join(buildDir, 'icon.ico'), packIco(entries))
fsSync.writeFileSync(join(buildDir, 'icon.png'), encodePng(256, 256, master))
fsSync.mkdirSync(join(root, 'resources'), { recursive: true })
fsSync.copyFileSync(join(buildDir, 'icon.ico'), join(root, 'resources', 'icon.ico'))
console.log('wrote build/icon.ico and build/icon.png')
