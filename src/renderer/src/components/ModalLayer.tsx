import { useEffect, useRef, useState } from 'react'
import { artStyles, ART_CYCLE } from '../lib/art'
import { ico } from '../lib/icons'
import { useLibrary } from '../state/library'
import { useUI } from '../state/ui'
import { EditorModal } from './Editor'
import { createFolderOp, moveFileOp, renameFileOp, renameFolderOp } from '../lib/ops'
import { api, call, errText, folderOfRel } from '../lib/api'
import { useExcerpts } from '../state/excerpts'

function Head({ icon, title, sub, onClose }: { icon: string; title: string; sub: string; onClose: () => void }) {
  return (
    <div className="modal-head">
      <div className="modal-head-icon">{ico(icon)}</div>
      <div>
        <strong>{title}</strong>
        <p>{sub}</p>
      </div>
      <button className="exit" onClick={onClose} aria-label="Close dialog">
        {ico('x')}
      </button>
    </div>
  )
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal-foot">
      <button className="secondary-button" onClick={() => useUI.getState().closeModal()}>
        Cancel
      </button>
      {children}
    </div>
  )
}

export function ModalLayer() {
  const modal = useUI(s => s.modal)
  const editor = useUI(s => s.editor)
  if (!modal) return null

  if (modal.type === 'editor' && editor) {
    return (
      <div className="modal-layer" data-editor-layer="true">
        <EditorModal />
      </div>
    )
  }

  return (
    <div
      className="modal-layer"
      onClick={e => {
        if (e.target === e.currentTarget) useUI.getState().closeModal()
      }}
    >
      {renderModal(modal)}
    </div>
  )
}

function renderModal(modal: NonNullable<ReturnType<typeof useUI.getState>['modal']>): React.ReactNode {
  switch (modal.type) {
    case 'new-folder':
      return <NewFolderModal art={modal.art} />
    case 'rename-folder':
      return <RenameFolderModal folder={modal.folder} />
    case 'rename-file':
      return <RenameFileModal relPath={modal.relPath} />
    case 'confirm':
      return <ConfirmModal modal={modal} />
    case 'move-file':
      return <MoveFileModal relPath={modal.relPath} />
    case 'help':
      return <HelpModal />
    case 'settings':
      return <SettingsModal />
    default:
      return null
  }
}

function NewFolderModal({ art }: { art: string }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(art)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  async function submit() {
    if (busy) return
    setBusy(true)
    const ok = await createFolderOp(name.trim(), selected)
    setBusy(false)
    if (ok) useUI.getState().closeModal()
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Create a collection">
      <Head icon="folder" title="Create a collection" sub="Adds a real folder inside your library." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <label className="field-label" htmlFor="folderName">
          Folder name
        </label>
        <input
          id="folderName"
          ref={inputRef}
          className="field"
          maxLength={60}
          placeholder="e.g. Favorite Prompts"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
        />
        <p className="helper">Pick an artwork style — it only changes how the folder looks in FolderDock.</p>
        <div className="colors">
          {ART_CYCLE.map(id => (
            <button
              key={id}
              className={`swatch${selected === id ? ' selected' : ''}`}
              style={{ background: artStyles[id]?.art }}
              onClick={() => setSelected(id)}
              title={id}
              aria-label={`Art style ${id}`}
            />
          ))}
        </div>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void submit()}>
          Create folder
        </button>
      </Foot>
    </section>
  )
}

function RenameFolderModal({ folder }: { folder: string }) {
  const [name, setName] = useState(folder)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function submit() {
    if (busy) return
    setBusy(true)
    const ok = await renameFolderOp(folder, name.trim())
    setBusy(false)
    if (ok) useUI.getState().closeModal()
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Rename collection">
      <Head icon="rename" title="Rename collection" sub="The folder on disk is renamed too." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <label className="field-label" htmlFor="renameInput">
          Name
        </label>
        <input
          id="renameInput"
          ref={inputRef}
          className="field"
          maxLength={60}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
        />
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void submit()}>
          Save name
        </button>
      </Foot>
    </section>
  )
}

function RenameFileModal({ relPath }: { relPath: string }) {
  const current = relPath.split('/').pop() ?? relPath
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    const dot = current.lastIndexOf('.')
    inputRef.current?.setSelectionRange(0, dot > 0 ? dot : current.length)
  }, [current])

  async function submit() {
    if (busy) return
    setBusy(true)
    const ok = await renameFileOp(relPath, name.trim())
    setBusy(false)
    if (ok) useUI.getState().closeModal()
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Rename file">
      <Head icon="rename" title="Rename file" sub="The extension determines the file type." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <label className="field-label" htmlFor="renameFileInput">
          Filename
        </label>
        <input
          id="renameFileInput"
          ref={inputRef}
          className="field"
          maxLength={150}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
        />
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void submit()}>
          Save name
        </button>
      </Foot>
    </section>
  )
}

function ConfirmModal({
  modal
}: {
  modal: Extract<NonNullable<ReturnType<typeof useUI.getState>['modal']>, { type: 'confirm' }>
}) {
  const [busy, setBusy] = useState(false)
  async function confirm() {
    if (busy) return
    setBusy(true)
    await modal.onConfirm()
    setBusy(false)
  }
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label={modal.title}>
      <Head icon="trash" title={modal.title} sub={modal.subtitle} onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <p className="helper">{modal.description}</p>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void confirm()}>
          {modal.confirmLabel}
        </button>
      </Foot>
    </section>
  )
}

function MoveFileModal({ relPath }: { relPath: string }) {
  const snapshot = useLibrary(s => s.snapshot)
  const current = folderOfRel(relPath)
  const folders = snapshot?.folders ?? []
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Move file">
      <Head
        icon="move"
        title="Move file"
        sub={relPath.split('/').pop() ?? relPath}
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="move-list">
          {folders.map(f => (
            <button
              key={f.name}
              className="move-option"
              disabled={f.name === current}
              onClick={() => void moveFileOp(relPath, f.name)}
            >
              {ico('folder', 'tiny')}
              {f.name}
            </button>
          ))}
        </div>
        <p className="helper">Files move between collections with a real file system move.</p>
      </div>
    </section>
  )
}

function HelpModal() {
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="How FolderDock works">
      <Head icon="info" title="How FolderDock works" sub="Everything here is a real file on disk." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <div className="markdown-preview" style={{ height: 'auto', maxHeight: 420 }}>
          <h2>Using your shelf</h2>
          <p>
            Click a glass folder front to open it in place and see its file list. Grab a visible paper sheet and drag it
            straight into Explorer or any app that accepts files — the original always stays in your library.
          </p>
          <p>
            Drop files from Explorer onto a collection to copy them in. Drag a sheet onto another collection card to move
            it between collections. Hover any sheet or row for a quick summary, click for the full side preview, and
            double-click (or press Edit) to open the text editor.
          </p>
          <h2>Shortcuts</h2>
          <p>
            <span className="kbd">Ctrl F</span> search · <span className="kbd">Ctrl N</span> new note ·{' '}
            <span className="kbd">Ctrl S</span> save in editor · <span className="kbd">F2</span> rename selected file ·{' '}
            <span className="kbd">Del</span> delete selected file · <span className="kbd">Esc</span> close topmost panel
          </p>
          <h2>Where your files live</h2>
          <p>
            Your library is a normal Windows folder (default: Documents\FolderDock). You can change it in Settings.
            Deleting moves files to the Recycle Bin. FolderDock never uploads anything anywhere.
          </p>
        </div>
      </div>
      <div className="modal-foot">
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Got it
        </button>
      </div>
    </section>
  )
}

function SettingsModal() {
  const snapshot = useLibrary(s => s.snapshot)
  const theme = useUI(s => s.theme)
  const setTheme = useUI(s => s.setTheme)
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
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">Rescan library</div>
          <button
            className="secondary-button"
            onClick={() => {
              void useLibrary.getState().refresh()
              useExcerpts.getState().invalidate()
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
