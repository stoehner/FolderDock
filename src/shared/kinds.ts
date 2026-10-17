import type { FileKind } from './types'

const MARKDOWN_EXTS = new Set(['.md', '.markdown'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico'])
const PDF_EXTS = new Set(['.pdf'])
const TEXT_EXTS = new Set([
  '.txt',
  '.log',
  '.csv',
  '.tsv',
  '.json',
  '.jsonc',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.yml',
  '.yaml',
  '.xml',
  '.ini',
  '.cfg',
  '.conf',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.srt',
  '.vtt',
  '.sql',
  '.toml'
])

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i).toLowerCase() : ''
}

export function kindForExt(ext: string): FileKind {
  if (MARKDOWN_EXTS.has(ext)) return 'markdown'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (PDF_EXTS.has(ext)) return 'pdf'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'other'
}

export function isTextKind(kind: FileKind): boolean {
  return kind === 'markdown' || kind === 'text'
}

export function isImageKind(kind: FileKind): boolean {
  return kind === 'image'
}

export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'markdown':
      return 'Markdown'
    case 'text':
      return 'Text'
    case 'image':
      return 'Image'
    case 'pdf':
      return 'PDF'
    default:
      return 'File'
  }
}
