// What to actually hang on the bar. Small feature, but it removes real
// arithmetic from a moment when you're between sets and not thinking clearly.
//
// Only meaningful for barbell lifts — a machine's stack is just a pin.

export const BAR_KG = 20
// Typical commercial-gym set, heaviest first (greedy fill works because each
// plate is a multiple of the next — no pathological cases at 2.5kg resolution).
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]

// Returns the plates for ONE side, since that's how you load a bar.
// `null` means "can't express this exactly" — better to show nothing than a
// breakdown that doesn't add up.
export function platesPerSide(totalKg, barKg = BAR_KG) {
  if (totalKg == null || totalKg < barKg) return null
  let perSide = (totalKg - barKg) / 2
  if (perSide === 0) return []

  const out = []
  for (const p of PLATES) {
    while (perSide >= p - 1e-9) {
      out.push(p)
      perSide = Math.round((perSide - p) * 100) / 100
    }
  }
  return perSide > 1e-9 ? null : out
}

// "20 + 10 + 2.5" — compact enough to sit on one line next to the weight.
export function formatPlates(totalKg, barKg = BAR_KG) {
  const plates = platesPerSide(totalKg, barKg)
  if (plates == null) return null
  if (!plates.length) return 'bar only'
  return plates.map((p) => (p % 1 === 0 ? p : p.toFixed(2).replace(/0$/, ''))).join(' + ')
}
