import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import type { Prefs } from '../shared/types'
import { extOf, kindForExt } from '../shared/kinds'
import type { PrefsStore } from './store'
import * as ops from './library/ops'
import { dragIconFor } from './library/drag'
import { resolveWithinRoot } from './library/validate'
import { scanLibrary } from './library/scan'
import { ensureRoot } from './library/root'

export interface MainContext {
  getRoot(): string
  prefs: PrefsStore
  getWindow(): BrowserWindow | null
  onRootChanged(newRoot: string): Promise<void>
  rootOverridden(): boolean
}

function handle<T>(channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => Promise<T>): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...(args as never[])) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registerIpc(ctx: MainContext): void {
  handle('app:info', async () => {
    const prefs = ctx.prefs.get()
    return { version: app.getVersion(), electron: process.versions.electron ?? '', root: ctx.getRoot(), overridden: ctx.rootOverridden(), defaultRoot: prefs.rootPath }
  })

  handle('library:scan', async () => scanLibrary(ctx.getRoot()))

  handle('folder:create', async (_e, name: string) => ops.createFolder(ctx.getRoot(), name))
  handle('folder:rename', async (_e, oldName: string, newName: string) => ops.renameFolder(ctx.getRoot(), oldName, newName))
  handle('folder:delete', async (_e, name: string) => ops.deleteFolder(ctx.getRoot(), name))

  handle('file:readText', async (_e, relPath: string) => ops.readTextFile(ctx.getRoot(), relPath))
  handle('file:writeText', async (_e, req) => ops.writeTextFile(ctx.getRoot(), req))
  handle('file:readBytes', async (_e, relPath: string, maxBytes: number) => ops.readBytes(ctx.getRoot(), relPath, maxBytes))
  handle('file:excerpt', async (_e, relPath: string) => ops.excerptFor(ctx.getRoot(), relPath))
  handle('file:meta', async (_e, relPath: string) => ops.detailedMeta(ctx.getRoot(), relPath))
  handle('file:rename', async (_e, relPath: string, newName: string) => ops.renameFile(ctx.getRoot(), relPath, newName))
  handle('file:move', async (_e, relPath: string, targetFolder: string) => ops.moveFile(ctx.getRoot(), relPath, targetFolder))
  handle('file:delete', async (_e, relPath: string) => ops.deleteFile(ctx.getRoot(), relPath))
  handle('files:drop', async (_e, paths: string[], targetFolder: string) => ops.importPaths(ctx.getRoot(), paths, targetFolder))

  handle('files:choose', async (_e, targetFolder: string) => {
    const win = ctx.getWindow()
    if (!win) throw new Error('No window is available.')
    const res = await dialog.showOpenDialog(win, {
      title: 'Import files into FolderDock',
      properties: ['openFile', 'multiSelections']
    })
    if (res.canceled || res.filePaths.length === 0) {
      return { imported: [], moved: [], skipped: [] }
    }
    return ops.importPaths(ctx.getRoot(), res.filePaths, targetFolder)
  })

  handle('file:reveal', async (_e, relPath: string) => {
    const abs = resolveWithinRoot(ctx.getRoot(), relPath)
    if (!abs) throw new Error('That path is outside the library.')
    shell.showItemInFolder(abs)
  })

  handle('file:openExternal', async (_e, relPath: string) => {
    const abs = resolveWithinRoot(ctx.getRoot(), relPath)
    if (!abs) throw new Error('That path is outside the library.')
    const result = await shell.openPath(abs)
    if (result) throw new Error(result)
  })

  handle('root:open', async () => {
    const result = await shell.openPath(ctx.getRoot())
    if (result) throw new Error(result)
  })

  handle('root:choose', async () => {
    const win = ctx.getWindow()
    if (!win) throw new Error('No window is available.')
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose your FolderDock library folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: ctx.getRoot()
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  handle('prefs:get', async () => ctx.prefs.get())

  handle('prefs:set', async (_e, patch: Partial<Prefs>) => {
    const before = ctx.prefs.get().rootPath
    const next = ctx.prefs.patch(patch)
    if (patch.rootPath !== undefined && patch.rootPath !== before && !ctx.rootOverridden()) {
      const root = patch.rootPath && patch.rootPath.trim() ? path.resolve(patch.rootPath.trim()) : null
      if (root) {
        await ensureRoot(root)
      }
      await ctx.onRootChanged(root ?? ctx.getRoot())
    }
    return next
  })

  handle('file:createNote', async (_e, folderName: string, baseName?: string) =>
    ops.createNote(ctx.getRoot(), folderName, baseName)
  )

  ipcMain.on('drag:start', (event, relPath: unknown) => {
    try {
      if (typeof relPath !== 'string') return
      const abs = resolveWithinRoot(ctx.getRoot(), relPath)
      if (!abs || !fsSync.existsSync(abs)) return
      const kind = kindForExt(extOf(path.basename(abs)))
      event.sender.startDrag({ file: abs, files: [abs], icon: dragIconFor(kind) })
    } catch (err) {
      console.warn('[folderdock] drag:start failed:', err)
    }
  })

  ipcMain.on('window:minimize', () => ctx.getWindow()?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    const win = ctx.getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', () => ctx.getWindow()?.close())
  ipcMain.on('window:widen', (_e, width: unknown) => {
    const win = ctx.getWindow()
    if (!win || win.isMaximized() || typeof width !== 'number' || !Number.isFinite(width)) return
    const bounds = win.getBounds()
    const target = Math.max(bounds.width, Math.min(Math.round(width), 1400))
    if (target <= bounds.width) return
    const { workArea } = screen.getDisplayMatching(bounds)
    let x = bounds.x
    if (x + target > workArea.x + workArea.width) {
      x = Math.max(workArea.x, workArea.x + workArea.width - target)
    }
    win.setBounds({ x, y: bounds.y, width: target, height: bounds.height })
  })
}
