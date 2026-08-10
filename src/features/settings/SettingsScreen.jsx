import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDeleteRow } from '../../db/dexie'
import { retrySyncErrors } from '../../db/sync'
import Sheet from '../../components/Sheet'
import { downloadExport, importAll, readFileAsJson } from '../../db/export'
import { useAuth } from '../../app/AuthProvider'
import { useSync } from '../../app/SyncProvider'
import { useProfile } from '../../app/ProfileProvider'
import { useProgramStart, startDateForWeek } from '../../lib/useProgramStart'
import { programPhase } from '../../lib/phase'
import { DELOAD_CYCLE_WEEKS } from '../../lib/constants'
import StepperRow from '../../components/StepperRow'
import { pushSupported, pushConfigured, isStandalone, currentSubscription, subscribe, unsubscribe, sendTestNotification } from '../../lib/push'
import Button from '../../components/Button'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const sync = useSync()
  const fileInput = useRef(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const { profile, save: saveProfile } = useProfile()
  const programStart = useProgramStart()
  const phase = programPhase(programStart)
  // Seeded from the computed week, then edited freely — showing a stepper
  // that snaps back to the derived value on every render would be unusable.
  const [weekDraft, setWeekDraft] = useState(null)
  useEffect(() => {
    if (weekDraft === null && phase?.week) setWeekDraft(phase.week)
  }, [phase?.week, weekDraft])

  const saveWeek = async () => {
    await saveProfile({ program_start_date: startDateForWeek(weekDraft) })
    setToast(`Now on week ${weekDraft}.`)
  }

  // Checked once at mount rather than watched: permission and install state
  // only change via a browser dialog, which reloads or backgrounds the page.
  const pushOk = { supported: pushSupported() && pushConfigured(), standalone: isStandalone() }
  const [pushOn, setPushOn] = useState(false)
  useEffect(() => {
    currentSubscription().then((s) => setPushOn(!!s)).catch(() => {})
  }, [])

  const togglePush = async () => {
    setBusy(true)
    try {
      if (pushOn) {
        await unsubscribe()
        setPushOn(false)
        setToast('Reminders off.')
      } else {
        await subscribe(user.id)
        setPushOn(true)
        setToast('Reminders on for this device.')
      }
    } catch (err) {
      setToast(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Soft-delete rather than a hard wipe: rows keep their id with deleted_at
  // set, so the deletion itself has something to push. Hard-deleting locally
  // would leave the cloud copy alive and sync would pull it straight back.
  const doReset = async () => {
    const now = new Date().toISOString()
    for (const table of ['sets', 'workouts', 'workout_exercises']) {
      const rows = await db[table].filter((r) => !r.deleted_at).toArray()
      for (const row of rows) await softDeleteRow(table, row.id)
    }
    // Week counting falls back to the earliest workout; with none left, an
    // explicit start date would keep the count frozen on a block that no
    // longer has any sessions in it.
    await db.meta.delete('program_started_at') // legacy key from before this moved to the profile
    await saveProfile({ program_start_date: null })
    setWeekDraft(1)
    setResetOpen(false)
    setConfirmText('')
    setToast('All logged sessions cleared.')
  }

  const syncErrors = useLiveQuery(() => db.sync_errors.orderBy('failed_at').reverse().toArray(), []) ?? []
  // Eight identical "missing column" rows say one thing, not eight — used to
  // pick wording that points at the actual fix.
  const distinctErrors = new Set(syncErrors.map((e) => e.message))

  const handleRetry = async () => {
    setBusy(true)
    try {
      const n = await retrySyncErrors()
      await sync?.syncNow?.()
      const left = await db.sync_errors.count()
      setToast(left === 0 ? `${n} item${n === 1 ? '' : 's'} uploaded.` : `${left} still failing — is the schema updated?`)
    } finally {
      setBusy(false)
    }
  }
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
            <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
              {distinctErrors.size === 1 && [...distinctErrors][0].includes('column')
                ? "The cloud database is missing a column these rows need — run the latest schema file in Supabase, then retry. Nothing is lost; it's all still on this phone."
                : "These failed to upload five times and were set aside so they don't block everything behind them. Your data is still safe on this phone."}
            </p>
            {/* Retrying is the whole point of showing these. Parked rows are
                no longer in the outbox, so fixing the cause upstream does
                nothing on its own — they need putting back in the queue. */}
            <Button variant="secondary" className="btn-block" style={{ marginBottom: 'var(--space-4)' }} onClick={handleRetry} disabled={busy}>
              Retry {syncErrors.length} item{syncErrors.length === 1 ? '' : 's'}
            </Button>
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
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Reminders</p>
          {!pushOk.supported ? (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
              This browser can't do notifications.
            </p>
          ) : !pushOk.standalone ? (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
              Add the app to your Home Screen first — iOS only allows notifications for installed
              web apps, not for pages open in Safari.
            </p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.55 }}>
                {pushOn
                  ? "One nudge a day, and only when it's warranted — nothing if you already trained."
                  : 'A daily nudge if you haven\'t trained, and a reminder for the routine on rest days. Reaches you with the app closed.'}
              </p>
              <div className="stack-2">
                <Button variant={pushOn ? 'secondary' : 'primary'} className="btn-block" disabled={busy} onClick={togglePush}>
                  <Icon name="bell" size={18} /> {pushOn ? 'Turn reminders off' : 'Turn reminders on'}
                </Button>
                {pushOn && (
                  <Button variant="secondary" className="btn-block" onClick={() => sendTestNotification()}>
                    Send a test notification
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Creatine</p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.55 }}>
            {profile.creatine_started_on
              ? 'Started ' + format(parseISO(profile.creatine_started_on), 'd MMMM') +
                '. For about four weeks it pulls water into muscle, so the scale reads high and the trend is paused rather than reported wrongly.'
              : 'If you\'ve started taking it, say when. It adds 1–2 kg of muscle water over the first weeks — enough to hide real fat loss and make the app tell you a deficit isn\'t working.'}
          </p>
          {profile.creatine_started_on ? (
            <Button variant="secondary" className="btn-block" onClick={() => saveProfile({ creatine_started_on: null })}>
              Not taking it
            </Button>
          ) : (
            <Button variant="secondary" className="btn-block" onClick={() => saveProfile({ creatine_started_on: todayLocalDate() })}>
              I started creatine
            </Button>
          )}
        </section>

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Programme week</p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.55 }}>
            {phase?.kind === 'deload'
              ? 'Deload week — half the sets, about 60% of the weight.'
              : phase?.kind === 'return'
                ? phase.note
                : `Week ${phase?.week ?? 1} of a ${DELOAD_CYCLE_WEEKS}-week block.`}
            {' '}Drives the load and set adjustments, and it syncs, so both devices agree.
          </p>
          <StepperRow
            label="Current week" hint={`deload every ${DELOAD_CYCLE_WEEKS}th`}
            value={weekDraft} onChange={setWeekDraft}
            step={1} min={1} max={52}
            format={(n) => `Week ${n}`}
          />
          {weekDraft !== (phase?.week ?? 1) && (
            <Button className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={saveWeek}>
              Set to week {weekDraft}
            </Button>
          )}
        </section>

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Training data</p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)', lineHeight: 1.55 }}>
            Deletes every logged session, set and pain reading. Your program, exercise library and
            meals stay. Export first if there's anything worth keeping — this can't be undone.
          </p>
          <Button variant="danger" className="btn-block" onClick={() => setResetOpen(true)}>
            Clear all logged sessions
          </Button>
        </section>

        <section className="panel set-block">
          <p className="label" style={{ marginBottom: 'var(--space-4)' }}>Account</p>
          <Button variant="secondary" className="btn-block" onClick={signOut}>Sign out</Button>
        </section>
      </div>

      {/* Typed confirmation, not a yes/no. This wipes training history that
          sync will then wipe on every other device too — worth making
          deliberate rather than one mis-tap away. */}
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)}>
        <h2 className="sheet-title">Clear all logged sessions?</h2>
        <p className="sheet-sub">
          Every session, set, warm-up and pain reading is deleted from this device and from the
          cloud on next sync. Your program and exercise library are untouched.
        </p>
        <label className="field">
          <span className="label">Type CLEAR to confirm</span>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" />
        </label>
        <Button
          variant="danger" className="btn-block" style={{ marginTop: 'var(--space-5)' }}
          disabled={confirmText.trim().toUpperCase() !== 'CLEAR'}
          onClick={doReset}
        >
          Delete everything logged
        </Button>
      </Sheet>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
