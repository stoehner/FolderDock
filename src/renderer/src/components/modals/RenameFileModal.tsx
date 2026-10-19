import { useEffect, useRef, useState } from 'react'
import { useUI } from '../../state/ui'
import { renameFileOp } from '../../lib/ops'
import { Head, Foot } from './kit'

export function RenameFileModal({ relPath }: { relPath: string }) {
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
