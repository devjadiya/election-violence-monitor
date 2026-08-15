const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

/**
 * Wikidata Q-identifier: "Q" followed by digits, no leading zero.
 */
const QID_PATTERN = /^Q[1-9][0-9]{0,11}$/

/**
 * Country names may contain letters (any script), spaces, hyphens, apostrophes
 * and full stops. Anything else — quotes, braces, newlines, SPARQL keywords —
 * is rejected outright rather than escaped.
 */
const COUNTRY_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-()]{1,59}$/u

export function isValidQid(qid: string): boolean {
  return QID_PATTERN.test(qid)
}

export function isValidCountryName(country: string): boolean {
  return COUNTRY_NAME_PATTERN.test(country)
}

/**
 * Escape a value for use inside a SPARQL double-quoted string literal.
 * Defence in depth — callers must ALSO have validated against the allowlist.
 */
function escapeSparqlLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

export async function searchWikidataElections(country: string): Promise<{
  id: string
  label: string
  description: string
  date: string | null
}[]> {
  // Never interpolate unvalidated input into a query. Reject, do not sanitise.
  if (!isValidCountryName(country)) return []

  const safeCountry = escapeSparqlLiteral(country)

  const sparql = `
    SELECT ?item ?itemLabel ?itemDescription ?date WHERE {
      ?item wdt:P31 wd:Q40231.
      ?item wdt:P17 ?country.
      ?country rdfs:label "${safeCountry}"@en.
      OPTIONAL { ?item wdt:P585 ?date. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?date)
    LIMIT 10
  `
  try {
    const res = await fetch(
      `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`,
      { headers: { 'User-Agent': 'ElectionViolenceMonitor/1.0' } }
    )
    const data = await res.json()
    return (data.results?.bindings ?? []).map((b: any) => ({
      id: b.item?.value?.split('/').pop() ?? '',
      label: b.itemLabel?.value ?? '',
      description: b.itemDescription?.value ?? '',
      date: b.date?.value?.slice(0, 10) ?? null,
    }))
  } catch {
    return []
  }
}

export async function getWikidataEntity(qid: string): Promise<{
  label: string
  description: string
  claims: Record<string, any>
} | null> {
  if (!isValidQid(qid)) return null

  try {
    const res = await fetch(
      `${WIKIDATA_API}?action=wbgetentities&ids=${encodeURIComponent(qid)}&format=json&languages=en&origin=*`
    )
    const data = await res.json()
    const entity = data.entities?.[qid]
    if (!entity) return null
    return {
      label: entity.labels?.en?.value ?? qid,
      description: entity.descriptions?.en?.value ?? '',
      claims: entity.claims ?? {},
    }
  } catch {
    return null
  }
}

export async function linkIncidentToWikidata(incidentId: string, wikidataId: string): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.incident.update({
      where: { id: incidentId },
      data: { wikidataId },
    })
    return true
  } catch {
    return false
  }
}

export function buildWikidataExport(incidents: any[]) {
  return incidents.map(incident => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    identifier: incident.referenceId,
    name: incident.title,
    description: incident.description,
    startDate: incident.occurredAt,
    location: {
      '@type': 'Place',
      name: [incident.community, incident.district, incident.region, incident.country].filter(Boolean).join(', '),
      geo: incident.latitude ? {
        '@type': 'GeoCoordinates',
        latitude: incident.latitude,
        longitude: incident.longitude,
      } : undefined,
    },
    about: incident.wikidataId ? `https://www.wikidata.org/wiki/${incident.wikidataId}` : undefined,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'category', value: incident.category },
      { '@type': 'PropertyValue', name: 'electionStage', value: incident.electionStage },
      { '@type': 'PropertyValue', name: 'confidenceScore', value: incident.confidenceScore },
      { '@type': 'PropertyValue', name: 'fatalities', value: incident.fatalities },
      { '@type': 'PropertyValue', name: 'injured', value: incident.injured },
    ],
  }))
}