import type { Metadata } from 'next'
import { SubmitTipForm } from '@/components/public/submit-tip-form'
import { SiteHeader, SiteFooter, PageHeader } from '@/components/public/site-shell'

export const metadata: Metadata = {
  title: 'Report an incident',
  description:
    'Send information about an election violence incident. Submissions are checked against reporting before anything is published.',
}

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-10">
        <PageHeader
          title="Report an incident"
          lede="Tell us about something you saw or know about. Nothing you send is published directly."
        />

        <div className="prose-measure py-6 text-[0.9375rem] leading-relaxed text-[var(--ink-2)]">
          <p>
            A submission is a lead, not a record. It goes to a reviewer, who looks for
            reporting that corroborates it. If none is found, it is not published — that is
            a limit of the method, not a judgement about you.
          </p>
          <p className="mt-3">
            <strong className="font-medium text-[var(--ink)]">Please do not put yourself at risk.</strong>{' '}
            Do not include your name or the names of victims unless they have already been
            published elsewhere. We cannot offer legal protection, and this form is not a
            secure channel for anyone in immediate danger.
          </p>
          <p className="mt-3">
            If someone is in danger now, contact emergency services rather than this form.
          </p>
        </div>

        <div className="rule-t pt-6">
          <SubmitTipForm />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
