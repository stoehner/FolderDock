import { create } from 'zustand'

interface DragState {
  draggingFolder: string | null
  dropTarget: string | null
  setDraggingFolder: (name: string | null) => void
  setDropTarget: (name: string | null) => void
}

export const useDrag = create<DragState>(set => ({
  draggingFolder: null,
  dropTarget: null,
  setDraggingFolder: name => set({ draggingFolder: name }),
  setDropTarget: name => set({ dropTarget: name })
}))
