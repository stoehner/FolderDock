import { create } from 'zustand'
import type { Prefs, Theme, ViewSize } from '../../../shared/types'
import { DEFAULT_PREFS } from '../../../shared/prefs'
import { api, call } from '../lib/api'

const SETTINGS_KEYS = [
  'theme',
  'alwaysOnTop',
  'viewSize',
  'cardColumns',
  'fileSort',
  'closeToTray',
  'confirmDelete',
  'hoverDelay',
  'newFolderArt'
] as const

export type Settings = Pick<Prefs, (typeof SETTINGS_KEYS)[number]>

interface PrefsState {
  prefs: Prefs
  booted: boolean
  boot: () => Promise<void>
  patch: (partial: Partial<Settings>) => void
  setTheme: (t: Theme) => void
  setViewSize: (v: ViewSize) => void
  resetSettings: () => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

function effectiveTheme(t: Theme): 'dark' | 'light' {
  if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return t
}

function applyThemeClass(prefs: Prefs): void {
  document.body.classList.toggle('light', effectiveTheme(prefs.theme) === 'light')
}

function applyViewSizeClass(prefs: Prefs): void {
  document.body.classList.toggle('compact', prefs.viewSize === 'compact')
  document.body.classList.toggle('cols-3', prefs.cardColumns === 3)
  document.body.classList.toggle('cols-4', prefs.cardColumns === 4)
  applyGridZoom(prefs)
}

const CARD_DESIGN_WIDTH = 186
const CARD_GAP = 14
const SCROLL_PADDING = 44
const COMPACT_ZOOM = 0.78
const MIN_WINDOW_WIDTH = 430

function applyGridZoom(prefs: Prefs): void {
  const columns = prefs.cardColumns
  const layoutNeeded = columns * CARD_DESIGN_WIDTH + (columns - 1) * CARD_GAP
  const available = Math.max(window.innerWidth, MIN_WINDOW_WIDTH) - SCROLL_PADDING
  const base = prefs.viewSize === 'compact' ? COMPACT_ZOOM : 1
  document.documentElement.style.setProperty('--grid-zoom', Math.min(base, available / layoutNeeded).toFixed(3))
}

function settingsPatch(prefs: Prefs): Partial<Prefs> {
  const out: Partial<Prefs> = {}
  for (const key of SETTINGS_KEYS) {
    ;(out as Record<string, unknown>)[key] = prefs[key]
  }
  return out
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void api.setPrefs(settingsPatch(usePrefs.getState().prefs)).catch(() => undefined)
  }, 200)
}

export const usePrefs = create<PrefsState>((set, get) => ({
  prefs: DEFAULT_PREFS,
  booted: false,

  boot: async () => {
    try {
      const prefs = await call(api.getPrefs())
      set({ prefs, booted: true })
    } catch {
      set({ booted: true })
    }
    const { prefs } = get()
    applyThemeClass(prefs)
    applyViewSizeClass(prefs)
  },

  patch: partial => {
    const prefs = { ...get().prefs, ...partial }
    set({ prefs })
    applyThemeClass(prefs)
    applyViewSizeClass(prefs)
    schedulePersist()
  },

  setTheme: t => get().patch({ theme: t }),
  setViewSize: v => get().patch({ viewSize: v }),
  resetSettings: () => {
    const partial = Object.fromEntries(SETTINGS_KEYS.map(key => [key, DEFAULT_PREFS[key]])) as Partial<Settings>
    get().patch(partial)
  }
}))

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => applyGridZoom(usePrefs.getState().prefs))
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyThemeClass(usePrefs.getState().prefs))
}
