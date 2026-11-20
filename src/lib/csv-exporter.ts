/**
 * CSV exporter — re-serializes products back into the upload CSV format,
 * with the new `generated_description` and `keywords` columns appended so
 * the export can be re-imported into Shopify/WooCommerce (or back into this
 * app for further editing).
 *
 * Output columns (in order):
 *   sku, name, brand, category, features, specs, price,
 *   current_description, generated_description, keywords
 *
 * Quoting rules (RFC-4180):
 *   - Any field containing `,`, `"`, or `\n` is wrapped in double quotes.
 *   - Double quotes inside a field are escaped as `""`.
 *
 * The exporter accepts the same Product shape that the Prisma client emits
 * (minus the Prisma wrapper), so it works on plain objects returned from
 * `db.product.findMany()` and on the in-memory representation used by tests.
 */

export interface ExportProduct {
  sku: string
  name: string
  brand?: string | null
  category?: string | null
  features?: string
  specs?: string
  price?: number | null
  currentDescription?: string | null
  generatedDescription?: string | null
  keywords?: string | null
}

export const EXPORT_COLUMNS = [
  'sku',
  'name',
  'brand',
  'category',
  'features',
  'specs',
  'price',
  'current_description',
  'generated_description',
  'keywords',
] as const

function quote(value: string): string {
  if (value === '' || value === null || value === undefined) return ''
  const needsQuotes = /[",\n\r]/.test(value)
  if (!needsQuotes) return value
  return '"' + value.replace(/"/g, '""') + '"'
}

function formatField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return quote(String(value))
}

export function exportProductsCsv(products: ExportProduct[]): string {
  const header = EXPORT_COLUMNS.join(',')
  const lines = [header]
  for (const p of products) {
    const row: string[] = [
      formatField(p.sku),
      formatField(p.name),
      formatField(p.brand ?? ''),
      formatField(p.category ?? ''),
      formatField(p.features ?? ''),
      formatField(p.specs ?? ''),
      // price: emit empty string for null/undefined so the column lines up;
      // numbers are stringified without quoting.
      p.price === null || p.price === undefined ? '' : String(p.price),
      formatField(p.currentDescription ?? ''),
      formatField(p.generatedDescription ?? ''),
      formatField(p.keywords ?? ''),
    ]
    lines.push(row.join(','))
  }
  return lines.join('\n') + '\n'
}
