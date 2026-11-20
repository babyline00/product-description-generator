import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exportProductsCsv } from '@/lib/csv-exporter'

/**
 * POST /api/products/export-csv
 *   body: { productIds?: string[] }  // optional; omit to export all
 *   returns: text/csv with the new `generated_description` and `keywords` columns
 *
 * Response is a CSV string. The Content-Disposition header hints the browser
 * to download it as "products-with-descriptions.csv".
 */
export async function POST(req: NextRequest) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // allow empty body
  }
  const productIds: string[] | undefined = Array.isArray(body?.productIds)
    ? body.productIds
    : undefined

  try {
    const products = productIds
      ? await db.product.findMany({ where: { id: { in: productIds } } })
      : await db.product.findMany({ orderBy: { createdAt: 'desc' } })

    const csv = exportProductsCsv(
      products.map((p: any) => ({
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category: p.category,
        features: p.features,
        specs: p.specs,
        price: p.price,
        currentDescription: p.currentDescription,
        generatedDescription: p.generatedDescription,
        keywords: p.keywords,
      })),
    )
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="products-with-descriptions.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
