import { createClient } from '@supabase/supabase-js'

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-2.5-flash-lite',
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

const prompts = {
  food_estimate: (foods) => `Estimate daily calories and macros from this food log. Treat every quantity as an estimate, avoid false precision, and mention any refined flour, added sugar, sweetened drinks, or very sweet fruit in the glucose note when relevant. The user is following clinician advice to limit those foods. Do not diagnose, prescribe medication, or claim that a food caused a health flare.\n\nFood log:\n${foods}\n\nReturn only JSON: {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "is_high_glucose": boolean, "glucose_warning": string}.`,
  exercise_swap: ({ exerciseName, painArea }) => `Suggest three conservative gym substitutions for ${exerciseName} when ${painArea} is painful. Preserve the target muscle when practical. Explain why each option may reduce local stress and include one setup cue. This is not medical clearance: do not diagnose or prescribe. Include a brief caution to stop if pain is sharp, worsening, or unusual.\n\nReturn only JSON: {"swaps":[{"name":string,"why_safe":string,"setup_cue":string}],"caution":string}.`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  if (!GEMINI_API_KEY || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'AI is not configured yet.' })
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in to use AI.' })

  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Your session has expired. Sign in again.' })

  const { task, input } = req.body ?? {}
  if (!prompts[task]) return res.status(400).json({ error: 'Unsupported AI request.' })
  if (task === 'food_estimate' && (typeof input !== 'string' || !input.trim() || input.length > 6000)) {
    return res.status(400).json({ error: 'Add a shorter food description first.' })
  }
  if (task === 'exercise_swap' && (!input?.exerciseName || !input?.painArea)) {
    return res.status(400).json({ error: 'Choose an exercise and pain area first.' })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompts[task](input) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    return res.status(response.status).json({ error: error.error?.message || 'AI request failed.' })
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return res.status(502).json({ error: 'AI returned no result.' })

  try {
    return res.status(200).json(JSON.parse(text))
  } catch {
    return res.status(502).json({ error: 'AI returned an invalid result.' })
  }
}