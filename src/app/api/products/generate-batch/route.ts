import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTonePreset } from '@/lib/preset-resolver'
import { generateForProduct } from '@/lib/generate'
import { runBatchConcurrent } from '@/lib/batch-runner'

const DEFAULT_CONCURRENCY = 5

/**
 * POST /api/products/generate-batch
 *   body: { productIds: string[], tonePresetId?: string, generateVariants?: boolean }
 *
 * Generates descriptions for many products in parallel with a concurrency
 * cap (default 5; override with PDG_BATCH_CONCURRENCY env var). Records the
 * run as a BatchJob row so the right-sidebar progress panel can poll it.
 * Returns: { jobId, products: Product[] }
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { productIds, tonePresetId, generateVariants } = body ?? {}
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: 'productIds[] is required' }, { status: 400 })
  }

  let preset
  try {
    preset = await resolveTonePreset(tonePresetId)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }

  // Create a BatchJob row.
  let jobId = ''
  try {
    const job = await db.batchJob.create({
      data: {
        tonePresetId: preset.name,
        productIds: JSON.stringify(productIds),
        status: 'running',
        total: productIds.length,
        progress: 0,
      },
    })
    jobId = job.id
  } catch (e) {
    // If the DB is unavailable, fall back to running without a job record
    // so the API stays usable for demos.
    console.warn('[generate-batch] could not create BatchJob row:', (e as Error).message)
  }

  const concurrency = Math.max(
    1,
    Number(process.env.PDG_BATCH_CONCURRENCY) || DEFAULT_CONCURRENCY,
  )

  // Run the batch.
  const results = await runBatchConcurrent(
    productIds,
    async (id) => {
      const product = await db.product.findUnique({ where: { id } })
      if (!product) throw new Error(`product ${id} not found`)
      const result = await generateForProduct(
        {
          name: product.name,
          brand: product.brand,
          category: product.category,
          features: product.features,
          specs: product.specs,
          price: product.price,
          currentDescription: product.currentDescription,
        },
        preset,
        { generateVariants: !!generateVariants },
      )
      const updated = await db.product.update({
        where: { id: product.id },
        data: {
          generatedDescription: result.generatedDescription,
          variantA: result.variantA,
          variantB: result.variantB,
          keywords: result.keywords.join(', '),
          tonePreset: preset.name,
          status: 'generated',
        },
      })
      // Increment the BatchJob progress as each product completes.
      if (jobId) {
        try {
          await db.batchJob.update({
            where: { id: jobId },
            data: { progress: { increment: 1 } },
          })
        } catch {
          // ignore progress-update failures
        }
      }
      return updated
    },
    concurrency,
  )

  // Finalize the BatchJob.
  if (jobId) {
    try {
      const failed = results.filter((r) => !r.ok).length
      await db.batchJob.update({
        where: { id: jobId },
        data: {
          status: failed === 0 ? 'completed' : failed === results.length ? 'failed' : 'completed',
          completedAt: new Date(),
        },
      })
    } catch {
      // ignore
    }
  }

  // Return only successful updates so the UI can render the table cleanly.
  const products = results
    .filter((r) => r.ok && r.result)
    .map((r) => r.result)
  const errors = results
    .filter((r) => !r.ok)
    .map((r) => ({ index: r.index, error: r.error }))

  return NextResponse.json({ jobId, products, errors })
}
