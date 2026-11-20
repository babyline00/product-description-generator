# Product Description Generator

A bulk product description generator for e-commerce: upload a CSV of SKUs + specs, get SEO-optimized descriptions per product with tone presets, A/B variants, and CSV re-export.

> Built as Project #49 of the 110-project portfolio plan.

---

## Overview

E-commerce teams routinely have to write hundreds (or thousands) of product descriptions when onboarding new catalogs. The work is repetitive, requires SEO awareness, and is highly tone-dependent: the same SKU needs different copy on a luxury boutique site vs. a discount marketplace. This app turns that problem into a single CSV-in / CSV-out workflow:

1. **Upload** a CSV of products (SKU, name, brand, category, features, specs, price, current description).
2. **Pick a tone preset** (premium, casual, technical, luxury, value).
3. **Generate** descriptions in bulk — one row per product, with optional A/B variants.
4. **Export** the same CSV back out with the new `generated_description` and `keywords` columns appended.

SEO keywords are derived deterministically (TF-IDF-like heuristic over name + category + features) so they can be asserted on. The LLM is never asked to invent keywords — that's a pure-function concern.

---

## MVP scope vs. stretch goals

| Feature | Status | Notes |
|---|---|---|
| Bulk CSV upload | MVP | `POST /api/products/upload-csv` parses RFC-4180 CSV with quoted fields. |
| Tone presets | MVP | 5 built-in presets (premium / casual / technical / luxury / value). User can add more via API. |
| SEO keyword injection | MVP | `extractKeywords(product)` is a pure function: 3-5 keywords, ranked by TF, with length penalty + stop-word removal. Keywords are appended as a `Tags:` line. |
| Batch generation | MVP | `POST /api/products/generate-batch` with concurrency cap of 5 (configurable via `PDG_BATCH_CONCURRENCY`). Records a `BatchJob` row for the progress panel. |
| A/B variant generation | MVP | Per-product: variant A (features-led) vs. variant B (benefits-led). User picks one as the canonical. |
| CSV re-export | MVP | `POST /api/products/export-csv` returns the same CSV with the new description + keywords columns. |
| **Shopify/WooCommerce sync** | Stretch | Not in MVP. The CSV export is structured to be directly importable by Shopify's CSV importer, but the live API sync is left as future work. |
| **Multi-language generation** | Stretch | Not in MVP. English only. The prompt builders are language-agnostic so adding locales is mostly a system-prompt change. |
| **Auto image alt text** | Stretch | Not in MVP. The keyword extractor could be reused for alt-text but is out of scope. |
| **Real LLM cost tracking** | Stretch | Not in MVP. Each `BatchJob` row tracks progress but not token cost. |

---

## Features

- **Pure-function core** — CSV parsing, CSV exporting, keyword extraction, prompt building, variant building, and the batch runner are all pure functions. The unit tests cover them without touching the database or the LLM.
- **Pluggable AI provider** — `ChatProvider` interface with `ZaiProvider` (production, z-ai-web-dev-sdk) and `MockProvider` (deterministic, offline). Tests swap the provider with `__setChatProviderForTest()`.
- **Concurrency-capped batch** — `runBatchConcurrent(items, worker, concurrency=5)` runs an async worker over an array with a fixed in-flight cap. Results are returned in input order regardless of completion order; per-item errors are captured rather than rejecting the whole batch.
- **A/B variant framing** — The variant builder isolates one variable: features-led vs. benefits-led framing. The tone preset is layered on top so the A/B test stays clean.
- **Sticky-header table + sticky batch panel** — The product table has a sticky header and a max-height with custom-scrollbar styling. The batch-jobs panel sticks to the viewport on large screens and polls running jobs every 1.5s.
- **Idempotent CSV upload** — `db.product.upsert({ where: { sku }, ... })` means re-uploading the same CSV updates existing rows instead of duplicating them.
- **Graceful degradation** — Tone-presets and stats endpoints return built-in fallbacks (presets list, zeros) when the database is unreachable, so the UI still renders on a fresh clone before `db:push` has been run.

---

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style) + lucide-react icons
- **Database**: Prisma 6 + SQLite (local file `db/custom.db`)
- **LLM**: `z-ai-web-dev-sdk` (non-streaming `complete()` for batch generation)
- **Tests**: `bun test` with `bun:test` (40+ unit tests)
- **Lint**: `eslint-config-next`

---

## Architecture

```
                              +---------------------------+
                              |     src/app/page.tsx       |  (single user-visible route)
                              |  - filter bar             |
                              |  - product table          |
                              |  - batch-jobs sidebar     |
                              |  - edit dialog w/ A/B pick |
                              +-------------+-------------+
                                            |
                                            |  fetch()
                                            v
+-------------------------------------------+---------------------------+
|                       src/app/api/* (Route Handlers)                  |
|                                                                       |
|  POST /api/products/upload-csv          -> import CSV                 |
|  GET  /api/products                     -> list (status/cat/q filter) |
|  GET/PATCH/DELETE /api/products/[id]    -> CRUD                       |
|  POST /api/products/generate            -> single generation         |
|  POST /api/products/generate-batch      -> batch (concurrency 5)     |
|  POST /api/products/[id]/pick-variant   -> pick A or B                |
|  POST /api/products/export-csv          -> CSV out                    |
|  GET/POST /api/tone-presets             -> list / create              |
|  GET /api/batch-jobs                    -> list jobs                  |
|  GET /api/batch-jobs/[id]               -> single job                 |
|  GET /api/stats                         -> dashboard counts           |
+-------------------------------------------+---------------------------+
                                            |
                                            v
+-----------------------------------------------------------+
|                  src/lib/*  (pure-function core)          |
|                                                           |
|  csv-parser.ts   parseProductsCsv(text)  -> ParsedProduct[]|
|  csv-exporter.ts exportProductsCsv(p)   -> CSV string     |
|  tone-presets.ts BUILT_IN_PRESETS[]     -> 5 presets      |
|  keyword-extractor.ts extractKeywords(p)-> 3-5 SEO keywords|
|  description-builder.ts buildDescriptionPrompt(p, preset) |
|  variant-builder.ts buildVariantPrompt(p, variant)       |
|  batch-runner.ts runBatchConcurrent(items, worker, n)     |
|  generate.ts generateForProduct(p, preset, opts)         |
|  ai.ts ChatProvider (Zai / Mock)                          |
|  preset-resolver.ts resolveTonePreset(idOrName)          |
|  db.ts PrismaClient singleton                             |
+-----------------------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------+
|             prisma/schema.prisma  -> SQLite db/custom.db   |
|  Product  | TonePreset  | BatchJob                          |
+-----------------------------------------------------------+
```

---

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Push the Prisma schema to SQLite
bun run db:push

# 3. (Optional) seed the 5 built-in tone presets into the database
bun run seed
#    -> Tone-presets are auto-seeded on first GET /api/tone-presets too.

# 4. Start the dev server (Next.js on port 3000)
bun run dev
```

Open the app at the root route `/`. (In the sandbox preview panel, click **Open in New Tab**.)

### Environment variables

Copy `.env.example` to `.env` and adjust:

```bash
# REQUIRED — absolute path to the SQLite file
DATABASE_URL="file:/home/z/my-project/apps/49-product-description-generator/db/custom.db"

# Optional — set to "1" to force the deterministic MockProvider
PDG_DISABLE_LLM=

# Optional — max concurrency for batch generation (default 5)
PDG_BATCH_CONCURRENCY=5
```

The `package.json` `db:*` scripts inline `DATABASE_URL="$(pwd)/db/custom.db"` so they work from any CWD, but the `.env` file is the source of truth for the running app.

---

## Tests

```bash
bun test
```

40+ unit tests across 8 files — none of which touch the database or the LLM:

| File | Tests | What it covers |
|---|---|---|
| `csv-parser.test.ts` | 10 | Standard CSV, semicolon features, key=value specs, missing optional fields, malformed CSV (row-number errors), quoted fields. |
| `csv-exporter.test.ts` | 7 | Header columns, new `generated_description` + `keywords` columns, quote/escape commas, null fields, trailing newline, multi-row order. |
| `tone-presets.test.ts` | 8 | 5 presets present, each has name + systemPrompt + example, premium mentions "premium", technical mentions "specifications", case-insensitive lookup. |
| `keyword-extractor.test.ts` | 8 | 3-5 keywords, extracts from name + category + features, dedupes, skips stop-words, ranks by frequency, brand/category fallback. |
| `description-builder.test.ts` | 8 | systemPrompt includes preset.systemPrompt + example, userPrompt includes name/brand/features/specs/price/current description. |
| `variant-builder.test.ts` | 6 | features variant mentions "lead with features", benefits variant mentions "lead with customer benefits", neutral fallback. |
| `batch-runner.test.ts` | 8 | 10 items concurrency 5, order preserved, errors captured, concurrency cap respected, default 5, sequential at 1, clamp at 0. |
| `ai.test.ts` | 7 | MockProvider deterministic output, cached provider, `__setChatProviderForTest(null)` clears cache, error propagation, `PDG_DISABLE_LLM=1` selects Mock, `withTags` integration. |

---

## Project structure

```
49-product-description-generator/
├── package.json                 # deps + db scripts with inline DATABASE_URL
├── tsconfig.json                # @/* path alias, bun-types
├── next.config.ts               # standalone output, ignoreBuildErrors
├── tailwind.config.ts           # shadcn color tokens
├── postcss.config.mjs           # @tailwindcss/postcss
├── components.json              # shadcn/ui config (New York, neutral)
├── eslint.config.mjs            # next core-web-vitals + typescript
├── prisma/
│   └── schema.prisma            # Product | TonePreset | BatchJob
├── .env                         # DATABASE_URL (absolute)
├── .env.example
├── .gitignore
├── LICENSE                      # MIT
├── README.md                    # this file
└── src/
    ├── app/
    │   ├── layout.tsx           # Geist fonts + Toaster (sonner)
    │   ├── globals.css          # Tailwind 4 + custom scrollbar
    │   ├── page.tsx             # table + filters + batch panel + edit dialog
    │   └── api/                 # 14 route handlers (see architecture)
    ├── components/ui/           # 17 shadcn/ui components (New York)
    └── lib/
        ├── ai.ts                # ChatProvider: Zai / Mock, complete()
        ├── batch-runner.ts      # runBatchConcurrent(items, worker, n=5)
        ├── csv-exporter.ts      # exportProductsCsv(products) -> CSV
        ├── csv-parser.ts        # parseProductsCsv(text) -> ParsedProduct[]
        ├── db.ts                # PrismaClient singleton
        ├── description-builder.ts# buildDescriptionPrompt(product, preset)
        ├── generate.ts          # generateForProduct() — orchestrator
        ├── keyword-extractor.ts # extractKeywords(product) -> 3-5 SEO keywords
        ├── preset-resolver.ts   # resolveTonePreset(idOrName)
        ├── seed.ts               # seed built-in presets into DB
        ├── tokenizer.ts         # tokenize() + STOP_WORDS
        ├── tone-presets.ts      # BUILT_IN_PRESETS (5 presets)
        ├── utils.ts             # cn() helper
        ├── variant-builder.ts   # buildVariantPrompt(product, variant)
        └── __tests__/            # 8 test files, 40+ tests
```

---

## Case study: CSV bulk processing + tone presets + SEO keyword injection + A/B variants

### CSV bulk processing

The parser is hand-rolled (not `papaparse`) to keep the dependency surface tiny and to give precise control over row-number error reporting. RFC-4180 quoting is supported (embedded commas, newlines, and `""` escapes). The `ParseError` carries the offending row number (1-indexed, header = row 1) so the user can jump straight to the bad line in their spreadsheet.

The exporter is the inverse: it re-serializes `Product[]` back into the upload CSV format, with two new columns appended — `generated_description` and `keywords`. The quoting logic is shared with the parser's mental model, so re-importing the export round-trips cleanly.

Upsert-by-SKU in the upload route means re-uploading the same catalog updates existing rows in place (preserving generated descriptions for SKUs that haven't changed) instead of duplicating them.

### Tone presets

The five built-in presets live in a single constant `BUILT_IN_PRESETS` so the pure-function consumers (`description-builder`, `variant-builder`, tests) can import them without a database. The same array is auto-seeded into the `TonePreset` table on first `GET /api/tone-presets` so users can extend or override presets through the API.

Each preset is a `(name, systemPrompt, example)` triple. The `example` is fed back to the LLM as few-shot guidance — this turns out to matter more than the system prompt wording itself for matching a target voice.

### SEO keyword injection

`extractKeywords(product)` is a pure function: tokenize `name + category + features`, drop stop words and <3-char tokens, score by `tf * (1 + log2(len))` (length penalty because "leather" is a better SEO keyword than "the"), dedupe, take top 5. If the corpus yields fewer than 3, pad with brand + category as fallbacks.

Keywords are appended as a `Tags: kw1, kw2, kw3` line after the LLM response — the LLM is never asked to produce keywords itself, because (a) we want deterministic output that's assertable in tests and (b) we want to keep token cost predictable.

### A/B variants

The variant builder isolates one variable — the framing — while holding the tone constant. Variant A leads with features, variant B leads with customer benefits. The user picks one as the canonical `generatedDescription` via `POST /api/products/[id]/pick-variant`. The edit dialog shows both variants side-by-side and exposes the pick buttons.

### What I'd do differently with more time

- **Real Shopify / WooCommerce sync** — the CSV exporter is structured to be directly importable by Shopify's CSV importer, but a real OAuth + REST sync would let users push generated descriptions back to their store with one click. Would need a per-store credentials table, token refresh handling, and rate-limit awareness (Shopify's REST API is 2 req/s per shop).
- **Real multi-language** — the prompt builders are language-agnostic, but adding locales would require (a) translated tone-preset examples, (b) a `language` column on `Product` and `TonePreset`, and (c) the LLM being prompted in the target language. The CSV exporter should also gain a `language` column so the import round-trips.
- **Real image alt text** — the keyword extractor already produces SEO-friendly tokens; the same tokens could be assembled into `<img alt="...">` strings for product galleries. Would need an `images` table and a separate prompt that emits one alt-text sentence per image.
- **Real LLM cost tracking** — each `BatchJob` row currently tracks progress but not token cost. Would add `inputTokens` / `outputTokens` / `costUsd` columns to `BatchJob` and have the AI provider surface those after each `complete()` call. The dashboard would then show "today's spend" alongside the existing stats.
- **Streaming generation** — the current `complete()` returns the whole string at once, which is fine for batch jobs but feels slow for single-row generates. A `streamComplete()` variant that emits deltas would let the UI update the description preview progressively.

---

## Resume bullet

**Product Description Generator** (Next.js 16, Prisma, z-ai-web-dev-sdk) — built a bulk e-commerce copywriting tool that ingests a CSV of SKUs + specs and emits SEO-optimized descriptions per product with 5 tone presets, A/B variant generation, and CSV re-export. Wrote a pure-function core (CSV parser, RFC-4180 exporter, TF-IDF-style keyword extractor, concurrency-capped batch runner) that ships with 40+ unit tests, and a thin Next.js Route Handler layer on top that persists to SQLite via Prisma.

---

## License

MIT. See [LICENSE](LICENSE).

---

## Push to GitHub

After committing locally, push to a fresh public repo:

```bash
gh repo create product-description-generator --public --source=. --remote=origin --push
```
