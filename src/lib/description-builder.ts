/**
 * Description-builder — assembles the system + user prompts that the LLM
 * consumes for the canonical (single-variant) generation flow.
 *
 * System prompt = preset.systemPrompt + "\n\n" + preset.example + rules
 * User prompt   = a structured block listing the product's name, brand,
 *                  category, features, specs, price, and (optionally) the
 *                  current description for rewrite. The keywords line is
 *                  appended AFTER the LLM responds — we don't ask the LLM to
 *                  produce keywords itself (the keyword-extractor does that
 *                  deterministically so we can assert on it).
 */

import type { TonePresetSeed } from '@/lib/tone-presets'

export interface PromptProduct {
  name: string
  brand?: string | null
  category?: string | null
  features?: string | string[]
  specs?: string | Record<string, string>
  price?: number | null
  currentDescription?: string | null
}

export interface BuiltPrompt {
  systemPrompt: string
  userPrompt: string
}

const RULES = [
  'Write a single, ready-to-publish product description (50-150 words).',
  'Use markdown headings and bullets only when they improve readability.',
  'Do NOT include the SKU, the price, or a meta "Tags" line — those are appended separately by the system.',
  'Do NOT invent features or specs that are not in the input.',
  'Return ONLY the description text — no preamble, no commentary.',
].join(' ')

function featuresList(p: PromptProduct): string[] {
  if (!p.features) return []
  if (Array.isArray(p.features)) return p.features.filter(Boolean)
  return p.features.split(';').map((s) => s.trim()).filter(Boolean)
}

function specsEntries(p: PromptProduct): Array<[string, string]> {
  if (!p.specs) return []
  if (typeof p.specs === 'string') {
    return p.specs
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=')
        return eq === -1 ? [pair, ''] : [pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()]
      })
  }
  return Object.entries(p.specs)
}

export function buildDescriptionPrompt(
  product: PromptProduct,
  preset: TonePresetSeed,
): BuiltPrompt {
  const systemPrompt = [
    preset.systemPrompt,
    '',
    'Example output for this tone:',
    preset.example,
    '',
    'Rules:',
    RULES,
  ].join('\n')

  const features = featuresList(product)
  const specs = specsEntries(product)

  const lines: string[] = []
  lines.push(`Product name: ${product.name}`)
  if (product.brand) lines.push(`Brand: ${product.brand}`)
  if (product.category) lines.push(`Category: ${product.category}`)
  if (product.price !== null && product.price !== undefined) {
    lines.push(`Price: ${product.price}`)
  }
  if (features.length) {
    lines.push('Features:')
    for (const f of features) lines.push(`- ${f}`)
  }
  if (specs.length) {
    lines.push('Specifications:')
    for (const [k, v] of specs) lines.push(`- ${k}: ${v}`)
  }
  if (product.currentDescription) {
    lines.push('', 'Existing description (rewrite if provided):')
    lines.push(product.currentDescription)
  }

  const userPrompt = lines.join('\n')
  return { systemPrompt, userPrompt }
}
