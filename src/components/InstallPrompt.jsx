// build-plan §9, first row of the traps table: "iOS Safari evicts IndexedDB
// after ~7 days unused → prompt to install to home screen on first run."
//
// This is a data-durability feature, not polish. An uninstalled PWA on iOS
// can have its local database cleared out from under it, and until sync is
// fully configured that database is the only copy.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import Button from './Button'
import Icon from './Icon'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallPrompt() {
  // Chrome/Android hands us the real install event; iOS Safari has no such
  // API, so there we fall back to telling the user which buttons to press.
  const [deferred, setDeferred] = useState(null)
  // db.meta.get() resolves to undefined for a missing key — the same value
  // useLiveQuery returns mid-read. Coerced, or the guard below is always true
  // and the prompt never appears at all.
  const dismissed = useLiveQuery(
    async () => (await db.meta.get('install_prompt_dismissed')) ?? null,
    [],
  )

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault() // stop Chrome's own mini-infobar; we choose the moment
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (isStandalone() || dismissed === undefined || dismissed?.value) return null
  if (!deferred && !isIOS()) return null // desktop Chrome pre-event, or a browser that can't install

  const dismiss = () => db.meta.put({ key: 'install_prompt_dismissed', value: true })

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  return (
    <div className="panel install-prompt">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p className="label">Install to home screen</p>
          <p className="install-copy">
            {isIOS()
              ? 'Tap Share, then "Add to Home Screen". iOS clears an uninstalled web app\'s data after about a week — installing keeps your log safe.'
              : 'Runs full screen and keeps your log safe even offline.'}
          </p>
        </div>
        <button className="btn btn-ghost pressable" style={{ minHeight: 32, padding: 4 }} onClick={dismiss} aria-label="dismiss">
          <Icon name="close" size={16} />
        </button>
      </div>
      {isIOS() ? (
        <p className="install-ios"><Icon name="share" size={15} /> Share → Add to Home Screen</p>
      ) : (
        <Button className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={install}>Install</Button>
      )}
    </div>
  )
}
