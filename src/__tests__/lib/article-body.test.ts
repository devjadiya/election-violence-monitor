// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { assertPublicHttpUrl, extractBodyFromHtml } from '@/lib/ingestion/article-body'

describe('SSRF guard', () => {
  // We fetch URLs supplied by external feeds, from inside our own
  // infrastructure. Without this guard a hostile feed could point us at cloud
  // metadata or an internal service and have us store the response.
  it.each([
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://127.0.0.1:3000/api/admin', 'loopback'],
    ['http://10.0.0.5/internal', 'private class A'],
    ['http://192.168.1.1/router', 'private class C'],
    ['http://172.16.0.9/service', 'private class B'],
    ['http://100.64.0.1/cgnat', 'carrier-grade NAT'],
    ['http://[::1]/local', 'IPv6 loopback'],
  ])('refuses %s (%s)', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow()
  })

  it('refuses non-http schemes', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toThrow(/scheme/)
    await expect(assertPublicHttpUrl('gopher://example.com/')).rejects.toThrow(/scheme/)
  })

  it('refuses credentials embedded in the url', async () => {
    await expect(assertPublicHttpUrl('https://user:pass@example.com/x')).rejects.toThrow(/credentials/)
  })

  it('allows an ordinary public article url', async () => {
    const u = await assertPublicHttpUrl('https://punchng.com/some-story')
    expect(u.hostname).toBe('punchng.com')
  })
})

describe('article body extraction', () => {
  it('prefers schema.org articleBody', () => {
    const html = `<html><body>
      <script type="application/ld+json">
        {"@type":"NewsArticle","articleBody":"${'Thugs attacked the polling unit in Osun. '.repeat(8)}"}
      </script>
      <nav>Home About Contact</nav>
      <article><p>short teaser</p></article>
    </body></html>`
    const out = extractBodyFromHtml(html)
    expect(out.method).toBe('json-ld')
    expect(out.text).toContain('Thugs attacked the polling unit')
    expect(out.text).not.toContain('Home About Contact')
  })

  it('falls back to the article tag', () => {
    const html = `<html><body>
      <article><p>${'Police confirmed the arrest of 146 suspects. '.repeat(8)}</p></article>
    </body></html>`
    const out = extractBodyFromHtml(html)
    expect(out.method).toBe('article-tag')
    expect(out.chars).toBeGreaterThan(200)
  })

  it('strips navigation, scripts and ads from the fallback path', () => {
    const html = `<html><body>
      <div class="content">
        <p>${'Ballot boxes were snatched at the polling unit. '.repeat(8)}</p>
        <p>Witnesses described the scene to reporters at length that morning.</p>
      </div>
      <script>trackUser()</script>
      <div class="advertisement">Buy now</div>
      <nav>Menu Home Politics</nav>
    </body></html>`
    const out = extractBodyFromHtml(html)
    expect(out.text).toContain('Ballot boxes were snatched')
    expect(out.text).not.toContain('trackUser')
    expect(out.text).not.toContain('Buy now')
    expect(out.text).not.toContain('Menu Home Politics')
  })

  it('reports nothing rather than guessing when there is no article', () => {
    const out = extractBodyFromHtml('<html><body><nav>Home</nav><p>404</p></body></html>')
    expect(out.method).toBe('none')
    expect(out.chars).toBe(0)
  })

  it('survives malformed JSON-LD without throwing', () => {
    const html = `<html><body>
      <script type="application/ld+json">{ this is not json }</script>
      <article><p>${'The election tribunal reconvened in Abuja today. '.repeat(8)}</p></article>
    </body></html>`
    expect(() => extractBodyFromHtml(html)).not.toThrow()
    expect(extractBodyFromHtml(html).method).toBe('article-tag')
  })
})
