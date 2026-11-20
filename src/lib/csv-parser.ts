/**
 * CSV parser for the product upload format.
 *
 * Expected columns (header row required, case-insensitive):
 *   sku, name, brand, category, features, specs, price, current_description
 *
 *   - features: semicolon-separated list of feature strings
 *     e.g. "RFID-blocking;6 card slots;full-grain leather"
 *   - specs:    semicolon-separated "key=value" pairs
 *     e.g. "material=leather;weight=68g;dimensions=11x9cm"
 *   - price:    float (optional). Empty -> null.
 *   - current_description, brand, category: optional. Empty -> null/undefined.
 *
 * Parsing rules:
 *   - RFC-4180-ish: fields may be quoted with double quotes; quotes inside a
 *     quoted field are escaped as `""`.
 *   - Newlines inside quoted fields are preserved.
 *   - A row with the wrong number of fields throws ParseError with the row
 *     number (1-indexed, header is row 1).
 *   - Missing optional fields are tolerated; missing required fields
 *     (sku, name) throw ParseError.
 *
 * Returns: ParsedProduct[] (NOT yet persisted).
 */

export interface ParsedProduct {
  sku: string
  name: string
  brand: string | null
  category: string | null
  features: string[]          // parsed from semicolon-separated input
  specs: Record<string, string> // parsed from key=value pairs
  price: number | null
  currentDescription: string | null
  // raw strings preserved for persistence (DB stores them as-is)
  featuresRaw: string
  specsRaw: string
}

export class ParseError extends Error {
  row: number
  constructor(row: number, message: string) {
    super(`Row ${row}: ${message}`)
    this.name = 'ParseError'
    this.row = row
  }
}

const REQUIRED_COLUMNS = ['sku', 'name'] as const
const ALL_COLUMNS = [
  'sku',
  'name',
  'brand',
  'category',
  'features',
  'specs',
  'price',
  'current_description',
] as const

type ColumnName = (typeof ALL_COLUMNS)[number]

/**
 * Split a CSV line into fields, honoring quoted fields with embedded commas,
 * newlines, and `""` escapes. Returns the list of fields. `cursor` lets us
 * parse multi-line records (a quoted field containing a newline continues
 * across physical input lines); the caller feeds successive physical lines
 * until the record completes.
 */
function parseCsvRecords(text: string): string[][] {
  // Normalize CRLF -> LF; keep LF as the row separator outside quoted fields.
  const normalized = text.replace(/\r\n?/g, '\n')
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  while (i < normalized.length) {
    const ch = normalized[i]
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  // Flush the last field/row if there's pending content (file ending without
  // a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    records.push(row)
  }
  return records
}

function normalizeHeader(raw: string[]): ColumnName[] {
  const lower = raw.map((h) => h.trim().toLowerCase())
  return lower.map((h) => {
    if ((ALL_COLUMNS as readonly string[]).includes(h)) return h as ColumnName
    throw new ParseError(1, `unknown column "${h}"`)
  })
}

function parseFeatures(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseSpecs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  for (const pair of raw.split(';')) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      // malformed pair — skip silently rather than throw, because the spec
      // asks the parser to be lenient on optional fields.
      continue
    }
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return out
}

function parsePrice(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function parseProductsCsv(text: string): ParsedProduct[] {
  if (!text || !text.trim()) {
    throw new ParseError(1, 'CSV is empty')
  }
  const records = parseCsvRecords(text)
  if (records.length === 0) throw new ParseError(1, 'CSV is empty')
  // Drop trailing empty record that some editors append (a final newline
  // produces an empty fields list — `[""]` after our flush logic).
  const cleaned = records.filter((r) => !(r.length === 1 && r[0] === ''))
  if (cleaned.length === 0) throw new ParseError(1, 'CSV has no rows')

  const header = normalizeHeader(cleaned[0])
  const headerIdx: Record<ColumnName, number> = {} as Record<ColumnName, number>
  header.forEach((col, idx) => {
    headerIdx[col] = idx
  })

  const out: ParsedProduct[] = []
  for (let r = 1; r < cleaned.length; r++) {
    const record = cleaned[r]
    // Allow fully empty trailing rows to be skipped.
    if (record.every((f) => f.trim() === '')) continue

    const rowNum = r + 1 // 1-indexed including header
    // Reject mismatched field counts — but tolerate the case where the
    // trailing columns are simply missing (pad with empty strings).
    if (record.length > header.length) {
      throw new ParseError(rowNum, `expected ${header.length} fields, got ${record.length}`)
    }
    const padded = record.concat(Array(header.length - record.length).fill(''))

    const get = (col: ColumnName): string => padded[headerIdx[col]] ?? ''

    const sku = get('sku').trim()
    const name = get('name').trim()
    if (!sku) throw new ParseError(rowNum, 'missing required field "sku"')
    if (!name) throw new ParseError(rowNum, 'missing required field "name"')

    const featuresRaw = get('features')
    const specsRaw = get('specs')

    out.push({
      sku,
      name,
      brand: optional(get('brand')),
      category: optional(get('category')),
      features: parseFeatures(featuresRaw),
      specs: parseSpecs(specsRaw),
      price: parsePrice(get('price')),
      currentDescription: optional(get('current_description')),
      featuresRaw,
      specsRaw,
    })
  }
  return out
}

function optional(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}
