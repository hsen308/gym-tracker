import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import { downloadExport, importAll, readFileAsJson } from '../../db/export'
import { useAuth } from '../../app/AuthProvider'
import { useSync } from '../../app/SyncProvider'
import Button from '../../components/Button'
import Toast from '../../components/Toast'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const sync = useSync()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const syncErrors = useLiveQuery(() => db.sync_errors.orderBy('failed_at').reverse().toArray(), []) ?? []

  const handleExport = async () => {
    await downloadExport()
    setToast('Export downloaded.')
  }

  const handleImportClick = () => fileInput.current?.click()

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setBusy(true)
    try {
      const payload = await readFileAsJson(file)
      await importAll(payload)
      setToast('Import complete.')
    } catch (err) {
      setToast(`Import failed — ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const dismissError = (id) => db.sync_errors.delete(id)

  return (
    <div className="container settings-screen">
      <header className="row today-header">
        <button className="btn btn-ghost pressable" onClick={() => navigate(-1)} aria-label="back">←</button>
        <span className="stepper-label">Settings</span>
        <span />
      </header>

      <section className="card settings-section">
        <h2 className="section-label">Account</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>{user?.email}</p>
        <Button variant="secondary" className="btn-block" onClick={signOut}>Sign out</Button>
      </section>

      <section className="card settings-section">
        <h2 className="section-label">Sync</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
          {sync?.pending ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to upload.` : 'Everything is synced.'}
        </p>
        <Button variant="secondary" className="btn-block" onClick={sync?.syncNow} disabled={sync?.syncing}>
          {sync?.syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </section>

      {syncErrors.length > 0 && (
        <section className="card settings-section">
          <h2 className="section-label" style={{ color: 'var(--danger)' }}>Sync errors</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            These changes failed to upload 5 times and were set aside so they don't block everything else. Your data is still safe on this phone.
          </p>
          <div className="stack-2">
            {syncErrors.map((e) => (
              <div key={e.id} className="sync-error-row">
                <div>
                  <div className="mono" style={{ fontSize: 13 }}>{e.table_name}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{e.message}</div>
                </div>
                <button className="btn btn-ghost pressable" onClick={() => dismissError(e.id)} aria-label="dismiss">✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card settings-section">
        <h2 className="section-label">Backup</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
          Full export of every session, set, and body log — the insurance policy behind sync. iOS can quietly wipe an
          unopened PWA's local data after about a week, so keep a recent export somewhere safe.
        </p>
        <div className="stack-2">
          <Button variant="secondary" className="btn-block" onClick={handleExport}>Export data (.json)</Button>
          <Button variant="secondary" className="btn-block" onClick={handleImportClick} disabled={busy}>
            {busy ? 'Importing…' : 'Import from file'}
          </Button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
      </section>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
