import { useEffect, useRef, useState } from 'react'
import { isImageKind, isTextKind, kindForExt } from '../../../../shared/kinds'
import { fdfileUrl, formatSize, tailPath } from '../../lib/api'
import { ico } from '../../lib/icons'
import { useExcerpts } from '../../state/excerpts'
import { useLibrary } from '../../state/library'
import { useUI } from '../../state/ui'
import { copyTextOp, openExternalOp, promptDeleteFiles, revealOp } from '../../lib/ops'
import { renderMarkdown } from '../../lib/markdown'
import { PdfViewer } from '../PdfViewer'

type LoadState =
  | { status: 'loading' }
  | { status: 'text'; content: string; hadBom: boolean; binary: boolean }
  | { status: 'media' }
  | { status: 'pdf'; data: ArrayBuffer }
  | { status: 'gone' }
  | { status: 'error'; message: string }

export function PreviewModal() {
  const relPath = useUI(s => s.previewRelPath)
  const nonce = useUI(s => s.previewNonce)
  const closePreview = useUI(s => s.closePreview)
  const openEditor = useUI(s => s.openEditor)
  const snapshot = useLibrary(s => s.snapshot)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const fileMeta =
    relPath && snapshot ? snapshot.folders.flatMap(f => f.files).find(f2 => f2.relPath === relPath) : undefined
  const kind = fileMeta?.kind ?? kindForExt(relPath?.includes('.') ? relPath.slice(relPath.lastIndexOf('.')) : '')
  const meta = useExcerpts(s => (relPath ? s.metas[relPath] : undefined))
  useEffect(() => {
    if (relPath && isImageKind(kind)) useExcerpts.getState().ensureMeta(relPath)
  }, [relPath, kind])

  const openedAt = useRef(0)
  useEffect(() => {
    if (relPath) openedAt.current = Date.now()
  }, [relPath])

  useEffect(() => {
    const rp = relPath
    if (!rp) return
    let cancelled = false
    const load = async (): Promise<void> => {
      setState({ status: 'loading' })
      try {
        if (isTextKind(kind)) {
          const file = await callReadText(rp)
          if (cancelled) return
          setState({ status: 'text', content: file.content, hadBom: file.hadBom, binary: file.binary })
          return
        }
        if (kind === 'image') {
          if (cancelled) return
          setState({ status: 'media' })
          return
        }
        if (kind === 'pdf') {
          const data = await callReadBytes(rp)
          if (cancelled) return
          setState({ status: 'pdf', data })
          return
        }
        if (cancelled) return
        setState({ status: 'media' })
      } catch {
        if (!cancelled) setState({ status: 'gone' })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [relPath, nonce, kind])

  useEffect(() => {
    if (!relPath || !snapshot) return
    const exists = snapshot.folders.some(f => f.files.some(f2 => f2.relPath === relPath))
    if (!exists) {
      useUI.getState().closePreview()
      useUI.getState().notify('That file is no longer in the library.')
    }
  }, [snapshot, relPath])

  if (!relPath) return null

  const name = relPath.split('/').pop() ?? relPath
  const folder = relPath.includes('/') ? tailPath(relPath.split('/')[0] ?? '') : 'Unsorted'
  const root = snapshot?.root ?? ''

  const isInteractive = (e: React.MouseEvent): boolean =>
    Boolean((e.target as HTMLElement).closest('button, a, input, textarea'))

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target !== e.currentTarget) return
    if (relPath && !isInteractive(e) && Date.now() - openedAt.current <= 500) {
      void openEditor(relPath)
      return
    }
    closePreview()
  }

  const handlePanelClick = (e: React.MouseEvent): void => {
    if (relPath && !isInteractive(e) && Date.now() - openedAt.current <= 500) void openEditor(relPath)
  }

  return (
    <div className="modal-layer" onClick={handleBackdropClick}>
      <section
        className="modal preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${name}`}
        onClick={handlePanelClick}
      >
        <div className="preview-head">
          <div style={{ minWidth: 0 }}>
            <div className="preview-kicker">LIVE FILE PREVIEW</div>
            <div className="preview-title">{name}</div>
          </div>
          <button className="preview-close" onClick={closePreview} aria-label="Close file preview">
            {ico('x')}
          </button>
        </div>
        <div className="preview-info">
          <span className="preview-pill">{kind === 'other' ? 'FILE' : kind.toUpperCase()}</span>
          <span className="preview-pill">{meta ? formatSize(meta.size) : ''}</span>
          {meta?.width ? (
            <span className="preview-pill">
              {meta.width} × {meta.height}
            </span>
          ) : null}
          <span className="preview-pill">{folder}</span>
        </div>
        <div className="preview-body">
          {state.status === 'loading' ? <div className="preview-empty">Loading preview…</div> : null}
          {state.status === 'gone' ? <div className="preview-empty">The original file is unavailable on disk.</div> : null}
          {state.status === 'error' ? <div className="preview-empty">{state.message}</div> : null}
          {state.status === 'text' ? (
            state.binary ? (
              <div className="preview-empty">
                This file looks binary and can't be shown as text. Use “Open” to view it with its default app.
              </div>
            ) : kind === 'markdown' ? (
              <div className="markdown-preview">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(state.content) }} />
              </div>
            ) : (
              <div className="plain-preview">{state.content}</div>
            )
          ) : null}
          {state.status === 'media' && kind === 'image' ? (
            <img
              className="preview-image"
              alt={`Preview of ${name}`}
              src={fdfileUrl(root, relPath)}
              onError={() => setState({ status: 'gone' })}
            />
          ) : null}
          {state.status === 'pdf' ? <PdfViewer data={state.data} name={name} /> : null}
          {state.status === 'media' && kind !== 'image' ? (
            <div className="preview-empty">
              No inline preview for this file type. Use “Open” to view it with its default Windows app, or reveal it in
              Explorer.
            </div>
          ) : null}
        </div>
        <div className="preview-footer">
          {isTextKind(kind) ? (
            <>
              <button className="secondary-button" onClick={() => void copyTextOp(relPath)}>
                {ico('copy')}Copy
              </button>
              <button className="primary-button" onClick={() => void openEditor(relPath)}>
                {ico('note')}Edit
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={() => void openExternalOp(relPath)}>
              {ico('maximize')}Open
            </button>
          )}
          <button className="secondary-button" onClick={() => void revealOp(relPath)}>
            {ico('folder')}Reveal
          </button>
          <button
            className="secondary-button danger-button"
            onClick={() => promptDeleteFiles([relPath])}
          >
            {ico('trash')}Delete
          </button>
          <button className="secondary-button" onClick={closePreview}>
            {ico('x')}Close
          </button>
        </div>
      </section>
    </div>
  )
}

async function callReadText(relPath: string) {
  const file = await window.folderdock.readTextFile(relPath)
  if (!file.ok) throw new Error(file.error)
  return file.data
}
async function callReadBytes(relPath: string): Promise<ArrayBuffer> {
  const r = await window.folderdock.readBytes(relPath, 30 * 1024 * 1024)
  if (!r.ok) throw new Error(r.error)
  return r.data
}
