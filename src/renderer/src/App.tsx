import { useEffect } from 'react'
import { api } from './lib/api'
import { ico } from './lib/icons'
import { useLibrary } from './state/library'
import { useUI } from './state/ui'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { LibraryGrid } from './components/LibraryGrid'
import { ContextMenu } from './components/ContextMenu'
import { ModalLayer } from './components/ModalLayer'
import { SidePreview } from './components/SidePreview'
import { HoverSummary } from './components/HoverSummary'
import { DropHint, Toast } from './components/Toast'
import { SelectionBar } from './components/SelectionBar'
import { createNoteOp, chooseImportOp, dropBackgroundOp, saveEditorOp } from './lib/ops'

export default function App() {
  const booted = useUI(s => s.booted)
  const previewOpen = useUI(s => s.previewRelPath !== null)
  const libError = useLibrary(s => s.error)

  useEffect(() => {
    void useUI.getState().boot()
    const offLib = api.onLibraryChanged(() => void useLibrary.getState().refresh())
    const offMax = api.onWindowMaximized(m => useUI.getState().setMaximized(m))
    return () => {
      offLib()
      offMax()
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const ui = useUI.getState()
      const ctrl = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') {
        if (ui.modal) {
          if (ui.modal.type === 'editor') ui.closeEditor()
          else ui.closeModal()
          return
        }
        if (ui.contextMenu) {
          ui.closeMenu()
          return
        }
        if (ui.previewRelPath) {
          ui.closePreview()
          return
        }
        if (ui.selection.length > 0) {
          ui.clearSelection()
          return
        }
        if (ui.openFolder) {
          ui.toggleFolder(ui.openFolder)
        }
        return
      }
      if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const input = document.getElementById('searchInput') as HTMLInputElement | null
        input?.focus()
        input?.select()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void createNoteOp()
        return
      }
      if (ctrl && e.key.toLowerCase() === 's') {
        if (ui.modal?.type === 'editor' && ui.editor) {
          e.preventDefault()
          void saveEditorOp()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!booted) {
    return <div className="app" />
  }

  return (
    <div
      className={`app${previewOpen ? ' preview-open' : ''}`}
      onDragEnter={e => {
        if (Array.from(e.dataTransfer.types).includes('Files')) useUI.getState().dragEnter(e as unknown as DragEvent)
      }}
      onDragOver={e => {
        if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault()
      }}
      onDragLeave={e => {
        if (Array.from(e.dataTransfer.types).includes('Files') && !e.relatedTarget) useUI.getState().dragReset()
      }}
      onDrop={e => {
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault()
          const paths = Array.from(e.dataTransfer.files)
            .map(f => {
              try {
                return api.getPathForFile(f)
              } catch {
                return ''
              }
            })
            .filter(Boolean)
          void dropBackgroundOp(paths)
        }
        useUI.getState().dragReset()
      }}
    >
      <Titlebar />
      <Toolbar />
      <div className="library-scroll" id="scrollArea">
        <LibraryGrid />
      </div>
      <footer className="footer">
        <div className="status">
          <span className={`live-dot${libError ? ' error' : ''}`} />
          <span id="statusText">{libError ? 'Library error — see above' : 'Local library · watching changes'}</span>
        </div>
        <div className="links">
          <button id="importBtn" onClick={() => void chooseImportOp()} title="Import files from this computer">
            Import files
          </button>
          <span>·</span>
          <button
            onClick={() => {
              void api.openRoot().catch(() => undefined)
            }}
            title="Open the library folder in File Explorer"
          >
            Open root
          </button>
          <span>·</span>
          <button onClick={() => useUI.getState().openModal({ type: 'help' })} title="See keyboard shortcuts and how it works">
            How it works
          </button>
          <span>·</span>
          <button
            className="footer-icon"
            onClick={() => useUI.getState().openModal({ type: 'settings' })}
            title="Settings"
            aria-label="Open settings"
          >
            {ico('gear')}
          </button>
        </div>
      </footer>
      {previewOpen ? <SidePreview /> : null}
      <ContextMenu />
      <ModalLayer />
      <Toast />
      <DropHint />
      <HoverSummary />
      <SelectionBar />
    </div>
  )
}
