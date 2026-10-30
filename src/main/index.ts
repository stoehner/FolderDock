import { app, BrowserWindow, Menu, net, protocol, Tray } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpc } from './ipc'
import { createWindow } from './window'
import { PrefsStore } from './store'
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
    err => console.warn('[folderdock] watcher error:', err)
  )
}

if (process.env.FOLDERDOCK_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.FOLDERDOCK_USER_DATA))
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    prefsStore = new PrefsStore(app.getPath('userData'))
    prefsStore.load()

    // One-time migration: hover summaries become off by default from 1.3.5.
    // The flag is written immediately so a deliberate choice afterwards is never reset.
    if (!prefsStore.get().hoverDelayMigrated) {
      prefsStore.patch({ hoverDelay: 'off', hoverDelayMigrated: true })
    }

    const root = resolveRoot(prefsStore.get().rootPath)
    const firstRun = !fsSync.existsSync(root)
    await applyRoot(root, { seed: firstRun })
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
    prefsStore?.saveSync()
    app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    prefsStore?.saveSync()
    stopWatcher?.()
  })
}
