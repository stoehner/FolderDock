import { api, call, errText } from './api'
import type { LibrarySnapshot } from '../../../shared/types'
import { useLibrary } from '../state/library'
import { useUI } from '../state/ui'

// Drag-out carrying: EVERY file drag (single and multi-selection) hands the file to the
// native main-process carrier (`api.startDrag`), which gives Windows a real file object
// with honest OS semantics (same-drive folder/desktop drops default to move).
//
// [drag-out verdict contract, measured 2026-11-01] the library never recycles its
// original on the strength of an event signal. Chromium's `dragend.dropEffect` is a
// guess on Windows and cannot distinguish a refused drop from a delivered one —
// crbug 41183574: "we use some heuristics to guess at a dropEffect in dragend, but we
// don't want to guess a destructive dropEffect ('move') so we always select 'copy'" —
// and this runtime measured refused drops reporting 'move', 'move' and 'copy' (one
// value FolderDock never writes anywhere). The single honest signal is the disk:
// after any out-drag, step scans decide — the original leaves the library ONLY when
// Windows actually moved it away (a "moved out" toast is earned by a vanished file
// that the UI still believed was present); a file still in the library root keeps the
// library entry untouched (refused drop, Esc, or a copy delivery — nothing recycles).

const SETTLE_BASE_MS = 1200
const SETTLE_STEP_MS = 4000
const SETTLE_MAX_MS = 10000

// Handed the job of watching one out-drag: scan the library at the settle points and
// stop at the first affirmative disk truth. Runs on native drags, for which no
// renderer event ever reports the OS drag outcome. The disk watcher ALSO applies
// moved-away files silently, so the "moved out" toast is earned against the listing
// captured at drag start, not against whatever the watcher already refreshed.
function settleScanChain(relPath: string): void {
  const listedAtStart =
    useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === relPath)) ?? false
  let delay = SETTLE_BASE_MS
  const run = async (): Promise<void> => {
    let settled = false
    try {
      const out = await call(api.scan())
      settled = applySettleOut(out, relPath, listedAtStart)
    } catch (err) {
      useUI.getState().notify(errText(err), 'error')
      return
    }
    if (settled) return
    delay += SETTLE_STEP_MS
    if (delay > SETTLE_MAX_MS) return
    window.setTimeout(() => void run(), SETTLE_STEP_MS)
  }
  window.setTimeout(() => void run(), delay)
}

// Verdict for one scan of an out-drag. Returns whether the chain may stop.
// - file still in the library root: not a move-out, keep scanning (refused / copy).
// - file gone but re-homed under another collection (in-app retarget): quiet.
// - file gone and it was in the library at drag start: apply + "moved out" toast.
function applySettleOut(snap: LibrarySnapshot, relPath: string, listedAtStart: boolean): boolean {
  const gone = !snap.folders.some(f => f.files.some(x => x.relPath === relPath))
  if (!gone) return false
  const name = relPath.split('/').pop() ?? relPath
  // an internal retarget leaves the basename inside the library - the importer owns that flow
  if (snap.folders.some(f => f.files.some(x => x.name === name))) return true
  if (!listedAtStart) return true // the watcher already handled it - stay quiet
  useLibrary.getState().apply(snap)
  useUI.getState().notify(`"${name}" moved out of the library`)
  return true
}

export function startOutDrag(e: React.DragEvent, relPath: string, root: string, otherRelPaths?: string[]): void {
  e.preventDefault() // never start an HTML5 drag session; the OLE loop owns the gesture
  if (!root) return
  if (otherRelPaths && otherRelPaths.length > 0) {
    api.startDrag(relPath, otherRelPaths)
  } else {
    api.startDrag(relPath)
    settleScanChain(relPath)
  }
  // The library updates purely from disk truth (settle scans):
  // file gone -> "moved out of the library"; file still there -> untouched.
}
