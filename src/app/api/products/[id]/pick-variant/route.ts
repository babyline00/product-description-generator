import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/products/[id]/pick-variant
 *   body: { variant: 'a' | 'b' }
 *
 * Sets `generatedDescription` to the chosen variant's text.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { variant } = body ?? {}
  if (variant !== 'a' && variant !== 'b') {
    return NextResponse.json(
      { error: 'variant must be "a" or "b"' },
      { status: 400 },
    )
  }

  try {
    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'product not found' }, { status: 404 })
    }
    const text = variant === 'a' ? product.variantA : product.variantB
    if (!text) {
      return NextResponse.json(
        { error: `variant ${variant} has not been generated yet` },
        { status: 409 },
      )
    }
    const updated = await db.product.update({
      where: { id },
      data: { generatedDescription: text, status: 'generated' },
    })
    return NextResponse.json({ product: updated })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
