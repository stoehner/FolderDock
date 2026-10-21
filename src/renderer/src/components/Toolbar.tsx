import { useState } from 'react'
import { ico } from '../lib/icons'
import { useLibrary } from '../state/library'
import { targetFolderForNewItems, useUI, type FilterKind } from '../state/ui'
import { chooseImportOp, createNoteOp, importDropOp } from '../lib/ops'

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recent' }
]

export function Toolbar() {
  const search = useUI(s => s.search)
  const filter = useUI(s => s.filter)
  const setSearch = useUI(s => s.setSearch)
  const setFilter = useUI(s => s.setFilter)
  const openModal = useUI(s => s.openModal)
  const snapshot = useLibrary(s => s.snapshot)

  const folders = snapshot?.folders.length ?? 0
  const root = snapshot?.root ?? ''
  const [zoneOver, setZoneOver] = useState(false)

  return (
    <div className="toolbar">
      <div className="actionbar">
        <label className="search" title={root}>
          {ico('search')}
          <input
            id="searchInput"
            placeholder="Search names and file contents..."
            autoComplete="off"
            aria-label="Search folders and files"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <kbd>Ctrl F</kbd>
        </label>
        <button className="primary-button" onClick={() => openModal({ type: 'new-folder', art: 'aurora' })}>
          {ico('plus')}
          <span>New folder</span>
        </button>
        <button className="secondary-button" onClick={() => void createNoteOp()} title="Create a quick Markdown note">
          {ico('note')}
        </button>
      </div>
      <div
        className={`dropzone${zoneOver ? ' drag-over' : ''}`}
        role="button"
        aria-label="Drop files to add them to FolderDock"
        title="Drop files here to move them into your library, or click to browse"
        onClick={() => void chooseImportOp()}
        onDragOver={e => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setZoneOver(true)
          }
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setZoneOver(false)
        }}
        onDrop={e => {
          e.preventDefault()
          setZoneOver(false)
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
          if (paths.length) void importDropOp(paths, targetFolderForNewItems() ?? 'Unsorted')
        }}
      >
        {ico('upload')}
        <span>Drop files here to move them into your library · click to browse</span>
      </div>
      <div className="section-row">
        <div className="section-label">
          Collections <span>{folders}</span>
        </div>
        <div className="filterbar" id="filterbar">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`filter-chip${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}