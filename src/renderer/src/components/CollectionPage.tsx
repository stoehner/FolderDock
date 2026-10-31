import { useMemo, useState } from 'react'
import type { FolderSnapshot } from '../../../shared/types'
import { artFor } from '../lib/art'
import { ico } from '../lib/icons'
import { useUI } from '../state/ui'
import { usePrefs } from '../state/prefs'
import { FileRow } from './FileRow'
import { filterFolderFiles } from './LibraryGrid'
import { chooseImportOp, createNoteOp, importDropOp, internalDropOp } from '../lib/ops'
import { isInternalDrag, markInternalDropHandled, readInternalDrop } from '../lib/dragOut'

interface PageProps {
  folder: FolderSnapshot
}

export function CollectionPage({ folder }: PageProps) {
  const setOpenFolder = useUI(s => s.setOpenFolder)
  const search = useUI(s => s.search)
  const filter = useUI(s => s.filter)
  const starred = useUI(s => s.starred)
  const folderArt = useUI(s => s.folderArt)
  const contentMatches = useUI(s => s.contentMatches)
  const previewRelPath = useUI(s => s.previewRelPath)
  const newFolderArt = usePrefs(s => s.prefs.newFolderArt)
  const fileSort = usePrefs(s => s.prefs.fileSort)
  const [dragOver, setDragOver] = useState(false)

  const art = useMemo(
    () => artFor(folder.name, folderArt[folder.name], newFolderArt !== 'varied' ? newFolderArt : undefined),
    [folder.name, folderArt, newFolderArt]
  )
  const shown = useMemo(
    () => filterFolderFiles(folder, search.trim().toLowerCase(), filter, starred, contentMatches, fileSort),
    [folder, search, filter, starred, contentMatches, fileSort]
  )
  const total = folder.files.length
  const filteredView = search.trim().length > 0 || filter !== 'all'

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    useUI.getState().dragReset()
    const internal = readInternalDrop(e)
    if (internal) {
      markInternalDropHandled(internal.payload)
      void internalDropOp(internal.files, folder.name)
      return
    }
    if (e.dataTransfer.files.length === 0) return
    const paths = Array.from(e.dataTransfer.files)
      .map(f => {
        try {
          return window.folderdock.getPathForFile(f)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
    if (paths.length) void importDropOp(paths, folder.name)
  }

  return (
    <div
      className={`collection-page${dragOver ? ' drag-over' : ''}`}
      data-folder={folder.name}
      onDragOver={e => {
        if (isInternalDrag(e) || Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={handleDrop}
    >
      <div className="page-head">
        <button
          className="page-back"
          onClick={() => setOpenFolder(null)}
          aria-label="Back to all collections"
        >
          {ico('arrow', 'flip-x')}
          <span>Collections</span>
        </button>
        <span className="page-art" style={{ background: art.art }} aria-hidden="true" />
        <div className="page-title">
          <div className="page-name">{folder.name}</div>
          <div className="page-count">
            {total} {total === 1 ? 'file' : 'files'}
            {shown.length !== total ? ` · ${shown.length} shown` : ''}
          </div>
        </div>
        <div className="page-tools">
          <button
            className="secondary-button"
            onClick={() => void createNoteOp(folder.name)}
            aria-label="New note"
            hidden={folder.virtual}
          >
            {ico('note')}
            <span>Note</span>
          </button>
          <button
            className="secondary-button"
            onClick={() => void chooseImportOp(folder.name)}
            aria-label="Import from Windows"
          >
            {ico('upload')}
            <span>Import</span>
          </button>
        </div>
      </div>
      <div className="page-list">
        {shown.length ? (
          shown.map(file => <FileRow key={file.relPath} file={file} selected={previewRelPath === file.relPath} />)
        ) : (
          <div className="page-empty">
            {filteredView
              ? 'No matching files in this collection.'
              : 'This collection is empty. Drop files anywhere on this page, import from Windows, or create a note.'}
          </div>
        )}
      </div>
      <div className="drop-hint">
        {ico('upload')} Drop files here to move them into {folder.name}
      </div>
    </div>
  )
}
