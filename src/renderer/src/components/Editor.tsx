import { useEffect, useRef } from 'react'
import { ico } from '../lib/icons'
import { useUI } from '../state/ui'
import { overwriteEditorOp, reloadEditorOp, requestCloseEditor, saveEditorOp } from '../lib/ops'
import { renderMarkdown } from '../lib/markdown'
export function EditorModal() {
  const editor = useUI(s => s.editor)
  const setEditorContent = useUI(s => s.setEditorContent)
  const setEditorName = useUI(s => s.setEditorName)
  const setEditorTab = useUI(s => s.setEditorTab)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  if (!editor) return null
  const ed = editor
  const isMarkdown = ed.name.toLowerCase().endsWith('.md') || ed.name.toLowerCase().endsWith('.markdown')
  const dirty = ed.content !== ed.savedContent

  async function save(): Promise<void> {
    const outcome = await saveEditorOp()
    if (outcome === 'conflict') {
      useUI.getState().openModal({
        type: 'confirm',
        title: 'File changed on disk',
        subtitle: ed.name,
        description:
          'This file was modified by another program after you opened it. Overwriting replaces the on-disk version with your edits. If you want their version instead, use “Reload from disk”. Overwrite only if you are sure.',
        confirmLabel: 'Overwrite anyway',
        onConfirm: () => overwriteEditorOp()
      })
    } else if (outcome === 'saved') {
      useUI.getState().closeEditor()
    }
  }

  return (
    <section className="modal editor-modal" role="dialog" aria-modal="true" aria-label="Edit document">
      <div className="modal-head">
        <div className="modal-head-icon">{ico('note')}</div>
        <div>
          <strong>{dirty ? 'Edit document — unsaved changes' : 'Edit document'}</strong>
          <p>{editor.relPath}</p>
        </div>
        <button className="exit" onClick={requestCloseEditor} aria-label="Close editor">
          {ico('x')}
        </button>
      </div>
      <div className="modal-content">
        <label className="field-label" htmlFor="editorFilename">
          Filename
        </label>
        <input
          id="editorFilename"
          ref={nameRef}
          className="field editor-name"
          maxLength={150}
          value={editor.name}
          onChange={e => setEditorName(e.target.value)}
        />
        {isMarkdown ? (
          <div className="editor-tabs">
            <button className={`editor-tab${editor.tab !== 'preview' ? ' active' : ''}`} onClick={() => setEditorTab('edit')}>
              Edit
            </button>
            <button className={`editor-tab${editor.tab === 'preview' ? ' active' : ''}`} onClick={() => setEditorTab('preview')}>
              Preview
            </button>
          </div>
        ) : null}
        {isMarkdown && editor.tab === 'preview' ? (
          <div className="markdown-preview" style={{ height: 'auto', minHeight: 295 }}>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(editor.content) }} />
          </div>
        ) : (
          <textarea
            ref={taRef}
            className="editor-textarea"
            spellCheck={false}
            value={editor.content}
            onChange={e => setEditorContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const ta = e.currentTarget
                const start = ta.selectionStart
                const end = ta.selectionEnd
                const next = editor.content.slice(0, start) + '  ' + editor.content.slice(end)
                setEditorContent(next)
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = start + 2
                })
              }
            }}
          />
        )}
        <p className="helper">
          Saves write atomically to disk. <span className="kbd">Ctrl S</span> saves · <span className="kbd">Esc</span>{' '}
          closes
        </p>
      </div>
      <div className="modal-foot">
        <button className="secondary-button" onClick={() => void reloadEditorOp()}>
          Reload from disk
        </button>
        <button className="secondary-button" onClick={requestCloseEditor}>
          {dirty ? 'Discard' : 'Close'}
        </button>
        <button className="primary-button" onClick={() => void save()}>
          Save changes
        </button>
      </div>
    </section>
  )
}
