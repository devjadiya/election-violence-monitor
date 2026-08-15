import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://election-violence-monitor.vercel.app'

  // changeFrequency reflects the actual cadence. Collection runs once a day and
  // review is manual, so nothing here is hourly.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/incidents`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/sources`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/sources/health`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    { url: `${base}/data`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/analytics`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/developers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    const incidents = await prisma.incident.findMany({
      where: publicIncidentFilter(),
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })

    const incidentRoutes: MetadataRoute.Sitemap = incidents.map(i => ({
      url: `${base}/incidents/${i.id}`,
      lastModified: i.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticRoutes, ...incidentRoutes]
  } catch {
    return staticRoutes
  }
}