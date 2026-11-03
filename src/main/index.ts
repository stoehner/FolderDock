import { app, BrowserWindow, crashReporter, Menu, net, protocol, Tray } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpc } from './ipc'
import { createWindow } from './window'
import { PrefsStore } from './store'
import { initLog, logLine } from './logger'
import { startWatcher } from './library/watch'
import { ensureRoot, resolveRoot, seedWelcome } from './library/root'
import { resolveWithinRoot } from './library/validate'
import { EVENTS } from '../shared/channels'
import { RELEASES_URL, UpdateWatcher } from './updater'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fdfile',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let prefsStore: PrefsStore | null = null
let mainWindow: BrowserWindow | null = null
let stopWatcher: (() => void) | null = null
let currentRoot = ''
let tray: Tray | null = null
let quitting = false
let heartbeat: ReturnType<typeof setInterval> | null = null

const errText = (e: unknown): string => (e instanceof Error ? `${e.message} ${e.stack ?? ''}` : String(e))

const rootOverridden = (): boolean => Boolean(process.env.FOLDERDOCK_ROOT?.trim())

function trayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'icon.ico')
    : path.join(app.getAppPath(), 'resources', 'icon.ico')
}

function ensureTray(): void {
  if (tray) return
  try {
    tray = new Tray(trayIconPath())
    const showWindow = (): void => {
      const win = mainWindow
      if (!win) return
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
    tray.setToolTip('FolderDock')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open FolderDock', click: showWindow },
        { type: 'separator' },
        { label: 'Quit FolderDock', click: () => app.quit() }
      ])
    )
    tray.on('click', showWindow)
  } catch (err) {
    console.warn('[folderdock] tray unavailable:', err)
  }
}

async function applyRoot(root: string, opts: { seed?: boolean } = {}): Promise<void> {
  currentRoot = root
  await ensureRoot(root)
  if (opts.seed) await seedWelcome(root)
  stopWatcher?.()
  stopWatcher = startWatcher(
    root,
    () => mainWindow?.webContents.send(EVENTS.libraryChanged),
    err => logLine('warn', 'watcher', errText(err))
  )
}

if (process.env.FOLDERDOCK_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.FOLDERDOCK_USER_DATA))
}

// Local-only crash dumps (no submit URL, upload disabled): the dump lands beside the
// app's own data on this machine and nothing is ever transmitted anywhere.
try {
  crashReporter.start({ submitURL: '', uploadToServer: false })
} catch {
  // A diagnostics aid only; it must never be able to block boot.
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  if (process.env.FOLDERDOCK_SOFTWARE_GPU === '1') {
    app.disableHardwareAcceleration()
  }
  app.setAppUserModelId('dev.folderdock.app')

  app.on('second-instance', () => {
    logLine('info', 'window', 'second instance asked for focus')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('child-process-gone', (_e, details) => {
    logLine('warn', 'window', `child process gone: ${details.type} ${details.reason} (exit code ${details.exitCode})`)
  })

  void app.whenReady().then(async () => {
    prefsStore = new PrefsStore(app.getPath('userData'))
    prefsStore.load()

    initLog(path.join(app.getPath('userData'), 'logs'), { verbose: prefsStore.get().logLevel === 'verbose' })
    process.on('uncaughtException', err => logLine('error', 'main', `uncaught exception: ${errText(err)}`))
    process.on('unhandledRejection', reason => logLine('error', 'main', `unhandled rejection: ${errText(reason)}`))
    heartbeat = setInterval(() => {
      logLine('info', 'heartbeat', `main alive - uptime ${Math.round(process.uptime())}s - heap ${Math.round(process.memoryUsage().heapUsed / 1048576)} MB`)
    }, 30_000)

    // One-time migration: hover summaries become off by default from 1.3.5.
    // The flag is written immediately so a deliberate choice afterwards is never reset.
    if (!prefsStore.get().hoverDelayMigrated) {
      prefsStore.patch({ hoverDelay: 'off', hoverDelayMigrated: true })
    }

    const root = resolveRoot(prefsStore.get().rootPath)
    const firstRun = !fsSync.existsSync(root)
    await applyRoot(root, { seed: firstRun })
    logLine(
      'info',
      'boot',
      `FolderDock ${app.getVersion()} - electron ${process.versions.electron ?? ''} - root ${root} - detail ${prefsStore.get().logLevel}${rootOverridden() ? ' (FOLDERDOCK_ROOT override)' : ''}${firstRun ? ' - first run, seeded' : ''}`
    )
    if (firstRun) {
      prefsStore.patch({ folderArt: { ...prefsStore.get().folderArt, Notes: 'verdant' } })
    }

    Menu.setApplicationMenu(null)

    protocol.handle('fdfile', async req => {
      try {
        const u = new URL(req.url)
        if (u.hostname !== 'local') return new Response('Bad request', { status: 400 })
        const target = decodeURIComponent(u.pathname.replace(/^\//, ''))
        const abs = resolveWithinRoot(currentRoot, target)
        if (!abs) return new Response('Forbidden', { status: 403 })
        return await net.fetch(pathToFileURL(abs).toString())
      } catch {
        return new Response('Not found', { status: 404 })
      }
    })

    registerIpc({
      getRoot: () => currentRoot,
      prefs: prefsStore,
      getWindow: () => mainWindow,
      rootOverridden,
      onRootChanged: async newRoot => {
        await applyRoot(newRoot)
        mainWindow?.webContents.send(EVENTS.libraryChanged)
      },
      updates: new UpdateWatcher({ getWindow: () => mainWindow, prefs: prefsStore, releasesUrl: RELEASES_URL })
    })

    mainWindow = createWindow({ prefs: prefsStore, isQuitting: () => quitting })
    ensureTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && prefsStore) {
        mainWindow = createWindow({ prefs: prefsStore, isQuitting: () => quitting })
      }
    })
  })

  app.on('window-all-closed', () => {
    logLine('info', 'shutdown', 'window closed - quitting')
    prefsStore?.saveSync()
    app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    logLine('info', 'shutdown', 'quitting')
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    prefsStore?.saveSync()
    stopWatcher?.()
  })
}
