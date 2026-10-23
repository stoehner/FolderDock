import { useEffect, useState } from 'react'
import { api, call, errText, formatSize } from '../../lib/api'
import { ico } from '../../lib/icons'
import { useUI } from '../../state/ui'
import type { BackupEntry } from '../../../../shared/types'
import { Head, Foot } from './kit'

export function BackupsModal() {
  const [entries, setEntries] = useState<BackupEntry[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stale = false
    void call(api.listBackups())
      .then(list => {
        if (!stale) {
          setEntries(list)
          setError('')
        }
      })
      .catch(e => {
        if (!stale) {
          setEntries(null)
          setError(errText(e))
        }
      })
    return () => {
      stale = true
    }
  }, [])

  async function reload(): Promise<void> {
    try {
      const list = await call(api.listBackups())
      setEntries(list)
      setError('')
    } catch (e) {
      setEntries(null)
      setError(errText(e))
    }
  }

  async function backupNow(): Promise<void> {
    setBusy(true)
    try {
      const r = await call(api.backupLibrary())
      useUI.getState().notify(`Backed up ${r.files} file${r.files === 1 ? '' : 's'} to ${r.destination}`)
      await reload()
    } catch (e) {
      useUI.getState().notify(errText(e), 'error')
    }
    setBusy(false)
  }

  function promptDelete(entry: BackupEntry): void {
    useUI.getState().openModal({
      type: 'confirm',
      title: 'Delete backup?',
      subtitle: entry.name,
      description: 'The whole backup folder is moved to the Windows Recycle Bin. You can restore it there if needed.',
      confirmLabel: 'Move to Recycle Bin',
      onConfirm: async () => {
        try {
          await call(api.deleteBackup(entry.name))
          useUI.getState().notify(`Backup "${entry.name}" moved to the Recycle Bin`)
        } catch (e) {
          useUI.getState().notify(errText(e), 'error')
        }
        useUI.getState().openModal({ type: 'backups' })
      }
    })
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Backups">
      <Head
        icon="folder"
        title="Backups"
        sub="Timestamped copies of your whole library at the backup location."
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="settings-row">
          <div style={{ minWidth: 0 }}>
            <div className="settings-label">New backup</div>
            <div className="settings-sub">Copies every file in the library into a fresh timestamped folder.</div>
          </div>
          <button className="primary-button" disabled={busy} onClick={() => void backupNow()}>
            {ico('upload')}Back up now
          </button>
        </div>
        {error ? <div className="helper">{error}</div> : null}
        {!error && entries === null ? <div className="helper">Loading backups…</div> : null}
        {entries && entries.length === 0 ? (
          <div className="helper">No backups yet — the list fills in as you back up.</div>
        ) : null}
        {entries?.map(entry => (
          <div className="settings-row" key={entry.name}>
            <div style={{ minWidth: 0 }}>
              <div className="settings-label">{entry.name}</div>
              <div className="settings-sub">
                {new Date(entry.createdAtMs).toLocaleString()} · {entry.fileCount} file
                {entry.fileCount === 1 ? '' : 's'} · {formatSize(entry.sizeBytes)}
              </div>
            </div>
            <button className="secondary-button danger-button" onClick={() => promptDelete(entry)}>
              Delete…
            </button>
          </div>
        ))}
      </div>
      <Foot>
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Done
        </button>
      </Foot>
    </section>
  )
}
