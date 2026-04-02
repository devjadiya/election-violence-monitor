import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/map', '/reports', '/submit', '/about'],
        disallow: ['/dashboard', '/incidents', '/admin', '/api/'],
      },
    ],
    sitemap: 'https://election-violence-monitor.vercel.app/sitemap.xml',
    host: 'https://election-violence-monitor.vercel.app',
  }
}