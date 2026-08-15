'use client'

/**
 * Last resort: a failure in the root layout itself, where no other boundary can
 * catch it. This component replaces the entire document, so it must supply its
 * own <html> and <body> and cannot rely on the stylesheet having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#ffffff',
          color: '#111114',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '5rem 1.25rem' }}>
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#71717a',
              margin: 0,
            }}
          >
            Error
          </p>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 640,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              margin: '0.625rem 0 0',
            }}
          >
            Election Violence Monitor is temporarily unavailable.
          </h1>
          <p style={{ marginTop: '1rem', color: '#3f3f46' }}>
            The application failed to start. No records have been lost. This is a fault
            on our side and says nothing about whether incidents occurred.
          </p>
          {error.digest ? (
            <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#71717a' }}>
              Reference{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</code>
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: '1.75rem',
              background: '#111114',
              color: '#fff',
              border: 0,
              borderRadius: 4,
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
