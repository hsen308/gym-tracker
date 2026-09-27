import { supabase } from '../db/supabase'

async function callAi(task, input) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sign in to use the AI assistant.')

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task, input }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'AI request failed.')
  return data
}

export function estimateDayMacrosWithAi(foodText) {
  return callAi('food_estimate', foodText)
}

export function getAiExerciseSwaps(exerciseName, painArea) {
  return callAi('exercise_swap', { exerciseName, painArea })
}