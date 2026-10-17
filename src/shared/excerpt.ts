export function looksBinary(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 8192))
  if (head.includes(0)) return true
  let suspicious = 0
  const n = Math.min(head.length, 2048)
  for (let i = 0; i < n; i++) {
    const b = head.readUInt8(i)
    if (b < 9 || (b > 13 && b < 32)) suspicious++
  }
  return n > 0 && suspicious / n > 0.08
}

export function extractExcerpt(content: string, maxLen = 230): string {
  const text = content
    .replace(/```[\s\S]*?(```|$)/g, ' code example ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*|__|~~/g, '')
    .replace(/[*_]/g, '')
    .replace(/^\s*([-*_]\s*){3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text
}

export function firstHeading(content: string): string | null {
  const m = content.match(/^\s*#{1,6}\s+(.+)$/m)
  const h = m?.[1]
  return h ? h.trim() : null
}
