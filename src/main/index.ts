import { app, BrowserWindow, Menu, net, protocol } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpc } from './ipc'
import { createWindow } from './window'
import { PrefsStore } from './store'
import { startWatcher } from './library/watch'
import { ensureRoot, resolveRoot, seedWelcome } from './library/root'
import { resolveWithinRoot } from './library/validate'

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

const rootOverridden = (): boolean => Boolean(process.env.FOLDERDOCK_ROOT?.trim())

async function applyRoot(root: string, opts: { seed?: boolean } = {}): Promise<void> {
  currentRoot = root
  await ensureRoot(root)
  if (opts.seed) await seedWelcome(root)
  stopWatcher?.()
  stopWatcher = startWatcher(
    root,
    () => mainWindow?.webContents.send('library:changed'),
    err => console.warn('[folderdock] watcher error:', err)
  )
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  if (process.env.FOLDERDOCK_USER_DATA) {
    app.setPath('userData', path.resolve(process.env.FOLDERDOCK_USER_DATA))
  }
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
        mainWindow?.webContents.send('library:changed')
      }
    })

    mainWindow = createWindow({ prefs: prefsStore })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow({ prefs: prefsStore! })
      }
    })
  })

  app.on('window-all-closed', () => {
    void prefsStore?.save()
    app.quit()
  })

  app.on('before-quit', () => {
    void prefsStore?.save()
    stopWatcher?.()
  })
}
