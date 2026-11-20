/**
 * Seed script — populates the TonePreset table with the five built-in
 * presets (idempotent: presets are matched by name and skipped if they
 * already exist). Run with `bun run src/lib/seed.ts` or `bun run seed`.
 *
 * Safe to run multiple times — it never deletes or overwrites existing
 * presets. New presets created through the API are preserved.
 */

import { db } from '@/lib/db'
import { BUILT_IN_PRESETS } from '@/lib/tone-presets'

async function main() {
  let created = 0
  for (const seed of BUILT_IN_PRESETS) {
    const existing = await db.tonePreset.findUnique({ where: { name: seed.name } })
    if (existing) continue
    await db.tonePreset.create({
      data: {
        name: seed.name,
        systemPrompt: seed.systemPrompt,
        example: seed.example,
      },
    })
    created++
  }
  console.log(`[seed] TonePresets: ${created} created, ${BUILT_IN_PRESETS.length - created} already existed.`)
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
