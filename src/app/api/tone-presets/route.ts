import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BUILT_IN_PRESETS, type TonePresetSeed } from '@/lib/tone-presets'

/**
 * Auto-seed the TonePreset table with the 5 built-in presets if it's empty.
 * Called lazily by GET /api/tone-presets so the user never sees an empty
 * dropdown even on a fresh database.
 */
async function ensureSeeded(): Promise<void> {
  try {
    const count = await db.tonePreset.count()
    if (count > 0) return
    for (const seed of BUILT_IN_PRESETS as TonePresetSeed[]) {
      await db.tonePreset.create({
        data: {
          name: seed.name,
          systemPrompt: seed.systemPrompt,
          example: seed.example,
        },
      })
    }
  } catch (e) {
    // DB unavailable — caller will fall back to BUILT_IN_PRESETS.
  }
}

/**
 * GET /api/tone-presets -> TonePreset[]
 *   Falls back to the built-in presets if the DB is unreachable.
 */
export async function GET() {
  try {
    await ensureSeeded()
    const presets = await db.tonePreset.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ presets })
  } catch (e) {
    return NextResponse.json(
      { presets: BUILT_IN_PRESETS, fallback: true, error: (e as Error).message },
      { status: 200 },
    )
  }
}

/**
 * POST /api/tone-presets
 *   body: { name, systemPrompt, example }
 *   creates a custom preset. Rejects duplicate names.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { name, systemPrompt, example } = body ?? {}
  if (!name || !systemPrompt || !example) {
    return NextResponse.json(
      { error: 'name, systemPrompt, and example are required' },
      { status: 400 },
    )
  }
  try {
    const preset = await db.tonePreset.create({
      data: { name, systemPrompt, example },
    })
    return NextResponse.json({ preset }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
