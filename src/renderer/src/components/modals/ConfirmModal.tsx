import { useState } from 'react'
import { useUI, type Modal } from '../../state/ui'
import { Head, Foot } from './kit'

export function ConfirmModal({ modal }: { modal: Extract<Modal, { type: 'confirm' }> }) {
  const [busy, setBusy] = useState(false)
  const cancel = (): void => {
    if (modal.onCancel) modal.onCancel()
    else useUI.getState().closeModal()
  }
  async function confirm() {
    if (busy) return
    setBusy(true)
    await modal.onConfirm()
    setBusy(false)
  }
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label={modal.title}>
      <Head icon="trash" title={modal.title} sub={modal.subtitle} onClose={cancel} />
      <div className="modal-content">
        <p className="helper">{modal.description}</p>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => void confirm()}>
          {modal.confirmLabel}
        </button>
      </Foot>
    </section>
  )
}
