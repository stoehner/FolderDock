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
type ReadInput = Parameters<typeof dragOut.readInternalDrop>[0]
const asDataTransfer = (dt: object): ReadInput['dataTransfer'] => dt as ReadInput['dataTransfer']

function sourceEvent(): { preventDefault: () => void; dataTransfer: { setData: (t: string, v: string) => void; effectAllowed: string; dropEffect: string } } {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: 'none' }
  }
}

function endEvent(effect: string): { dataTransfer: { dropEffect: string } } {
  return { dataTransfer: { dropEffect: effect } }
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
  useUI.setState({ toast: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('drag out', () => {
  describe('internal marker', () => {
    it('reads the internal payload only for internal drags', () => {
      const external = { types: ['Files'], getData: vi.fn() }
      expect(dragOut.readInternalDrop({ dataTransfer: asDataTransfer(external) })).toBeNull()

      const payload = dragOut.encodeInternalDrop(['A/one.md'])
      const internal = { types: [dragOut.INTERNAL_FILES_TYPE], getData: () => payload }
      expect(dragOut.readInternalDrop({ dataTransfer: asDataTransfer(internal) })).toEqual({
        payload,
        files: ['A/one.md']
      })

      const broken = { types: [dragOut.INTERNAL_FILES_TYPE], getData: () => 'not json' }
      expect(dragOut.readInternalDrop({ dataTransfer: asDataTransfer(broken) })).toBeNull()
    })
  })

  describe('startOutDrag', () => {
    it('arms an HTML5 carrier with the marker and a DownloadURL file path', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', 'C:\\Lib\\Root')

      const calls = (e.dataTransfer.setData as ReturnType<typeof vi.fn>).mock.calls as [string, string][]
      expect(calls).toContainEqual([dragOut.INTERNAL_FILES_TYPE, dragOut.encodeInternalDrop(['A/one.md'])])
      const dl = calls.find(([t]) => t === 'DownloadURL')
      expect(dl?.[1]).toBe('application/octet-stream:one.md:file:///C:/Lib/Root/A/one.md')
      expect(e.preventDefault).not.toHaveBeenCalled()
      expect(stubApi.startDrag).not.toHaveBeenCalled()
    })

    it('keeps the native drag for multi-selection', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', 'C:\\Lib', ['B/two.md'])

      expect(e.preventDefault).toHaveBeenCalled()
      expect(stubApi.startDrag).toHaveBeenCalledWith('A/one.md', ['B/two.md'])
      expect((e.dataTransfer.setData as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    })

    it('cancels the drag when the library root is unknown', () => {
      const e = sourceEvent()
      dragOut.startOutDrag(e as unknown as DragEventLike, 'A/one.md', '')
      expect(e.preventDefault).toHaveBeenCalled()
      expect((e.dataTransfer.setData as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    })
  })

  describe('finishOutDrag', () => {
    it('recycles the original after the settle window on an accepted effect', async () => {
      stubApi.scan.mockResolvedValue(result(snap(['A/alpha.md'])))
      stubApi.deleteFile.mockResolvedValue(result(snap([])))

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/alpha.md', 'C:\\Lib')
      dragOut.finishOutDrag(endEvent('copy') as unknown as DragEventLike, 'A/alpha.md', 4)
      await vi.advanceTimersByTimeAsync(1199)
      expect(stubApi.scan).not.toHaveBeenCalled()
      // the store clears its own toast on a timer; assert before advancing past that clear
      await vi.advanceTimersByTimeAsync(1)
      expect(stubApi.scan).toHaveBeenCalledTimes(1)
      expect(stubApi.deleteFile).toHaveBeenCalledWith('A/alpha.md')
      expect(useLibrary.getState().snapshot?.folders.some(f => f.files.length > 0)).toBe(false)
      expect(useUI.getState().toast?.text).toContain('moved out of the library')
      expect(useUI.getState().toast?.text).toContain('Recycle Bin')
    })

    it('applies the scan without recycling when the destination already moved the file', async () => {
      stubApi.scan.mockResolvedValue(result(snap([])))

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/beta.md', 'C:\\Lib')
      dragOut.finishOutDrag(endEvent('move') as unknown as DragEventLike, 'A/beta.md', 4)
      await vi.advanceTimersByTimeAsync(1200)

      expect(stubApi.deleteFile).not.toHaveBeenCalled()
      expect(useLibrary.getState().snapshot?.root).toBe('C:\\tmp\\lib')
      expect(useUI.getState().toast?.text).toContain('moved out of the library')
      expect(useUI.getState().toast?.text).not.toContain('Recycle Bin')
    })

    it('skips everything when the drop was consumed in-app', async () => {
      dragOut.markInternalDropHandled(dragOut.encodeInternalDrop(['A/gamma.md']))
      stubApi.scan.mockResolvedValue(result(snap(['A/gamma.md'])))

      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/gamma.md', 'C:\\Lib')
      dragOut.finishOutDrag(endEvent('copy') as unknown as DragEventLike, 'A/gamma.md', 4)
      await vi.runAllTimersAsync()

      expect(stubApi.scan).not.toHaveBeenCalled()
      expect(useLibrary.getState().snapshot).toBeNull()
      expect(useUI.getState().toast).toBeNull()
    })

    it('ignores refused, cancelled, and link effects', async () => {
      for (const effect of ['none', 'link', '']) {
        const relPath = `A/refused-${effect || 'empty'}.md`
        dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, relPath, 'C:\\Lib')
        dragOut.finishOutDrag(endEvent(effect) as unknown as DragEventLike, relPath, 4)
      }
      await vi.runAllTimersAsync()
      expect(stubApi.scan).not.toHaveBeenCalled()
    })

    it('ignores a dragend from a native multi-selection drag', async () => {
      // no prior startOutDrag arm for this row — must never move anything
      dragOut.finishOutDrag(endEvent('copy') as unknown as DragEventLike, 'A/stale.md', 4)
      await vi.runAllTimersAsync()
      expect(stubApi.scan).not.toHaveBeenCalled()
    })

    it('scales the settle window with file size and caps it', async () => {
      stubApi.scan.mockResolvedValue(result(snap([])))
      // 15 MB -> 1200 + round(1.5)*1000 = 3200 ms
      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/sized.md', 'C:\\Lib')
      dragOut.finishOutDrag(endEvent('copy') as unknown as DragEventLike, 'A/sized.md', 15 * 1024 * 1024)

      await vi.advanceTimersByTimeAsync(3100)
      expect(stubApi.scan).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(200)
      expect(stubApi.scan).toHaveBeenCalledTimes(1)

      // 200 MB -> capped at 15000 ms
      dragOut.startOutDrag(sourceEvent() as unknown as DragEventLike, 'A/big.md', 'C:\\Lib')
      dragOut.finishOutDrag(endEvent('copy') as unknown as DragEventLike, 'A/big.md', 200 * 1024 * 1024)
      await vi.advanceTimersByTimeAsync(14999)
      expect(stubApi.scan).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(stubApi.scan).toHaveBeenCalledTimes(2)
    })
  })
})
