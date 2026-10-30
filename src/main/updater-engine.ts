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

// Notes are one short line each on purpose. The Settings card renders the status
// line only while something is happening, so idle and disabled states stay blank.
export function createInitialUpdateState(opts: UpdateEngineOptions): UpdateStateView {
  return {
    status: opts.disabled ? 'disabled' : 'idle',
    version: opts.version.trim() ? opts.version : null,
    progress: null,
    canInstall: false,
    portable: opts.portable,
    note: ''
  }
}

export function reduceUpdateEvent(prev: UpdateStateView, ev: UpdaterEvent, currentVersion: string): UpdateStateView {
  switch (ev.type) {
    case 'checking':
      return { ...prev, status: 'checking', progress: null, canInstall: false, note: 'Checking…' }
    case 'available':
      if (prev.portable) {
        return {
          ...prev,
          status: 'available',
          version: ev.version,
          progress: null,
          canInstall: false,
          note: `New version ${ev.version} is available.`
        }
      }
      return {
        ...prev,
        status: 'downloading',
        version: ev.version,
        progress: 0,
        canInstall: false,
        note: `Downloading ${ev.version}…`
      }
    case 'notAvailable':
      return {
        ...prev,
        status: 'uptodate',
        version: currentVersion,
        progress: null,
        canInstall: false,
        note: 'Up to date.'
      }
    case 'progress': {
      const percent = Math.max(0, Math.min(100, Math.round(ev.percent)))
      return { ...prev, status: 'downloading', progress: percent, canInstall: false, note: `Downloading… ${percent}%` }
    }
    case 'downloaded':
      return {
        ...prev,
        status: 'downloaded',
        progress: 100,
        canInstall: !prev.portable,
        note: 'Update ready — installs next quit.'
      }
    case 'error':
      return {
        ...prev,
        status: 'error',
        progress: null,
        canInstall: false,
        note: `Update failed: ${ev.message}`
      }
  }
}
