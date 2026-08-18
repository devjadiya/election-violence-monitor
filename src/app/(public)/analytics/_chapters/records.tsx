import { getRecordsChapter } from '@/lib/analytics'
import { FiguresTable } from '@/components/analytics/figures-table'
import {
  CategoriesChart,
  CompletenessChart,
  ConfidenceChart,
  EvidenceChart,
  FamilyStageChart,
  GeoPrecisionChart,
  LifecycleChart,
  PlacesChart,
  PublisherLinksChart,
  RecordLatencyChart,
} from '@/components/analytics/charts/record-charts'

/**
 * Chapter 3 — the published record set.
 *
 * Ten views of the same rows: what kind of incident and where, how well the
 * location is known, how much of each record is quoted from its source, how
 * long it took to exist, and which publishers it rests on.
 *
 * Every mark is one record. At this size an average would be a lie, so nothing
 * here is smoothed or bucketed where a record could be its own mark. The
 * layout grows with the data — chart heights are computed from row counts, so
 * a hundred records lay out correctly without a code change.
 */
export async function RecordsChapter() {
  const result = await getRecordsChapter()

  if (!result.ok) {
    return (
      <section className="section-sm">
        <h2 className="headline">The published records</h2>
        <p className="rule-t mt-4 bg-[var(--paper-2)] px-4 py-6 text-[0.875rem] text-[var(--ink-3)]">
          This section could not be read from the database at{' '}
          <time dateTime={result.at.toISOString()}>
            {result.at.toISOString().slice(11, 16)} UTC
          </time>
          . The figures are not missing; they were not retrieved.
        </p>
      </section>
    )
  }

  const { chapter } = result
  const { n } = chapter

  if (n.records === 0) {
    return (
      <section className="section-sm">
        <h2 className="headline">The published records</h2>
        <p className="prose-measure mt-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
          Nothing has been published, so there is nothing here to chart. Drawing an empty
          version of these ten charts would suggest a record set that does not exist.
        </p>
      </section>
    )
  }

  return (
    <section className="section-sm">
      <h2 className="headline">The published records</h2>
      <p className="prose-measure mt-1.5 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
        Ten views of the {n.records} published records, drawn from {n.publishers} publisher
        {n.publishers === 1 ? '' : 's'} across {n.countries}{' '}
        {n.countries === 1 ? 'country' : 'countries'}. Every mark is one record — nothing here is
        an average, because at this size an average would say more than the data can support.
      </p>

      {/* Where, and what kind. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FamilyStageChart viz={chapter.familyStage}>
          <FiguresTable table={chapter.familyStage.figures} />
        </FamilyStageChart>

        <PlacesChart viz={chapter.places}>
          <FiguresTable table={chapter.places.figures} />
        </PlacesChart>

        <CategoriesChart viz={chapter.categories}>
          <FiguresTable table={chapter.categories.figures} />
        </CategoriesChart>

        <GeoPrecisionChart viz={chapter.geoPrecision}>
          <FiguresTable table={chapter.geoPrecision.figures} />
        </GeoPrecisionChart>
      </div>

      {/* What each record is worth to someone who wants to cite it. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ConfidenceChart viz={chapter.confidence}>
          <FiguresTable table={chapter.confidence.figures} />
        </ConfidenceChart>

        <EvidenceChart viz={chapter.evidence}>
          <FiguresTable table={chapter.evidence.figures} />
        </EvidenceChart>
      </div>

      <div className="mt-4">
        <CompletenessChart viz={chapter.completeness}>
          <FiguresTable table={chapter.completeness.figures} />
        </CompletenessChart>
      </div>

      {/* How fast, and on whose reporting. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <LifecycleChart viz={chapter.lifecycle}>
          <FiguresTable table={chapter.lifecycle.figures} />
        </LifecycleChart>

        <PublisherLinksChart viz={chapter.publishers}>
          <FiguresTable table={chapter.publishers.figures} />
        </PublisherLinksChart>
      </div>

      <div className="mt-4">
        <RecordLatencyChart viz={chapter.latency}>
          <FiguresTable table={chapter.latency.figures} />
        </RecordLatencyChart>
      </div>
    </section>
  )
}
