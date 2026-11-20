/**
 * Tone presets for product descriptions. Each preset has:
 *   - name         — the stable identifier (premium, casual, technical, ...)
 *   - systemPrompt — the fragment injected into the LLM system prompt
 *   - example     — a short example of the desired output (shown to the LLM
 *                  as few-shot guidance)
 *
 * The five built-in presets are exported as a constant array AND seeded into
 * the database (TonePreset table) on first run so users can extend or override
 * them through the API. The pure-function consumers (description-builder,
 * variant-builder, tests) import `BUILT_IN_PRESETS` directly to stay
 * deterministic and DB-free.
 */

export interface TonePresetSeed {
  name: string
  systemPrompt: string
  example: string
}

export const BUILT_IN_PRESETS: TonePresetSeed[] = [
  {
    name: 'premium',
    systemPrompt:
      'You write premium product descriptions for an upscale e-commerce audience. Use refined, sophisticated language; emphasize craftsmanship, materials, and exclusivity. Mention "premium" quality and the elevated experience the buyer will enjoy. Avoid slang and exclamation marks.',
    example:
      'Premium leather wallet handcrafted in Florence from full-grain Italian calfskin. Every stitch is set by hand, delivering a finish that improves with age and use.',
  },
  {
    name: 'casual',
    systemPrompt:
      'You write casual, friendly product descriptions for an everyday shopper audience. Use a warm conversational tone, second-person ("you"), short punchy sentences, and an emoji or two at most. Keep it light and approachable.',
    example:
      'Looking for a wallet that just works? This one fits your cards, your cash, and your everyday carry without the bulk. :) Perfect for the daily commute or a weekend out.',
  },
  {
    name: 'technical',
    systemPrompt:
      'You write technical product descriptions for a discerning, spec-driven audience. Lead with specifications and quantitative claims; use precise measurements and technical terminology. Include a "Specifications" bullet list whenever possible.',
    example:
      'Full-grain leather wallet, 11 x 9 cm, 6 card slots, RFID-shielded. Specifications:\n- Material: full-grain Italian calfskin (1.8 mm)\n- Slots: 6 card, 1 cash, 2 hidden\n- RFID: 13.56 MHz shielded\n- Weight: 68 g',
  },
  {
    name: 'luxury',
    systemPrompt:
      'You write luxury product descriptions for a high-net-worth audience. Use evocative, aspirational language; reference heritage, rarity, and the world of the buyer. Sentences should be measured and elegant. Avoid price-talk.',
    example:
      'An object of desire. Crafted in the workshops of Florence by artisans whose families have worked leather for three generations, this wallet is a quiet statement of taste.',
  },
  {
    name: 'value',
    systemPrompt:
      'You write value-oriented product descriptions for a price-conscious shopper. Emphasize affordability, durability, and "more for less". Mention concrete benefits and use phrases like "great value", "everyday use", and "built to last" without being salesy.',
    example:
      'Great value for everyday use. Durable construction, plenty of card slots, and a slim profile that fits any pocket — all at a price that leaves room in your budget.',
  },
]

/** Lookup a preset by name from the built-in list (case-insensitive). */
export function findPresetByName(name: string): TonePresetSeed | undefined {
  const lower = name.toLowerCase()
  return BUILT_IN_PRESETS.find((p) => p.name.toLowerCase() === lower)
}
