import { test, expect, describe } from 'bun:test'
import { buildVariantPrompt } from '../variant-builder'
import { findPresetByName } from '../tone-presets'

describe('buildVariantPrompt', () => {
  const product = {
    name: 'Florence Wallet',
    features: ['RFID-blocking', '6 card slots'],
    specs: { material: 'leather' },
  }
  const preset = findPresetByName('premium')

  test('features variant prompt mentions "lead with features"', () => {
    const { systemPrompt, variant } = buildVariantPrompt(product, 'features')
    expect(variant).toBe('features')
    expect(systemPrompt.toLowerCase()).toContain('lead with features')
  })

  test('benefits variant prompt mentions "lead with customer benefits"', () => {
    const { systemPrompt, variant } = buildVariantPrompt(product, 'benefits')
    expect(variant).toBe('benefits')
    expect(systemPrompt.toLowerCase()).toContain('lead with customer benefits')
  })

  test('features and benefits prompts are different', () => {
    const a = buildVariantPrompt(product, 'features')
    const b = buildVariantPrompt(product, 'benefits')
    expect(a.systemPrompt).not.toBe(b.systemPrompt)
    expect(a.userPrompt).toBe(b.userPrompt) // same product input
  })

  test('userPrompt still includes the product name and features', () => {
    const { userPrompt } = buildVariantPrompt(product, 'features')
    expect(userPrompt).toContain('Florence Wallet')
    expect(userPrompt).toContain('- RFID-blocking')
  })

  test('falls back to a neutral default when no preset is provided', () => {
    const { systemPrompt } = buildVariantPrompt(product, 'features')
    const withoutPreset = buildVariantPrompt(product, 'features').systemPrompt
    // Calling without preset should still produce a valid (non-empty) prompt
    // and should mention the variant instruction.
    expect(withoutPreset.toLowerCase()).toContain('lead with features')
    expect(systemPrompt.length).toBeGreaterThan(0)
  })

  test('preserves tone preset when one is provided', () => {
    const { systemPrompt } = buildVariantPrompt(product, 'features', preset)
    expect(systemPrompt).toContain(preset!.systemPrompt)
  })
})
