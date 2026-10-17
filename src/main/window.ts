import { BrowserWindow, app, shell } from 'electron'
import path from 'node:path'
import type { PrefsStore } from './store'

export interface WindowDeps {
  prefs: PrefsStore
}

export function createWindow(deps: WindowDeps): BrowserWindow {
  const prefs = deps.prefs.get()
  const bounds = prefs.windowBounds
  const win = new BrowserWindow({
    width: bounds?.width ?? 660,
    height: bounds?.height ?? 890,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 430,
    minHeight: 580,
    frame: false,
    backgroundColor: '#101318',
    show: false,
    title: 'FolderDock',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => win.show())
  if (bounds?.maximized) win.maximize()

  const sendMaximized = (): void => {
    void win.webContents.send('window:maximized', win.isMaximized())
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)

  win.on('close', () => {
    deps.prefs.patch({
      windowBounds: { ...win.getNormalBounds(), maximized: win.isMaximized() }
    })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.on('before-input-event', (_e, input) => {
    if (!app.isPackaged && input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools()
    }
  })

  if (process.env.FOLDERDOCK_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  return win
}
