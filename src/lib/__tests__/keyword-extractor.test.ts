import { test, expect, describe } from 'bun:test'
import { extractKeywords } from '../keyword-extractor'

describe('extractKeywords', () => {
  test('returns between 3 and 5 keywords', () => {
    const kws = extractKeywords({
      name: 'Florence Leather Wallet',
      category: 'Accessories',
      features: ['RFID-blocking', '6 card slots', 'full-grain leather'],
    })
    expect(kws.length).toBeGreaterThanOrEqual(3)
    expect(kws.length).toBeLessThanOrEqual(5)
  })

  test('extracts from name + category + features', () => {
    const kws = extractKeywords({
      name: 'Florence Leather Wallet',
      category: 'Wallets',
      features: ['RFID-blocking', 'full-grain leather', '6 card slots'],
    })
    expect(kws).toContain('leather')
    expect(kws).toContain('florence')
    expect(kws).toContain('wallet')
  })

  test('dedupes repeated tokens', () => {
    const kws = extractKeywords({
      name: 'Leather Wallet Leather',
      category: 'Leather Wallets',
      features: ['leather', 'leather', 'leather wallet'],
    })
    const set = new Set(kws)
    expect(set.size).toBe(kws.length)
  })

  test('skips stop words', () => {
    const kws = extractKeywords({
      name: 'The Wallet Is The Best',
      category: 'Accessories',
      features: ['the wallet', 'with the leather'],
    })
    expect(kws).not.toContain('the')
    expect(kws).not.toContain('with')
  })

  test('ranks by frequency (repeated token ranks first)', () => {
    const kws = extractKeywords({
      name: 'Leather Leather Leather Wallet',
      category: '',
      features: ['unique-feature-once'],
    })
    // 'leather' appears 3x — should outrank a feature appearing once.
    expect(kws[0]).toBe('leather')
  })

  test('skips tokens shorter than 3 chars', () => {
    const kws = extractKeywords({
      name: 'AA BB CC Wallet',
      category: '',
      features: [],
    })
    expect(kws).not.toContain('aa')
    expect(kws).not.toContain('bb')
    expect(kws).toContain('wallet')
  })

  test('pads with brand/category fallback when corpus is thin', () => {
    const kws = extractKeywords({
      name: 'X', // <3 chars, dropped by the min-token-length filter
      brand: 'Artigiano',
      category: 'Leather Wallets',
      features: [],
    })
    expect(kws.length).toBeGreaterThanOrEqual(3)
    expect(kws).toContain('artigiano')
    // 'leather' and 'wallets' come from the category — both pass the filter.
    expect(kws).toContain('leather')
    expect(kws).toContain('wallets')
  })

  test('accepts features as a string (semicolon-separated)', () => {
    const kws = extractKeywords({
      name: 'Florence Wallet',
      features: 'leather;RFID-blocking',
    })
    expect(kws).toContain('leather')
    expect(kws).toContain('florence')
  })
})
