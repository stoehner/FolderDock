import { create } from 'zustand'
import type { Prefs } from '../../../shared/types'
import { api, call, errText } from '../lib/api'
import { useLibrary } from './library'
import { usePrefs } from './prefs'

export type FilterKind = 'all' | 'markdown' | 'image' | 'pdf' | 'favorites' | 'recent'

export type Modal =
  | { type: 'new-folder'; art: string }
  | { type: 'rename-folder'; folder: string }
  | { type: 'rename-file'; relPath: string }
  | {
      type: 'confirm'
      title: string
      subtitle: string
      description: string
      confirmLabel: string
      onConfirm: () => Promise<void> | void
      onCancel?: () => void
    }
  | { type: 'move-file'; relPath: string }
  | { type: 'move-files'; relPaths: string[] }
  | { type: 'recolor-folder'; folder: string }
  | { type: 'help' }
  | { type: 'settings' }
  | { type: 'editor'; relPath: string }

export type ContextMenu =
  | { kind: 'folder'; folder: string; x: number; y: number }
  | { kind: 'file'; relPath: string; x: number; y: number }

export interface EditorState {
  relPath: string
  name: string
  content: string
  savedContent: string
  mtimeMs: number
  hadBom: boolean
  tab: 'edit' | 'preview'
}

interface UIState {
  booted: boolean
  search: string
  filter: FilterKind
  openFolder: string | null
  folderOrder: string[]
  folderArt: Record<string, string>
  starred: string[]
  contextMenu: ContextMenu | null
  modal: Modal | null
  previewRelPath: string | null
  previewNonce: number
  editor: EditorState | null
  maximized: boolean
  dragDepth: number
  contentMatches: Record<string, string>
  selection: string[]
  toast: { text: string; kind: 'info' | 'error'; id: number } | null

  boot: () => Promise<void>
  notify: (text: string, kind?: 'info' | 'error') => void
  setSearch: (s: string) => void
  setContentMatches: (m: Record<string, string>) => void
  toggleSelect: (relPath: string) => void
  clearSelection: () => void
  setFilter: (f: FilterKind) => void
  toggleFolder: (name: string | null) => void
  setOpenFolder: (name: string | null) => void
  setFolderArt: (name: string, art: string) => void
  unsetFolderArt: (name: string) => void
  clearFolderArt: () => void
  moveFolderOrder: (source: string, target: string) => void
  rekeyFolder: (oldName: string, newName: string) => void
  toggleStar: (relPath: string) => void
  openMenu: (m: ContextMenu) => void
  closeMenu: () => void
  openModal: (m: Modal) => void
  closeModal: () => void
  openPreview: (relPath: string) => void
  closePreview: () => void
  bumpPreview: () => void
  openEditor: (relPath: string) => Promise<void>
  closeEditor: () => void
  setEditorContent: (c: string) => void
  setEditorName: (n: string) => void
  setEditorTab: (t: 'edit' | 'preview') => void
  setMaximized: (m: boolean) => void
  dragEnter: (e: DragEvent) => void
  dragLeave: () => void
  dragReset: () => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 0

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const s = useUI.getState()
    const patch: Partial<Prefs> = {
      folderOrder: s.folderOrder,
      folderArt: s.folderArt,
      starred: s.starred,
      openFolder: s.openFolder
    }
    void api.setPrefs(patch).catch(() => undefined)
  }, 200)
}

export const useUI = create<UIState>((set, get) => ({
  booted: false,
  search: '',
  filter: 'all',
  openFolder: null,
  folderOrder: [],
  folderArt: {},
  starred: [],
  contextMenu: null,
  modal: null,
  previewRelPath: null,
  previewNonce: 0,
  editor: null,
  maximized: false,
  dragDepth: 0,
  contentMatches: {},
  selection: [],
  toast: null,

  boot: async () => {
    const prefs = usePrefs.getState().prefs
    set({
      folderOrder: prefs.folderOrder,
      folderArt: prefs.folderArt,
      starred: prefs.starred,
      openFolder: prefs.openFolder,
      booted: true
    })
    await useLibrary.getState().refresh()
  },

  notify: (text, kind = 'info') => {
    if (toastTimer) clearTimeout(toastTimer)
    toastId += 1
    set({ toast: { text, kind, id: toastId } })
    toastTimer = setTimeout(() => set({ toast: null }), 2900)
  },

  setSearch: s => set({ search: s, contextMenu: null }),
  setContentMatches: m => set({ contentMatches: m }),
  toggleSelect: relPath => {
    const s = get()
    set({
      selection: s.selection.includes(relPath) ? s.selection.filter(p => p !== relPath) : [...s.selection, relPath]
    })
  },
  clearSelection: () => set({ selection: [] }),
  setFilter: f => set({ filter: f, contextMenu: null }),

  toggleFolder: name => {
    set({ openFolder: get().openFolder === name ? null : name, contextMenu: null })
    schedulePersist()
  },

  setOpenFolder: name => {
    set({ openFolder: name })
    schedulePersist()
  },

  setFolderArt: (name, art) => {
    set({ folderArt: { ...get().folderArt, [name]: art } })
    schedulePersist()
  },

  unsetFolderArt: name => {
    const folderArt = { ...get().folderArt }
    delete folderArt[name]
    set({ folderArt })
    schedulePersist()
  },

  clearFolderArt: () => {
    set({ folderArt: {} })
    schedulePersist()
  },

  moveFolderOrder: (source, target) => {
    if (source === target) return
    const snap = useLibrary.getState().snapshot
    if (!snap) return
    const names = snap.folders.filter(f => !f.virtual).map(f => f.name)
    const order = [...get().folderOrder.filter(n => names.includes(n)), ...names.filter(n => !get().folderOrder.includes(n))]
    const fromIdx = order.indexOf(source)
    const toIdx = order.indexOf(target)
    if (fromIdx < 0 || toIdx < 0) return
    order.splice(toIdx, 0, ...order.splice(fromIdx, 1))
    set({ folderOrder: order })
    schedulePersist()
  },

  rekeyFolder: (oldName, newName) => {
    const s = get()
    const remap = (p: string): string =>
      p === oldName || p.startsWith(`${oldName}/`) ? `${newName}${p.slice(oldName.length)}` : p
    set({
      folderOrder: s.folderOrder.map(n => (n === oldName ? newName : n)),
      folderArt: Object.fromEntries(Object.entries(s.folderArt).map(([k, v]) => [k === oldName ? newName : k, v])),
      openFolder: s.openFolder === oldName ? newName : s.openFolder,
      starred: s.starred.map(remap),
      selection: s.selection.map(remap)
    })
    schedulePersist()
  },

  toggleStar: relPath => {
    const starred = get().starred.includes(relPath)
      ? get().starred.filter(p => p !== relPath)
      : [...get().starred, relPath]
    set({ starred })
    schedulePersist()
  },

  openMenu: m => set({ contextMenu: m }),
  closeMenu: () => set({ contextMenu: null }),
  openModal: m => set({ modal: m, contextMenu: null }),
  closeModal: () => set({ modal: null }),

  openPreview: relPath => {
    set({ previewRelPath: relPath, previewNonce: get().previewNonce + 1, contextMenu: null })
  },

  closePreview: () => {
    set({ previewRelPath: null })
  },
  bumpPreview: () => set({ previewNonce: get().previewNonce + 1 }),

  openEditor: async relPath => {
    try {
      const file = await call(api.readTextFile(relPath))
      if (file.binary) {
        get().notify('This file looks binary and cannot be edited as text.', 'error')
        return
      }
      const name = relPath.split('/').pop() ?? relPath
      set({
        modal: { type: 'editor', relPath },
        editor: {
          relPath,
          name,
          content: file.content,
          savedContent: file.content,
          mtimeMs: file.mtimeMs,
          hadBom: file.hadBom,
          tab: 'edit'
        },
        contextMenu: null
      })
    } catch (e) {
      get().notify(errText(e), 'error')
    }
  },

  closeEditor: () => set({ modal: null, editor: null }),
  setEditorContent: c => {
    const ed = get().editor
    if (ed) set({ editor: { ...ed, content: c } })
  },
  setEditorName: n => {
    const ed = get().editor
    if (ed) set({ editor: { ...ed, name: n } })
  },
  setEditorTab: t => {
    const ed = get().editor
    if (ed) set({ editor: { ...ed, tab: t } })
  },

  setMaximized: m => set({ maximized: m }),

  dragEnter: (e: DragEvent) => {
    if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
      set({ dragDepth: 1 })
    }
  },
  dragLeave: () => set({ dragDepth: 0 }),
  dragReset: () => set({ dragDepth: 0 })
}))

export function targetFolderForNewItems(): string | null {
  const s = useUI.getState()
  const snap = useLibrary.getState().snapshot
  if (!snap) return null
  if (s.openFolder && s.openFolder !== 'Unsorted') return s.openFolder
  const first = snap.folders.find(f => !f.virtual)
  return first?.name ?? null
}
