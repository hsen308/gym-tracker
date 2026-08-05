import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import { downloadExport, importAll, readFileAsJson } from '../../db/export'
import { useAuth } from '../../app/AuthProvider'
import { useSync } from '../../app/SyncProvider'
import Button from '../../components/Button'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const sync = useSync()
  const fileInput = useRef(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const syncErrors = useLiveQuery(() => db.sync_errors.orderBy('failed_at').reverse().toArray(), []) ?? []
  const counts = useLiveQuery(async () => ({
    workouts: await db.workouts.filter((w) => !w.deleted_at).count(),
    sets: await db.sets.filter((s) => !s.deleted_at).count(),
  }), [])

  const handleExport = async () => {
    await downloadExport()
    setToast('Export downloaded.')
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setBusy(true)
    try {
      await importAll(await readFileAsJson(file))
      setToast('Import complete.')
    } catch (err) {
      setToast(`Import failed — ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{user?.email}</p>
          <h1 className="readout screen-title">SETUP</h1>
        </div>
      </header>

      <div className="stack-3">
        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Sync</p>
          <p className="muted" style={{ fontSize: 14, marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
            {sync?.pending
              ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to upload.`
              : 'Everything is synced.'}
          </p>
          <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="label">Logged</span>
            <span className="mono" style={{ fontSize: 13 }}>{counts?.workouts ?? 0} sessions · {counts?.sets ?? 0} sets</span>
          </div>
          <Button variant="secondary" className="btn-block" onClick={sync?.syncNow} disabled={sync?.syncing}>
            {sync?.syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </section>

        {syncErrors.length > 0 && (
          <section className="panel set-block">
            <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Sync errors</p>
            <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
              These failed to upload five times and were set aside so they don't block everything behind them.
              Your data is still safe on this phone.
            </p>
            <div className="rule-list">
              {syncErrors.map((e) => (
                <div key={e.id} className="err-row">
                  <div style={{ minWidth: 0 }}>
                    <p className="mono" style={{ fontSize: 12 }}>{e.table_name}</p>
                    <p className="faint" style={{ fontSize: 12, lineHeight: 1.4 }}>{e.message}</p>
                  </div>
                  <button className="btn btn-ghost pressable" style={{ minHeight: 32, padding: 4 }} onClick={() => db.sync_errors.delete(e.id)} aria-label="dismiss error">
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Backup</p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.55 }}>
            Full export of every session, set and body log — the insurance policy behind sync. iOS can wipe an
            unopened PWA's local data after about a week, so keep a recent export somewhere safe.
          </p>
          <div className="stack-2">
            <Button variant="secondary" className="btn-block" onClick={handleExport}>
              <Icon name="download" size={18} /> Export .json
            </Button>
            <Button variant="secondary" className="btn-block" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Icon name="upload" size={18} /> {busy ? 'Importing…' : 'Import from file'}
            </Button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={handleImportFile} />
          </div>
        </section>

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-4)' }}>Account</p>
          <Button variant="danger" className="btn-block" onClick={signOut}>Sign out</Button>
        </section>
      </div>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
