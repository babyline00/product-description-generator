import { test, expect, describe } from 'bun:test'
import { exportProductsCsv, EXPORT_COLUMNS } from '../csv-exporter'

describe('exportProductsCsv', () => {
  test('header line matches EXPORT_COLUMNS', () => {
    const out = exportProductsCsv([])
    expect(out.split('\n')[0]).toBe(EXPORT_COLUMNS.join(','))
  })

  test('appends generated_description and keywords columns', () => {
    expect(EXPORT_COLUMNS).toContain('generated_description')
    expect(EXPORT_COLUMNS).toContain('keywords')
    expect(EXPORT_COLUMNS).toContain('current_description')
  })

  test('serializes a product row with the new description column', () => {
    const out = exportProductsCsv([
      {
        sku: 'WALLET-001',
        name: 'Florence Wallet',
        brand: 'Artigiano',
        category: 'Accessories',
        features: 'RFID-blocking;6 card slots',
        specs: 'material=leather;weight=68g',
        price: 49.99,
        currentDescription: null,
        generatedDescription: 'Premium wallet, handcrafted in Florence.',
        keywords: 'leather, wallet, florence, rfid, handcrafted',
      },
    ])
    const lines = out.trim().split('\n')
    expect(lines).toHaveLength(2)
    const row = lines[1]
    expect(row).toContain('WALLET-001')
    expect(row).toContain('Florence Wallet')
    expect(row).toContain('49.99')
    expect(row).toContain('Premium wallet, handcrafted in Florence.')
    expect(row).toContain('leather, wallet, florence, rfid, handcrafted')
  })

  test('quotes and escapes commas inside features', () => {
    const out = exportProductsCsv([
      {
        sku: 'A',
        name: 'Thing',
        features: 'has,comma;and"quote',
      },
    ])
    const row = out.trim().split('\n')[1]
    // The features field must be wrapped in quotes and the embedded quote doubled.
    expect(row).toContain('"has,comma;and""quote"')
  })

  test('null fields render as empty (no quotes)', () => {
    const out = exportProductsCsv([
      { sku: 'A', name: 'Thing', price: null, brand: null },
    ])
    const row = out.trim().split('\n')[1]
    // Empty cells render as consecutive commas — no spurious quotes.
    expect(row).not.toContain('""')
    expect(row).toContain('A,Thing')
  })

  test('emits a trailing newline', () => {
    const out = exportProductsCsv([{ sku: 'A', name: 'T' }])
    expect(out.endsWith('\n')).toBe(true)
  })

  test('multi-row order preserved', () => {
    const out = exportProductsCsv([
      { sku: 'A', name: 'A1' },
      { sku: 'B', name: 'B2' },
      { sku: 'C', name: 'C3' },
    ])
    const lines = out.trim().split('\n').slice(1) // drop header
    expect(lines.map((l) => l.split(',')[0])).toEqual(['A', 'B', 'C'])
  })
})
