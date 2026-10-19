import { create } from 'zustand'
import type { Prefs, Theme, ViewSize } from '../../../shared/types'
import { DEFAULT_PREFS } from '../../../shared/prefs'
import { api, call } from '../lib/api'

const SETTINGS_KEYS = ['theme', 'alwaysOnTop', 'viewSize', 'fileSort', 'closeToTray', 'confirmDelete', 'hoverDelay'] as const

export type Settings = Pick<Prefs, (typeof SETTINGS_KEYS)[number]>

interface PrefsState {
  prefs: Prefs
  booted: boolean
  boot: () => Promise<void>
  patch: (partial: Partial<Settings>) => void
  setTheme: (t: Theme) => void
  setViewSize: (v: ViewSize) => void
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
  setViewSize: v => get().patch({ viewSize: v })
}))

if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyThemeClass(usePrefs.getState().prefs))
}
