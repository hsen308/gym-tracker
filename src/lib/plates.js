// What to actually hang on the bar. Small feature, but it removes real
// arithmetic from a moment when you're between sets and not thinking clearly.
//
// Only meaningful for barbell lifts — a machine's stack is just a pin.
import { kgToLb, lbToKg } from './units'

// A metric gym and a North American one are genuinely different problems:
// different bar weight, different plate denominations. Doing the maths in kg
// and converting the answer would tell someone in Canada to load 11.3 kg.
const GYM = {
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
}

export const barWeightKg = (unit) => (unit === 'lb' ? lbToKg(GYM.lb.bar) : GYM.kg.bar)

// Returns the plates for ONE side, in the display unit, since that's how a
// bar is loaded. `null` means "can't express this exactly" — better to show
// nothing than a breakdown that doesn't add up.
export function platesPerSide(totalKg, unit = 'kg') {
  const { bar, plates } = GYM[unit === 'lb' ? 'lb' : 'kg']
  const total = unit === 'lb' ? kgToLb(totalKg) : totalKg
  if (total == null || total < bar - 0.01) return null

  let perSide = (total - bar) / 2
  if (perSide < 0.01) return []

  const out = []
  for (const p of plates) {
    while (perSide >= p - 1e-6) {
      out.push(p)
      perSide = Math.round((perSide - p) * 1000) / 1000
    }
  }
  // Tolerance rather than an exact zero: converting kg→lb rarely lands on a
  // clean plate total, and being 0.2 lb out is not worth hiding the answer.
  return perSide > 0.3 ? null : out
}

const fmt = (p) => (p % 1 === 0 ? String(p) : String(p))

// "45 + 25 + 10" — compact enough to sit on one line under the weight.
export function formatPlates(totalKg, unit = 'kg') {
  const plates = platesPerSide(totalKg, unit)
  if (plates == null) return null
  if (!plates.length) return 'bar only'
  return plates.map(fmt).join(' + ')
}
