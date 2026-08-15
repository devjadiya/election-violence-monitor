import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://election-violence-monitor.vercel.app'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/map`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/reports`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]

  try {
    const incidents = await prisma.incident.findMany({
      where: publicIncidentFilter(),
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })

    const incidentRoutes: MetadataRoute.Sitemap = incidents.map(i => ({
      url: `${base}/reports/${i.id}`,
      lastModified: i.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticRoutes, ...incidentRoutes]
  } catch {
    return staticRoutes
  }
}