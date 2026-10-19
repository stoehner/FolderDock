import { useEffect, useRef, useState } from 'react'
import { artStyles, ART_CYCLE } from '../../lib/art'
import { useUI } from '../../state/ui'
import { createFolderOp } from '../../lib/ops'
import { Head, Foot } from './kit'

export function NewFolderModal({ art }: { art: string }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(art)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  async function submit() {
    if (busy) return
    setBusy(true)
    const ok = await createFolderOp(name.trim(), selected)
    setBusy(false)
    if (ok) useUI.getState().closeModal()
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Create a collection">
      <Head icon="folder" title="Create a collection" sub="Adds a real folder inside your library." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <label className="field-label" htmlFor="folderName">
          Folder name
        </label>
        <input
          id="folderName"
          ref={inputRef}
          className="field"
          maxLength={60}
          placeholder="e.g. Favorite Prompts"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
        />
        <p className="helper">Pick an artwork style — it only changes how the folder looks in FolderDock.</p>
        <div className="colors">
          {ART_CYCLE.map(id => (
            <button
              key={id}
              className={`swatch${selected === id ? ' selected' : ''}`}
              style={{ background: artStyles[id]?.art }}
              onClick={() => setSelected(id)}
              title={id}
              aria-label={`Art style ${id}`}
            />
          ))}
        </div>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void submit()}>
          Create folder
        </button>
      </Foot>
    </section>
  )
}
