/**
 * Batch runner — runs an async `worker` over an array of items with a
 * concurrency cap (default 5). Results are returned in the SAME order as the
 * input items, regardless of completion order. Per-item errors are captured
 * into a `BatchResult.error` field rather than rejecting the whole batch.
 *
 *   runBatchConcurrent(items, worker, concurrency=5)
 *     -> Promise<BatchResult<T, R>[]>
 *
 * The runner is used by the batch-generation API to fan out LLM calls with a
 * concurrency cap of 5 (so we don't blow through LLM rate limits). It is also
 * tested in isolation with a mock worker so we can assert on order
 * preservation, error capture, and concurrency behavior without burning real
 * LLM tokens.
 */

export interface BatchResult<T, R> {
  item: T
  index: number
  ok: boolean
  result?: R
  error?: string
}

export async function runBatchConcurrent<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 5,
): Promise<BatchResult<T, R>[]> {
  if (concurrency < 1) concurrency = 1
  const results: BatchResult<T, R>[] = new Array(items.length)
  let nextIndex = 0

  async function runOne(): Promise<void> {
    while (true) {
      const myIndex = nextIndex++
      if (myIndex >= items.length) return
      const item = items[myIndex]
      try {
        const result = await worker(item, myIndex)
        results[myIndex] = { item, index: myIndex, ok: true, result }
      } catch (e) {
        results[myIndex] = {
          item,
          index: myIndex,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
  }

  // Spawn `concurrency` workers. Each worker pulls the next free index off
  // the shared `nextIndex` counter — this guarantees (a) at most
  // `concurrency` in-flight calls at any moment and (b) order preservation
  // because results are written to a pre-allocated array indexed by the
  // original position.
  const workers: Promise<void>[] = []
  const n = Math.min(concurrency, items.length || 1)
  for (let i = 0; i < n; i++) workers.push(runOne())
  await Promise.all(workers)

  // Defensive: fill any slots that didn't get a result (e.g. items was empty)
  for (let i = 0; i < items.length; i++) {
    if (!results[i]) {
      results[i] = {
        item: items[i],
        index: i,
        ok: false,
        error: 'unreachable: worker skipped this index',
      }
    }
  }
  return results
}
