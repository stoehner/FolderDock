import { useEffect, useMemo } from 'react'
import type { FileMeta, FolderSnapshot } from '../../../shared/types'
import { isImageKind } from '../../../shared/kinds'
import { compareFiles } from '../../../shared/sort'
import { api, call } from '../lib/api'
import { artFor } from '../lib/art'
import { useLibrary } from '../state/library'
import { useDrag } from '../state/drag'
import { useUI, type FilterKind } from '../state/ui'
import { usePrefs } from '../state/prefs'
import type { FileSort } from '../../../shared/types'
import { FileRow } from './FileRow'
import { PaperSheet } from './PaperSheet'
import { CollectionPage } from './CollectionPage'
import { chooseImportOp, createNoteOp, importDropOp } from '../lib/ops'

export interface DisplayFolder extends FolderSnapshot {
  art: ReturnType<typeof artFor>
  shown: FileMeta[]
  titleMatch: boolean
}

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function matchesFilter(file: FileMeta, filter: FilterKind, starred: string[]): boolean {
  if (filter === 'all') return true
  if (filter === 'favorites') return starred.includes(file.relPath)
  if (filter === 'recent') return Date.now() - file.mtimeMs <= RECENT_WINDOW_MS
  if (filter === 'image') return isImageKind(file.kind)
  return file.kind === filter
}

export function filterFolderFiles(
  folder: FolderSnapshot,
  q: string,
  filter: FilterKind,
  starred: string[],
  contentMatches: Record<string, string>,
  fileSort: FileSort
): FileMeta[] {
  const titleMatch = folder.name.toLowerCase().includes(q)
  const sorted = [...folder.files].sort((a, b) => compareFiles(a, b, fileSort))
  const folderStarred = starred.includes(folder.name)
  return sorted.filter(
    file =>
      (filter === 'favorites'
        ? folderStarred || starred.includes(file.relPath)
        : matchesFilter(file, filter, starred)) &&
      (!q || titleMatch || file.name.toLowerCase().includes(q) || contentMatches[file.relPath] !== undefined)
  )
}

export function computeDisplayFolders(
  snapshot: NonNullable<ReturnType<typeof useLibrary.getState>['snapshot']>,
  opts: {
    search: string
    filter: FilterKind
    folderOrder: string[]
    folderArt: Record<string, string>
    newFolderArt: string
    starred: string[]
    contentMatches: Record<string, string>
    fileSort: FileSort
  }
): DisplayFolder[] {
  const q = opts.search.trim().toLowerCase()
  const byName = new Map(snapshot.folders.map(f => [f.name, f] as const))
  const ordered = [
    ...snapshot.folders.filter(f => f.virtual),
    ...opts.folderOrder.flatMap(n => {
      const f = byName.get(n)
      return f && !f.virtual ? [f] : []
    }),
    ...snapshot.folders
      .filter(f => !f.virtual && !opts.folderOrder.includes(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  ]
  return ordered
    .map(f => {
      const art = artFor(f.name, opts.folderArt[f.name], opts.newFolderArt !== 'varied' ? opts.newFolderArt : undefined)
      const titleMatch = f.name.toLowerCase().includes(q)
      const shown = filterFolderFiles(f, q, opts.filter, opts.starred, opts.contentMatches, opts.fileSort)
      return { ...f, art, shown, titleMatch }
    })
    .filter(
      f =>
        (!q && opts.filter === 'all') ||
        f.shown.length > 0 ||
        (q && f.titleMatch) ||
        (opts.filter === 'favorites' && !q && opts.starred.includes(f.name))
    )
}

export function useDisplayFolders() {
  const snapshot = useLibrary(s => s.snapshot)
  const search = useUI(s => s.search)
  const filter = useUI(s => s.filter)
  const folderOrder = useUI(s => s.folderOrder)
  const folderArt = useUI(s => s.folderArt)
  const newFolderArt = usePrefs(s => s.prefs.newFolderArt)
  const starred = useUI(s => s.starred)
  const contentMatches = useUI(s => s.contentMatches)
  const fileSort = usePrefs(s => s.prefs.fileSort)
  return useMemo(
    () =>
      snapshot
        ? computeDisplayFolders(snapshot, {
            search,
            filter,
            folderOrder,
            folderArt,
            newFolderArt,
            starred,
            contentMatches,
            fileSort
          })
        : [],
    [snapshot, search, filter, folderOrder, folderArt, newFolderArt, starred, contentMatches, fileSort]
  )
}

export function LibraryGrid() {
  const snapshot = useLibrary(s => s.snapshot)
  const error = useLibrary(s => s.error)
  const search = useUI(s => s.search)
  const filter = useUI(s => s.filter)
  const openFolder = useUI(s => s.openFolder)
  const previewRelPath = useUI(s => s.previewRelPath)
  const openModal = useUI(s => s.openModal)
  const folders = useDisplayFolders()

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      useUI.getState().setContentMatches({})
      return
    }
    let stale = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await call(api.searchContent(q))
          if (!stale) {
            useUI.getState().setContentMatches(Object.fromEntries(res.map(m => [m.relPath, m.snippet])))
          }
        } catch {
          if (!stale) useUI.getState().setContentMatches({})
        }
      })()
    }, 200)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [search, snapshot])

  useEffect(() => {
    const selection = useUI.getState().selection
    if (selection.length === 0 || !snapshot) return
    const known = new Set(snapshot.folders.flatMap(f => f.files.map(file => file.relPath)))
    if (selection.some(p => !known.has(p))) {
      useUI.getState().clearSelection()
    }
  }, [snapshot])

  useEffect(() => {
    if (!openFolder || !snapshot) return
    if (!snapshot.folders.some(f => f.name === openFolder)) {
      useUI.getState().setOpenFolder(null)
      useUI.getState().notify('That collection is no longer in the library.')
    }
  }, [snapshot, openFolder])

  if (error) {
    return (
      <div className="library-grid">
        <div className="error-banner">
          {ico('info')} {error}
          <button className="secondary-button" onClick={() => void useLibrary.getState().refresh()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (openFolder) {
    const pageFolder = snapshot?.folders.find(f => f.name === openFolder)
    if (pageFolder) {
      return <CollectionPage folder={pageFolder} />
    }
  }

  if (folders.length === 0) {
    const blank = !search.trim() && filter === 'all'
    return (
      <div className="library-grid">
        <div className="empty">
          {ico('search', 'large')}
          <h3>{blank ? 'Your shelf is empty' : 'No matches found'}</h3>
          <p>
            {blank
              ? 'Create your first collection — it becomes a real folder inside your library.'
              : 'Try another search or choose a different filter.'}
          </p>
          {blank ? (
            <div className="empty-actions">
              <button className="primary-button" onClick={() => openModal({ type: 'new-folder', art: 'aurora' })}>
                {ico('plus')} <span>New folder</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="library-grid">
      {folders.map(f => (
        <FolderCard
          key={f.name}
          folder={f}
          isOpen={search.trim().length > 0}
          previewRelPath={previewRelPath}
        />
      ))}
    </div>
  )
}

import { ico } from '../lib/icons'

interface CardProps {
  folder: DisplayFolder
  isOpen: boolean
  previewRelPath: string | null
}

function FolderCard({ folder, isOpen, previewRelPath }: CardProps) {
  const setOpenFolder = useUI(s => s.setOpenFolder)
  const openMenu = useUI(s => s.openMenu)
  const draggingFolder = useDrag(s => s.draggingFolder)
  const setDraggingFolder = useDrag(s => s.setDraggingFolder)
  const dropTarget = useDrag(s => s.dropTarget)
  const setDropTarget = useDrag(s => s.setDropTarget)
  const folderStarred = useUI(s => s.starred.includes(folder.name))
  const isDropTarget = dropTarget === folder.name
  const count = folder.files.length
  const opened = isOpen

  function handleDragOver(e: React.DragEvent) {
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('application/x-folderdock-folder')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(folder.name)
    } else if (types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(folder.name)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (useDrag.getState().dropTarget === folder.name) setDropTarget(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    useUI.getState().dragReset()
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('application/x-folderdock-folder')) {
      const source = e.dataTransfer.getData('application/x-folderdock-folder')
      if (source && source !== folder.name) useUI.getState().moveFolderOrder(source, folder.name)
      return
    }
    if (e.dataTransfer.files.length > 0) {
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
  }

  return (
    <article
      className={`folder-card${opened ? ' is-open' : ''}${isDropTarget ? ' drop-target' : ''}${
        draggingFolder === folder.name ? ' dragging-card' : ''
      }`}
      data-folder={folder.name}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={e => {
        e.preventDefault()
        openMenu({ kind: 'folder', folder: folder.name, x: e.clientX, y: e.clientY })
      }}
    >
      <div
        className={`folder-scene leaf-count-${Math.min(3, folder.shown.length)}`}
        tabIndex={0}
        role="button"
        aria-label={`Open ${folder.name} collection`}
        aria-expanded={opened}
        onClick={() => setOpenFolder(folder.name)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpenFolder(folder.name)
          }
        }}
        style={makeVars(folder.art)}
      >
        <div className="folder-back">
          <div className="folder-art" />
          <div className="top-edge" />
        </div>
        <SheetStack folder={folder} previewRelPath={previewRelPath} />
        <div className="folder-front">
          <div className="folder-label">
            <div className="name">{folder.name}</div>
            <div className="details">
              {count} {count === 1 ? 'file' : 'files'}
              {opened ? ' · open' : ''}
            </div>
          </div>
        </div>
        <div className="folder-sheet-hint">Grab a page ↗ · Click to preview</div>
      </div>
      {!folder.virtual ? (
        <div
          className="folder-grip"
          draggable
          tabIndex={0}
          role="button"
          aria-label={`Reorder ${folder.name}`}
          title="Drag to reorder collections"
          onDragStart={e => {
            e.dataTransfer.setData('application/x-folderdock-folder', folder.name)
            e.dataTransfer.effectAllowed = 'move'
            setDraggingFolder(folder.name)
          }}
          onDragEnd={() => setDraggingFolder(null)}
        >
          {ico('grip')}
        </div>
      ) : null}
      <div className="folder-actions">
        <button
          className={`folder-topbtn star-btn${folderStarred ? ' starred' : ''}`}
          onClick={e => {
            e.stopPropagation()
            useUI.getState().toggleStar(folder.name)
          }}
          aria-pressed={folderStarred}
          aria-label={folderStarred ? `Remove ${folder.name} from favorites` : `Add ${folder.name} to favorites`}
          title={folderStarred ? 'Remove from favorites' : 'Add to favorites'}
        >
          {ico('star')}
        </button>
        <button
          className="folder-topbtn"
          onClick={e => {
            e.stopPropagation()
            void createNoteOp(folder.name)
          }}
          aria-label={`New note in ${folder.name}`}
          title="New note"
          hidden={folder.virtual}
        >
          {ico('plus')}
        </button>
        <button
          className="folder-topbtn"
          onClick={e => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            openMenu({ kind: 'folder', folder: folder.name, x: r.left, y: r.bottom + 4 })
          }}
          aria-label={`Options for ${folder.name}`}
          title="Collection options"
        >
          {ico('more')}
        </button>
      </div>
      <div className="folder-inside">
        <div className="inside-heading">
          <span className="inside-title">INSIDE FOLDER</span>
          <div className="inside-tools">
            <button
              className="inside-tool"
              onClick={() => void createNoteOp(folder.name)}
              title="New Markdown note"
              hidden={folder.virtual}
            >
              {ico('note')}
            </button>
            <button
              className="inside-tool"
              onClick={() => void chooseImportOp(folder.name)}
              title="Import from Windows"
            >
              {ico('upload')}
            </button>
          </div>
        </div>
        <div className="file-list">
          {folder.shown.length ? (
            folder.shown.map(file => (
              <FileRow key={file.relPath} file={file} selected={previewRelPath === file.relPath} />
            ))
          ) : (
            <div className="file-empty">No matching files yet.</div>
          )}
        </div>
        <div className="drop-hint">
          {ico('upload')} Drop files here · Or drag a page out
        </div>
      </div>
    </article>
  )
}

function SheetStack({ folder, previewRelPath }: { folder: DisplayFolder; previewRelPath: string | null }) {
  const files = folder.shown.slice(0, 3)
  const n = files.length
  if (!n) {
    return (
      <div className="sheet s3 empty-sheet" aria-hidden="true">
        <div className="mini-badge">EMPTY FOLDER</div>
        <span className="rule" />
        <span className="rule" />
      </div>
    )
  }
  const slots = ['s3', 's2', 's1']
  return (
    <>
      {files.map((file, i) => (
        <PaperSheet
          key={file.relPath}
          file={file}
          folderName={folder.name}
          slot={slots[n - 1 - i] as string}
          selected={previewRelPath === file.relPath}
        />
      ))}
    </>
  )
}

function makeVars(art: { art: string; tab: string }): React.CSSProperties {
  return { '--art': art.art, '--tab': art.tab } as React.CSSProperties
}
