import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/stats -> { products, generated, pending, batchJobs }
 *
 * If the database is unreachable (e.g. db:push hasn't been run), returns
 * zeros so the UI still renders a useful dashboard.
 */
export async function GET() {
  try {
    const [products, generated, pending, batchJobs] = await Promise.all([
      db.product.count(),
      db.product.count({ where: { status: 'generated' } }),
      db.product.count({ where: { status: 'pending' } }),
      db.batchJob.count(),
    ])
    return NextResponse.json({ products, generated, pending, batchJobs })
  } catch (e) {
    return NextResponse.json(
      { products: 0, generated: 0, pending: 0, batchJobs: 0, error: (e as Error).message },
      { status: 200 },
    )
  }
}
