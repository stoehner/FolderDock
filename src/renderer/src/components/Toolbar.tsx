import { ico } from '../lib/icons'
import { useLibrary } from '../state/library'
import { useUI, type FilterKind } from '../state/ui'
import { createNoteOp } from '../lib/ops'

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'favorites', label: 'Starred' }
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

  return (
    <div className="toolbar">
      <div className="actionbar">
        <label className="search" title={root}>
          {ico('search')}
          <input
            id="searchInput"
            placeholder="Search folders and files..."
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