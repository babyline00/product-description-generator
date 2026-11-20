import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/batch-jobs       — list all batch jobs, newest first
 * GET /api/batch-jobs/[id]  — single batch job
 */

export async function GET() {
  try {
    const jobs = await db.batchJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ jobs })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}

// Named export for the single-job route is provided by
// src/app/api/batch-jobs/[id]/route.ts (same file pattern).
