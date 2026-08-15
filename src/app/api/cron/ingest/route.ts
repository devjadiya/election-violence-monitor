import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorisedCron } from '@/lib/auth/cron'
import {
  fetchGdeltArticles,
  fetchRssArticles,
  processArticle,
  ELECTION_VIOLENCE_KEYWORDS,
  type ProcessOutcome,
} from '@/lib/ingestion/gdelt'
import { notifyAdmins } from '@/lib/notifications'

// Hobby allows up to 300s. The previous value of 60 was self-imposed.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface Tally {
  discovered: number
  duplicates: number
  filtered: number
  created: number
  errors: number
}

function tallyOutcome(t: Tally, o: ProcessOutcome) {
  switch (o.status) {
    case 'created':
      t.created++
      break
    case 'duplicate':
      t.duplicates++
      break
    case 'filtered':
    case 'skipped':
      t.filtered++
      break
    case 'error':
      t.errors++
      break
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()
  const t: Tally = { discovered: 0, duplicates: 0, filtered: 0, created: 0, errors: 0 }

  // Structured failure records. The previous implementation joined error
  // strings with newlines, which made them unqueryable and easy to ignore.
  const failures: { scope: string; reason: string; detail: string }[] = []
  const perSource: Record<string, { discovered: number; created: number; errors: number }> = {}

  const note = (scope: string, reason: string, detail: string) => {
    failures.push({ scope, reason, detail: detail.slice(0, 300) })
  }

  try {
    // ---- GDELT --------------------------------------------------------------
    const gdeltSource = await prisma.monitoredSource.upsert({
      where: { url: 'https://api.gdeltproject.org' },
      update: { lastFetchedAt: new Date() },
      create: {
        name: 'GDELT Project',
        url: 'https://api.gdeltproject.org',
        sourceType: 'API',
        language: 'en',
        lastFetchedAt: new Date(),
      },
    })

    try {
      const gdeltArticles = await fetchGdeltArticles(ELECTION_VIOLENCE_KEYWORDS, 30)
      t.discovered += gdeltArticles.length
      perSource['GDELT Project'] = { discovered: gdeltArticles.length, created: 0, errors: 0 }

      for (const article of gdeltArticles) {
        try {
          const outcome = await processArticle({
            url: article.url,
            title: article.title,
            // GDELT returns metadata only, no body. Screening therefore sees a
            // headline. Article-body extraction is the next pipeline step.
            content: article.title,
            publishedAt: new Date(article.seendate),
            sourceId: gdeltSource.id,
            language: article.language ?? 'en',
          })
          tallyOutcome(t, outcome)
          if (outcome.status === 'created') perSource['GDELT Project'].created++
          if (outcome.status === 'error') {
            perSource['GDELT Project'].errors++
            note('GDELT', outcome.reason, outcome.detail)
          }
        } catch (e) {
          t.errors++
          note('GDELT', 'UNCAUGHT', (e as Error).message)
        }
      }
    } catch (e) {
      note('GDELT', 'DISCOVERY_FAILED', (e as Error).message)
    }

    // ---- RSS ----------------------------------------------------------------
    const rssSources = await prisma.monitoredSource.findMany({
      where: { isActive: true, rssUrl: { not: null }, sourceType: 'RSS_FEED' },
      take: 20,
    })

    for (const source of rssSources) {
      perSource[source.name] = { discovered: 0, created: 0, errors: 0 }
      try {
        const articles = await fetchRssArticles(source)
        t.discovered += articles.length
        perSource[source.name].discovered = articles.length

        // A feed that returns nothing is a signal, not a non-event.
        if (articles.length === 0) {
          note(source.name, 'EMPTY_FEED', 'feed returned zero items')
        }

        for (const article of articles) {
          try {
            const outcome = await processArticle({ ...article, sourceId: source.id })
            tallyOutcome(t, outcome)
            if (outcome.status === 'created') perSource[source.name].created++
            if (outcome.status === 'error') {
              perSource[source.name].errors++
              note(source.name, outcome.reason, outcome.detail)
            }
          } catch (e) {
            t.errors++
            perSource[source.name].errors++
            note(source.name, 'UNCAUGHT', (e as Error).message)
          }
        }

        await prisma.monitoredSource.update({
          where: { id: source.id },
          data: { lastFetchedAt: new Date() },
        })
      } catch (e) {
        perSource[source.name].errors++
        note(source.name, 'FETCH_FAILED', (e as Error).message)
      }
    }

    const durationMs = Date.now() - startedAt.getTime()

    await prisma.ingestionLog.create({
      data: {
        jobType: 'cron',
        articlesFound: t.discovered,
        articlesNew: t.discovered - t.duplicates,
        incidentsCreated: t.created,
        errors: failures.length ? JSON.stringify({ failures, perSource }) : null,
        durationMs,
        completedAt: new Date(),
      },
    })

    // Alarms. A run that discovers articles but produces neither incidents nor
    // filtered results means the classifier is not working — the exact failure
    // that went unnoticed for months.
    const classifierDead = t.discovered > 20 && t.created === 0 && t.filtered === 0
    const highErrorRate = t.discovered > 0 && t.errors / t.discovered > 0.4

    if (t.created > 0) {
      await notifyAdmins({
        type: 'new_incident',
        title: `${t.created} incident${t.created > 1 ? 's' : ''} awaiting review`,
        message: `Ingestion screened ${t.discovered} articles and flagged ${t.created} for human review.`,
        link: '/review',
      })
    }

    if (classifierDead || highErrorRate) {
      await notifyAdmins({
        type: 'ingestion_failure',
        title: classifierDead ? 'Ingestion produced no results' : 'Ingestion error rate high',
        message: classifierDead
          ? `${t.discovered} articles discovered but none classified. The AI provider is likely failing.`
          : `${t.errors} of ${t.discovered} articles errored.`,
        link: '/admin/settings',
      })
    }

    return NextResponse.json({
      ok: true,
      // Report honestly. Zero is zero.
      discovered: t.discovered,
      duplicates: t.duplicates,
      filtered: t.filtered,
      created: t.created,
      errors: t.errors,
      failureCount: failures.length,
      failures: failures.slice(0, 20),
      perSource,
      durationMs,
      healthy: !classifierDead && !highErrorRate,
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime()
    // A total failure must still leave a record.
    await prisma.ingestionLog
      .create({
        data: {
          jobType: 'cron',
          articlesFound: t.discovered,
          articlesNew: 0,
          incidentsCreated: t.created,
          errors: JSON.stringify({ fatal: (error as Error).message, failures }),
          durationMs,
          completedAt: new Date(),
        },
      })
      .catch(() => {})

    return NextResponse.json(
      { ok: false, error: (error as Error).message, discovered: t.discovered },
      { status: 500 }
    )
  }
}
