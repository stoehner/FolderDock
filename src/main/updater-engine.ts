import type { UpdateStateView } from '../shared/types'

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'notAvailable' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export interface UpdateEngineOptions {
  version: string
  portable: boolean
  disabled: boolean
}

export function createInitialUpdateState(opts: UpdateEngineOptions): UpdateStateView {
  return {
    status: opts.disabled ? 'disabled' : 'idle',
    version: opts.version.trim() ? opts.version : null,
    progress: null,
    canInstall: false,
    portable: opts.portable,
    note: opts.disabled
      ? 'Development build — grab installers from the GitHub Releases page.'
      : opts.portable
        ? 'Portable copy — updates are announced, but download a new portable build yourself.'
        : 'Checked at launch. The update downloads on its own and installs when FolderDock quits.'
  }
}

export function reduceUpdateEvent(prev: UpdateStateView, ev: UpdaterEvent, currentVersion: string): UpdateStateView {
  switch (ev.type) {
    case 'checking':
      return { ...prev, status: 'checking', progress: null, canInstall: false, note: 'Checking for updates…' }
    case 'available':
      if (prev.portable) {
        return {
          ...prev,
          status: 'available',
          version: ev.version,
          progress: null,
          canInstall: false,
          note: `Version ${ev.version} is available — open Releases to download the new portable build.`
        }
      }
      return {
        ...prev,
        status: 'downloading',
        version: ev.version,
        progress: 0,
        canInstall: false,
        note: `Downloading update to ${ev.version}…`
      }
    case 'notAvailable':
      return {
        ...prev,
        status: 'uptodate',
        version: currentVersion,
        progress: null,
        canInstall: false,
        note: `FolderDock ${currentVersion} is up to date.`
      }
    case 'progress': {
      const percent = Math.max(0, Math.min(100, Math.round(ev.percent)))
      return { ...prev, status: 'downloading', progress: percent, canInstall: false, note: `Downloading update… ${percent}%` }
    }
    case 'downloaded':
      return {
        ...prev,
        status: 'downloaded',
        progress: 100,
        canInstall: !prev.portable,
        note: 'Update ready — installs automatically when FolderDock quits.'
      }
    case 'error':
      return {
        ...prev,
        status: 'error',
        progress: null,
        canInstall: false,
        note: `Update check failed: ${ev.message}`
      }
  }
}
