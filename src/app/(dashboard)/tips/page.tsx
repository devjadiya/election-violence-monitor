import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { MapPin, CalendarDays } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getActor, hasPermission } from '@/lib/auth/guard'
import { TipActions } from '@/components/tips/tip-actions'
import { PageHeader, Panel, Stat, Empty } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

/**
 * Public tip submissions.
 *
 * Anyone can send one, so this queue is untrusted input by definition and the
 * page is built for triage rather than reading. It needs ANALYST: a tip names
 * places and sometimes people, and deciding one needs no further action is an
 * editorial judgement.
 *
 * The reviewer's name is shown against every handled tip. With two people
 * working the same queue, "reviewed" with nobody attached is how the same item
 * gets worked twice.
 */

interface TipRow {
  id: string
  description: string
  location: string | null
  occurredAt: Date | null
  category: string | null
  isAnonymous: boolean
  isReviewed: boolean
  reviewNotes: string | null
  reviewedAt: Date | null
  createdAt: Date
  reviewedBy: { name: string | null; email: string } | null
}

async function loadTips() {
  return prisma.tipSubmission.findMany({
    orderBy: [{ isReviewed: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      description: true,
      location: true,
      occurredAt: true,
      category: true,
      isAnonymous: true,
      isReviewed: true,
      reviewNotes: true,
      reviewedAt: true,
      createdAt: true,
      reviewedBy: { select: { name: true, email: true } },
    },
  })
}

function TipCard({ tip }: { tip: TipRow }) {
  return (
    <article
      className={`card p-4 sm:p-5 ${tip.isReviewed ? 'opacity-70' : ''}`}
      aria-labelledby={`tip-${tip.id}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip">{tip.isAnonymous ? 'Anonymous' : 'Named submitter'}</span>
            {tip.category ? <span className="chip">{tip.category}</span> : null}
            <span className={`status ${tip.isReviewed ? 'status-active' : 'status-caution'}`}>
              {tip.isReviewed ? 'Reviewed' : 'Awaiting review'}
            </span>
          </div>

          <p
            id={`tip-${tip.id}`}
            className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink)]"
          >
            {tip.description}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
            {tip.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden />
                {tip.location}
              </span>
            ) : null}
            {tip.occurredAt ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} aria-hidden />
                <time dateTime={tip.occurredAt.toISOString()}>
                  {format(tip.occurredAt, 'd MMM yyyy')}
                </time>
              </span>
            ) : null}
            <span>
              Submitted{' '}
              <time dateTime={tip.createdAt.toISOString()}>
                {formatDistanceToNow(tip.createdAt, { addSuffix: true })}
              </time>
            </span>
          </div>

          {tip.isReviewed ? (
            <div className="rule-t mt-3 pt-2.5">
              <p className="text-[0.75rem] text-[var(--ink-3)]">
                Reviewed by{' '}
                <span className="text-[var(--ink-2)]">
                  {tip.reviewedBy?.name ?? tip.reviewedBy?.email ?? 'an earlier version of this system'}
                </span>
                {tip.reviewedAt ? (
                  <>
                    {' '}
                    <time dateTime={tip.reviewedAt.toISOString()}>
                      {formatDistanceToNow(tip.reviewedAt, { addSuffix: true })}
                    </time>
                  </>
                ) : null}
              </p>
              {tip.reviewNotes ? (
                <p className="prose-measure mt-1.5 bg-[var(--paper-2)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--ink-2)]">
                  {tip.reviewNotes}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <TipActions tip={{ id: tip.id, isReviewed: tip.isReviewed }} />
      </div>
    </article>
  )
}

export default async function TipsPage() {
  const actor = await getActor()
  if (!actor || !hasPermission(actor.role, 'ANALYST')) redirect('/dashboard')

  const tips = await loadTips()
  const pending = tips.filter((t) => !t.isReviewed)
  const reviewed = tips.filter((t) => t.isReviewed)
  const oldest = pending[pending.length - 1]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Tips"
        lede="Reports sent through the public form. Every one is unverified by definition — a tip is a lead to check, not a record."
        action={
          <Link href="/submit" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            View public form
          </Link>
        }
      />

      <section className="rule-b grid grid-cols-2 gap-x-6 gap-y-6 pb-6 sm:grid-cols-3">
        <Stat value={pending.length} label="Awaiting review" />
        <Stat value={reviewed.length} label="Reviewed" />
        <Stat
          value={oldest ? formatDistanceToNow(oldest.createdAt) : '—'}
          label="Oldest unreviewed"
          note={oldest ? 'has been waiting' : 'nothing waiting'}
        />
      </section>

      {tips.length === 0 ? (
        <Empty title="No tips have been submitted.">
          <p>
            Reports sent through the public form appear here. Nothing arriving is not the same as
            nothing happening &mdash; the form has to be found before it can be used.
          </p>
        </Empty>
      ) : (
        <>
          {pending.length > 0 ? (
            <section>
              <h2 className="eyebrow">Awaiting review ({pending.length})</h2>
              <div className="mt-3 space-y-3">
                {pending.map((tip) => (
                  <TipCard key={tip.id} tip={tip} />
                ))}
              </div>
            </section>
          ) : null}

          {reviewed.length > 0 ? (
            <section className="section-sm">
              <h2 className="eyebrow">Reviewed ({reviewed.length})</h2>
              <div className="mt-3 space-y-3">
                {reviewed.map((tip) => (
                  <TipCard key={tip.id} tip={tip} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Panel className="p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[var(--ink)]">Handling a tip</h2>
        <div className="prose-measure mt-2 space-y-2.5 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
          <p>
            A tip is an allegation from an anonymous member of the public. It never becomes a
            published record on its own: creating a record from one starts the same review path as
            anything the pipeline extracts, and it still needs a source that can be cited.
          </p>
          <p>
            Marking a tip reviewed records your name against it. If someone else has already done
            so, saving is refused rather than overwriting their note.
          </p>
        </div>
      </Panel>
    </div>
  )
}
