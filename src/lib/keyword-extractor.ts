/**
 * SEO keyword extraction — derives 3-5 keywords from a product's name,
 * category, and features using a TF-IDF-like heuristic.
 *
 * Algorithm:
 *   1. Tokenize `name + ' ' + category + ' ' + features.join(' ')`.
 *   2. Compute raw term frequencies (TF).
 *   3. Apply a length penalty: `score = tf * (1 + log2(len))`. Longer tokens
 *      (e.g. "leather", "RFID") are usually better SEO keywords than short
 *      ones (e.g. "the", "set"), even though both might appear once.
 *   4. Drop tokens shorter than 3 chars (after tokenization already drops
 *      <2-char and stop-words; we tighten further for SEO).
 *   5. Dedupe case-insensitively — keep the highest-scoring variant.
 *   6. Sort by score descending; take top-K.
 *   7. If the corpus yields fewer than 3 keywords, pad with the brand and the
 *      category as fallbacks (still useful for SEO).
 *
 * The function is pure: same input -> same output. It does NOT touch the DB
 * or the network.
 */

import { tokenize, STOP_WORDS } from '@/lib/tokenizer'

export interface KeywordProduct {
  name: string
  brand?: string | null
  category?: string | null
  features?: string | string[]
}

const MIN_TOKEN_LENGTH = 3
const MIN_KEYWORDS = 3
const MAX_KEYWORDS = 5

export function extractKeywords(product: KeywordProduct): string[] {
  const featuresStr = Array.isArray(product.features)
    ? product.features.join(' ')
    : (product.features ?? '')

  const corpus = [product.name, product.category ?? '', featuresStr]
    .join(' ')
    .trim()

  const tokens = tokenize(corpus)

  // Tighten stop-words: tokenizer already drops a base set, but the SEO
  // context has additional filler (we added some e-commerce terms to the
  // shared stop list). Tokens shorter than MIN_TOKEN_LENGTH are dropped.
  const scores = new Map<string, number>()
  for (const tok of tokens) {
    if (tok.length < MIN_TOKEN_LENGTH) continue
    if (STOP_WORDS.has(tok)) continue
    const tf = (scores.get(tok) ?? 0) + 1
    scores.set(tok, tf)
  }

  // Apply length penalty (longer = better for SEO).
  const scored: Array<{ token: string; score: number }> = []
  for (const [token, tf] of scores.entries()) {
    const score = tf * (1 + Math.log2(token.length))
    scored.push({ token, score })
  }
  scored.sort((a, b) => b.score - a.score || a.token.localeCompare(b.token))

  // Dedupe case-insensitively. The tokenizer already lowercases, so this is
  // effectively a uniqueness pass.
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const { token } of scored) {
    if (seen.has(token)) continue
    seen.add(token)
    keywords.push(token)
    if (keywords.length >= MAX_KEYWORDS) break
  }

  // Pad with brand/category fallbacks if we're below the minimum.
  if (keywords.length < MIN_KEYWORDS) {
    const fallbacks: string[] = []
    if (product.brand) fallbacks.push(product.brand.toLowerCase())
    if (product.category) fallbacks.push(product.category.toLowerCase())
    for (const fb of fallbacks) {
      const t = fb.trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        keywords.push(t)
        if (keywords.length >= MIN_KEYWORDS) break
      }
    }
  }

  // Final clamp: never return more than MAX_KEYWORDS.
  return keywords.slice(0, MAX_KEYWORDS)
}
