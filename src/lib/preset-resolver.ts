/**
 * Resolves a tone preset from a request payload. Supports two forms:
 *   1. tonePresetId is a built-in preset NAME (premium/casual/technical/...)
 *      -> resolved from BUILT_IN_PRESETS (DB-free).
 *   2. tonePresetId is a database cuid -> resolved from the TonePreset table.
 *
 * If no id is provided, defaults to "premium".
 * Throws if the id cannot be resolved either way.
 */

import { db } from '@/lib/db'
import { BUILT_IN_PRESETS, findPresetByName, type TonePresetSeed } from '@/lib/tone-presets'

export interface TonePresetLike {
  name: string
  systemPrompt: string
  example: string
}

export async function resolveTonePreset(
  idOrName?: string | null,
): Promise<TonePresetLike> {
  if (!idOrName) return BUILT_IN_PRESETS[0] // default = premium
  // Built-in name?
  const builtIn = findPresetByName(idOrName)
  if (builtIn) return builtIn
  // Otherwise look up in the DB.
  try {
    const row = await db.tonePreset.findUnique({ where: { id: idOrName } })
    if (row) {
      return { name: row.name, systemPrompt: row.systemPrompt, example: row.example }
    }
    // Also try by name in the DB in case the user created a custom preset by name.
    const byName = await db.tonePreset.findUnique({ where: { name: idOrName } })
    if (byName) {
      return { name: byName.name, systemPrompt: byName.systemPrompt, example: byName.example }
    }
  } catch (e) {
    // DB unavailable — fall through to the not-found error.
  }
  throw new Error(`Tone preset "${idOrName}" not found`)
}
