import type { VerificationPathway } from '@/lib/generated/prisma'

/**
 * Automated publication.
 *
 * The platform is operated by a single developer, so there is no editorial desk
 * standing between extraction and the public site. Rather than leave the archive
 * empty or pretend a reviewer exists, records can reach publication through an
 * automated pathway with explicit conditions — and every such record is stamped
 * `AUTOMATED_CORROBORATION` so the interface can say plainly that no person
 * checked it.
 *
 * The conditions below are what make that defensible. A record must be
 * traceable (a real source URL), quotable (a verbatim passage supporting the
 * extraction), and read from actual article text rather than a headline. An
 * extraction that cannot point at the sentence it came from is a guess, and a
 * guess about violence during a live election is not something to publish.
 *
 * This is deliberately NOT the same as editorial review, and nothing in the
 * product may present it as though it were.
 */

/** Minimum model confidence. Below this the extraction goes to review instead. */
export const AUTO_PUBLISH_MIN_CONFIDENCE = 65

/** Minimum verbatim quotations tying the extraction to the source text. */
export const AUTO_PUBLISH_MIN_EVIDENCE = 1

/** Above this many independent publishers, corroboration is considered strong. */
export const STRONG_CORROBORATION = 2

export interface PublishCandidate {
  status: string
  isDemo: boolean
  confidenceScore: number
  evidence: unknown
  sources: { sourceUrl: string }[]
  /** How the article body was obtained; null means only a feed summary. */
  bodyMethod?: string | null
}

export interface PublishDecision {
  publish: boolean
  pathway: VerificationPathway
  corroboratingSources: number
  reasons: string[]
}

/** Distinct publishers behind a record, by hostname. */
export function distinctPublishers(sources: { sourceUrl: string }[]): number {
  const hosts = new Set<string>()
  for (const s of sources) {
    try {
      hosts.add(new URL(s.sourceUrl).hostname.replace(/^www\./, '').toLowerCase())
    } catch {
      // An unparseable URL is not a publisher we can count.
    }
  }
  return hosts.size
}

function evidenceCount(evidence: unknown): number {
  if (!Array.isArray(evidence)) return 0
  return evidence.filter(
    (e) => e && typeof e === 'object' && typeof (e as { quote?: unknown }).quote === 'string'
  ).length
}

/**
 * Decides whether a record may be published without a person.
 *
 * Returns the reasons either way, so a rejected record can be explained rather
 * than silently held back.
 */
export function evaluateForAutoPublication(c: PublishCandidate): PublishDecision {
  const reasons: string[] = []
  const publishers = distinctPublishers(c.sources)
  const quotes = evidenceCount(c.evidence)

  if (c.isDemo) {
    return {
      publish: false,
      pathway: 'PENDING',
      corroboratingSources: 0,
      reasons: ['record is seed data and can never be published'],
    }
  }

  if (c.status !== 'FLAGGED' && c.status !== 'VERIFIED') {
    reasons.push(`status is ${c.status}, not awaiting publication`)
  }
  if (publishers < 1) {
    reasons.push('no resolvable source URL — the claim would not be traceable')
  }
  if (quotes < AUTO_PUBLISH_MIN_EVIDENCE) {
    reasons.push('no verbatim quotation supporting the extraction')
  }
  if (c.confidenceScore < AUTO_PUBLISH_MIN_CONFIDENCE) {
    reasons.push(`confidence ${Math.round(c.confidenceScore)} below ${AUTO_PUBLISH_MIN_CONFIDENCE}`)
  }
  if (!c.bodyMethod) {
    reasons.push('extracted from a feed summary rather than the published article')
  }

  if (reasons.length > 0) {
    return { publish: false, pathway: 'PENDING', corroboratingSources: publishers, reasons }
  }

  return {
    publish: true,
    pathway: 'AUTOMATED_CORROBORATION',
    corroboratingSources: publishers,
    reasons: [
      `${publishers} independent publisher${publishers === 1 ? '' : 's'}`,
      `${quotes} supporting quotation${quotes === 1 ? '' : 's'}`,
      `confidence ${Math.round(c.confidenceScore)}`,
      'full article text retrieved',
    ],
  }
}

/** Human-readable label for how a record reached the public site. */
export function pathwayLabel(pathway: VerificationPathway, corroborating = 0): string {
  switch (pathway) {
    case 'EDITORIAL_REVIEW':
      return 'Checked by a reviewer'
    case 'AUTOMATED_CORROBORATION':
      return corroborating >= STRONG_CORROBORATION
        ? `Machine-extracted, ${corroborating} independent sources`
        : 'Machine-extracted from a single source'
    default:
      return 'Awaiting review'
  }
}

/**
 * The sentence shown alongside any automatically published record.
 *
 * Wording matters here: it must not leave a reader believing a person signed off
 * on the record when nobody did.
 */
export const AUTOMATED_PUBLICATION_NOTICE =
  'This record was extracted automatically from published reporting and met the ' +
  'platform\'s automated publication criteria. It has not been checked by a human ' +
  'reviewer. Verify against the cited sources before relying on it.'
