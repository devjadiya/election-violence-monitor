import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader, SiteFooter, PageHeader } from '@/components/public/site-shell'

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How incident records are collected, screened, extracted, reviewed and published — including what the method cannot do.',
}

/**
 * The methodology page.
 *
 * Written to be checkable rather than reassuring. If a reader cannot work out
 * from this page how a given number came to exist, and where it might be wrong,
 * the page has failed.
 */

function Step({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rule-b py-6">
      <div className="flex items-baseline gap-3">
        <span className="tnum text-[0.8125rem] text-[var(--ink-4)]">{n}</span>
        <h2 className="headline">{title}</h2>
      </div>
      <div className="prose-measure mt-2.5 space-y-3 pl-[1.75rem] text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
        {children}
      </div>
    </section>
  )
}

export default function MethodologyPage() {
  return (
    <>
      <SiteHeader current="/methodology" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader
          title="Methodology"
          lede="How a record gets here, what each step can and cannot establish, and where the method is weakest."
        />

        <div className="mt-2">
          <Step n="01" title="Collection">
            <p>
              Once a day, at 09:00 UTC, the monitor reads the RSS feeds of every active
              publication in the{' '}
              <Link href="/sources" className="link-underline">source directory</Link>. New
              articles are stored; nothing is judged at this stage.
            </p>
            <p>
              Articles are deduplicated on a normalised form of their URL, so tracking
              parameters, AMP variants and{' '}
              <code className="text-[0.875em]">www</code> prefixes do not produce repeats.
            </p>
          </Step>

          <Step n="02" title="Screening">
            <p>
              Each article is assessed on two questions: does it concern an election, and
              does it describe violence, intimidation or disruption of that process? Both
              must be true for it to continue. Ordinary political news, campaign
              announcements and opinion pieces are excluded.
            </p>
            <p>
              This is done by a language model. It is a filter, not a finding — an article
              passing it is not yet a record of anything.
            </p>
          </Step>

          <Step n="03" title="Extraction">
            <p>
              Where the published article can be retrieved, the full text is used. Where it
              cannot, only the feed summary is available, and the resulting record is marked
              accordingly and given lower confidence.
            </p>
            <p>
              Structured fields are pulled from the text: category, location, date, election
              stage, weapon, and casualty counts. The model is required to quote the exact
              sentence supporting each field. Those quotations are stored and shown on every
              record, so any claim can be checked against the source.
            </p>
            <p>
              Numbers are taken only where a source states them. A record showing zero
              deaths means no deaths were reported, not that none occurred.
            </p>
          </Step>

          <Step n="04" title="Assembling incidents">
            <p>
              The unit of record is the incident, not the article. When several
              publications report the same event, their articles are attached to one
              incident as separate sources rather than producing duplicate records.
            </p>
            <p>
              Matching is done on headline similarity within the same place and a ten-day
              window. It is deliberately conservative: it will sometimes leave two records
              for one event rather than risk merging two genuinely different ones.
            </p>
          </Step>

          <Step n="05" title="Human review">
            <p>
              Nothing produced automatically is published. Every record waits in a review
              queue until a person has read it against the source article and either
              confirmed, corrected or rejected it.
            </p>
            <p>
              This is the step that makes the dataset usable, and it is the slowest one. The
              number of unpublished records is not a backlog to be hidden; it is the
              distance between what a machine proposed and what a person has stood behind.
            </p>
          </Step>

          <Step n="06" title="Publication">
            <p>
              Published records are available on this site, as bulk downloads, and through a
              public API, under CC0 1.0. Source articles remain the property of their
              publishers and are linked, not reproduced.
            </p>
          </Step>
        </div>

        <section className="rule-t py-7">
          <h2 className="headline">What this method cannot do</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              <strong className="font-medium text-[var(--ink)]">
                It cannot find what was never published.
              </strong>{' '}
              The dataset reflects national English-language reporting. Violence covered
              only in local languages, only on radio, or not covered at all does not appear.
              Rural incidents are systematically less likely to be reported than urban ones,
              and this dataset inherits that bias in full.
            </p>
            <p>
              <strong className="font-medium text-[var(--ink)]">
                It cannot establish that an event occurred.
              </strong>{' '}
              It establishes that a named publication reported it, on a given date, in
              language we quote. Where reporting is wrong, the record is wrong, and the
              citation is what lets you find that out.
            </p>
            <p>
              <strong className="font-medium text-[var(--ink)]">
                It is not a count of election violence.
              </strong>{' '}
              Totals here are counts of documented, reviewed records. Treating them as
              measurements of how much violence occurred would overstate what the method
              supports.
            </p>
            <p>
              <strong className="font-medium text-[var(--ink)]">It is not fast.</strong>{' '}
              Collection is daily and review is manual, so there is a lag of at least a day
              and usually longer between an event being reported and a record appearing.
            </p>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Confidence scores</h2>
          <div className="prose-measure mt-2.5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            <p>
              Each record carries a confidence figure. It describes how well the source text
              supported the extraction — nothing more. It is a model&rsquo;s self-assessment,
              not a probability that the event happened, and it is shown as a described band
              rather than a bare percentage to discourage reading it as a measurement.
            </p>
            <p>
              Extractions with no supporting quotations, drawn from a summary rather than a
              full article, are capped below the evidenced range.
            </p>
          </div>
        </section>

        <section className="rule-t py-7">
          <h2 className="headline">Corrections</h2>
          <p className="prose-measure mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
            If a record is wrong, we want to know. Every record has a reference identifier;
            quote it when reporting a problem. Records are corrected in place rather than
            quietly removed.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[0.875rem]">
            <Link href="/sources/health" className="link-underline">Collection health</Link>
            <Link href="/data" className="link-underline">Download the data</Link>
            <a
              href="https://github.com/devjadiya/election-violence-monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              Source code
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
