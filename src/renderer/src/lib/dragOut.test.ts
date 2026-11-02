import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileMeta, FolderSnapshot, LibrarySnapshot } from '../../../shared/types'

// dragOut's module graph reads window.folderdock (lib/api) at import time and calls
// window.setTimeout at run time — stub both before the dynamic import. Node env: no DOM.
const stubApi = { startDrag: vi.fn(), scan: vi.fn(), deleteFile: vi.fn() }
;(globalThis as unknown as { window: unknown }).window = {
  folderdock: stubApi,
  setTimeout: (fn: () => void, ms: number): ReturnType<typeof setTimeout> => setTimeout(fn, ms),
  addEventListener: () => {},
  matchMedia: () => ({ addEventListener: () => {} })
}

const dragOut = await import('./dragOut')
const { useUI } = await import('../state/ui')
const { useLibrary } = await import('../state/library')

type DragEventLike = Parameters<typeof dragOut.startOutDrag>[0]

function sourceEvent(modifiers: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}): {
  preventDefault: () => void
  shiftKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  dataTransfer: { setData: (t: string, v: string) => void; effectAllowed: string; dropEffect: string }
} {
  return {
    preventDefault: vi.fn(),
    ...modifiers,
    dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: 'none' }
  }
}

function meta(relPath: string): FileMeta {
  const name = relPath.split('/').pop() ?? relPath
  return { relPath, name, ext: 'md', kind: 'text', size: 2, mtimeMs: 1, binary: false }
}

function snap(files: string[]): LibrarySnapshot {
  const folders: FolderSnapshot[] = files.map(relPath => ({
    name: relPath.slice(0, relPath.indexOf('/')),
    virtual: false,
    files: [meta(relPath)]
  }))
  return { root: 'C:\\tmp\\lib', folders, warnings: [] }
}

const result = (data: LibrarySnapshot): { ok: true; data: LibrarySnapshot } => ({ ok: true, data })

beforeEach(() => {
  vi.useFakeTimers()
  stubApi.startDrag.mockReset()
  stubApi.scan.mockReset()
  stubApi.deleteFile.mockReset()
  useLibrary.setState({ snapshot: null, error: null })
  useUI.setState({ toast: null, modal: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('drag out', () => {
  describe('startOutDrag', () => {
    it('hands a single file to the native OS carrier and carries no HTML5 data', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', 'C:\\Lib\\Root')

      expect(e.preventDefault).toHaveBeenCalledTimes(1) // no HTML5 drag session may start
      expect(stubApi.startDrag).toHaveBeenCalledWith('A/one.md')
      expect((e.dataTransfer.setData as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    })

    it('hands multi-selection to the native carrier with the extra paths', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', 'C:\\Lib', ['B/two.md'])

      expect(stubApi.startDrag).toHaveBeenCalledWith('A/one.md', ['B/two.md'])
    })

    it('cancels the drag when the library root is unknown', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', '')

      expect(e.preventDefault).toHaveBeenCalled()
      expect(stubApi.startDrag).not.toHaveBeenCalled()
    })
  })

  describe('settle scan verdict (disk truth)', () => {
    it('recycles nothing and keeps the file while it is still in the library, then teaches Shift', async () => {
      // Regression (2026-11-01): refused / cancelled / copy-delivered releases all leave the
      // original on disk (measurements: dragend reported 'move', 'move', 'copy' for refusals,
      // and event verdicts are guesses in Chromium — crbug 41183574). The settled disk state
      // is the only evidence the move-out of a library file may act on. Since 2026-11-02 the
      // kept verdict is no longer SILENT: a plain drag earns one educational toast.
      stubApi.scan.mockResolvedValue(result(snap(['A/delta.md'])))
      useLibrary.setState({ snapshot: snap(['A/delta.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(9300) // scans at 1200 / 5200 / 9200 run to the cap

      // scans stop at the settle cap - a kept file must not be re-forever-scanned - and the
      // plain-drag keep verdict is explained with one educational toast naming Shift
      expect(stubApi.scan).toHaveBeenCalledTimes(3)
      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect(useUI.getState().toast?.text).toContain('still in your library')
      expect(useUI.getState().toast?.text).toContain('Shift')
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === 'A/delta.md'))).toBe(true)
      await vi.advanceTimersByTimeAsync(4000) // the toast auto-dismisses; the file stays
      expect(useUI.getState().toast).toBeNull()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === 'A/delta.md'))).toBe(true)
    })

    it('keeps silently for an explicit copy/shortcut intent (Ctrl, Alt or multi-selection)', async () => {
      stubApi.scan.mockResolvedValue(result(snap(['A/delta.md'])))
      useLibrary.setState({ snapshot: snap(['A/delta.md']), error: null })

      dragOut.startOutDrag(sourceEvent({ ctrlKey: true }) as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib')
      dragOut.startOutDrag(sourceEvent({ altKey: true }) as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib', [
        'B/other.md'
      ])
      await vi.advanceTimersByTimeAsync(13000)

      expect(useUI.getState().toast).toBeNull()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === 'A/delta.md'))).toBe(true)
    })

    it('raises the confirm modal on a Shift drag instead of recycling on a guess', async () => {
      // 2026-11-02: the Electron carrier offers COPY|LINK only (drag_util_views.cc line 47),
      // so Windows copies instead of moving; a Shift drag explicitly asks for move-out and
      // the only party allowed to recycle the kept original is the user's own modal click.
      stubApi.scan.mockResolvedValue(result(snap(['A/delta.md'])))
      stubApi.deleteFile.mockResolvedValue(result(snap([])))
      useLibrary.setState({ snapshot: snap(['A/delta.md']), error: null })

      dragOut.startOutDrag(sourceEvent({ shiftKey: true }) as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(13000)

      expect(stubApi.deleteFile).not.toHaveBeenCalled() // never without the user's click
      const modal = useUI.getState().modal
      expect(modal?.type).toBe('confirm')
      if (modal?.type !== 'confirm') return
      expect(modal.title).toBe('Move out of the library?')
      expect(modal.confirmLabel).toBe('Move it out')

      await modal.onConfirm() // the user's own click recycles the library copy
      expect(stubApi.deleteFile).toHaveBeenCalledWith('A/delta.md')
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.length > 0)).toBe(false)
      expect(useUI.getState().modal).toBeNull()
      expect(useUI.getState().toast?.text).toContain('moved out of the library')
    })

    it('keeps everything when the user declines the Shift move-out', async () => {
      stubApi.scan.mockResolvedValue(result(snap(['A/delta.md'])))
      useLibrary.setState({ snapshot: snap(['A/delta.md']), error: null })

      dragOut.startOutDrag(sourceEvent({ shiftKey: true }) as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(13000)

      useUI.getState().closeModal() // the modal's Cancel button / Head cross
      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect(useUI.getState().toast).toBeNull()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === 'A/delta.md'))).toBe(true)
    })

    it('a real move-out during a Shift drag beats the confirm modal', async () => {
      stubApi.scan
        .mockResolvedValueOnce(result(snap(['A/delta.md']))) // drag still in flight
        .mockResolvedValueOnce(result(snap([]))) // shipped out before the settle cap
      useLibrary.setState({ snapshot: snap(['A/delta.md']), error: null })

      dragOut.startOutDrag(sourceEvent({ shiftKey: true }) as unknown as DragEventLike, 'A/delta.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)
      expect(useUI.getState().modal).toBeNull()
      await vi.advanceTimersByTimeAsync(4300)

      expect(useUI.getState().toast?.text).toContain('moved out of the library')
      expect(useUI.getState().modal).toBeNull()
      expect(stubApi.deleteFile).not.toHaveBeenCalled()
    })

    it('applies the scan when the OS already moved the file away', async () => {
      stubApi.scan.mockResolvedValue(result(snap([])))
      useLibrary.setState({ snapshot: snap(['A/alpha.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/alpha.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)

      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.length > 0)).toBe(false)
      expect(useUI.getState().toast?.text).toContain('moved out of the library')
    })

    it('catches a file that leaves on a later step scan (long-held drag)', async () => {
      stubApi.scan
        .mockResolvedValueOnce(result(snap(['A/beta.md']))) // scan 1: drag still live
        .mockResolvedValueOnce(result(snap([]))) // scan 2: released, OS moved it away
      useLibrary.setState({ snapshot: snap(['A/beta.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/beta.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)
      expect(useUI.getState().toast).toBeNull()
      await vi.advanceTimersByTimeAsync(4300)

      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.length > 0)).toBe(false)
      expect(useUI.getState().toast?.text).toContain('moved out of the library')
    })

    it('stops scheduling once the move-out was applied', async () => {
      stubApi.scan.mockResolvedValue(result(snap([])))
      useLibrary.setState({ snapshot: snap(['A/alpha.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/alpha.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(13000)

      expect(stubApi.scan).toHaveBeenCalledTimes(1)
    })

    it('stays quiet when the UI already lost the file beforehand', async () => {
      // The watcher or in-app delete paths refresh the snapshot themselves; a drag whose
      // file was absent at start must not toast "moved out" for work it did not do.
      stubApi.scan.mockResolvedValue(result(snap([])))
      useLibrary.setState({ snapshot: snap([]), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/one.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)

      expect(stubApi.scan).toHaveBeenCalledTimes(1)
      expect(useUI.getState().toast).toBeNull()
    })

    it('stays quiet when the file re-homed under another collection (internal retarget)', async () => {
      // An in-app retarget (import rename in main) disappears the old relPath but keeps
      // the basename in the library: that flow owns its own toast, this chain stays out.
      stubApi.scan.mockResolvedValue(result(snap(['B/one.md'])))
      useLibrary.setState({ snapshot: snap(['A/one.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/one.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)

      expect(stubApi.scan).toHaveBeenCalledTimes(1) // chain stops: the retarget handled it
      expect(useUI.getState().toast).toBeNull()
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.some(x => x.relPath === 'A/one.md'))).toBe(true)
    })

    it('notifies an error toast when the scan fails', async () => {
      stubApi.scan.mockRejectedValue(new Error('scan failed'))
      useLibrary.setState({ snapshot: snap(['A/alpha.md']), error: null })

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/alpha.md', 'C:\\Lib')
      await vi.advanceTimersByTimeAsync(1300)

      expect(useUI.getState().toast?.text).toContain('scan failed')
      expect(useUI.getState().toast?.kind).toBe('error')
    })
  })

  describe('retired signals', () => {
    it('does not delete a library file based on an event verdict of any kind', () => {
      // The dragend gate and deleteFile force-recycle were removed with the 2026-11-01
      // fix: no signal at module scope may ever recycle a library original by itself.
      stubApi.scan.mockResolvedValue(result(snap(['A/gamma.md'])))
      useLibrary.setState({ snapshot: snap(['A/gamma.md']), error: null })

      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect('finishOutDrag' in dragOut).toBe(false)
    })
  })
})
