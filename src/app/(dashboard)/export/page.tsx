'use client'

import { useState } from 'react'
import { Download, FileJson, FileText, Share2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Bulk export.
 *
 * The previous version never checked the response: a 401, a 429 from the
 * rate limiter, or a 500 all produced a blob, and the browser cheerfully
 * downloaded the error body as `evm-incidents-2026-09-09.csv`. Someone would
 * have opened a spreadsheet containing the word "Unauthorized" and had no idea
 * why. The content type is now verified before anything is saved.
 *
 * The anchor is also appended to the document before it is clicked. A detached
 * anchor works in Chromium and silently does nothing in Firefox.
 */

type Format = 'csv' | 'json' | 'wikidata'

const EXTENSION: Record<Format, string> = { csv: 'csv', json: 'json', wikidata: 'jsonld' }

export default function ExportPage() {
  const [loading, setLoading] = useState<Format | null>(null)

  async function exportData(format: Format) {
    setLoading(format)
    try {
      const res = await fetch(`/api/export?format=${format}`)

      if (!res.ok) {
        // The body of a failed export is JSON, not data.
        const detail = await res.json().catch(() => ({}))
        toast.error('The export failed', {
          description:
            detail.error ??
            (res.status === 429
              ? 'The export rate limit was reached. Exports are capped at ten an hour.'
              : `The server returned ${res.status}.`),
        })
        return
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        toast.error('The export was empty', {
          description: 'Nothing matched, so no file was saved.',
        })
        return
      }

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `evm-records-${new Date().toISOString().slice(0, 10)}.${EXTENSION[format]}`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success('Export downloaded', {
        description: `${(blob.size / 1024).toFixed(0)} KB as ${EXTENSION[format].toUpperCase()}.`,
      })
    } catch {
      toast.error('The export failed', {
        description: 'The request did not complete. Check your connection and try again.',
      })
    } finally {
      setLoading(null)
    }
  }

  const options: { id: Format; icon: typeof FileText; label: string; note: string }[] = [
    { id: 'csv', icon: FileText, label: 'CSV', note: 'Spreadsheets and GIS tools' },
    { id: 'json', icon: FileJson, label: 'JSON', note: 'Scripts and analysis' },
    { id: 'wikidata', icon: Share2, label: 'JSON-LD', note: 'Wikidata and knowledge graphs' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="rule-b pb-5">
        <h1 className="headline">Export</h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
          The record set as a file. What you receive depends on your role: everyone gets published
          records, an analyst and above also gets those marked verified.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map(({ id, icon: Icon, label, note }) => {
          const busy = loading === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => exportData(id)}
              disabled={!!loading}
              className="card card-hover flex flex-col items-start gap-2 p-5 text-left disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={22} className="animate-spin text-[var(--navy)]" aria-hidden />
              ) : (
                <Icon size={22} className="text-[var(--ink-3)]" aria-hidden />
              )}
              <span className="text-[0.9375rem] font-semibold text-[var(--ink)]">{label}</span>
              <span className="text-[0.75rem] leading-relaxed text-[var(--ink-3)]">{note}</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-[var(--link)]">
                <Download size={13} aria-hidden />
                {busy ? 'Preparing…' : 'Download'}
              </span>
            </button>
          )
        })}
      </div>

      <section className="card p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">What is in the file</h2>
        <div className="prose-measure mt-2 space-y-2.5 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          <p>
            Every row carries its own provenance: the source URL, when the source published, the
            model and prompt version that extracted it, its confidence, and whether a person
            reviewed it or it met the automated publication criteria. A row you cannot trace back
            to a published article is not in here, because it is not in the database.
          </p>
          <p>
            Victim names, personal identifiers and the sensitive demographic fields are excluded
            from every export, at every role. Casualty figures are the numbers a source stated;
            where a report said &ldquo;several injured&rdquo; the field is zero, so these are lower
            bounds rather than counts.
          </p>
          <p>
            Structured data is <span className="text-[var(--ink)]">CC0</span>. The underlying
            articles remain their publishers&rsquo;, which is why this links to them rather than
            reproducing them.
          </p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Rate limit</h2>
        <p className="prose-measure mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          Ten exports an hour. The public API at{' '}
          <span className="chip-mono">/api/public/incidents</span> is the better route for anything
          automated &mdash; it is paginated, unauthenticated and documented under{' '}
          <span className="text-[var(--ink)]">Developers</span>.
        </p>
      </section>
    </div>
  )
}
