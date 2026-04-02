import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchGdeltArticles, fetchRssArticles, processArticle, ELECTION_VIOLENCE_KEYWORDS } from '@/lib/ingestion/gdelt'
import { notifyAdmins } from '@/lib/notifications'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()
  let articlesFound = 0
  let articlesNew = 0
  let incidentsCreated = 0
  const errors: string[] = []

  try {
    // 1. Fetch from GDELT
    const gdeltSource = await prisma.monitoredSource.upsert({
      where: { url: 'https://api.gdeltproject.org' },
      update: { lastFetchedAt: new Date() },
      create: {
        name: 'GDELT Project',
        url: 'https://api.gdeltproject.org',
        sourceType: 'API',
        language: 'en',
        trustScore: 70,
        lastFetchedAt: new Date(),
      },
    })

    const gdeltArticles = await fetchGdeltArticles(ELECTION_VIOLENCE_KEYWORDS, 30)
    articlesFound += gdeltArticles.length

    for (const article of gdeltArticles) {
      try {
        const result = await processArticle({
          url: article.url,
          title: article.title,
          content: article.title,
          publishedAt: new Date(article.seendate),
          sourceId: gdeltSource.id,
          language: article.language ?? 'en',
        })
        if (result.created) incidentsCreated++
        articlesNew++
      } catch (e: any) {
        errors.push(`GDELT: ${e.message}`)
      }
    }

    // 2. Fetch from active RSS sources
    const rssSources = await prisma.monitoredSource.findMany({
      where: { isActive: true, rssUrl: { not: null }, sourceType: 'RSS_FEED' },
      take: 10,
    })

    for (const source of rssSources) {
      try {
        const articles = await fetchRssArticles(source)
        articlesFound += articles.length

        for (const article of articles) {
          const result = await processArticle({
            ...article,
            sourceId: source.id,
          })
          if (result.created) incidentsCreated++
          articlesNew++
        }

        await prisma.monitoredSource.update({
          where: { id: source.id },
          data: { lastFetchedAt: new Date() },
        })
      } catch (e: any) {
        errors.push(`RSS ${source.name}: ${e.message}`)
      }
    }

    // Log the run
    await prisma.ingestionLog.create({
      data: {
        jobType: 'cron',
        articlesFound,
        articlesNew,
        incidentsCreated,
        errors: errors.length > 0 ? errors.join('\n') : null,
        durationMs: Date.now() - startedAt.getTime(),
        completedAt: new Date(),
      },
    })

    if (incidentsCreated > 0) {
      await notifyAdmins({
        type: 'new_incident',
        title: `AI detected ${incidentsCreated} new incident${incidentsCreated > 1 ? 's' : ''}`,
        message: `Ingestion found ${articlesFound} articles, created ${incidentsCreated} incidents for review.`,
        link: '/review',
      })
    }

    return NextResponse.json({
      success: true,
      articlesFound,
      articlesNew,
      incidentsCreated,
      errors,
      duration: `${Date.now() - startedAt.getTime()}ms`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}