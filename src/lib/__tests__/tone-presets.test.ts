import { test, expect, describe } from 'bun:test'
import { BUILT_IN_PRESETS, findPresetByName, type TonePresetSeed } from '../tone-presets'

describe('BUILT_IN_PRESETS', () => {
  test('contains exactly 5 presets', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(5)
  })

  test('each preset has name + systemPrompt + example', () => {
    for (const p of BUILT_IN_PRESETS as TonePresetSeed[]) {
      expect(typeof p.name).toBe('string')
      expect(p.name.length).toBeGreaterThan(0)
      expect(typeof p.systemPrompt).toBe('string')
      expect(p.systemPrompt.length).toBeGreaterThan(20)
      expect(typeof p.example).toBe('string')
      expect(p.example.length).toBeGreaterThan(10)
    }
  })

  test('preset names are unique', () => {
    const names = BUILT_IN_PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('the five expected names are present', () => {
    const names = BUILT_IN_PRESETS.map((p) => p.name).sort()
    expect(names).toEqual(['casual', 'luxury', 'premium', 'technical', 'value'])
  })

  test('premium tone mentions "premium" in the prompt', () => {
    const p = findPresetByName('premium')
    expect(p).toBeDefined()
    expect(p!.systemPrompt.toLowerCase()).toContain('premium')
  })

  test('technical tone mentions "specifications"', () => {
    const p = findPresetByName('technical')
    expect(p).toBeDefined()
    expect(p!.systemPrompt.toLowerCase()).toContain('specification')
  })

  test('findPresetByName is case-insensitive', () => {
    expect(findPresetByName('PREMIUM')?.name).toBe('premium')
    expect(findPresetByName('CaSuAl')?.name).toBe('casual')
  })

  test('findPresetByName returns undefined for unknown name', () => {
    expect(findPresetByName('nonexistent')).toBeUndefined()
  })
})
