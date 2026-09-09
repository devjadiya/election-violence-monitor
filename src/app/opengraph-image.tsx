import { ImageResponse } from 'next/og'

/**
 * The card a link to this site produces in Slack, WhatsApp or a tweet.
 *
 * The metadata has pointed at `/og-image.png` since the project began and that
 * file has never existed, so every shared link previewed as a bare URL — which
 * is the first thing anyone sees when a collaborator forwards this to someone
 * else.
 *
 * Generated rather than exported from a design tool: it is one file, it cannot
 * fall out of sync with the wordmark, and it needs no binary in the repository.
 *
 * Deliberately sober. This is a card about documented political violence, and
 * the restraint is the argument — it says the same thing the site does, in the
 * same voice.
 */

export const runtime = 'edge'
export const alt =
  'Election Violence Monitor — turning published reporting on election violence into structured, citable records'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '72px 80px',
          // The navy edge is the only ornament, and it is the same navy as the
          // site's accent rather than a decorative gradient.
          borderLeft: '16px solid #10263f',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* The wordmark: three rules of decreasing length, the funnel from
              reporting to published record. Redrawn here because an edge
              runtime cannot import the component. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 7,
              width: 64,
              height: 64,
              background: '#10263f',
              borderRadius: 10,
              padding: '0 14px',
            }}
          >
            <div style={{ width: 36, height: 5, borderRadius: 3, background: '#ffffff' }} />
            <div
              style={{ width: 25, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.7)' }}
            />
            <div
              style={{ width: 15, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.45)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: '#14161a', letterSpacing: -0.5 }}>
              Election Violence Monitor
            </div>
            <div style={{ fontSize: 19, color: '#626974', marginTop: 2 }}>
              Open records of election-related violence
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 52,
            lineHeight: 1.2,
            fontWeight: 600,
            color: '#14161a',
            letterSpacing: -1.2,
            maxWidth: 940,
          }}
        >
          Turning published reporting on election violence into structured, citable records.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #e2e6ec',
            paddingTop: 26,
            fontSize: 20,
            color: '#626974',
          }}
        >
          <div style={{ display: 'flex', gap: 28 }}>
            <span>Every record cites its source</span>
            <span style={{ color: '#cdd3db' }}>·</span>
            <span>Machine-extracted, human-reviewed</span>
            <span style={{ color: '#cdd3db' }}>·</span>
            <span>CC0 data</span>
          </div>
        </div>
      </div>
    ),
    size
  )
}
