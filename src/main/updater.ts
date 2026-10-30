import { app, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { EVENTS } from '../shared/channels'
import type { UpdateStateView } from '../shared/types'
import type { PrefsStore } from './store'
import { createInitialUpdateState, reduceUpdateEvent, type UpdaterEvent } from './updater-engine'

export const RELEASES_URL = 'https://github.com/stoehner/FolderDock/releases'

export interface UpdateWatcherDeps {
  getWindow(): BrowserWindow | null
  prefs: PrefsStore
  releasesUrl: string
}

const AUTO_CHECK_DELAY_MS = 4000

export class UpdateWatcher {
  private state: UpdateStateView
  private readonly deps: UpdateWatcherDeps
  private readonly disabled: boolean
  private readonly portable: boolean
  private readonly version: string

  constructor(deps: UpdateWatcherDeps) {
    this.deps = deps
    this.version = app.getVersion()
    this.portable = app.isPackaged && Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
    this.disabled = !app.isPackaged

    this.state = createInitialUpdateState({
      version: this.version,
      portable: this.portable,
      disabled: this.disabled
    })
    if (this.disabled) return

    autoUpdater.autoDownload = !this.portable
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => this.set({ type: 'checking' }))
    autoUpdater.on('update-available', info => this.set({ type: 'available', version: String((info as { version?: string }).version ?? '') }))
    autoUpdater.on('update-not-available', () => this.set({ type: 'notAvailable' }))
    autoUpdater.on('download-progress', progress => this.set({ type: 'progress', percent: progress.percent }))
    autoUpdater.on('update-downloaded', info => this.set({ type: 'downloaded', version: String((info as { version?: string }).version ?? '') }))
    autoUpdater.on('error', err => this.set({ type: 'error', message: err?.message ?? String(err) }))

    if (this.deps.prefs.get().autoCheckUpdates) {
      setTimeout(() => {
        if (this.deps.prefs.get().autoCheckUpdates) void this.check()
      }, AUTO_CHECK_DELAY_MS)
    }
  }

  get view(): UpdateStateView {
    return this.state
  }

  private set(ev: UpdaterEvent): void {
    this.state = reduceUpdateEvent(this.state, ev, this.version)
    this.deps.getWindow()?.webContents.send(EVENTS.updatesStatus, this.state)
  }

  private async check(): Promise<UpdateStateView> {
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // The 'error' event carries the reason into the state on its own.
    }
    return this.state
  }

  async checkNow(): Promise<UpdateStateView> {
    if (this.disabled) return this.state
    return this.check()
  }

  setAutoCheckEnabled(on: boolean): void {
    if (!on || this.disabled) return
    if (this.state.status === 'checking' || this.state.status === 'downloading' || this.state.status === 'downloaded') return
    void this.check()
  }

  install(): void {
    if (!this.state.canInstall) return
    // Silent install; the app relaunches afterwards. Windows shows the normal UAC prompt.
    autoUpdater.quitAndInstall(true, true)
  }

  async openReleases(): Promise<void> {
    await shell.openExternal(this.deps.releasesUrl)
  }
}
