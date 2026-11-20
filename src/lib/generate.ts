/**
 * High-level orchestrator — wires together the pure pieces (prompt
 * builders, keyword extractor) with the ChatProvider and the database so
 * the API route handlers can stay thin.
 *
 *   generateForProduct(product, preset, { generateVariants }) -> {
 *     generatedDescription, variantA?, variantB?, keywords
 *   }
 *
 * The function does NOT persist anything — the route handler decides
 * whether to write to DB. This keeps the function unit-testable with a
 * MockProvider.
 */

import { getChatProvider, type ChatProvider } from '@/lib/ai'
import { buildDescriptionPrompt } from '@/lib/description-builder'
import { buildVariantPrompt } from '@/lib/variant-builder'
import { extractKeywords } from '@/lib/keyword-extractor'

export interface GenerateProductInput {
  name: string
  brand?: string | null
  category?: string | null
  features?: string | string[]
  specs?: string | Record<string, string>
  price?: number | null
  currentDescription?: string | null
}

export interface TonePresetLike {
  name: string
  systemPrompt: string
  example: string
}

export interface GeneratedResult {
  generatedDescription: string
  variantA: string | null
  variantB: string | null
  keywords: string[]  // 3-5 SEO keywords derived from the product
}

const TAGS_PREFIX = 'Tags: '

/** Append the SEO keywords as a "Tags:" footer line. Pure helper. */
export function withTags(description: string, keywords: string[]): string {
  if (!keywords.length) return description
  const tagsLine = TAGS_PREFIX + keywords.join(', ')
  return description.trimEnd() + '\n' + tagsLine
}

export async function generateForProduct(
  product: GenerateProductInput,
  preset: TonePresetLike,
  opts: { generateVariants?: boolean } = {},
): Promise<GeneratedResult> {
  const provider: ChatProvider = getChatProvider()
  const { systemPrompt, userPrompt } = buildDescriptionPrompt(product, preset)
  const generatedDescription = await provider.complete({ systemPrompt, userPrompt })

  let variantA: string | null = null
  let variantB: string | null = null
  if (opts.generateVariants) {
    const aPrompt = buildVariantPrompt(product, 'features', preset)
    const bPrompt = buildVariantPrompt(product, 'benefits', preset)
    const [a, b] = await Promise.all([
      provider.complete({ systemPrompt: aPrompt.systemPrompt, userPrompt: aPrompt.userPrompt }),
      provider.complete({ systemPrompt: bPrompt.systemPrompt, userPrompt: bPrompt.userPrompt }),
    ])
    variantA = a
    variantB = b
  }

  const keywords = extractKeywords(product)
  const finalDescription = withTags(generatedDescription, keywords)

  return {
    generatedDescription: finalDescription,
    variantA: variantA ? withTags(variantA, keywords) : null,
    variantB: variantB ? withTags(variantB, keywords) : null,
    keywords,
  }
}
