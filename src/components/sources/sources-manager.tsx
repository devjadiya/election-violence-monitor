'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Rss, Plus, RefreshCw, Trash2, Play } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Panel, TableShell, Empty, StateBadge } from '@/components/dashboard/ui'

/**
 * Source registry management.
 *
 * The previous version was a read-only table with an add form that inserted a
 * row and did nothing else. A mistyped feed URL was stored as happily as a
 * working one, there was no way to remove anything, and the page claimed
 * collection "runs hourly via cron" when the schedule is daily and gated on an
 * election window.
 *
 * Every control here now performs the action it names, and reports what
 * actually happened rather than that a request was sent.
 */

interface Source {
  id: string
  name: string
  url: string
  rssUrl: string | null
  sourceType: string
  country: string | null
  language: string
  isActive: boolean
  trustScore: number
  lastFetchedAt: Date | string | null
  lastSuccessAt: Date | string | null
  lastError: string | null
  consecutiveFailures: number
  _count: { rawArticles: number }
}

interface Props {
  sources: Source[]
  /** ADMIN gates removal and activation; everyone here may add and fetch. */
  isAdmin: boolean
}

interface ProbeSample {
  title: string
  url: string
}

const EMPTY_FORM = { name: '', url: '', rssUrl: '', country: '', language: 'en' }

export function SourcesManager({ sources, isAdmin }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probeSample, setProbeSample] = useState<ProbeSample[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function addSource(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProbeError(null)
    setProbeSample([])

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // The form stays open and populated: the feed URL is the hard part to
        // retype, and losing it on a validation failure is the fastest way to
        // make someone give up.
        setProbeError(data.error ?? `The server refused the change (${res.status}).`)
        return
      }

      const fetched = data.fetched as
        | { found: number; stored: number; duplicates: number; error?: string }
        | null

      if (fetched?.error) {
        toast.warning(`${form.name} was added, but the first read failed`, {
          description: fetched.error,
        })
      } else if (fetched) {
        toast.success(`${form.name} added`, {
          description:
            fetched.stored > 0
              ? `Read the feed and stored ${fetched.stored} new article${fetched.stored === 1 ? '' : 's'}${fetched.duplicates > 0 ? `, skipping ${fetched.duplicates} already held` : ''}.`
              : `Read ${fetched.found} items, all of which we already held.`,
        })
      } else {
        toast.success(`${form.name} added`, {
          description: 'No feed URL was given, so there is nothing to collect yet.',
        })
      }

      setShowAdd(false)
      setForm(EMPTY_FORM)
      refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function fetchNow(source: Source) {
    setBusyId(source.id)
    try {
      const res = await fetch(`/api/sources/${source.id}/fetch`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        toast.error(`Could not read ${source.name}`, {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        refresh()
        return
      }

      toast.success(`Read ${source.name}`, {
        description:
          data.stored > 0
            ? `${data.stored} new article${data.stored === 1 ? '' : 's'} stored from ${data.found} in the feed.`
            : `${data.found} items in the feed, all already held.`,
      })
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(source: Source) {
    setBusyId(source.id)
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error('Could not change the source', {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        return
      }
      toast.success(source.isActive ? `${source.name} deactivated` : `${source.name} reactivated`)
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(source: Source) {
    const articles = source._count.rawArticles
    const warning =
      articles > 0
        ? `${source.name} has ${articles.toLocaleString('en-US')} stored articles.\n\nIt will be deactivated and collection will stop. The articles are kept, because published records cite them.\n\nContinue?`
        : `${source.name} has never returned an article and will be removed entirely.\n\nContinue?`

    if (!window.confirm(warning)) return

    setBusyId(source.id)
    try {
      const res = await fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('Could not remove the source', {
          description: data.error ?? `The server returned ${res.status}.`,
        })
        return
      }
      toast.success(data.action === 'deleted' ? 'Source removed' : 'Source deactivated', {
        description: data.message,
      })
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  const active = sources.filter((s) => s.isActive).length
  const failing = sources.filter((s) => s.isActive && s.consecutiveFailures > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-[var(--ink-3)]">
          {active} active of {sources.length}
          {failing > 0 ? ` · ${failing} currently failing` : ''}
        </p>
        <button
          type="button"
          onClick={() => setShowAdd((open) => !open)}
          className="btn btn-secondary"
        >
          <Plus size={14} aria-hidden /> Add source
        </button>
      </div>

      {showAdd ? (
        <Panel className="p-5">
          <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Add a source</h2>
          <p className="prose-measure mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
            The feed is fetched before the source is saved. If it cannot be read, nothing is
            stored and the reason is shown here — a source that produces nothing is worse than no
            source, because it looks like coverage.
          </p>

          <form onSubmit={addSource} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="figure-label">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Premium Times Nigeria"
                className="mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
              />
            </label>
            <label className="block">
              <span className="figure-label">Website URL</span>
              <input
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://premiumtimesng.com"
                className="mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
              />
            </label>
            <label className="block">
              <span className="figure-label">RSS or Atom feed URL</span>
              <input
                value={form.rssUrl}
                onChange={(e) => setForm((f) => ({ ...f, rssUrl: e.target.value }))}
                placeholder="https://premiumtimesng.com/feed"
                className="mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
              />
            </label>
            <label className="block">
              <span className="figure-label">Country</span>
              <input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="Nigeria"
                className="mt-1 w-full border border-[var(--rule-2)] bg-[var(--paper)] px-3 py-2 text-[0.875rem] text-[var(--ink)] outline-none focus:border-[var(--navy-3)]"
              />
            </label>

            {probeError ? (
              <p className="sm:col-span-2 border-l-2 border-[var(--severity)] bg-[var(--severity-tint)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--severity)]">
                {probeError}
              </p>
            ) : null}

            {probeSample.length > 0 ? (
              <div className="sm:col-span-2 bg-[var(--paper-2)] px-3 py-2">
                <p className="figure-label">Most recent items in this feed</p>
                <ul className="mt-1 space-y-0.5">
                  {probeSample.map((item) => (
                    <li key={item.url} className="truncate text-[0.8125rem] text-[var(--ink-2)]">
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Checking the feed…' : 'Check feed and add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false)
                  setProbeError(null)
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {sources.length === 0 ? (
        <Empty title="No sources registered.">
          <p>
            The pipeline can only find what it is pointed at. Add a publisher&rsquo;s RSS feed to
            begin collecting.
          </p>
        </Empty>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Articles</th>
              <th scope="col">Last success</th>
              <th scope="col">State</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const busy = busyId === source.id || pending
              return (
                <tr key={source.id} className={source.isActive ? '' : 'opacity-60'}>
                  <td>
                    <div className="flex items-start gap-2">
                      {source.rssUrl ? (
                        <Rss size={13} className="mt-1 shrink-0 text-[var(--ink-4)]" aria-hidden />
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--ink)]">{source.name}</div>
                        <div className="truncate text-[0.75rem] text-[var(--ink-4)]">
                          {source.url}
                        </div>
                        {source.lastError && source.isActive ? (
                          <div className="mt-0.5 text-[0.75rem] text-[var(--severity)]">
                            {source.lastError.slice(0, 120)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="tnum text-[var(--ink-2)]">
                    {source._count.rawArticles.toLocaleString('en-US')}
                  </td>
                  <td className="whitespace-nowrap text-[0.8125rem] text-[var(--ink-3)]">
                    {source.lastSuccessAt
                      ? formatDistanceToNow(new Date(source.lastSuccessAt), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td>
                    <StateBadge ok={source.isActive} yes="Collecting" no="Stopped" />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {source.rssUrl ? (
                        <button
                          type="button"
                          onClick={() => fetchNow(source)}
                          disabled={busy}
                          title="Read this feed now"
                          aria-label={`Read ${source.name} now`}
                          className="flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)] disabled:opacity-40"
                        >
                          <RefreshCw
                            size={14}
                            className={busy ? 'animate-spin' : ''}
                            aria-hidden
                          />
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleActive(source)}
                            disabled={busy}
                            title={source.isActive ? 'Stop collecting' : 'Resume collecting'}
                            aria-label={
                              source.isActive
                                ? `Stop collecting ${source.name}`
                                : `Resume collecting ${source.name}`
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)] disabled:opacity-40"
                          >
                            <Play size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(source)}
                            disabled={busy}
                            title="Remove this source"
                            aria-label={`Remove ${source.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-3)] hover:bg-[var(--severity-tint)] hover:text-[var(--severity)] disabled:opacity-40"
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
