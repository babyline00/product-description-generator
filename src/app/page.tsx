'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  Download,
  Sparkles,
  Trash2,
  Pencil,
  RefreshCw,
  Check,
  Loader2,
  Wand2,
  Package,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

type ProductStatus = 'pending' | 'generated' | 'error'

interface Product {
  id: string
  sku: string
  name: string
  brand: string | null
  category: string | null
  features: string
  specs: string
  price: number | null
  currentDescription: string | null
  generatedDescription: string | null
  variantA: string | null
  variantB: string | null
  tonePreset: string | null
  keywords: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface TonePreset {
  id: string
  name: string
  systemPrompt: string
  example: string
}

interface BatchJob {
  id: string
  tonePresetId: string
  productIds: string
  status: string
  progress: number
  total: number
  startedAt: string
  completedAt: string | null
}

interface Stats {
  products: number
  generated: number
  pending: number
  batchJobs: number
}

interface Filters {
  status: 'all' | ProductStatus
  category: string
  q: string
  tonePresetId: string
  generateVariants: boolean
}

const DEFAULT_FILTERS: Filters = {
  status: 'all',
  category: '',
  q: '',
  tonePresetId: '',
  generateVariants: false,
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '...' : s
}

function formatFeatures(raw: string): string[] {
  if (!raw) return []
  return raw.split(';').map((s) => s.trim()).filter(Boolean)
}

function previewDescription(p: Product): string {
  return p.generatedDescription ?? p.currentDescription ?? ''
}

export default function Page() {
  const [products, setProducts] = useState<Product[]>([])
  const [presets, setPresets] = useState<TonePreset[]>([])
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [stats, setStats] = useState<Stats>({ products: 0, generated: 0, pending: 0, batchJobs: 0 })
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<null | string>(null) // busy id (or 'batch', 'upload', 'export')
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Data fetchers ------------------------------------------------------
  const refreshProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.status !== 'all') params.set('status', filters.status)
      if (filters.category) params.set('category', filters.category)
      if (filters.q) params.set('q', filters.q)
      const res = await fetch('/api/products?' + params.toString())
      const json = await res.json()
      if (res.ok) setProducts(json.products ?? [])
      else toast.error(json.error ?? 'Failed to load products')
    } catch (e) {
      toast.error('Failed to load products: ' + (e as Error).message)
    }
  }, [filters.status, filters.category, filters.q])

  const refreshPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/tone-presets')
      const json = await res.json()
      if (res.ok) setPresets(json.presets ?? [])
    } catch {
      // ignore — UI still works with empty preset list (server defaults to premium)
    }
  }, [])

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/batch-jobs')
      const json = await res.json()
      if (res.ok) setJobs(json.jobs ?? [])
    } catch {
      // ignore
    }
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      const json = await res.json()
      if (res.ok) setStats(json)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refreshPresets()
    refreshJobs()
    refreshStats()
  }, [refreshPresets, refreshJobs, refreshStats])

  useEffect(() => {
    refreshProducts()
  }, [refreshProducts])

  // Poll batch jobs while at least one is running.
  useEffect(() => {
    const anyRunning = jobs.some((j) => j.status === 'running')
    if (!anyRunning) return
    const t = setInterval(() => {
      refreshJobs()
      refreshStats()
      refreshProducts()
    }, 1500)
    return () => clearInterval(t)
  }, [jobs, refreshJobs, refreshStats, refreshProducts])

  // ---- Mutations ----------------------------------------------------------
  async function handleUploadCsv(file: File) {
    setBusy('upload')
    try {
      const form = new FormData()
      form.append('csv', file)
      const res = await fetch('/api/products/upload-csv', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Upload failed')
        return
      }
      toast.success(`Imported ${json.count} product(s) from CSV`)
      await Promise.all([refreshProducts(), refreshStats()])
    } catch (e) {
      toast.error('Upload failed: ' + (e as Error).message)
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleExportCsv() {
    setBusy('export')
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      const res = await fetch('/api/products/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Export failed')
        return
      }
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'products-with-descriptions.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${selected.size > 0 ? selected.size : 'all'} product(s) to CSV`)
    } catch (e) {
      toast.error('Export failed: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerate(productId: string) {
    setBusy(productId)
    try {
      const res = await fetch('/api/products/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          tonePresetId: filters.tonePresetId || undefined,
          generateVariants: filters.generateVariants,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Generation failed')
        return
      }
      toast.success(`Generated description for ${json.product.sku}`)
      await Promise.all([refreshProducts(), refreshStats()])
    } catch (e) {
      toast.error('Generation failed: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerateBatch() {
    if (selected.size === 0) {
      toast.error('Select at least one product first')
      return
    }
    setBusy('batch')
    try {
      const res = await fetch('/api/products/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selected),
          tonePresetId: filters.tonePresetId || undefined,
          generateVariants: filters.generateVariants,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Batch generation failed')
        return
      }
      toast.success(
        `Batch done — ${json.products?.length ?? 0}/${selected.size} generated${
          json.errors?.length ? ` (${json.errors.length} errors)` : ''
        }`,
      )
      await Promise.all([refreshProducts(), refreshStats(), refreshJobs()])
    } catch (e) {
      toast.error('Batch failed: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('Delete this product?')) return
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Delete failed')
        return
      }
      toast.success('Product deleted')
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
      await Promise.all([refreshProducts(), refreshStats()])
    } catch (e) {
      toast.error('Delete failed: ' + (e as Error).message)
    }
  }

  async function handlePickVariant(productId: string, variant: 'a' | 'b') {
    setBusy(productId)
    try {
      const res = await fetch(`/api/products/${productId}/pick-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Pick failed')
        return
      }
      toast.success(`Set variant ${variant.toUpperCase()} as the canonical description`)
      await refreshProducts()
    } catch (e) {
      toast.error('Pick failed: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function openEdit(p: Product) {
    setEditTarget(p)
    setEditForm({
      name: p.name,
      brand: p.brand ?? '',
      category: p.category ?? '',
      features: p.features,
      specs: p.specs,
      price: p.price !== null ? String(p.price) : '',
      currentDescription: p.currentDescription ?? '',
      generatedDescription: p.generatedDescription ?? '',
    })
  }

  async function saveEdit() {
    if (!editTarget) return
    try {
      const patch: Record<string, unknown> = {
        name: editForm.name,
        brand: editForm.brand || null,
        category: editForm.category || null,
        features: editForm.features,
        specs: editForm.specs,
        price: editForm.price === '' ? null : Number(editForm.price),
        currentDescription: editForm.currentDescription || null,
        generatedDescription: editForm.generatedDescription || null,
      }
      const res = await fetch(`/api/products/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Save failed')
        return
      }
      toast.success('Product updated')
      setEditTarget(null)
      await refreshProducts()
    } catch (e) {
      toast.error('Save failed: ' + (e as Error).message)
    }
  }

  // ---- Selection helpers --------------------------------------------------
  const allFilteredIds = useMemo(() => products.map((p) => p.id), [products])
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id))
  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allFilteredIds))
    }
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.category) set.add(p.category)
    return Array.from(set).sort()
  }, [products])

  // ---- Render -------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-base sm:text-lg">
            <Package className="size-5" aria-hidden />
            <span>Product Description Generator</span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              v1.0
            </Badge>
          </div>
          <div className="flex-1" />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUploadCsv(f)
            }}
          />
          <Button
            variant="default"
            size="sm"
            disabled={busy === 'upload'}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy === 'upload' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Upload CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy === 'export' || products.length === 0}
            onClick={handleExportCsv}
          >
            {busy === 'export' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Export CSV
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1400px] w-full px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* LEFT: filters + table */}
        <section className="flex flex-col gap-4 min-w-0">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Products" value={stats.products} />
            <StatCard label="Generated" value={stats.generated} />
            <StatCard label="Pending" value={stats.pending} />
            <StatCard label="Batch jobs" value={stats.batchJobs} />
          </div>

          {/* Filter bar */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div className="col-span-2 sm:col-span-1 lg:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="filter-q">Search</Label>
                  <Input
                    id="filter-q"
                    placeholder="name, SKU, brand"
                    value={filters.q}
                    onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => setFilters({ ...filters, status: v as Filters['status'] })}
                  >
                    <SelectTrigger id="filter-status" className="w-full">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="generated">Generated</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-category">Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(v) => setFilters({ ...filters, category: v })}
                  >
                    <SelectTrigger id="filter-category" className="w-full">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-preset">Tone preset</Label>
                  <Select
                    value={filters.tonePresetId}
                    onValueChange={(v) => setFilters({ ...filters, tonePresetId: v })}
                  >
                    <SelectTrigger id="filter-preset" className="w-full">
                      <SelectValue placeholder="Premium (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-batch" className="flex items-center gap-2">
                    <Checkbox
                      id="filter-batch"
                      checked={filters.generateVariants}
                      onCheckedChange={(v) =>
                        setFilters({ ...filters, generateVariants: v === true })
                      }
                    />
                    A/B variants
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshProducts}
                      aria-label="Refresh products"
                    >
                      <RefreshCw className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={selected.size === 0 || busy === 'batch'}
                  onClick={handleGenerateBatch}
                >
                  {busy === 'batch' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Wand2 className="size-4" aria-hidden />
                  )}
                  Generate {selected.size > 0 ? `${selected.size} ` : ''}selected
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected of {products.length} shown
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Product table */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base">Products</CardTitle>
              <CardDescription>
                Upload a CSV to populate this table, then generate descriptions in
                bulk with a tone preset.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No products yet. Click <strong>Upload CSV</strong> to import a
                  catalog. Need a sample? Use this header:{' '}
                  <code className="px-1 py-0.5 rounded bg-muted">
                    sku,name,brand,category,features,specs,price,current_description
                  </code>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto pdg-scroll rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead className="min-w-[140px]">SKU</TableHead>
                        <TableHead className="min-w-[200px]">Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tone</TableHead>
                        <TableHead className="min-w-[280px]">Description preview</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(p.id)}
                              onCheckedChange={() => toggleSelect(p.id)}
                              aria-label={`Select ${p.sku}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            {p.brand && (
                              <div className="text-xs text-muted-foreground">{p.brand}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.category ? (
                              <Badge variant="outline">{p.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.price !== null ? `$${p.price.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>
                            {p.tonePreset ? (
                              <Badge variant="secondary">{p.tonePreset}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            {previewDescription(p) ? (
                              <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                                {truncate(previewDescription(p), 200)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {p.keywords && (
                              <div className="mt-1 text-xs text-muted-foreground truncate">
                                Tags: {p.keywords}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={busy === p.id}
                                onClick={() => handleGenerate(p.id)}
                                aria-label="Generate description"
                                title="Generate description"
                              >
                                {busy === p.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Sparkles className="size-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(p)}
                                aria-label="Edit"
                                title="Edit"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(p.id)}
                                aria-label="Delete"
                                title="Delete"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* RIGHT: batch jobs panel */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <Card className="h-full max-h-[calc(100vh-120px)] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Batch jobs</CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={refreshJobs}
                  aria-label="Refresh jobs"
                  className="size-7"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
              <CardDescription>
                Bulk-generation runs and their progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {jobs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No batch jobs yet. Select products in the table and click
                  Generate to start one.
                </div>
              ) : (
                <div className="max-h-full overflow-y-auto pdg-scroll pr-1 flex flex-col gap-3">
                  {jobs.map((j) => {
                    const pct = j.total > 0 ? Math.round((j.progress / j.total) * 100) : 0
                    const running = j.status === 'running'
                    return (
                      <div key={j.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            #{j.id.slice(-6)}
                          </span>
                          <Badge
                            variant={
                              j.status === 'completed'
                                ? 'default'
                                : j.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {j.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Tone: {j.tonePresetId}</span>
                          <span>
                            {j.progress}/{j.total}
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <div className="text-xs text-muted-foreground">
                          {running ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" />
                              Generating...
                            </span>
                          ) : j.completedAt ? (
                            <span>
                              Done {new Date(j.completedAt).toLocaleTimeString()}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="mt-auto border-t py-3 px-4 sm:px-6 text-center text-xs text-muted-foreground">
        Product Description Generator &middot; Next.js 16 + Prisma + z-ai-web-dev-sdk &middot;
        English-only MVP &middot; CSV in / CSV out
      </footer>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pdg-scroll">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update the source fields or rewrite the generated description. Use
              the buttons below to pick a variant as the canonical description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-sku">SKU (read-only)</Label>
                <Input id="e-sku" value={editTarget?.sku ?? ''} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-price">Price</Label>
                <Input
                  id="e-price"
                  value={editForm.price ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-name">Name</Label>
              <Input
                id="e-name"
                value={editForm.name ?? ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-brand">Brand</Label>
                <Input
                  id="e-brand"
                  value={editForm.brand ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-category">Category</Label>
                <Input
                  id="e-category"
                  value={editForm.category ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-features">Features (semicolon-separated)</Label>
              <Textarea
                id="e-features"
                rows={2}
                value={editForm.features ?? ''}
                onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
              />
              <span className="text-xs text-muted-foreground">
                {formatFeatures(editForm.features ?? '').length} features parsed
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-specs">Specs (key=value;key=value)</Label>
              <Textarea
                id="e-specs"
                rows={2}
                value={editForm.specs ?? ''}
                onChange={(e) => setEditForm({ ...editForm, specs: e.target.value })}
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-current">Current description</Label>
              <Textarea
                id="e-current"
                rows={3}
                value={editForm.currentDescription ?? ''}
                onChange={(e) => setEditForm({ ...editForm, currentDescription: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-gen">Generated description</Label>
              <Textarea
                id="e-gen"
                rows={5}
                value={editForm.generatedDescription ?? ''}
                onChange={(e) => setEditForm({ ...editForm, generatedDescription: e.target.value })}
              />
            </div>
            {editTarget && (editTarget.variantA || editTarget.variantB) && (
              <div className="rounded-md border p-2">
                <div className="text-xs font-medium mb-2">A/B variants</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === editTarget.id}
                    onClick={() => handlePickVariant(editTarget.id, 'a')}
                  >
                    <Check className="size-3.5" /> Use variant A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === editTarget.id}
                    onClick={() => handlePickVariant(editTarget.id, 'b')}
                  >
                    <Check className="size-3.5" /> Use variant B
                  </Button>
                </div>
                {editTarget.variantA && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Variant A preview
                    </summary>
                    <pre className="mt-1 text-xs whitespace-pre-wrap rounded bg-muted p-2 max-h-40 overflow-y-auto pdg-scroll">
                      {editTarget.variantA}
                    </pre>
                  </details>
                )}
                {editTarget.variantB && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Variant B preview
                    </summary>
                    <pre className="mt-1 text-xs whitespace-pre-wrap rounded bg-muted p-2 max-h-40 overflow-y-auto pdg-scroll">
                      {editTarget.variantB}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'generated')
    return (
      <Badge className="gap-1">
        <Check className="size-3" /> Generated
      </Badge>
    )
  if (status === 'error')
    return <Badge variant="destructive">Error</Badge>
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="size-3" /> Pending
    </Badge>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-3">
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
