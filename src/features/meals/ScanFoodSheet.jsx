import { lazy, Suspense, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import StepperRow from '../../components/StepperRow'
import { lookupBarcode, scaleMacros } from '../../lib/openfoodfacts'

// Lazy: the decoder is ~300 KB and most sessions never open the scanner.
const BarcodeScanner = lazy(() => import('./BarcodeScanner'))

// Scan → confirm the portion → log. The middle step is the important one:
// Open Food Facts gives macros per 100 g, and almost nobody eats exactly
// 100 g of anything, so logging the raw figure would overstate every entry.
export default function ScanFoodSheet({ open, onClose, onLog }) {
  const [stage, setStage] = useState('scan') // scan | loading | found
  const [product, setProduct] = useState(null)
  const [grams, setGrams] = useState(100)
  const [error, setError] = useState('')

  const reset = () => { setStage('scan'); setProduct(null); setError(''); setGrams(100) }
  const close = () => { reset(); onClose() }

  const handleDetected = async (code) => {
    setStage('loading')
    setError('')
    try {
      const p = await lookupBarcode(code)
      setProduct(p)
      // Default to the labelled serving when there is one — "1 serving" is
      // what people actually eat, and 100 g is only a coincidence.
      setGrams(p.servingGrams && p.servingGrams > 0 ? Math.round(p.servingGrams) : 100)
      setStage('found')
    } catch (err) {
      setError(err.message)
      setStage('scan')
    }
  }

  const macros = product ? scaleMacros(product.per100, grams) : null

  return (
    <Sheet open={open} onClose={close}>
      {stage !== 'found' && (
        <>
          <h2 className="sheet-title">Scan a barcode</h2>
          <p className="sheet-sub">
            Packaged food only — Open Food Facts won't know what's in your mother's cooking.
            Use the whole-day estimate for that.
          </p>
          {error && <p className="form-error" style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>{error}</p>}
          {stage === 'loading' ? (
            <p className="empty" style={{ padding: 'var(--space-6) 0' }}>Looking it up…</p>
          ) : (
            <Suspense fallback={<p className="empty" style={{ padding: 'var(--space-6) 0' }}>Loading scanner…</p>}>
              <BarcodeScanner onDetected={handleDetected} onCancel={close} />
            </Suspense>
          )}
        </>
      )}

      {stage === 'found' && product && (
        <>
          <h2 className="sheet-title">{product.name}</h2>
          <p className="sheet-sub">
            {product.per100.calories} kcal per 100g
            {product.quantity ? ` · pack ${product.quantity}` : ''}
          </p>

          <StepperRow
            label="How much" hint={product.servingLabel ? `label says ${product.servingLabel}` : 'grams'}
            value={grams} onChange={setGrams}
            step={10} longPressStep={50} min={0} max={2000}
            format={(n) => `${n} g`}
          />

          <div className="panel" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <p className="label">That portion</p>
            <p className="estimate-macros" style={{ color: 'var(--text)' }}>
              {macros.calories} kcal · {macros.protein_g}p · {macros.carbs_g}c · {macros.fat_g}f
            </p>
          </div>

          <Button
            className="btn-block" style={{ marginTop: 'var(--space-5)' }}
            onClick={() => { onLog({ name: `${product.name} (${grams}g)`, ...macros }); close() }}
          >
            Log it
          </Button>
          <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-2)' }} onClick={reset}>
            Scan something else
          </Button>
        </>
      )}
    </Sheet>
  )
}
