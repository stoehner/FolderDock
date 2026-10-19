import { create } from 'zustand'
import type { DetailedFileMeta } from '../../../shared/types'
import { api, call } from '../lib/api'
import { useLibrary } from './library'

interface ExcerptState {
  texts: Record<string, string>
  metas: Record<string, DetailedFileMeta>
  stamps: Record<string, number>
  ensureExcerpt: (relPath: string) => void
  ensureMeta: (relPath: string) => void
}

function mtimeOf(relPath: string): number | null {
  const file = useLibrary
    .getState()
    .snapshot?.folders.flatMap(f => f.files)
    .find(x => x.relPath === relPath)
  return file ? file.mtimeMs : null
}

export const useExcerpts = create<ExcerptState>((set, get) => ({
  texts: {},
  metas: {},
  stamps: {},

  ensureExcerpt: relPath => {
    const mtime = mtimeOf(relPath)
    if (mtime === null) {
      if (get().stamps[relPath] !== undefined) {
        set(s => {
          const texts = { ...s.texts }
          const metas = { ...s.metas }
          const stamps = { ...s.stamps }
          delete texts[relPath]
          delete metas[relPath]
          delete stamps[relPath]
          return { texts, metas, stamps }
        })
      }
      return
    }
    if (get().stamps[relPath] === mtime && get().texts[relPath] !== undefined) return
    if (get().stamps[relPath] !== mtime) set(s => ({ texts: { ...s.texts, [relPath]: s.texts[relPath] ?? '' } }))
    void api
      .excerpt(relPath)
      .then(r => {
        const text = r.ok ? r.data : ''
        if (mtimeOf(relPath) !== mtime) return
        set(s => ({ texts: { ...s.texts, [relPath]: text }, stamps: { ...s.stamps, [relPath]: mtime } }))
      })
      .catch(() => undefined)
  },

  ensureMeta: relPath => {
    const mtime = mtimeOf(relPath)
    if (mtime === null) return
    if (get().stamps[relPath] === mtime && get().metas[relPath] !== undefined) return
    void call(api.fileMeta(relPath))
      .then(meta => {
        if (mtimeOf(relPath) !== mtime) return
        set(s => ({ metas: { ...s.metas, [relPath]: meta }, stamps: { ...s.stamps, [relPath]: mtime } }))
      })
      .catch(() => undefined)
  }
}))
