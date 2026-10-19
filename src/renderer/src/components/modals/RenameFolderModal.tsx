import { useEffect, useRef, useState } from 'react'
import { useUI } from '../../state/ui'
import { renameFolderOp } from '../../lib/ops'
import { Head, Foot } from './kit'

export function RenameFolderModal({ folder }: { folder: string }) {
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
