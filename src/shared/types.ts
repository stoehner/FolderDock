export type FileKind = 'markdown' | 'text' | 'image' | 'pdf' | 'other'

export type Theme = 'dark' | 'light' | 'system'

export type ViewSize = 'regular' | 'compact'

export type CardColumns = 2 | 3 | 4

export type FileSort = 'recent' | 'name' | 'size'

export type HoverDelay = 'fast' | 'normal' | 'slow'

export interface FileMeta {
  relPath: string
  name: string
  ext: string
  kind: FileKind
  size: number
  mtimeMs: number
  binary: boolean
}

export interface FolderSnapshot {
  name: string
  virtual: boolean
  files: FileMeta[]
}

export interface LibrarySnapshot {
  root: string
  folders: FolderSnapshot[]
  warnings: string[]
}

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface Prefs {
  theme: Theme
  rootPath: string | null
  windowBounds: WindowBounds | null
  folderOrder: string[]
  folderArt: Record<string, string>
  starred: string[]
  openFolder: string | null
  alwaysOnTop: boolean
  viewSize: ViewSize
  cardColumns: CardColumns
  fileSort: FileSort
  closeToTray: boolean
  confirmDelete: boolean
  hoverDelay: HoverDelay
  newFolderArt: string
  backupLocation: string
}

export interface TextFileContent {
  relPath: string
  content: string
  mtimeMs: number
  hadBom: boolean
  binary: boolean
}

export interface WriteTextRequest {
  relPath: string
  content: string
  expectedMtimeMs: number | null
  hadBom: boolean
}

export type WriteTextResult =
  | { saved: true; mtimeMs: number }
  | { saved: false; conflict: true; currentMtimeMs: number }

export interface ImportResult {
  imported: { name: string; relPath: string }[]
  moved: { name: string; relPath: string }[]
  skipped: { name: string; reason: string }[]
}

export interface BackupResult {
  destination: string
  files: number
  folders: number
}

export interface ContentMatch {
  relPath: string
  snippet: string
}

export interface DetailedFileMeta extends FileMeta {
  width: number | null
  height: number | null
}

export type IPCResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const UNSORTED = 'Unsorted'
