import { test, expect, describe } from 'bun:test'
import { parseProductsCsv, ParseError } from '../csv-parser'

describe('parseProductsCsv — standard CSV', () => {
  const CSV =
    'sku,name,brand,category,features,specs,price,current_description\n' +
    'WALLET-001,Florence Wallet,Artigiano,Accessories,RFID-blocking;6 card slots,material=leather;weight=68g,49.99,The everyday wallet.\n'

  test('parses a single product row', () => {
    const rows = parseProductsCsv(CSV)
    expect(rows).toHaveLength(1)
    const p = rows[0]
    expect(p.sku).toBe('WALLET-001')
    expect(p.name).toBe('Florence Wallet')
    expect(p.brand).toBe('Artigiano')
    expect(p.category).toBe('Accessories')
    expect(p.features).toEqual(['RFID-blocking', '6 card slots'])
    expect(p.specs).toEqual({ material: 'leather', weight: '68g' })
    expect(p.price).toBe(49.99)
    expect(p.currentDescription).toBe('The everyday wallet.')
  })

  test('header is case-insensitive', () => {
    const csv =
      'SKU,Name,Brand,Category,Features,Specs,Price,Current_Description\n' +
      'X-1,Thing,B,C,f1;s2,k=v,1.00,\n'
    const rows = parseProductsCsv(csv)
    expect(rows[0].sku).toBe('X-1')
    expect(rows[0].features).toEqual(['f1', 's2'])
    expect(rows[0].currentDescription).toBeNull()
  })

  test('features parse semicolon-separated values', () => {
    const csv =
      'sku,name,features\n' +
      'A,A,one;two;three\n'
    const rows = parseProductsCsv(csv)
    expect(rows[0].features).toEqual(['one', 'two', 'three'])
  })

  test('specs parse key=value pairs', () => {
    const csv =
      'sku,name,specs\n' +
      'A,A,material=leather;weight=68g;dimensions=11x9cm\n'
    const rows = parseProductsCsv(csv)
    expect(rows[0].specs).toEqual({
      material: 'leather',
      weight: '68g',
      dimensions: '11x9cm',
    })
  })

  test('missing optional fields are tolerated', () => {
    const csv =
      'sku,name\n' +
      'X-1,Thing\n'
    const rows = parseProductsCsv(csv)
    expect(rows[0].brand).toBeNull()
    expect(rows[0].category).toBeNull()
    expect(rows[0].features).toEqual([])
    expect(rows[0].specs).toEqual({})
    expect(rows[0].price).toBeNull()
    expect(rows[0].currentDescription).toBeNull()
  })

  test('malformed CSV (too many fields) throws with row number', () => {
    const csv =
      'sku,name\n' +
      'X-1,Thing,EXTRA\n'
    expect(() => parseProductsCsv(csv)).toThrow(ParseError)
    try {
      parseProductsCsv(csv)
    } catch (e) {
      expect((e as ParseError).row).toBe(2)
    }
  })

  test('missing required "sku" throws with row number', () => {
    const csv =
      'sku,name\n' +
      ',Thing\n'
    expect(() => parseProductsCsv(csv)).toThrow(ParseError)
    try {
      parseProductsCsv(csv)
    } catch (e) {
      expect((e as ParseError).row).toBe(2)
    }
  })

  test('empty CSV throws', () => {
    expect(() => parseProductsCsv('')).toThrow(ParseError)
  })

  test('quoted fields with embedded commas are preserved', () => {
    const csv =
      'sku,name,features\n' +
      'A,"Comma, in name",f1;s2\n'
    const rows = parseProductsCsv(csv)
    expect(rows[0].name).toBe('Comma, in name')
  })

  test('multi-row parse preserves order', () => {
    const csv =
      'sku,name\n' +
      'A,A1\n' +
      'B,B2\n' +
      'C,C3\n'
    const rows = parseProductsCsv(csv)
    expect(rows.map((r) => r.sku)).toEqual(['A', 'B', 'C'])
  })
})
