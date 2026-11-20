/**
 * Variant-builder — produces two alternative prompt framings for the same
 * product so the user can A/B pick which one becomes the canonical
 * description.
 *
 *   - features variant: instructs the LLM to "lead with features" —
 *     enumerate the product's capabilities/specs first, then close with a
 *     short benefit statement.
 *   - benefits variant: instructs the LLM to "lead with customer benefits" —
 *     open with the outcome the buyer will enjoy, then back it up with a
 *     short list of features/specs that deliver it.
 *
 * Both prompts share a common system prompt (deterministic tone-agnostic
 * copywriter voice). The tone preset is layered on top by the caller if
 * desired — the variant builder intentionally stays tone-agnostic so the
 * A/B test isolates the framing variable.
 */

import type { TonePresetSeed } from '@/lib/tone-presets'
import { buildDescriptionPrompt } from '@/lib/description-builder'
import type { PromptProduct } from '@/lib/description-builder'

export type VariantKind = 'features' | 'benefits'

export interface BuiltVariantPrompt {
  systemPrompt: string
  userPrompt: string
  variant: VariantKind
}

const FEATURES_INSTRUCTION =
  'Lead with features. Open by enumerating the product\'s key features and specifications in concrete terms, then close with a single short sentence stating the customer benefit. Use bullet points for the feature list.'

const BENEFITS_INSTRUCTION =
  'Lead with customer benefits. Open with one or two sentences describing the outcome the buyer will enjoy, then back it up with a short list of features/specs that deliver the benefit. Use bullet points for the supporting list.'

export function buildVariantPrompt(
  product: PromptProduct,
  variant: VariantKind,
  preset?: TonePresetSeed,
): BuiltVariantPrompt {
  const instruction = variant === 'features' ? FEATURES_INSTRUCTION : BENEFITS_INSTRUCTION
  // Compose with the tone preset (if given) so the variant still respects the
  // user's chosen tone; otherwise use a neutral default.
  const base = buildDescriptionPrompt(
    product,
    preset ?? {
      name: 'neutral',
      systemPrompt: 'You are a professional e-commerce copywriter.',
      example: 'A concise, benefit-led product description.',
    },
  )
  const systemPrompt = [
    base.systemPrompt,
    '',
    'Variant instruction:',
    instruction,
  ].join('\n')
  return { systemPrompt, userPrompt: base.userPrompt, variant }
}
