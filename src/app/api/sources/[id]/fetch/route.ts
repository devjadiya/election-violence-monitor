import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guard'
import { fetchSourceNow } from '@/lib/ingestion/source-onboarding'

/**
 * Read one source now.
 *
 * The only way to collect from a single feed used to be triggering a whole
 * discovery run, which reads every source and is gated on an election window —
 * so testing one newly added publisher meant either waiting a day or running
 * the entire pipeline. This reads exactly one feed and reports what it found.
 *
 * ANALYST, matching the permission needed to register a feed in the first
 * place: someone who may decide what the pipeline reads may also check that it
 * reads.
 *
 * Discovery only. Classification stays a separate job, as it is for the cron —
 * feed reads are fast and free, AI calls are neither.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('ANALYST')
  if (!guard.ok) return guard.response

  const { id } = await params
  const result = await fetchSourceNow(id)

  if (result.error) {
    return NextResponse.json({ success: false, ...result }, { status: 422 })
  }

  return NextResponse.json({ success: true, ...result })
}
