import { test, expect, describe } from 'bun:test'
import { runBatchConcurrent } from '../batch-runner'

describe('runBatchConcurrent', () => {
  test('10 items with concurrency 5 — all complete', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const worker = async (n: number) => n * 2
    const results = await runBatchConcurrent(items, worker, 5)
    expect(results).toHaveLength(10)
    for (let i = 0; i < 10; i++) {
      expect(results[i].ok).toBe(true)
      expect(results[i].result).toBe(i * 2)
    }
  })

  test('results preserve input order regardless of completion order', async () => {
    const items = [10, 1, 5, 2, 8]
    // Worker sleeps longer for smaller input — so completion order is reversed
    // from input order.
    const worker = async (n: number) => {
      await new Promise((r) => setTimeout(r, (20 - n) * 5))
      return n
    }
    const results = await runBatchConcurrent(items, worker, 2)
    expect(results.map((r) => r.result)).toEqual([10, 1, 5, 2, 8])
  })

  test('errors captured per item, others still succeed', async () => {
    const items = [0, 1, 2, 3, 4]
    const worker = async (n: number) => {
      if (n % 2 === 0) throw new Error(`boom-${n}`)
      return n * 10
    }
    const results = await runBatchConcurrent(items, worker, 5)
    expect(results).toHaveLength(5)
    expect(results[0].ok).toBe(false)
    expect(results[0].error).toBe('boom-0')
    expect(results[1].ok).toBe(true)
    expect(results[1].result).toBe(10)
    expect(results[2].ok).toBe(false)
    expect(results[3].ok).toBe(true)
    expect(results[3].result).toBe(30)
    expect(results[4].ok).toBe(false)
  })

  test('respects the concurrency cap (never more than N in flight)', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = Array.from({ length: 20 }, (_, i) => i)
    const worker = async (n: number) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
      return n
    }
    await runBatchConcurrent(items, worker, 5)
    expect(maxInFlight).toBeLessThanOrEqual(5)
  })

  test('empty input -> empty results', async () => {
    const results = await runBatchConcurrent([], async () => 1, 5)
    expect(results).toEqual([])
  })

  test('default concurrency is 5', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = Array.from({ length: 12 }, (_, i) => i)
    const worker = async (n: number) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return n
    }
    await runBatchConcurrent(items, worker) // no concurrency arg
    expect(maxInFlight).toBeLessThanOrEqual(5)
  })

  test('concurrency 1 runs strictly sequentially', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = Array.from({ length: 5 }, (_, i) => i)
    const worker = async (n: number) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return n
    }
    await runBatchConcurrent(items, worker, 1)
    expect(maxInFlight).toBe(1)
  })

  test('concurrency below 1 is clamped to 1', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = [1, 2, 3]
    const worker = async (n: number) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return n
    }
    await runBatchConcurrent(items, worker, 0)
    expect(maxInFlight).toBe(1)
  })
})
