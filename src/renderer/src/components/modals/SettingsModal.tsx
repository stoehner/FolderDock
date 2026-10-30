import { useEffect, useState } from 'react'
import { api, call, errText } from '../../lib/api'
import { ART_CYCLE, artStyles } from '../../lib/art'
import { useLibrary } from '../../state/library'
import { usePrefs } from '../../state/prefs'
import { useUI } from '../../state/ui'
import { isHexColor } from '../../../../shared/art-values'
import type { UpdateStateView } from '../../../../shared/types'
import { ColorPickerSwatch } from '../ColorPickerSwatch'
import { Head, Foot, Toggle } from './kit'

export function SettingsModal() {
  const snapshot = useLibrary(s => s.snapshot)
  const prefs = usePrefs(s => s.prefs)
  const patch = usePrefs(s => s.patch)
  const setTheme = usePrefs(s => s.setTheme)
  const setViewSize = usePrefs(s => s.setViewSize)
  const theme = prefs.theme
  const alwaysOnTop = prefs.alwaysOnTop
  const viewSize = prefs.viewSize
  const fontSize = prefs.fontSize
  const cardColumns = prefs.cardColumns
  const fileSort = prefs.fileSort
  const closeToTray = prefs.closeToTray
  const confirmDelete = prefs.confirmDelete
  const hoverDelay = prefs.hoverDelay
  const newFolderArt = prefs.newFolderArt
  const [info, setInfo] = useState<{ version: string; electron: string; overridden: boolean; defaultRoot: string | null } | null>(null)
  const [updates, setUpdates] = useState<UpdateStateView | null>(null)
  useEffect(() => {
    void call(api.appInfo())
      .then(setInfo)
      .catch(() => undefined)
    void call(api.updateState())
      .then(setUpdates)
      .catch(() => undefined)
    return api.onUpdateStatus(state => setUpdates(state))
  }, [])

  async function checkForUpdates(): Promise<void> {
    try {
      const state = await call(api.checkForUpdates())
      setUpdates(state)
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
  }

  async function installUpdate(): Promise<void> {
    try {
      await call(api.installUpdate())
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
  }

  async function changeRoot() {
    try {
      const path = await call(api.chooseRoot())
      if (!path) return
      await call(api.setPrefs({ rootPath: path }))
      await useLibrary.getState().refresh()
      useUI.getState().notify('Library root updated')
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
  }

  async function changeBackup(): Promise<void> {
    try {
      const p = await call(api.chooseBackupFolder())
      if (!p) return
      await call(api.setPrefs({ backupLocation: p }))
      useUI.getState().notify('Backup location updated')
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
  }

  async function backupNow(): Promise<void> {
    try {
      const r = await call(api.backupLibrary())
      useUI.getState().notify(`Backed up ${r.files} file${r.files === 1 ? '' : 's'} to ${r.destination}`)
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
  }

  function restoreDefaults(): void {
    useUI.getState().openModal({
      type: 'confirm',
      title: 'Restore defaults?',
      subtitle: 'Settings and colors',
      description:
        'Restores the default settings and clears every pinned collection color and saved custom color. Your files, library location, favorites, and window size are untouched.',
      confirmLabel: 'Restore defaults',
      onConfirm: () => {
        usePrefs.getState().resetSettings()
        useUI.getState().clearFolderArt()
        useUI.getState().notify('Default settings and colors restored')
        useUI.getState().openModal({ type: 'settings' })
      }
    })
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <Head icon="gear" title="Settings" sub="Library location and appearance." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Library root</div>
            <div className="settings-sub">{snapshot?.root ?? ''}</div>
            {info?.overridden ? <div className="settings-sub">Overridden by FOLDERDOCK_ROOT environment variable.</div> : null}
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <button className="secondary-button" onClick={() => void changeRoot()} disabled={info?.overridden}>
              Change…
            </button>
            <button className="secondary-button" onClick={() => void api.openRoot().catch(() => undefined)}>
              Open
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Backup</div>
            <div className="settings-sub">
              {prefs.backupLocation} · manual copies of the whole library, one timestamped folder per backup
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <button className="secondary-button" onClick={() => void changeBackup()}>
              Change…
            </button>
            <button className="secondary-button" onClick={() => useUI.getState().openModal({ type: 'backups' })}>
              Manage…
            </button>
            <button className="primary-button" onClick={() => void backupNow()}>
              Back up now
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Updates</div>
            <div className="settings-sub">{updates?.note ?? ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            {updates?.canInstall ? (
              <button className="primary-button" onClick={() => void installUpdate()}>
                Restart &amp; update
              </button>
            ) : null}
            {updates?.portable ? (
              <button className="secondary-button" onClick={() => void api.openUpdateReleases().catch(() => undefined)}>
                Releases…
              </button>
            ) : null}
            <button className="secondary-button" onClick={() => void checkForUpdates()}>
              Check now
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Automatic update checks</div>
            <div className="settings-sub">Look for a new version each time FolderDock starts. The update downloads itself and installs on quit.</div>
          </div>
          <Toggle on={prefs.autoCheckUpdates} onChange={v => patch({ autoCheckUpdates: v })} label="Automatic update checks" />
        </div>
        <div className="settings-row">
          <div className="settings-label">Appearance</div>
          <div className="theme-choices">
            <button className={`theme-choice${theme === 'dark' ? ' active' : ''}`} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button className={`theme-choice${theme === 'light' ? ' active' : ''}`} onClick={() => setTheme('light')}>
              Light
            </button>
            <button className={`theme-choice${theme === 'system' ? ' active' : ''}`} onClick={() => setTheme('system')}>
              System
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">Card size</div>
          <div className="theme-choices">
            <button className={`theme-choice${viewSize === 'regular' ? ' active' : ''}`} onClick={() => setViewSize('regular')}>
              Regular
            </button>
            <button className={`theme-choice${viewSize === 'compact' ? ' active' : ''}`} onClick={() => setViewSize('compact')}>
              Compact
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Font size</div>
            <div className="settings-sub">Text size inside a collection page. Medium is the default.</div>
          </div>
          <div className="theme-choices">
            <button className={`theme-choice${fontSize === 'small' ? ' active' : ''}`} onClick={() => patch({ fontSize: 'small' })}>
              Small
            </button>
            <button className={`theme-choice${fontSize === 'medium' ? ' active' : ''}`} onClick={() => patch({ fontSize: 'medium' })}>
              Medium
            </button>
            <button className={`theme-choice${fontSize === 'large' ? ' active' : ''}`} onClick={() => patch({ fontSize: 'large' })}>
              Large
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Cards per row</div>
            <div className="settings-sub">More cards per row shrink each collection card.</div>
          </div>
          <div className="theme-choices">
            <button
              className={`theme-choice${cardColumns === 2 ? ' active' : ''}`}
              onClick={() => patch({ cardColumns: 2 })}
            >
              2
            </button>
            <button
              className={`theme-choice${cardColumns === 3 ? ' active' : ''}`}
              onClick={() => patch({ cardColumns: 3 })}
            >
              3
            </button>
            <button
              className={`theme-choice${cardColumns === 4 ? ' active' : ''}`}
              onClick={() => patch({ cardColumns: 4 })}
            >
              4
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-label">New collection colors</div>
            <div className="settings-sub">Applied when you create a collection. “Varied” picks by name.</div>
            <div className="colors" style={{ marginTop: 10 }}>
              <button
                className={`theme-choice${newFolderArt === 'varied' ? ' active' : ''}`}
                onClick={() => patch({ newFolderArt: 'varied' })}
              >
                Varied
              </button>
              {ART_CYCLE.map(id => (
                <button
                  key={id}
                  className={`swatch small${newFolderArt === id ? ' selected' : ''}`}
                  style={{ background: artStyles[id]?.art }}
                  onClick={() => patch({ newFolderArt: id })}
                  title={id}
                  aria-label={`Default style ${id}`}
                />
              ))}
              <ColorPickerSwatch
                small
                value={isHexColor(newFolderArt) ? newFolderArt : undefined}
                onPick={hex => patch({ newFolderArt: hex })}
              />
            </div>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">File sort</div>
            <div className="settings-sub">How files order inside every collection.</div>
          </div>
          <div className="theme-choices">
            <button className={`theme-choice${fileSort === 'recent' ? ' active' : ''}`} onClick={() => patch({ fileSort: 'recent' })}>
              Recent
            </button>
            <button className={`theme-choice${fileSort === 'name' ? ' active' : ''}`} onClick={() => patch({ fileSort: 'name' })}>
              Name
            </button>
            <button className={`theme-choice${fileSort === 'size' ? ' active' : ''}`} onClick={() => patch({ fileSort: 'size' })}>
              Size
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Always on top</div>
            <div className="settings-sub">Keeps the shelf visible while you drag files out to other apps.</div>
          </div>
          <Toggle on={alwaysOnTop} onChange={v => patch({ alwaysOnTop: v })} label="Always on top" />
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Close to tray</div>
            <div className="settings-sub">Closing the window keeps FolderDock in the system tray. Quit from the tray menu.</div>
          </div>
          <Toggle on={closeToTray} onChange={v => patch({ closeToTray: v })} label="Close to tray" />
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Confirm before delete</div>
            <div className="settings-sub">Ask before moving files or collections to the Recycle Bin.</div>
          </div>
          <Toggle on={confirmDelete} onChange={v => patch({ confirmDelete: v })} label="Confirm before delete" />
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Hover summaries</div>
            <div className="settings-sub">Small summary tooltip when hovering a file. Off keeps the shelf quiet.</div>
          </div>
          <div className="theme-choices">
            <button className={`theme-choice${hoverDelay === 'off' ? ' active' : ''}`} onClick={() => patch({ hoverDelay: 'off' })}>
              Off
            </button>
            <button className={`theme-choice${hoverDelay === 'fast' ? ' active' : ''}`} onClick={() => patch({ hoverDelay: 'fast' })}>
              Fast
            </button>
            <button className={`theme-choice${hoverDelay === 'normal' ? ' active' : ''}`} onClick={() => patch({ hoverDelay: 'normal' })}>
              Normal
            </button>
            <button className={`theme-choice${hoverDelay === 'slow' ? ' active' : ''}`} onClick={() => patch({ hoverDelay: 'slow' })}>
              Slow
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">Rescan library</div>
          <button
            className="secondary-button"
            onClick={() => {
              void useLibrary.getState().refresh()
              useUI.getState().notify('Library rescanned')
            }}
          >
            Scan now
          </button>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">Default look</div>
            <div className="settings-sub">
              Restore the default settings and clear pinned collection colors and saved custom colors. Files, library
              location, favorites, and window size are untouched.
            </div>
          </div>
          <button className="secondary-button" onClick={restoreDefaults}>
            Restore…
          </button>
        </div>
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">About</div>
            <div className="settings-sub">
              FolderDock {info?.version ?? ''} · Electron {info?.electron ?? ''} · preferences in %APPDATA%\FolderDock
            </div>
          </div>
        </div>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Done
        </button>
      </Foot>
    </section>
  )
}
