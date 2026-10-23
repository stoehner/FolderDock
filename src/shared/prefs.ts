import type { Prefs } from './types'
import { isArtValue, isHexColor, isNewFolderArtValue } from './art-values'

export const MAX_SAVED_COLORS = 24

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  rootPath: null,
  windowBounds: null,
  folderOrder: [],
  folderArt: {},
  starred: [],
  openFolder: null,
  alwaysOnTop: false,
  viewSize: 'regular',
  fontSize: 'medium',
  cardColumns: 2,
  fileSort: 'recent',
  closeToTray: true,
  confirmDelete: true,
  hoverDelay: 'normal',
  newFolderArt: 'varied',
  backupLocation: 'Z:\\REA-Backups',
  customColors: []
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function mergePrefs(raw: unknown): Prefs {
  const r = (raw ?? {}) as Record<string, unknown>
  const theme = r.theme === 'light' || r.theme === 'system' ? r.theme : 'dark'
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
    if (typeof v === 'string' && isArtValue(v)) folderArt[k] = v
  }
  const openFolder = typeof r.openFolder === 'string' ? r.openFolder : null
  return {
    theme,
    rootPath,
    windowBounds,
    folderOrder: strArray(r.folderOrder),
    folderArt,
    starred: strArray(r.starred),
    openFolder,
    alwaysOnTop: r.alwaysOnTop === true,
    viewSize: r.viewSize === 'compact' ? 'compact' : 'regular',
    fontSize: r.fontSize === 'small' || r.fontSize === 'large' ? r.fontSize : 'medium',
    cardColumns: r.cardColumns === 3 || r.cardColumns === 4 ? r.cardColumns : 2,
    fileSort: r.fileSort === 'name' || r.fileSort === 'size' ? r.fileSort : 'recent',
    closeToTray: r.closeToTray === undefined ? true : r.closeToTray === true,
    confirmDelete: r.confirmDelete === undefined ? true : r.confirmDelete === true,
    hoverDelay: r.hoverDelay === 'fast' || r.hoverDelay === 'slow' ? r.hoverDelay : 'normal',
    newFolderArt: typeof r.newFolderArt === 'string' && isNewFolderArtValue(r.newFolderArt) ? r.newFolderArt : 'varied',
    backupLocation:
      typeof r.backupLocation === 'string' && r.backupLocation.trim() ? r.backupLocation.trim() : DEFAULT_PREFS.backupLocation,
    customColors: [...new Set(strArray(r.customColors).filter(isHexColor))].slice(0, MAX_SAVED_COLORS)
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
