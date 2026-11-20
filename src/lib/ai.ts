/**
 * Non-streaming chat completion provider used by the Product Description
 * Generator. Each call returns a single string (the generated product
 * description), which fits batch generation with Promise.all perfectly — no
 * need to assemble streamed deltas on the server.
 *
 * The interface `ChatProvider` has a single method `complete()` returning a
 * `Promise<string>`. Two implementations are provided:
 *
 *   - `ZaiProvider`   — uses the z-ai-web-dev-sdk (production)
 *   - `MockProvider`  — deterministic echo, used in unit tests and when the
 *                       SDK config is unavailable so the app stays demoable
 *                       offline
 *
 * The provider is a singleton cached at module scope. Tests can swap it with
 * `__setChatProviderForTest()`.
 */

export interface ChatProvider {
  /** Returns the full completion string (no streaming). */
  complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string>
}

let cachedProvider: ChatProvider | null = null

class ZaiProvider implements ChatProvider {
  async complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string> {
    // Dynamic import so a missing config in unit-test envs doesn't crash the
    // module-level evaluation.
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: args.systemPrompt },
        { role: 'user', content: args.userPrompt },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    })

    // The SDK may return either a string, a ReadableStream (when the upstream
    // ignores `stream:false`), or a JSON completion object. Handle all three.
    if (typeof completion === 'string') return completion
    if (completion && typeof (completion as any).getReader === 'function') {
      const reader = (completion as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
      }
      buf += decoder.decode()
      return buf
    }
    const content = (completion as any)?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    throw new Error('AI provider returned an unrecognized completion shape')
  }
}

class MockProvider implements ChatProvider {
  async complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string> {
    // Deterministic mock — picks the first product name out of the user prompt
    // and emits a short templated description. Used by tests and offline demos.
    const nameMatch = args.userPrompt.match(/Product name:\s*(.+)/)
    const name = nameMatch ? nameMatch[1].trim() : 'the product'
    const featuresMatch = args.userPrompt.match(/Features:\s*([\s\S]*?)(\n\n|$)/)
    const featuresLine = featuresMatch ? featuresMatch[1].trim() : ''
    const features = featuresLine
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)

    return [
      `Introducing ${name}.`,
      ``,
      features.length
        ? `Key highlights: ${features.slice(0, 3).join(', ')}.`
        : `A reliable addition to your everyday toolkit.`,
      ``,
      `[mock] Generated with MockProvider — set PDG_DISABLE_LLM=0 and configure the z-ai-web-dev-sdk to enable real generations.`,
    ].join('\n')
  }
}

export function getChatProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PDG_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn('[ai] ZaiProvider unavailable, using MockProvider:', (e as Error).message)
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only. */
export function __setChatProviderForTest(p: ChatProvider | null) {
  cachedProvider = p
}
