import { BrowserWindow, app, screen, shell } from 'electron'
import path from 'node:path'
import { EVENTS } from '../shared/channels'
import type { PrefsStore } from './store'

export interface WindowDeps {
  prefs: PrefsStore
  isQuitting: () => boolean
}

function boundsTouchAScreen(x: number | undefined, y: number | undefined, width: number, height: number): boolean {
  if (x === undefined || y === undefined) return false
  return screen.getAllDisplays().some(d => {
    const { workArea } = d
    return (
      x + width > workArea.x + 8 &&
      x < workArea.x + workArea.width - 8 &&
      y + height > workArea.y + 8 &&
      y < workArea.y + workArea.height - 8
    )
  })
}

export function createWindow(deps: WindowDeps): BrowserWindow {
  const prefs = deps.prefs.get()
  const bounds = prefs.windowBounds
  const restoreXY = bounds ? boundsTouchAScreen(bounds.x, bounds.y, bounds.width, bounds.height) : false
  const win = new BrowserWindow({
    width: bounds?.width ?? 660,
    height: bounds?.height ?? 890,
    x: restoreXY ? bounds?.x : undefined,
    y: restoreXY ? bounds?.y : undefined,
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
  if (prefs.alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver')

  const sendMaximized = (): void => {
    void win.webContents.send(EVENTS.windowMaximized, win.isMaximized())
  }
  const persistBounds = (): void => {
    deps.prefs.patch({ windowBounds: { ...win.getNormalBounds(), maximized: win.isMaximized() } })
  }
  win.on('maximize', () => {
    sendMaximized()
    persistBounds()
  })
  win.on('unmaximize', () => {
    sendMaximized()
    persistBounds()
  })
  win.on('resize', persistBounds)
  win.on('move', persistBounds)

  win.on('close', event => {
    if (deps.prefs.get().closeToTray && !deps.isQuitting()) {
      event.preventDefault()
      win.hide()
      return
    }
    persistBounds()
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
