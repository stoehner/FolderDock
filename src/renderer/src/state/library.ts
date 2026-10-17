import { create } from 'zustand'
import type { LibrarySnapshot } from '../../../shared/types'
import { api, call } from '../lib/api'

interface LibraryState {
  snapshot: LibrarySnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  apply: (snap: LibrarySnapshot) => void
}

export const useLibrary = create<LibraryState>(set => ({
  snapshot: null,
  loading: false,
  error: null,
  refresh: async () => {
    try {
      const snap = await call(api.scan())
      set({ snapshot: snap, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
  apply: snap => set({ snapshot: snap, error: null })
}))
