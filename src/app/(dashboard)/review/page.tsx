import Link from 'next/link'
import { prisma } from '@/lib/db'
import {
  CATEGORY_LABEL,
  casualtySummary,
  confidenceBand,
  formatDate,
  formatPlace,
  publisherHost,
  relativeDays,
} from '@/lib/incidents/format'

export const dynamic = 'force-dynamic'

/**
 * The review queue.
 *
 * This is the step that turns a model's proposal into a published claim, so the
 * screen is built for checking rather than for browsing. Each item shows the
 * quotations the extraction was based on and a direct link to the source
 * article, because the reviewer's actual job is comparing those two things.
 *
 * Fabricated seed records are excluded. Asking a person to verify data we
 * invented would waste their time and corrupt the review history.
 */
export default async function ReviewPage() {
  const [incidents, publishedCount, oldest] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { in: ['FLAGGED', 'UNDER_REVIEW'] }, isDemo: false },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        sources: true,
        rawArticles: { select: { bodyMethod: true, content: true } },
      },
    }),
    prisma.incident.count({ where: { status: 'PUBLISHED', isDemo: false } }),
    prisma.incident.findFirst({
      where: { status: { in: ['FLAGGED', 'UNDER_REVIEW'] }, isDemo: false },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-5xl">
      <header className="rule-b pb-5">
        <h1 className="headline">Review queue</h1>
        <p className="mt-1 text-[0.875rem] text-[var(--ink-3)]">
          {incidents.length === 0
            ? 'Nothing is waiting.'
            : `${incidents.length} record${incidents.length === 1 ? '' : 's'} awaiting a human check`}
          {oldest ? ` · oldest ${relativeDays(oldest.createdAt)}` : ''}
          {' · '}
          {publishedCount} published so far
        </p>
      </header>

      {incidents.length === 0 ? (
        <div className="rule-b bg-[var(--paper-2)] px-5 py-12 text-center">
          <p className="text-[0.9375rem] font-medium text-[var(--ink)]">
            The queue is empty.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
            Either everything the pipeline produced has been reviewed, or the
            classifier has not produced anything since the last run. If that seems
            wrong, check collection health before assuming the queue is genuinely clear.
          </p>
          <Link href="/sources/health" className="link-underline mt-3 inline-block text-[0.875rem]">
            Collection health
          </Link>
        </div>
      ) : (
        <div>
          {incidents.map((incident) => {
            const evidence =
              (incident.evidence as { field: string; quote: string }[] | null) ?? []
            const band = confidenceBand(incident.confidenceScore)
            const article = incident.rawArticles[0]
            const thin = !article?.bodyMethod

            return (
              <article key={incident.id} className="rule-b py-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
                  <span className="chip chip-mono">{incident.referenceId}</span>
                  <span>{CATEGORY_LABEL[incident.category]}</span>
                  <span aria-hidden>·</span>
                  <span>{formatPlace(incident)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(incident.occurredAt)}</span>
                  <span aria-hidden>·</span>
                  <span>flagged {relativeDays(incident.createdAt)}</span>
                </div>

                <h2 className="mt-1.5 text-[1.0625rem] font-medium leading-snug">
                  <Link
                    href={`/manage/incidents/${incident.id}`}
                    className="text-[var(--ink)] hover:underline"
                  >
                    {incident.title}
                  </Link>
                </h2>

                <p className="prose-measure mt-1.5 text-[0.875rem] leading-relaxed text-[var(--ink-2)]">
                  {incident.description}
                </p>

                {/* What a reviewer needs first: the claim's support and its
                    weaknesses, not a status badge. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem]">
                  <span
                    className={
                      band.tone === 'ok'
                        ? 'text-[var(--ok)]'
                        : band.tone === 'caution'
                          ? 'text-[var(--caution)]'
                          : 'text-[var(--severity)]'
                    }
                  >
                    {band.label} ({Math.round(incident.confidenceScore)})
                  </span>
                  <span className="text-[var(--ink-4)]" aria-hidden>·</span>
                  <span className="text-[var(--ink-3)]">{casualtySummary(incident)}</span>
                  {thin ? (
                    <>
                      <span className="text-[var(--ink-4)]" aria-hidden>·</span>
                      <span className="text-[var(--caution)]">
                        Feed summary only — read the source before trusting any field
                      </span>
                    </>
                  ) : null}
                  {evidence.length === 0 ? (
                    <>
                      <span className="text-[var(--ink-4)]" aria-hidden>·</span>
                      <span className="text-[var(--caution)]">No supporting quotations</span>
                    </>
                  ) : null}
                </div>

                {evidence.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[0.8125rem] text-[var(--ink-2)]">
                      {evidence.length} supporting quotation
                      {evidence.length === 1 ? '' : 's'}
                    </summary>
                    <ul className="mt-2.5 space-y-2.5">
                      {evidence.map((e, i) => (
                        <li key={i}>
                          <p className="text-[0.6875rem] uppercase tracking-wide text-[var(--ink-4)]">
                            {e.field}
                          </p>
                          <blockquote className="evidence mt-0.5">“{e.quote}”</blockquote>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.8125rem]">
                  <Link
                    href={`/manage/incidents/${incident.id}`}
                    className="rounded bg-[var(--ink)] px-3 py-1.5 font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Review
                  </Link>
                  {incident.sources.map((s) => (
                    <a
                      key={s.id}
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="link-underline"
                    >
                      Open source: {publisherHost(s.sourceUrl)} ↗
                    </a>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
