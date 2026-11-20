import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/batch-jobs/[id] — single batch job. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const job = await db.batchJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ job })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
