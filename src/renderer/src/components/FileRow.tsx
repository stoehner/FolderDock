import type { FileMeta } from '../../../shared/types'
import { api, formatSize } from '../lib/api'
import { ico } from '../lib/icons'
import { useUI } from '../state/ui'
import { promptDeleteFiles } from '../lib/ops'

function iconFor(file: FileMeta): string {
  if (file.kind === 'image') return 'image'
  if (file.kind === 'pdf') return 'pdf'
  return 'file'
}

function kindClass(file: FileMeta): string {
  if (file.kind === 'image') return 'image'
  if (file.kind === 'pdf') return 'pdf'
  if (file.kind === 'text' || file.kind === 'markdown') return 'text'
  return ''
}

export function FileRow({ file, selected }: { file: FileMeta; selected: boolean }) {
  const openPreview = useUI(s => s.openPreview)
  const openMenu = useUI(s => s.openMenu)
  const isStarred = useUI(s => s.starred.includes(file.relPath))
  const snippet = useUI(s => s.contentMatches[file.relPath])
  const inSelection = useUI(s => s.selection.includes(file.relPath))
  const selection = useUI(s => s.selection)

  return (
    <div
      className={`file-row${selected || inSelection ? ' is-selected' : ''}`}
      data-file={file.relPath}
      draggable
      tabIndex={0}
      role="button"
      aria-label={`Preview ${file.name}`}
      title="Drag out or into another collection · click to preview · double-click to edit · Ctrl+click to select"
      onClick={e => {
        if (e.ctrlKey || e.metaKey) {
          useUI.getState().toggleSelect(file.relPath)
          return
        }
        openPreview(file.relPath)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPreview(file.relPath)
        } else if (e.key === 'F2') {
          e.preventDefault()
          useUI.getState().openModal({ type: 'rename-file', relPath: file.relPath })
        } else if (e.key === 'Delete') {
          e.preventDefault()
          promptDeleteFiles(inSelection && selection.length > 1 ? [...selection] : [file.relPath])
        }
      }}
      onContextMenu={e => {
        e.preventDefault()
        e.stopPropagation()
        openMenu({ kind: 'file', relPath: file.relPath, x: e.clientX, y: e.clientY })
      }}
      onDragStart={e => {
        e.preventDefault()
        const others = inSelection && selection.length > 1 ? selection.filter(p => p !== file.relPath) : undefined
        api.startDrag(file.relPath, others)
      }}
    >
      <span className={`typeicon ${kindClass(file)}`}>{ico(iconFor(file))}</span>
      <div className="file-info">
        <div className="file-name">{file.name}</div>
        <div className="file-meta">
          {formatSize(file.size)} · {new Date(file.mtimeMs).toLocaleDateString()}
        </div>
        {snippet ? <div className="file-snippet">{snippet}</div> : null}
      </div>
      <button
        className={`file-star${isStarred ? ' starred' : ''}`}
        onClick={e => {
          e.stopPropagation()
          useUI.getState().toggleStar(file.relPath)
        }}
        aria-pressed={isStarred}
        aria-label={isStarred ? `Remove ${file.name} from favorites` : `Add ${file.name} to favorites`}
        title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
      >
        {ico('star')}
      </button>
      <button
        className="file-more"
        onClick={e => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          openMenu({ kind: 'file', relPath: file.relPath, x: r.right - 190, y: r.bottom + 4 })
        }}
        aria-label={`Options for ${file.name}`}
        title="File options"
      >
        {ico('more')}
      </button>
    </div>
  )
}
