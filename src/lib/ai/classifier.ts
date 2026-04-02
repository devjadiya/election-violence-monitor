import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const ClassificationSchema = z.object({
  isElectionRelated: z.boolean(),
  isViolenceRelated: z.boolean(),
  confidence: z.number().min(0).max(100),
})

const DetailedSchema = z.object({
  category: z.enum([
    'PHYSICAL_ASSAULT', 'ARMED_ATTACK', 'VOTER_INTIMIDATION',
    'POLITICAL_PARTY_CLASH', 'POLLING_UNIT_DISRUPTION', 'INFRASTRUCTURE_ATTACK',
    'PROPERTY_DAMAGE', 'SECURITY_FORCE_MISCONDUCT', 'KIDNAPPING',
    'POST_ELECTION_VIOLENCE', 'OTHER'
  ]),
  electionStage: z.enum([
    'PRE_CAMPAIGN', 'CAMPAIGN', 'ELECTION_DAY',
    'VOTE_COUNTING', 'POST_ELECTION', 'UNKNOWN'
  ]),
  country: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  community: z.string().optional(),
  weaponType: z.enum([
    'FIREARMS', 'KNIVES_MACHETES', 'BLUNT_OBJECTS',
    'EXPLOSIVES', 'IMPROVISED', 'NONE', 'UNKNOWN'
  ]),
  fatalities: z.number().min(0).default(0),
  injured: z.number().min(0).default(0),
  victimRoles: z.array(z.string()).default([]),
  actorTypes: z.array(z.string()).default([]),
  summary: z.string(),
  confidence: z.number().min(0).max(100),
})

// Pass 1: Quick filter — is this election + violence related?
export async function pass1Screen(text: string): Promise<{
  isElectionRelated: boolean
  isViolenceRelated: boolean
  confidence: number
}> {
  try {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      schema: ClassificationSchema,
      prompt: `You are screening news articles for an election violence monitoring system.

Analyze this text and determine:
1. Is it related to an election, voting, electoral process, or political campaign?
2. Does it describe violence, intimidation, attacks, or disruption?

Text: """${text.slice(0, 2000)}"""

Be strict: only return true if clearly relevant.`,
    })
    return object
  } catch {
    return { isElectionRelated: false, isViolenceRelated: false, confidence: 0 }
  }
}

// Pass 2: Deep extraction — structured incident data
export async function pass2Extract(text: string, title: string): Promise<z.infer<typeof DetailedSchema> | null> {
  try {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      schema: DetailedSchema,
      prompt: `You are an expert analyst for an election violence monitoring system.

Extract structured information from this news article about election-related violence.

Title: "${title}"
Content: """${text.slice(0, 4000)}"""

Extract:
- Exact category of violence
- Election stage when it occurred
- Precise location (country, region, district, community)
- Weapon types used
- Casualties (fatalities and injured counts — use 0 if none mentioned)
- Who were the victims (voter, candidate, journalist, etc.)
- Who were the perpetrators (political party, security force, militia, unknown)
- A 2-3 sentence factual summary
- Your confidence score (0-100) based on clarity of information

Be precise and factual. Do not infer what is not stated.`,
    })
    return object
  } catch {
    return null
  }
}

// Geocode location using Nominatim
export async function geocodeLocation(location: {
  country?: string
  region?: string
  district?: string
  community?: string
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = [location.community, location.district, location.region, location.country]
      .filter(Boolean)
      .join(', ')

    if (!query) return null

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'ElectionViolenceMonitor/1.0' } }
    )

    const data = await res.json()
    if (!data?.[0]) return null

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}