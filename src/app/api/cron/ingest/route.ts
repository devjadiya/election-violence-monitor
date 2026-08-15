import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorisedCron } from '@/lib/auth/cron'
import {
  fetchGdeltArticles,
  fetchRssArticles,
  storeArticle,
  ELECTION_VIOLENCE_KEYWORDS,
} from '@/lib/ingestion/gdelt'
import { backlogSize } from '@/lib/ingestion/backlog'
import { notifyAdmins } from '@/lib/notifications'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * DISCOVERY ONLY. Reads every active feed and stores what it finds.
 *
 * No AI runs here. Classification is a separate job (/api/cron/classify)
 * because feed reads are fast and rate-limit-free while AI calls are neither.
 * When the two shared one request, a day's articles could not be screened
 * inside the 300s function limit, and the run died half-applied without ever
 * writing an IngestionLog — invisible failure, which is the exact pathology
 * that let this pipeline sit dead for four months.
 */

interface SourceResult {
  discovered: number
  stored: number
  duplicates: number
  ok: boolean
  error?: string
}

export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()
  const perSource: Record<string, SourceResult> = {}
  let discovered = 0
  let stored = 0
  let duplicates = 0

  const blank = (): SourceResult => ({ discovered: 0, stored: 0, duplicates: 0, ok: true })

  const ingest = async (
    name: string,
    sourceId: string,
    articles: { url: string; title: string; content: string; publishedAt: Date; language?: string }[]
  ) => {
    const r = perSource[name]
    r.discovered = articles.length
    discovered += articles.length

    for (const a of articles) {
      try {
        const outcome = await storeArticle({ ...a, sourceId })
        if (outcome.status === 'stored') {
          r.stored++
          stored++
        } else if (outcome.status === 'duplicate') {
          r.duplicates++
          duplicates++
        }
      } catch (e) {
        r.ok = false
        r.error = (e as Error).message.slice(0, 200)
      }
    }
  }

  try {
    // ---- GDELT --------------------------------------------------------------
    const gdeltSource = await prisma.monitoredSource.upsert({
      where: { url: 'https://api.gdeltproject.org' },
      update: {},
      create: {
        name: 'GDELT Project',
        url: 'https://api.gdeltproject.org',
        sourceType: 'API',
        language: 'en',
      },
    })

    perSource['GDELT Project'] = blank()
    try {
      const gdelt = await fetchGdeltArticles(ELECTION_VIOLENCE_KEYWORDS, 50)
      await ingest(
        'GDELT Project',
        gdeltSource.id,
        gdelt.map((a) => ({
          url: a.url,
          title: a.title,
          // GDELT returns metadata only, never a body.
          content: a.title,
          publishedAt: new Date(a.seendate),
          language: a.language ?? 'en',
        }))
      )
      if (gdelt.length === 0) {
        perSource['GDELT Project'].ok = false
        perSource['GDELT Project'].error = 'query returned zero articles'
      }
    } catch (e) {
      perSource['GDELT Project'].ok = false
      perSource['GDELT Project'].error = (e as Error).message.slice(0, 200)
    }

    const g = perSource['GDELT Project']
    await prisma.monitoredSource.update({
      where: { id: gdeltSource.id },
      data: g.ok
        ? { lastFetchedAt: new Date(), lastSuccessAt: new Date(), lastError: null, consecutiveFailures: 0 }
        : {
            lastFetchedAt: new Date(),
            lastError: g.error ?? 'unknown failure',
            consecutiveFailures: { increment: 1 },
          },
    })

    // ---- RSS ----------------------------------------------------------------
    const rssSources = await prisma.monitoredSource.findMany({
      where: { isActive: true, rssUrl: { not: null }, sourceType: 'RSS_FEED' },
    })

    for (const source of rssSources) {
      perSource[source.name] = blank()
      try {
        const articles = await fetchRssArticles(source)
        await ingest(source.name, source.id, articles)

        // A feed that returns nothing is a failure, not a quiet success. This
        // is what stops a dead source looking healthy.
        if (articles.length === 0) {
          perSource[source.name].ok = false
          perSource[source.name].error = 'feed returned zero items'
        }
      } catch (e) {
        perSource[source.name].ok = false
        perSource[source.name].error = (e as Error).message.slice(0, 200)
      }

      // lastFetchedAt records an ATTEMPT; lastSuccessAt records a fetch that
      // actually returned items. Conflating the two is what let sixteen dead
      // feeds look healthy for four months.
      const r = perSource[source.name]
      await prisma.monitoredSource.update({
        where: { id: source.id },
        data: r.ok
          ? {
              lastFetchedAt: new Date(),
              lastSuccessAt: new Date(),
              lastError: null,
              consecutiveFailures: 0,
            }
          : {
              lastFetchedAt: new Date(),
              lastError: r.error ?? 'unknown failure',
              consecutiveFailures: { increment: 1 },
            },
      })
    }

    const durationMs = Date.now() - startedAt.getTime()
    const failed = Object.entries(perSource).filter(([, r]) => !r.ok)
    const backlog = await backlogSize()

    await prisma.ingestionLog.create({
      data: {
        jobType: 'discover',
        articlesFound: discovered,
        articlesNew: stored,
        incidentsCreated: 0,
        errors: failed.length
          ? JSON.stringify({
              failedSources: failed.map(([name, r]) => ({ name, error: r.error })),
              perSource,
            })
          : null,
        durationMs,
        completedAt: new Date(),
      },
    })

    // Every source failing means the reader itself is broken, not the feeds.
    const allFailed = Object.keys(perSource).length > 0 && failed.length === Object.keys(perSource).length

    if (allFailed) {
      await notifyAdmins({
        type: 'ingestion_failure',
        title: 'Discovery found nothing from any source',
        message: `All ${failed.length} configured sources returned no articles.`,
        link: '/sources',
      })
    }

    return NextResponse.json({
      ok: true,
      discovered,
      stored,
      duplicates,
      backlogAwaitingClassification: backlog,
      sourcesHealthy: Object.keys(perSource).length - failed.length,
      sourcesFailed: failed.length,
      failedSources: failed.map(([name, r]) => ({ name, error: r.error })),
      perSource,
      durationMs,
      healthy: !allFailed,
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime()
    await prisma.ingestionLog
      .create({
        data: {
          jobType: 'discover',
          articlesFound: discovered,
          articlesNew: stored,
          incidentsCreated: 0,
          errors: JSON.stringify({ fatal: (error as Error).message, perSource }),
          durationMs,
          completedAt: new Date(),
        },
      })
      .catch(() => {})

    return NextResponse.json(
      { ok: false, error: (error as Error).message, discovered, stored },
      { status: 500 }
    )
  }
}
