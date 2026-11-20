import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/products?status=&category=&q=
 *   - status:   filter by status (pending | generated | error)
 *   - category: filter by category (case-insensitive contains)
 *   - q:        free-text search across name + sku + brand (case-insensitive)
 *   returns: Product[]
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const status = url.searchParams.get('status') || undefined
  const category = url.searchParams.get('category') || undefined
  const q = url.searchParams.get('q') || undefined

  try {
    const where: any = {}
    if (status) where.status = status
    if (category) where.category = { contains: category }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { brand: { contains: q } },
      ]
    }
    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ products })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
