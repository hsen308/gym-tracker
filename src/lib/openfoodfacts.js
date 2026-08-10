// Open Food Facts lookup — free, no API key, no account.
//
// Covers packaged food well and home cooking not at all, which is exactly the
// split this app needs: the day-estimate handles the shawarma, this handles
// the protein bar with a barcode on it.

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product'
// Requested explicitly so the response is a few hundred bytes instead of the
// full product record, which is enormous.
const FIELDS = [
  'product_name', 'brands', 'quantity', 'serving_size', 'serving_quantity',
  'nutriments', 'image_small_url', 'code',
].join(',')

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Everything is normalised to PER 100 G, because that's the only figure Open
// Food Facts reliably has. Serving sizes are frequently missing or in units
// nobody can weigh ("1 bar"), so portion maths happens in the UI against a
// number we can trust.
export async function lookupBarcode(code, { signal } = {}) {
  const clean = String(code).replace(/\D/g, '')
  if (clean.length < 6) throw new Error('That doesn\'t look like a barcode.')

  const res = await fetch(`${ENDPOINT}/${clean}.json?fields=${FIELDS}`, { signal })
  if (!res.ok) throw new Error('Could not reach Open Food Facts.')
  const json = await res.json()
  if (json.status !== 1 || !json.product) throw new Error('No product with that barcode.')

  const p = json.product
  const n = p.nutriments ?? {}

  const per100 = {
    calories: num(n['energy-kcal_100g']) ?? (num(n.energy_100g) != null ? Math.round(n.energy_100g / 4.184) : null),
    protein_g: num(n.proteins_100g),
    carbs_g: num(n.carbohydrates_100g),
    fat_g: num(n.fat_100g),
  }

  // A product with no calories is useless to us — better to say so than to
  // log a zero that quietly under-counts the day.
  if (per100.calories == null) throw new Error('That product has no nutrition data on Open Food Facts.')

  return {
    code: clean,
    name: [p.product_name, p.brands?.split(',')[0]?.trim()].filter(Boolean).join(' · ') || 'Unnamed product',
    quantity: p.quantity ?? null,
    servingGrams: num(p.serving_quantity),
    servingLabel: p.serving_size ?? null,
    image: p.image_small_url ?? null,
    per100: {
      calories: Math.round(per100.calories),
      protein_g: Math.round(per100.protein_g ?? 0),
      carbs_g: Math.round(per100.carbs_g ?? 0),
      fat_g: Math.round(per100.fat_g ?? 0),
    },
  }
}

export const scaleMacros = (per100, grams) => ({
  calories: Math.round((per100.calories * grams) / 100),
  protein_g: Math.round((per100.protein_g * grams) / 100),
  carbs_g: Math.round((per100.carbs_g * grams) / 100),
  fat_g: Math.round((per100.fat_g * grams) / 100),
})
