import { api, call, errText } from './api'
import type { LibrarySnapshot } from '../../../shared/types'
import { useLibrary } from '../state/library'
import { useUI } from '../state/ui'
import { diagLog } from './diag'

// Drag-out carrying: EVERY file drag (single and multi-selection) hands the file to the
// native main-process carrier (`api.startDrag`), which gives Windows a real file object.
//
// [upstream evidence, 2026-11-02] the Electron carrier can only ever deliver a COPY:
// DragFileItems starts the OLE drag loop with allowed operations DRAG_COPY | DRAG_LINK
// (electron 44.10.1, shell/browser/ui/drag_util_views.cc line 47) and webContents.startDrag
// exposes no way to add DRAG_MOVE. Windows therefore never moves a file out of the library
// on its own: external drops onto the Desktop or into folders land as copies (any drive),
// Alt-drag yields a shortcut, and the library original always survives on disk. The old
// "same-drive drops default to move" premise held for Explorer-to-Explorer drags only —
// not for an Electron app source (first reported in daily use, 2026-11-01 evening).
//
// [drag-out verdict contract, measured 2026-11-01] the library never recycles its
// original on the strength of an event signal. Chromium's `dragend.dropEffect` is a
// guess on Windows and cannot distinguish a refused drop from a delivered one —
// crbug 41183574: "we use some heuristics to guess at a dropEffect in dragend, but we
// don't want to guess a destructive dropEffect ('move') so we always select 'copy'" —
// and this runtime measured refused drops reporting 'move', 'move' and 'copy' (one
// value FolderDock never writes anywhere). The honest signal is the disk: after an
// out-drag, step scans decide. A file gone from the library root and listed nowhere
// else means Windows really moved it away (a Recycle-bin target, or a future carrier
// that offers move) — the entry retires and a toast reports "moved out of the library".
// A file still in the library root once the settle cap passes means a copy delivery, a
// refused drop, Esc, or a cancelled drag — states the disk alone cannot separate — so
// the USER's declared intent resolves it, never a guess:
// - plain drag (no modifier): keep + one educational toast naming the Shift gesture.
// - Ctrl or Alt, or a multi-selection drag: the user asked for copy/shortcut — silent keep.
// - Shift (a move request): a confirm modal resolves the verdict. "Move it out" recycles
//   the library copy into the Recycle Bin (recoverable) and retires the entry with the
//   same "moved out" toast; Cancel keeps everything as-is. Refused targets and
//   Esc-with-Shift stay fully safe: nothing recycles without the user's own click.

const SETTLE_BASE_MS = 1200
const SETTLE_STEP_MS = 4000
const SETTLE_MAX_MS = 10000

type OutIntent = 'move' | 'copy' | 'auto'

function intentOf(shiftKey: boolean, ctrlKey: boolean, altKey: boolean, multi: boolean): OutIntent {
  if (multi) return 'copy'
  if (shiftKey) return 'move'
  if (ctrlKey || altKey) return 'copy'
  return 'auto'
}

// Handed the job of watching one out-drag: scan the library at the settle points and
// stop at the first affirmative disk truth. Runs on native drags, for which no
// renderer event ever reports the OS drag outcome. The disk watcher ALSO applies
// moved-away files silently, so the "moved out" toast is earned against the listing
// captured at drag start, not against whatever the watcher already refreshed.
function settleScanChain(relPath: string, intent: OutIntent): void {
  const listedAtStart =
    useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === relPath)) ?? false
  let delay = SETTLE_BASE_MS
  const run = async (): Promise<void> => {
    let settled = false
    try {
      const out = await call(api.scan())
      settled = applySettleOut(out, relPath, listedAtStart)
    } catch (err) {
      diagLog('error', 'drag-out', `scan failed: ${errText(err)}`)
      useUI.getState().notify(errText(err), 'error')
      return
    }
    if (settled) return
    delay += SETTLE_STEP_MS
    if (delay > SETTLE_MAX_MS) {
      finishKeptOut(relPath, intent)
      return
    }
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
  if (snap.folders.some(f => f.files.some(x => x.name === name))) {
    diagLog('info', 'drag-out', `scan verdict: ${name} re-homed inside the library - the import path owns it, quiet`)
    return true
  }
  if (!listedAtStart) return true // the watcher already handled it - stay quiet
  useLibrary.getState().apply(snap)
  useUI.getState().notify(`"${name}" moved out of the library`)
  diagLog('info', 'drag-out', `scan verdict: ${name} left the library - entry retired`)
  return true
}

// The scans exhausted their cap with the original still on disk: Windows did not move
// the file away, and the disk cannot separate "copy delivered" from "refused/cancelled".
// The user's intent decides — the copy branch keeps silently, the plain branch gets one
// educational toast, and the move branch raises a confirm modal whose OWN click is the
// only thing that may ever recycle the original (Recycle Bin, recoverable).
function finishKeptOut(relPath: string, intent: OutIntent): void {
  if (intent === 'copy') {
    diagLog('info', 'drag-out', `${relPath} kept with no feedback (explicit copy/shortcut intent)`)
    return
  }
  const name = relPath.split('/').pop() ?? relPath
  if (intent === 'move') {
    diagLog('info', 'drag-out', `move requested for ${relPath} - opening the confirm modal`)
    useUI.getState().openModal({
      type: 'confirm',
      title: 'Move out of the library?',
      subtitle: `${name} is still in the library`,
      description:
        'Windows always delivers copies from drag-and-drop apps, and it delivers nothing when a target refuses or the drag was cancelled — the disk cannot tell those apart. If a copy landed at the destination, that copy is your file: confirm to retire the library copy. It goes to the Recycle Bin, so nothing is ever lost.',
      confirmLabel: 'Move it out',
      icon: 'info',
      onCancel: () => {
        diagLog('info', 'drag-out', `move-out declined for ${relPath} - everything kept`)
        useUI.getState().closeModal()
      },
      onConfirm: async () => {
        try {
          const snap = await call(api.deleteFile(relPath))
          useLibrary.getState().apply(snap)
          useUI.getState().notify(`"${name}" moved out of the library`)
          diagLog('info', 'drag-out', `${relPath} retired by the user's confirm click`)
        } catch (err) {
          diagLog('error', 'drag-out', `move-out confirm failed: ${errText(err)}`)
          useUI.getState().notify(errText(err), 'error')
        }
        useUI.getState().closeModal()
      }
    })
    return
  }
  diagLog('info', 'drag-out', `${relPath} kept with the Shift hint for a plain drag`)
  useUI.getState().notify(`"${name}" is still in your library — hold Shift while dragging to move it out`)
}

export function startOutDrag(e: React.DragEvent, relPath: string, root: string, otherRelPaths?: string[]): void {
  e.preventDefault() // never start an HTML5 drag session; the OLE loop owns the gesture
  if (!root) return
  const others = otherRelPaths && otherRelPaths.length > 0 ? otherRelPaths : undefined
  const intent = intentOf(Boolean(e.shiftKey), Boolean(e.ctrlKey), Boolean(e.altKey), Boolean(others))
  diagLog('info', 'drag-out', `started ${relPath} as ${intent}${others ? ` multi (${others.length + 1})` : ''}`)
  if (others) {
    api.startDrag(relPath, others)
    // multi-selection drags ride copy semantics on purpose; the originals stay — no settle chain.
  } else {
    api.startDrag(relPath)
    settleScanChain(relPath, intent)
  }
}
