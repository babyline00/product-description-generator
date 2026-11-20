import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseProductsCsv, ParseError } from '@/lib/csv-parser'

/**
 * POST /api/products/upload-csv
 *   multipart/form-data, field name "csv" -> the CSV file
 *   returns: { count, ids }
 */
export async function POST(req: NextRequest) {
  let text: string
  try {
    const form = await req.formData()
    const file = form.get('csv')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'missing "csv" file in form data' },
        { status: 400 },
      )
    }
    text = await file.text()
  } catch (e) {
    return NextResponse.json(
      { error: 'failed to read multipart body: ' + (e as Error).message },
      { status: 400 },
    )
  }

  let parsed
  try {
    parsed = parseProductsCsv(text)
  } catch (e) {
    const status = e instanceof ParseError ? 422 : 400
    return NextResponse.json(
      { error: (e as Error).message, row: e instanceof ParseError ? e.row : undefined },
      { status },
    )
  }
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'CSV contained no product rows' }, { status: 422 })
  }

  try {
    // Upsert by SKU so re-uploading the same file is idempotent.
    const ids: string[] = []
    for (const p of parsed) {
      const row = await db.product.upsert({
        where: { sku: p.sku },
        create: {
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          category: p.category,
          features: p.featuresRaw,
          specs: p.specsRaw,
          price: p.price,
          currentDescription: p.currentDescription,
        },
        update: {
          name: p.name,
          brand: p.brand,
          category: p.category,
          features: p.featuresRaw,
          specs: p.specsRaw,
          price: p.price,
          currentDescription: p.currentDescription,
        },
      })
      ids.push(row.id)
    }
    return NextResponse.json({ count: parsed.length, ids })
  } catch (e) {
    return NextResponse.json(
      { error: 'database error: ' + (e as Error).message },
      { status: 500 },
    )
  }
}
