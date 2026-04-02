import { NextRequest, NextResponse } from 'next/server'
import { getWikidataEntity, searchWikidataElections } from '@/lib/wikidata'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qid = searchParams.get('qid')
  const country = searchParams.get('country')

  if (qid) {
    const entity = await getWikidataEntity(qid)
    return NextResponse.json({ success: true, data: entity })
  }

  if (country) {
    const elections = await searchWikidataElections(country)
    return NextResponse.json({ success: true, data: elections })
  }

  return NextResponse.json({ error: 'Provide qid or country param' }, { status: 400 })
}