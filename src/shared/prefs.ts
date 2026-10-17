import type { Prefs } from './types'

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  rootPath: null,
  windowBounds: null,
  folderOrder: [],
  folderArt: {},
  starred: [],
  openFolder: null
}

const ART_IDS = new Set(['aurora', 'ember', 'dusk', 'glacier', 'verdant', 'slate'])

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function mergePrefs(raw: unknown): Prefs {
  const r = (raw ?? {}) as Record<string, unknown>
  const theme = r.theme === 'light' ? 'light' : 'dark'
  const rootPath = typeof r.rootPath === 'string' && r.rootPath.trim() ? r.rootPath : null
  const wb = (r.windowBounds ?? null) as Record<string, unknown> | null
  const windowBounds =
    wb && typeof wb === 'object' && typeof wb.width === 'number' && typeof wb.height === 'number'
      ? {
          x: typeof wb.x === 'number' ? wb.x : undefined,
          y: typeof wb.y === 'number' ? wb.y : undefined,
          width: wb.width,
          height: wb.height,
          maximized: wb.maximized === true
        }
      : null
  const folderArtRaw = (r.folderArt ?? {}) as Record<string, unknown>
  const folderArt: Record<string, string> = {}
  for (const [k, v] of Object.entries(folderArtRaw)) {
    if (typeof v === 'string' && ART_IDS.has(v)) folderArt[k] = v
  }
  const openFolder = typeof r.openFolder === 'string' ? r.openFolder : null
  return {
    theme,
    rootPath,
    windowBounds,
    folderOrder: strArray(r.folderOrder),
    folderArt,
    starred: strArray(r.starred),
    openFolder
  }
}

export function prunePrefs(prefs: Prefs, folderNames: string[]): Prefs {
  const names = new Set(folderNames)
  const folderOrder = prefs.folderOrder.filter(n => names.has(n))
  const folderArt: Record<string, string> = {}
  for (const [k, v] of Object.entries(prefs.folderArt)) if (names.has(k)) folderArt[k] = v
  const openFolder = prefs.openFolder && names.has(prefs.openFolder) ? prefs.openFolder : null
  return { ...prefs, folderOrder, folderArt, openFolder }
}
