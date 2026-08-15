import type { MetadataRoute } from 'next'

/**
 * `/incidents` used to be the authenticated management route and was therefore
 * disallowed here. It is now the public archive, so leaving that rule in place
 * would have hidden the entire dataset from search engines. Management moved to
 * `/manage/*`, which is what should be disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/incidents',
          '/map',
          '/sources',
          '/methodology',
          '/data',
          '/analytics',
          '/developers',
          '/submit',
        ],
        disallow: ['/manage/', '/dashboard', '/admin', '/review', '/tips', '/export', '/api/'],
      },
    ],
    sitemap: 'https://election-violence-monitor.vercel.app/sitemap.xml',
    host: 'https://election-violence-monitor.vercel.app',
  }
}
