import { useEffect, useState } from 'react'
import { api, call, errText } from '../../lib/api'
import { useLibrary } from '../../state/library'
import { usePrefs } from '../../state/prefs'
import { useUI } from '../../state/ui'
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
  const fileSort = prefs.fileSort
  const closeToTray = prefs.closeToTray
  const confirmDelete = prefs.confirmDelete
  const hoverDelay = prefs.hoverDelay
  const [info, setInfo] = useState<{ version: string; electron: string; overridden: boolean; defaultRoot: string | null } | null>(null)
  useEffect(() => {
    void call(api.appInfo())
      .then(setInfo)
      .catch(() => undefined)
  }, [])

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
            <div className="settings-label">Hover summary delay</div>
            <div className="settings-sub">How quickly the file summary tooltip appears.</div>
          </div>
          <div className="theme-choices">
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
