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

export function matchSnippet(text: string, matchStart: number, matchLen: number, radius = 48): string {
  const start = Math.max(0, matchStart - radius)
  const end = Math.min(text.length, matchStart + matchLen + radius)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()
  if (!body) return ''
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`
}
