import { test, expect, describe } from 'bun:test'
import { buildDescriptionPrompt } from '../description-builder'
import { findPresetByName } from '../tone-presets'

describe('buildDescriptionPrompt', () => {
  const preset = findPresetByName('premium')!

  test('systemPrompt includes preset.systemPrompt', () => {
    const { systemPrompt } = buildDescriptionPrompt(
      { name: 'Florence Wallet' },
      preset,
    )
    expect(systemPrompt).toContain(preset.systemPrompt)
  })

  test('systemPrompt includes preset.example', () => {
    const { systemPrompt } = buildDescriptionPrompt(
      { name: 'Florence Wallet' },
      preset,
    )
    expect(systemPrompt).toContain(preset.example)
  })

  test('userPrompt includes the product name', () => {
    const { userPrompt } = buildDescriptionPrompt(
      { name: 'Florence Leather Wallet', brand: 'Artigiano' },
      preset,
    )
    expect(userPrompt).toContain('Florence Leather Wallet')
    expect(userPrompt).toContain('Artigiano')
  })

  test('userPrompt includes features as a bullet list', () => {
    const { userPrompt } = buildDescriptionPrompt(
      {
        name: 'W',
        features: ['RFID-blocking', '6 card slots', 'full-grain leather'],
      },
      preset,
    )
    expect(userPrompt).toContain('- RFID-blocking')
    expect(userPrompt).toContain('- 6 card slots')
    expect(userPrompt).toContain('- full-grain leather')
  })

  test('userPrompt includes specs as key: value bullets', () => {
    const { userPrompt } = buildDescriptionPrompt(
      {
        name: 'W',
        specs: { material: 'leather', weight: '68g' },
      },
      preset,
    )
    expect(userPrompt).toContain('- material: leather')
    expect(userPrompt).toContain('- weight: 68g')
  })

  test('userPrompt includes the price when present', () => {
    const { userPrompt } = buildDescriptionPrompt(
      { name: 'W', price: 49.99 },
      preset,
    )
    expect(userPrompt).toContain('Price: 49.99')
  })

  test('userPrompt includes existing description for rewrite when provided', () => {
    const { userPrompt } = buildDescriptionPrompt(
      {
        name: 'W',
        currentDescription: 'A short blurb about the wallet.',
      },
      preset,
    )
    expect(userPrompt).toContain('Existing description (rewrite if provided):')
    expect(userPrompt).toContain('A short blurb about the wallet.')
  })

  test('tone instructions ("premium") are reflected in the systemPrompt', () => {
    const { systemPrompt } = buildDescriptionPrompt(
      { name: 'W' },
      preset,
    )
    expect(systemPrompt.toLowerCase()).toContain('premium')
  })
})
