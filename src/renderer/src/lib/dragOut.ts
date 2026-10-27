import { api, call, errText } from './api'
import { useLibrary } from '../state/library'
import { useUI } from '../state/ui'

// Drag-out carrying: single-file drags use the DownloadURL flavor which names a real
// file:// path. Electron-probed (2026-10-27, manual sessions): DownloadURL drags from a
// file:// page land on Explorer targets with full content, while renderer `dragend`
// reliably fires afterwards reporting the OS outcome (copy/move vs none). Blob File
// drags (dataTransfer.items.add) are refused by Explorer on this runtime.

export const INTERNAL_FILES_TYPE = 'application/x-folderdock-files'

interface InternalPayload {
  v: 1
  files: string[]
}

const CONSUMED_MS = 10000
const SETTLE_BASE_MS = 1200
const SETTLE_PER_10MB_MS = 1000
const SETTLE_MAX_MS = 15000

let consumedDrop: { payload: string; at: number } | null = null
// Set only while an HTML5 single-file drag is live. Native `api.startDrag` drags never
// mark this, so their dragend (if the runtime ever fires one) cannot move a file out.
let activeOutDrag: string | null = null

export function encodeInternalDrop(files: string[]): string {
  const payload: InternalPayload = { v: 1, files }
  return JSON.stringify(payload)
}

interface InternalDropRead {
  payload: string
  files: string[]
}

export function readInternalDrop(e: { dataTransfer: React.DragEvent['dataTransfer'] }): InternalDropRead | null {
  const dt = e.dataTransfer
  if (!dt || !dt.types.includes(INTERNAL_FILES_TYPE)) return null
  try {
    const payload = dt.getData(INTERNAL_FILES_TYPE)
    const parsed = JSON.parse(payload) as Partial<InternalPayload> | null
    if (!parsed || !Array.isArray(parsed.files)) return null
    const files = parsed.files.filter((p): p is string => typeof p === 'string')
    if (files.length === 0) return null
    return { payload, files }
  } catch {
    return null
  }
}

export function markInternalDropHandled(payload: string): void {
  consumedDrop = { payload, at: Date.now() }
}

export function isInternalDrag(e: { dataTransfer: React.DragEvent['dataTransfer'] | null }): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(INTERNAL_FILES_TYPE)
}

function fileUrlFor(root: string, relPath: string): string {
  const abs = `${root.replace(/[\\/]+$/, '')}/${relPath}`
  const segments = abs.split(/[\\/]/)
  return segments.map((s, i) => (i === 0 ? s : encodeURIComponent(s))).join('/')
}

export function startOutDrag(e: React.DragEvent, relPath: string, root: string, otherRelPaths?: string[]): void {
  if (otherRelPaths && otherRelPaths.length > 0) {
    // Chromium can carry only one DownloadURL file per drag; multi-selection keeps the
    // native main-process drag (copy semantics, unchanged).
    activeOutDrag = null
    e.preventDefault()
    api.startDrag(relPath, otherRelPaths)
    return
  }
  if (!root) {
    activeOutDrag = null
    e.preventDefault()
    return
  }
  activeOutDrag = relPath
  e.dataTransfer.setData(INTERNAL_FILES_TYPE, encodeInternalDrop([relPath]))
  e.dataTransfer.effectAllowed = 'copyMove'
  const name = relPath.split('/').pop() ?? ''
  const url = `file:///${fileUrlFor(root, relPath)}`
  e.dataTransfer.setData('DownloadURL', `application/octet-stream:${name}:${url}`)
}

export function finishOutDrag(e: React.DragEvent, relPath: string, sizeBytes: number): void {
  if (activeOutDrag !== relPath) return // native multi-selection drag or a stale row
  activeOutDrag = null
  const effect = e.dataTransfer?.dropEffect
  // copy/move = the OS delivered the file somewhere outside this window; the library
  // original should not stay (that is drag-out = move-out). none = cancelled or refused.
  // link = a shortcut was created, not the file itself.
  if (!effect || (effect !== 'copy' && effect !== 'move')) return
  const payload = encodeInternalDrop([relPath])
  const settle = Math.min(
    SETTLE_MAX_MS,
    SETTLE_BASE_MS + Math.round(sizeBytes / (10 * 1024 * 1024)) * SETTLE_PER_10MB_MS
  )
  window.setTimeout(() => void moveDraggedFileOut(payload, relPath), settle)
}

function wasConsumedInApp(payload: string): boolean {
  const consumed = consumedDrop
  return !!consumed && consumed.payload === payload && Date.now() - consumed.at <= CONSUMED_MS
}

async function moveDraggedFileOut(payload: string, relPath: string): Promise<void> {
  if (wasConsumedInApp(payload)) return
  const ui = useUI.getState()
  const name = relPath.split('/').pop() ?? relPath
  try {
    const snap = await call(api.scan())
    const stillThere = snap.folders.some(f => f.files.some(file => file.relPath === relPath))
    if (!stillThere) {
      // Windows already moved the file at the destination.
      useLibrary.getState().apply(snap)
      ui.notify(`"${name}" moved out of the library`)
      return
    }
    const after = await call(api.deleteFile(relPath))
    useLibrary.getState().apply(after)
    ui.notify(`"${name}" moved out of the library · original went to the Recycle Bin`)
  } catch (err) {
    ui.notify(errText(err), 'error')
  }
}
