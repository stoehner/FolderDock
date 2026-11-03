import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import type { LibrarySnapshot, Prefs } from '../shared/types'
import { extOf, kindForExt } from '../shared/kinds'
import { prunePrefs } from '../shared/prefs'
import { CHANNELS, SEND } from '../shared/channels'
import type { PrefsStore } from './store'
import * as ops from './library/ops'
import { dragIconFor } from './library/drag'
import { resolveWithinRoot } from './library/validate'
import { scanLibrary } from './library/scan'
import { ensureRoot } from './library/root'
import type { UpdateWatcher } from './updater'
import { logLine, logTail, logPaths, logVerbose, setVerbose } from './logger'

export interface MainContext {
  getRoot(): string
  prefs: PrefsStore
  getWindow(): BrowserWindow | null
  onRootChanged(newRoot: string): Promise<void>
  rootOverridden(): boolean
  updates: UpdateWatcher
}

function handle<T>(channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => Promise<T>): void {
  ipcMain.handle(channel, async (event, ...args) => {
    logVerbose('ipc', channel)
    try {
      return { ok: true, data: await fn(event, ...(args as never[])) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logLine('error', 'ipc', `${channel} failed: ${message}`)
      return { ok: false, error: message }
    }
  })
}

function pruneOrphanPrefs(ctx: MainContext, snapshot: LibrarySnapshot): void {
  const before = ctx.prefs.get()
  const names = snapshot.folders.filter(f => !f.virtual).map(f => f.name)
  const after = prunePrefs(before, names)
  if (
    after.folderOrder.length !== before.folderOrder.length ||
    Object.keys(after.folderArt).length !== Object.keys(before.folderArt).length ||
    after.openFolder !== before.openFolder
  ) {
    ctx.prefs.patch({
      folderOrder: after.folderOrder,
      folderArt: after.folderArt,
      openFolder: after.openFolder
    })
  }
}

export function registerIpc(ctx: MainContext): void {
  handle(CHANNELS.appInfo, async () => {
    const prefs = ctx.prefs.get()
    return { version: app.getVersion(), electron: process.versions.electron ?? '', root: ctx.getRoot(), overridden: ctx.rootOverridden(), defaultRoot: prefs.rootPath }
  })

  handle(CHANNELS.scan, async () => {
    const snap = await scanLibrary(ctx.getRoot())
    pruneOrphanPrefs(ctx, snap)
    return snap
  })
  handle(CHANNELS.searchContent, async (_e, query: string) => ops.searchContent(ctx.getRoot(), query))

  handle(CHANNELS.createFolder, async (_e, name: string) => ops.createFolder(ctx.getRoot(), name))
  handle(CHANNELS.renameFolder, async (_e, oldName: string, newName: string) => ops.renameFolder(ctx.getRoot(), oldName, newName))
  handle(CHANNELS.deleteFolder, async (_e, name: string) => ops.deleteFolder(ctx.getRoot(), name))

  handle(CHANNELS.readTextFile, async (_e, relPath: string) => ops.readTextFile(ctx.getRoot(), relPath))
  handle(CHANNELS.writeTextFile, async (_e, req) => ops.writeTextFile(ctx.getRoot(), req))
  handle(CHANNELS.readBytes, async (_e, relPath: string, maxBytes: number) => ops.readBytes(ctx.getRoot(), relPath, maxBytes))
  handle(CHANNELS.excerpt, async (_e, relPath: string) => ops.excerptFor(ctx.getRoot(), relPath))
  handle(CHANNELS.fileMeta, async (_e, relPath: string) => ops.detailedMeta(ctx.getRoot(), relPath))
  handle(CHANNELS.renameFile, async (_e, relPath: string, newName: string) => ops.renameFile(ctx.getRoot(), relPath, newName))
  handle(CHANNELS.moveFile, async (_e, relPath: string, targetFolder: string) => ops.moveFile(ctx.getRoot(), relPath, targetFolder))
  handle(CHANNELS.deleteFile, async (_e, relPath: string) => ops.deleteFile(ctx.getRoot(), relPath))
  handle(CHANNELS.moveFileOut, async (_e, relPath: string, destination: unknown) => {
    if (typeof destination !== 'string') throw new Error('Choose a destination folder first.')
    return ops.moveFileOut(ctx.getRoot(), relPath, destination)
  })
  handle(CHANNELS.dropFiles, async (_e, paths: string[], targetFolder: string) => ops.importPaths(ctx.getRoot(), paths, targetFolder))

  handle(CHANNELS.chooseAndImport, async (_e, targetFolder: string) => {
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

  handle(CHANNELS.revealFile, async (_e, relPath: string) => {
    const abs = resolveWithinRoot(ctx.getRoot(), relPath)
    if (!abs) throw new Error('That path is outside the library.')
    shell.showItemInFolder(abs)
  })

  handle(CHANNELS.openFileExternal, async (_e, relPath: string) => {
    const abs = resolveWithinRoot(ctx.getRoot(), relPath)
    if (!abs) throw new Error('That path is outside the library.')
    const result = await shell.openPath(abs)
    if (result) throw new Error(result)
  })

  handle(CHANNELS.openRoot, async () => {
    const result = await shell.openPath(ctx.getRoot())
    if (result) throw new Error(result)
  })

  handle(CHANNELS.chooseRoot, async () => {
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

  handle(CHANNELS.chooseBackupFolder, async () => {
    const win = ctx.getWindow()
    if (!win) throw new Error('No window is available.')
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose the FolderDock backup folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: ctx.prefs.get().backupLocation
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  handle(CHANNELS.backupLibrary, async () => ops.backupLibrary(ctx.getRoot(), ctx.prefs.get().backupLocation))
  handle(CHANNELS.listBackups, async () => ops.listBackups(ctx.prefs.get().backupLocation))
  handle(CHANNELS.deleteBackup, async (_e, name: string) => ops.deleteBackup(ctx.prefs.get().backupLocation, name))

  handle(CHANNELS.getPrefs, async () => ctx.prefs.get())

  handle(CHANNELS.setPrefs, async (_e, patch: Partial<Prefs>) => {
    const before = ctx.prefs.get().rootPath
    const next = ctx.prefs.patch(patch)
    if (patch.alwaysOnTop !== undefined) {
      ctx.getWindow()?.setAlwaysOnTop(patch.alwaysOnTop, 'screen-saver')
    }
    if (patch.autoCheckUpdates !== undefined) {
      ctx.updates.setAutoCheckEnabled(patch.autoCheckUpdates === true)
    }
    if (patch.logLevel !== undefined) {
      setVerbose(ctx.prefs.get().logLevel === 'verbose')
      logLine('info', 'log', `diagnostics detail set to ${ctx.prefs.get().logLevel}`)
    }
    if (patch.rootPath !== undefined && patch.rootPath !== before && !ctx.rootOverridden()) {
      const root = patch.rootPath && patch.rootPath.trim() ? path.resolve(patch.rootPath.trim()) : null
      if (root) {
        await ensureRoot(root)
      }
      await ctx.onRootChanged(root ?? ctx.getRoot())
    }
    return next
  })

  // Renderer diagnostics feed: one-way log reports (errors, heartbeats, ui breadcrumbs),
  // strictly validated - the renderer is untrusted input like anything else.
  ipcMain.on(SEND.logReport, (_e, level: unknown, tag: unknown, message: unknown) => {
    if (typeof message !== 'string') return
    if (level !== 'info' && level !== 'warn' && level !== 'error') return
    const safeTag = typeof tag === 'string' && tag.trim() ? tag.slice(0, 40) : 'renderer'
    logLine(level, safeTag, message.slice(0, 600))
  })

  handle(CHANNELS.diagnosticsGet, async () => {
    const paths = logPaths()
    return {
      version: app.getVersion(),
      electron: process.versions.electron ?? '',
      root: ctx.getRoot(),
      logDir: paths.dir,
      logFile: paths.file,
      level: ctx.prefs.get().logLevel,
      tail: logTail(50)
    }
  })

  handle(CHANNELS.openLogs, async () => {
    await shell.openPath(logPaths().dir)
  })

  handle(CHANNELS.chooseMoveOut, async () => {
    const win = ctx.getWindow()
    if (!win) throw new Error('No window is available.')
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose where to move this file out of FolderDock',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  handle(CHANNELS.createNote, async (_e, folderName: string, baseName?: string) =>
    ops.createNote(ctx.getRoot(), folderName, baseName)
  )

  handle(CHANNELS.updatesGetState, async () => ctx.updates.view)
  handle(CHANNELS.updatesCheckNow, async () => ctx.updates.checkNow())
  handle(CHANNELS.updatesInstall, async () => ctx.updates.install())
  handle(CHANNELS.updatesOpenReleases, async () => ctx.updates.openReleases())

  ipcMain.on(SEND.startDrag, (event, relPath: unknown, additional: unknown) => {
    try {
      if (typeof relPath !== 'string') return
      logLine(
        'info',
        'drag',
        `carrier start for ${relPath}${Array.isArray(additional) && additional.length > 0 ? ` (+${additional.length} more)` : ''}`
      )
      // E2E harness: never start a real OLE drag loop; record what would be dragged.
      if (process.env.FOLDERDOCK_E2E_NODRAG === '1') {
        const g = globalThis as { __fdE2eStartDragLog?: { relPath: string; extra: number }[] }
        const log = g.__fdE2eStartDragLog ?? []
        log.push({ relPath, extra: Array.isArray(additional) ? additional.length : 0 })
        g.__fdE2eStartDragLog = log
        return
      }
      const rest =
        Array.isArray(additional) && additional.every(x => typeof x === 'string') ? additional.filter(x => x !== relPath) : []
      const absPaths = [relPath, ...rest]
        .map(p => resolveWithinRoot(ctx.getRoot(), p))
        .filter((p): p is string => Boolean(p && fsSync.existsSync(p)))
      const primary = absPaths[0]
      if (!primary) return
      const kind = kindForExt(extOf(path.basename(primary)))
      event.sender.startDrag({ file: primary, files: absPaths, icon: dragIconFor(kind) })
    } catch (err) {
      console.warn('[folderdock] drag:start failed:', err)
    }
  })

  ipcMain.on(SEND.minimize, () => ctx.getWindow()?.minimize())
  ipcMain.on(SEND.toggleMaximize, () => {
    const win = ctx.getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(SEND.close, () => ctx.getWindow()?.close())
}
