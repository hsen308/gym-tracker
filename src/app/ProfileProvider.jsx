// Everything that makes the app belong to ONE person, in one place.
//
// Macro targets, step and water goals, display units, which programme was
// seeded and whether the SI-joint material applies all used to be constants
// in the source. That was a reasonable call while there was exactly one user
// (build-plan §11 explicitly ruled out multi-user), but it meant a second
// account got someone else's calorie target and a daily routine for a joint
// problem they may not have.
import { createContext, useContext } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../db/dexie'
import { useAuth } from './AuthProvider'

const ProfileContext = createContext(null)

// Used before a profile exists, and as the floor under a partial one, so no
// screen ever has to guard against a missing field.
export const DEFAULT_PROFILE = {
  display_name: null,
  program_template: 'ppl_si_recomp',
  unit_weight: 'kg',
  unit_height: 'cm',
  goal: 'recomp',
  height_cm: null,
  target_weight_kg: null,
  calories: 2200,
  protein_g: 170,
  carbs_g: 220,
  fat_g: 70,
  steps_target: 9000,
  water_target_l: 3.2,
  has_si_joint: false,
  creatine_started_on: null,
  // null = fall back to the earliest logged workout. Set explicitly, it wins,
  // and because it's on the profile it agrees across devices.
  program_start_date: null,
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()

  // `.first()` resolves to undefined when nothing matches — the SAME value
  // useLiveQuery returns while the read is still in flight. Coerced to null
  // so the two states are actually distinguishable: undefined = loading,
  // null = loaded and this account has no profile.
  //
  // Without this, `loading` was permanently true for anyone without a
  // profile, the route guard rendered nothing, and login led to a white
  // screen with no error to explain it.
  const row = useLiveQuery(
    async () => {
      if (!user) return null
      return (await db.profiles.where('user_id').equals(user.id).first()) ?? null
    },
    [user?.id],
  )

  const save = async (patch) => {
    if (!user) return
    const now = new Date().toISOString()
    await upsertRow('profiles', {
      ...DEFAULT_PROFILE,
      ...row,
      id: row?.id ?? newId(),
      user_id: user.id,
      created_at: row?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
      ...patch,
    })
  }

  const value = {
    // `undefined` while the read is in flight, so the setup flow can tell
    // "no profile yet" apart from "not loaded yet" and avoid flashing the
    // wizard at someone who already has one.
    loading: user ? row === undefined : false,
    exists: !!row,
    profile: { ...DEFAULT_PROFILE, ...row },
    save,
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export const useProfile = () => useContext(ProfileContext) ?? { profile: DEFAULT_PROFILE, loading: false, exists: false, save: async () => {} }

// Convenience for the many components that only care about the unit.
export const useUnit = () => useProfile().profile.unit_weight
