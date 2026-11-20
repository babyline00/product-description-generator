import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET    /api/products/[id] — single product
 * PATCH  /api/products/[id] — partial update (name, brand, category, features, specs, price, currentDescription, generatedDescription)
 * DELETE /api/products/[id] — remove
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ product })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}

export async function PATCH(
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
  const allowed = [
    'name', 'brand', 'category', 'features', 'specs', 'price',
    'currentDescription', 'generatedDescription', 'variantA',
    'variantB', 'tonePreset', 'keywords', 'status',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }
  try {
    const product = await db.product.update({ where: { id }, data })
    return NextResponse.json({ product })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    await db.product.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
