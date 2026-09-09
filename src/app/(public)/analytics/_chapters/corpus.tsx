import { getCorpusChapter } from '@/lib/analytics'
import { FiguresTable } from '@/components/analytics/figures-table'
import { ShareFigure } from '@/components/analytics/static-figures'
import {
  ArticleLengthChart,
  CollectionCalendarChart,
  DedupChart,
  ExtractionMatrixChart,
  FeedStalenessChart,
  PublicationHourChart,
  PublisherVolumeChart,
  TrustVsVolumeChart,
  VolumeOverTimeChart,
} from '@/components/analytics/charts/corpus-charts'

/**
 * Chapter 1 — the corpus.
 *
 * What this platform actually reads, which is a different question from what
 * it finds. Every chart here describes our own collection: a publisher with a
 * larger bar is one whose feed we poll successfully and can parse, not a
 * busier newsroom.
 *
 * It is placed before the screening chapter deliberately. The funnel makes no
 * sense until you know what is going into it.
 */
export async function CorpusChapter() {
  const result = await getCorpusChapter()

  if (!result.ok) {
    return (
      <section className="section-sm">
        <h2 className="headline">The corpus</h2>
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

  return (
    <section className="section-sm">
      <h2 className="headline">The corpus</h2>
      <p className="prose-measure mt-1.5 text-[0.875rem] leading-relaxed text-[var(--ink-3)]">
        {n.articles.toLocaleString('en-US')} articles from {n.sources} configured publishers over{' '}
        {n.days} days of collection. This describes what we read, not what was published: a
        publisher is here because its feed can be polled and parsed, and{' '}
        {n.silentSources} of them have never returned anything at all.
      </p>

      <div className="mt-5 grid gap-4">
        <PublisherVolumeChart viz={chapter.publisherVolume}>
          <FiguresTable table={chapter.publisherVolume.figures} />
        </PublisherVolumeChart>

        <CollectionCalendarChart viz={chapter.calendar}>
          <FiguresTable table={chapter.calendar.figures} />
        </CollectionCalendarChart>

        <VolumeOverTimeChart viz={chapter.volumeOverTime}>
          <FiguresTable table={chapter.volumeOverTime.figures} />
        </VolumeOverTimeChart>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FeedStalenessChart viz={chapter.staleness}>
          <FiguresTable table={chapter.staleness.figures} />
        </FeedStalenessChart>

        <TrustVsVolumeChart viz={chapter.trust}>
          <FiguresTable table={chapter.trust.figures} />
        </TrustVsVolumeChart>

        <ArticleLengthChart viz={chapter.length}>
          <FiguresTable table={chapter.length.figures} />
        </ArticleLengthChart>

        <PublicationHourChart viz={chapter.publicationHour}>
          <FiguresTable table={chapter.publicationHour.figures} />
        </PublicationHourChart>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ExtractionMatrixChart viz={chapter.extractionByPublisher}>
          <FiguresTable table={chapter.extractionByPublisher.figures} />
        </ExtractionMatrixChart>

        <ShareFigure viz={chapter.extractionCoverage} unit="articles collected" />
      </div>

      <div className="mt-4">
        <DedupChart viz={chapter.dedup}>
          <FiguresTable table={chapter.dedup.figures} />
        </DedupChart>
      </div>
    </section>
  )
}
