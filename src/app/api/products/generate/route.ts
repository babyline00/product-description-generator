import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTonePreset } from '@/lib/preset-resolver'
import { generateForProduct } from '@/lib/generate'

/**
 * POST /api/products/generate
 *   body: { productId: string, tonePresetId?: string, generateVariants?: boolean }
 *
 * Generates a description (and optionally 2 variants) for a single product,
 * persists the result, and returns the updated product.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { productId, tonePresetId, generateVariants } = body ?? {}
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  try {
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'product not found' }, { status: 404 })
    }
    let preset
    try {
      preset = await resolveTonePreset(tonePresetId)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 })
    }
    const result = await generateForProduct(
      {
        name: product.name,
        brand: product.brand,
        category: product.category,
        features: product.features,
        specs: product.specs,
        price: product.price,
        currentDescription: product.currentDescription,
      },
      preset,
      { generateVariants: !!generateVariants },
    )
    const updated = await db.product.update({
      where: { id: product.id },
      data: {
        generatedDescription: result.generatedDescription,
        variantA: result.variantA,
        variantB: result.variantB,
        keywords: result.keywords.join(', '),
        tonePreset: preset.name,
        status: 'generated',
      },
    })
    return NextResponse.json({ product: updated })
  } catch (e) {
    return NextResponse.json(
      { error: 'generation failed: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
