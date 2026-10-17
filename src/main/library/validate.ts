import path from 'node:path'

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
])

const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/

export type NameCheck = { valid: true; value: string } | { valid: false; reason: string }

export function checkFileName(raw: string): NameCheck {
  const name = raw.trim()
  if (!name) return { valid: false, reason: 'Enter a file name.' }
  if (name.length > 120) return { valid: false, reason: 'File name is too long (max 120 characters).' }
  if (INVALID_CHARS.test(name)) return { valid: false, reason: 'File names cannot contain <>:"/\\|?* or control characters.' }
  if (name.endsWith(' ') || name.endsWith('.')) return { valid: false, reason: 'File names cannot end with a space or period.' }
  const stem = name.includes('.') ? name.slice(0, name.indexOf('.')) : name
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) return { valid: false, reason: `"${stem}" is a reserved Windows name.` }
  return { valid: true, value: name }
}

export function checkFolderName(raw: string, reservedNames: string[] = []): NameCheck {
  const name = raw.trim()
  if (!name) return { valid: false, reason: 'Enter a folder name.' }
  if (name.length > 60) return { valid: false, reason: 'Folder name is too long (max 60 characters).' }
  if (INVALID_CHARS.test(name)) return { valid: false, reason: 'Folder names cannot contain <>:"/\\|?* or control characters.' }
  if (name === '.' || name === '..') return { valid: false, reason: 'This folder name is not allowed.' }
  if (name.endsWith(' ') || name.endsWith('.')) return { valid: false, reason: 'Folder names cannot end with a space or period.' }
  if (WINDOWS_RESERVED.has(name.toUpperCase())) return { valid: false, reason: `"${name}" is a reserved Windows name.` }
  const lower = name.toLowerCase()
  if (lower === 'unsorted') return { valid: false, reason: '"Unsorted" is reserved for files dropped at the library root.' }
  if (reservedNames.some(n => n.toLowerCase() === lower)) return { valid: false, reason: `A collection named "${name}" already exists.` }
  return { valid: true, value: name }
}

export function resolveWithinRoot(root: string, relPath: string): string | null {
  if (typeof relPath !== 'string' || !relPath.trim()) return null
  const abs = path.resolve(root, relPath)
  const rel = path.relative(root, abs)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
  if (rel.split(path.sep).some(seg => seg === '..' || seg === '.')) return null
  return abs
}

export function toRelPath(root: string, absPath: string): string {
  return path.relative(root, absPath).split(path.sep).join('/')
}

export function uniqueName(existing: Iterable<string>, name: string): string {
  const lower = new Set(Array.from(existing, n => n.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 2; i < 10000; i++) {
    const candidate = `${stem} (${i})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
  return `${stem}-${Date.now()}${ext}`
}

export function describeFsError(err: unknown): string {
  const e = err as { code?: string; message?: string }
  switch (e?.code) {
    case 'ENOENT':
      return 'The file or folder no longer exists on disk.'
    case 'EEXIST':
      return 'Something with that name already exists.'
    case 'EPERM':
    case 'EACCES':
      return 'Windows denied permission for this operation.'
    case 'EBUSY':
      return 'The file is locked by another program.'
    case 'ENAMETOOLONG':
      return 'The resulting path is too long for Windows.'
    case 'ENOSPC':
      return 'The disk is full.'
    case 'EXDEV':
      return 'Cannot move across different drives.'
    default:
      return e?.message ? e.message : 'An unexpected file system error occurred.'
  }
}

export function isTempName(name: string): boolean {
  return name.includes('.fdtmp')
}
