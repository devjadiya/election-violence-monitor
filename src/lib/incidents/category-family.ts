import type { IncidentCategory } from '@/lib/generated/prisma'

/**
 * Semantic colour families for incident categories.
 *
 * The map previously assigned each of the 19 categories its own hue — four
 * near-identical reds among them — which made colour decorative: nothing about
 * "#ec4899 means infrastructure attack" can be read without the legend, and no
 * two readers would group the hues the same way.
 *
 * Colour is a data channel here, so it encodes the one distinction a reader can
 * act on at a glance: what kind of harm the record describes. Six families,
 * each with one hue, chosen to remain distinguishable to a reader with reduced
 * red-green discrimination (they differ in lightness as well as hue), and every
 * mark still carries its precise category as text wherever it is inspected.
 */

export type CategoryFamilyId =
  | 'PERSONS'
  | 'COERCION'
  | 'PROCESS'
  | 'STATE_ACTION'
  | 'UNREST'
  | 'OTHER'

export interface CategoryFamily {
  id: CategoryFamilyId
  label: string
  /** What membership of this family asserts about the record. */
  note: string
  color: string
  categories: IncidentCategory[]
}

export const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    id: 'PERSONS',
    label: 'Violence against people',
    note: 'A person was attacked, abducted or killed.',
    color: '#a5241d',
    categories: [
      'PHYSICAL_ASSAULT',
      'ARMED_ATTACK',
      'KIDNAPPING',
      'ABDUCTION_THREAT',
      'MOB_VIOLENCE',
      'POLITICAL_PARTY_CLASH',
      'POST_ELECTION_VIOLENCE',
      'ATTACK_ON_JOURNALIST',
      'ATTACK_ON_OFFICIAL',
    ],
  },
  {
    id: 'COERCION',
    label: 'Intimidation and inducement',
    note: 'Voters pressured, threatened or paid.',
    color: '#b45309',
    categories: ['VOTER_INTIMIDATION', 'VOTE_BUYING_INDUCEMENT'],
  },
  {
    id: 'PROCESS',
    label: 'Process and property',
    note: 'Polling disrupted, ballots compromised, property or infrastructure attacked.',
    color: '#6d28d9',
    categories: [
      'POLLING_UNIT_DISRUPTION',
      'BALLOT_INTEGRITY_BREACH',
      'INFRASTRUCTURE_ATTACK',
      'PROPERTY_DAMAGE',
    ],
  },
  {
    id: 'STATE_ACTION',
    label: 'Security force actions',
    note: 'Misconduct by, or mass arrests carried out by, security forces.',
    color: '#1d4ed8',
    categories: ['SECURITY_FORCE_MISCONDUCT', 'MASS_ARREST_DETENTION'],
  },
  {
    id: 'UNREST',
    label: 'Protest and unrest',
    note: 'Demonstrations and public disorder, violent or not.',
    color: '#0f766e',
    categories: ['PROTEST_UNREST'],
  },
  {
    id: 'OTHER',
    label: 'Uncategorised',
    note: 'Recorded, but not classifiable into the families above.',
    color: '#6b7280',
    categories: ['OTHER'],
  },
]

const BY_CATEGORY = new Map<IncidentCategory, CategoryFamily>(
  CATEGORY_FAMILIES.flatMap((f) => f.categories.map((c) => [c, f] as const))
)

const FALLBACK = CATEGORY_FAMILIES[CATEGORY_FAMILIES.length - 1]

export function familyOf(category: IncidentCategory | string): CategoryFamily {
  return BY_CATEGORY.get(category as IncidentCategory) ?? FALLBACK
}
