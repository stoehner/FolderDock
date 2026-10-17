import { create } from 'zustand'
import type { DetailedFileMeta } from '../../../shared/types'
import { api, call } from '../lib/api'
import { useLibrary } from './library'

interface ExcerptState {
  texts: Record<string, string>
  metas: Record<string, DetailedFileMeta>
  nonce: number
  invalidate: () => void
  ensureExcerpt: (relPath: string) => void
  ensureMeta: (relPath: string) => void
}

export const useExcerpts = create<ExcerptState>((set, get) => ({
  texts: {},
  metas: {},
  nonce: 0,
  invalidate: () => set({ texts: {}, metas: {}, nonce: get().nonce + 1 }),
  ensureExcerpt: (relPath: string) => {
    if (get().texts[relPath] !== undefined) return
    set(s => ({ texts: { ...s.texts, [relPath]: '' } }))
    void api
      .excerpt(relPath)
      .then(r => {
        const text = r.ok ? r.data : ''
        set(s => ({ texts: { ...s.texts, [relPath]: text } }))
      })
      .catch(() => undefined)
  },
  ensureMeta: (relPath: string) => {
    if (get().metas[relPath]) return
    void call(api.fileMeta(relPath))
      .then(meta => set(s => ({ metas: { ...s.metas, [relPath]: meta } })))
      .catch(() => undefined)
  }
}))

useLibrary.subscribe((s, prev) => {
  if (s.snapshot !== prev.snapshot) {
    useExcerpts.getState().invalidate()
  }
})
