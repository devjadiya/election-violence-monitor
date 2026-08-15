import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'
import { SiteHeader, SiteFooter } from '@/components/public/site-shell'
import {
  CATEGORY_LABEL,
  STAGE_LABEL,
  WEAPON_LABEL,
  confidenceBand,
  formatDate,
  formatDateTime,
  formatPlace,
  publisherHost,
} from '@/lib/incidents/format'

export const dynamic = 'force-dynamic'

async function getIncident(id: string) {
  // findFirst, not findUnique: the visibility filter is not a unique key, so a
  // non-public record must not become reachable by knowing its id.
  return prisma.incident.findFirst({
    where: { id, ...publicIncidentFilter() },
    include: {
      sources: { orderBy: { publishedAt: 'asc' } },
      victims: true,
      followUps: { where: { isConfirmed: true }, orderBy: { date: 'desc' } },
      election: { select: { name: true, country: true, electionType: true, wikidataId: true } },
      rawArticles: { select: { url: true, title: true, publishedAt: true, bodyMethod: true } },
      reviewedBy: { select: { name: true } },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) return { title: 'Incident not found' }
  return {
    title: `${incident.referenceId} — ${incident.title}`,
    description: incident.description.slice(0, 155),
  }
}

/** A labelled fact in the record. Definition list, not a card grid. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rule-b py-2.5">
      <dt className="text-[0.75rem] text-[var(--ink-3)]">{label}</dt>
      <dd className="mt-0.5 text-[0.875rem] text-[var(--ink)]">{children}</dd>
    </div>
  )
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) notFound()

  const band = confidenceBand(incident.confidenceScore)
  const evidence = (incident.evidence as { field: string; quote: string }[] | null) ?? []
  const anyCasualties =
    incident.fatalities > 0 || incident.injured > 0 || incident.arrested > 0

  return (
    <>
      <SiteHeader current="/incidents" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-[0.8125rem]">
          <Link href="/incidents" className="link-underline">
            Incidents
          </Link>
          <span className="mx-1.5 text-[var(--ink-4)]">/</span>
          <span className="chip chip-mono">{incident.referenceId}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* --- The record ------------------------------------------------ */}
          <div>
            <header className="rule-b pb-5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-[var(--ink-3)]">
                <span>{CATEGORY_LABEL[incident.category]}</span>
                <span aria-hidden>·</span>
                <span>{STAGE_LABEL[incident.electionStage]}</span>
                <span aria-hidden>·</span>
                <time dateTime={new Date(incident.occurredAt).toISOString()}>
                  {formatDate(incident.occurredAt)}
                </time>
              </div>
              <h1 className="display mt-2 text-[1.75rem] leading-tight sm:text-[2rem]">
                {incident.title}
              </h1>
              <p className="mt-2 text-[0.875rem] text-[var(--ink-2)]">
                {formatPlace(incident)}
              </p>
            </header>

            <section className="py-6">
              <h2 className="eyebrow mb-2.5">What was reported</h2>
              <p className="prose-measure text-[1rem] leading-relaxed text-[var(--ink)]">
                {incident.description}
              </p>
            </section>

            {/* Casualties stated plainly, including when there were none. */}
            <section className="rule-t py-6">
              <h2 className="eyebrow mb-3">Reported impact</h2>
              {anyCasualties ? (
                <div className="grid grid-cols-3 gap-6 sm:max-w-md">
                  <div>
                    <div className="figure-value text-[var(--severity)]">{incident.fatalities}</div>
                    <div className="figure-label">Killed</div>
                  </div>
                  <div>
                    <div className="figure-value">{incident.injured}</div>
                    <div className="figure-label">Injured</div>
                  </div>
                  <div>
                    <div className="figure-value">{incident.arrested}</div>
                    <div className="figure-label">Arrested</div>
                  </div>
                </div>
              ) : (
                <p className="text-[0.875rem] text-[var(--ink-2)]">
                  No casualties were stated in the source reporting. This means none were
                  reported, not that none occurred.
                </p>
              )}
            </section>

            {/* Evidence: the quotes the extraction was based on. This is the
                point of the whole system — a reader can check the claim. */}
            {evidence.length > 0 ? (
              <section className="rule-t py-6">
                <h2 className="eyebrow mb-1">Supporting quotations</h2>
                <p className="mb-4 text-[0.8125rem] text-[var(--ink-3)]">
                  Passages from the source article that each field was drawn from.
                </p>
                <ul className="space-y-4">
                  {evidence.map((e, idx) => (
                    <li key={idx}>
                      <p className="mb-1 text-[0.6875rem] uppercase tracking-wide text-[var(--ink-4)]">
                        {e.field}
                      </p>
                      <blockquote className="evidence">“{e.quote}”</blockquote>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Sources. Many articles, one incident. */}
            <section className="rule-t py-6">
              <h2 className="eyebrow mb-1">Sources</h2>
              <p className="mb-4 text-[0.8125rem] text-[var(--ink-3)]">
                {incident.sources.length === 1
                  ? 'This record was assembled from one published article.'
                  : `This record was assembled from ${incident.sources.length} published articles reporting the same event.`}
              </p>
              <ol className="space-y-3">
                {incident.sources.map((s, idx) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="tnum mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="link-underline break-words text-[0.875rem]"
                      >
                        {s.sourceName || publisherHost(s.sourceUrl)}
                      </a>
                      <div className="mt-0.5 break-all text-[0.75rem] text-[var(--ink-4)]">
                        {s.sourceUrl}
                      </div>
                      {s.publishedAt ? (
                        <div className="mt-0.5 text-[0.75rem] text-[var(--ink-3)]">
                          Published {formatDate(s.publishedAt)}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {incident.followUps.length > 0 ? (
              <section className="rule-t py-6">
                <h2 className="eyebrow mb-3">Confirmed follow-ups</h2>
                <ul className="space-y-3">
                  {incident.followUps.map((f) => (
                    <li key={f.id}>
                      <div className="text-[0.75rem] text-[var(--ink-3)]">
                        {formatDate(f.date)}
                      </div>
                      <p className="text-[0.875rem] text-[var(--ink-2)]">{f.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* --- Provenance sidebar ---------------------------------------- */}
          <aside className="lg:pt-1">
            <h2 className="eyebrow mb-1">Record details</h2>
            <dl className="rule-t">
              <Fact label="Reference">
                <span className="chip chip-mono">{incident.referenceId}</span>
              </Fact>
              <Fact label="Category">{CATEGORY_LABEL[incident.category]}</Fact>
              <Fact label="Election stage">{STAGE_LABEL[incident.electionStage]}</Fact>
              <Fact label="Weapon">{WEAPON_LABEL[incident.weaponType]}</Fact>
              <Fact label="Date of incident">{formatDate(incident.occurredAt)}</Fact>
              <Fact label="Location">{formatPlace(incident)}</Fact>
              {incident.latitude && incident.longitude ? (
                <Fact label="Coordinates">
                  <span className="tnum">
                    {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                  </span>
                  <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                    Approximate — geocoded from the place name, not a surveyed position.
                  </div>
                </Fact>
              ) : (
                <Fact label="Coordinates">
                  <span className="text-[var(--ink-3)]">Not geocoded</span>
                </Fact>
              )}
              {incident.election ? (
                <Fact label="Election">{incident.election.name}</Fact>
              ) : null}
              <Fact label="Published">{formatDate(incident.publishedAt)}</Fact>
            </dl>

            {/* How this record was made. Never hidden. */}
            <h2 className="eyebrow mt-8 mb-1">How this record was made</h2>
            <dl className="rule-t">
              <Fact label="Origin">
                {incident.isAutoDetected
                  ? 'Detected by automated screening of published reporting'
                  : 'Entered manually'}
              </Fact>
              <Fact label="Human review">
                {incident.reviewedBy?.name
                  ? `Checked by ${incident.reviewedBy.name}`
                  : 'Checked before publication'}
              </Fact>
              <Fact label="Source support">
                <span
                  className={
                    band.tone === 'ok'
                      ? 'text-[var(--ok)]'
                      : band.tone === 'caution'
                        ? 'text-[var(--caution)]'
                        : 'text-[var(--severity)]'
                  }
                >
                  {band.label}
                </span>
                <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                  Model self-assessment, {Math.round(incident.confidenceScore)} of 100. Not a
                  measure of whether the event occurred.
                </div>
              </Fact>
              {incident.extractionModel ? (
                <Fact label="Extraction model">
                  <span className="chip chip-mono">{incident.extractionModel}</span>
                  {incident.promptVersion ? (
                    <span className="chip chip-mono ml-1.5">{incident.promptVersion}</span>
                  ) : null}
                </Fact>
              ) : null}
              {incident.rawArticles[0]?.bodyMethod ? (
                <Fact label="Article text">
                  Full article body retrieved
                  <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                    via {incident.rawArticles[0].bodyMethod}
                  </div>
                </Fact>
              ) : (
                <Fact label="Article text">
                  <span className="text-[var(--caution)]">Feed summary only</span>
                  <div className="mt-0.5 text-[0.75rem] text-[var(--ink-4)]">
                    The full article could not be retrieved, so extraction saw a short
                    summary.
                  </div>
                </Fact>
              )}
              <Fact label="Record updated">{formatDateTime(incident.updatedAt)}</Fact>
            </dl>

            <div className="mt-8">
              <h2 className="eyebrow mb-2">Reuse</h2>
              <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-3)]">
                This record is CC0 1.0. Cite it as{' '}
                <span className="chip chip-mono">{incident.referenceId}</span>.
              </p>
              <Link href="/data" className="link-underline mt-2 inline-block text-[0.8125rem]">
                Download the dataset
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
