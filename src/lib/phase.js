// Where you are in the program, and what that changes about today's session.
//
// Two overlapping schedules from the program:
//   Weeks 1–3  returning from 4 months off — ramp load and volume back up
//   Every 7th  deload — same exercises, half the sets, ~60% of the weight
//
// Both are pure functions of "how many weeks since you started", so the only
// state the app needs is a start date (meta.program_started_at, set on the
// first workout).
import { DELOAD_CYCLE_WEEKS } from './constants'

// Week 1 is the week you started, not the week after.
export function weeksSince(startDate, today = new Date()) {
  if (!startDate) return null
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  return Math.floor((today - start) / (7 * 86_400_000)) + 1
}

// The program's return protocol, verbatim:
//   1  ~55%  -1 set each        3-4 RIR
//   2  ~70%  -1 set compounds   2-3 RIR
//   3  ~85%  full               2 RIR
//   4+ normal
const RETURN_WEEKS = {
  1: { loadPct: 0.55, setDelta: -1, rir: '3–4', note: 'Returning — week 1. It should feel too easy.' },
  2: { loadPct: 0.70, setDelta: -1, rir: '2–3', note: 'Returning — week 2. Compounds still one set short.' },
  3: { loadPct: 0.85, setDelta: 0,  rir: '2',   note: 'Returning — week 3. Full volume, near-full load.' },
}

export function programPhase(startDate, today = new Date()) {
  const week = weeksSince(startDate, today)
  if (week == null || week < 1) return null

  // Deload takes precedence: it's "non-negotiable" in the program, and weeks
  // 1–3 can't collide with it anyway (the first deload is week 7).
  const isDeload = week % DELOAD_CYCLE_WEEKS === 0
  if (isDeload) {
    return {
      week,
      kind: 'deload',
      loadPct: 0.6,
      setMultiplier: 0.5,
      rir: '—',
      title: 'Deload week',
      note: 'Same exercises, half the sets, ~60% of the weight. No hard sets. This is what lets the next block work.',
    }
  }

  const ret = RETURN_WEEKS[week]
  if (ret) {
    return {
      week,
      kind: 'return',
      loadPct: ret.loadPct,
      setDelta: ret.setDelta,
      rir: ret.rir,
      title: `Return week ${week} of 3`,
      note: ret.note,
    }
  }

  return { week, kind: 'normal', loadPct: 1, rir: null, title: null, note: null }
}

// Target sets for today, after whichever adjustment is in force. Never drops
// below 1 — "half of one set" isn't a thing.
export function adjustedSets(targetSets, phase, isCompound = true) {
  if (!phase) return targetSets
  if (phase.kind === 'deload') return Math.max(1, Math.round(targetSets * phase.setMultiplier))
  if (phase.kind === 'return') {
    // Week 2 pulls a set from compounds only; week 1 pulls from everything.
    const applies = phase.week === 1 || isCompound
    return applies ? Math.max(1, targetSets + (phase.setDelta ?? 0)) : targetSets
  }
  return targetSets
}

// Suggested load for a reduced-intensity week, rounded to a loadable 2.5kg.
export function adjustedWeight(weightKg, phase) {
  if (!phase || !weightKg || phase.loadPct >= 1) return weightKg
  return Math.round((weightKg * phase.loadPct) / 2.5) * 2.5
}

// Target sets for a LIGHT session: the whole point is keeping the main lifts
// at full volume while everything else takes a small fraction of its sets, so
// the big session still gets done on a day it would otherwise be skipped.
// Never drops below 1. Same inputs as adjustedSets plus the strength-lift
// flag and the light flag, so it can layer onto the deload/return rules.
export function setsForSession(targetSets, phase, isCompound, isStrengthLift, isLight) {
  const base = adjustedSets(targetSets, phase, isCompound)
  if (!isLight || isStrengthLift) return base
  return Math.max(1, Math.ceil(base * 0.5))
}

// Weeks until the next deload — a countdown people actually plan around,
// unlike a bare "week 5 of 7".
export function weeksToDeload(week) {
  if (week == null) return null
  const into = week % DELOAD_CYCLE_WEEKS
  return into === 0 ? 0 : DELOAD_CYCLE_WEEKS - into
}
