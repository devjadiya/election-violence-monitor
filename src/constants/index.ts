import type { IncidentCategory, ElectionStage, WeaponType } from '@/lib/generated/prisma'

export const APP_NAME = 'Election Violence Monitor'
export const APP_SHORT = 'EVM'

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  PHYSICAL_ASSAULT: 'Physical Assault',
  ARMED_ATTACK: 'Armed Attack',
  VOTER_INTIMIDATION: 'Voter Intimidation',
  POLITICAL_PARTY_CLASH: 'Political Party Clash',
  POLLING_UNIT_DISRUPTION: 'Polling Unit Disruption',
  INFRASTRUCTURE_ATTACK: 'Infrastructure Attack',
  PROPERTY_DAMAGE: 'Property Damage',
  SECURITY_FORCE_MISCONDUCT: 'Security Force Misconduct',
  KIDNAPPING: 'Kidnapping / Abduction',
  POST_ELECTION_VIOLENCE: 'Post-Election Violence',
  MASS_ARREST_DETENTION: 'Mass Arrest / Detention',
  ABDUCTION_THREAT: 'Abduction / Threat',
  MOB_VIOLENCE: 'Mob Violence',
  ATTACK_ON_JOURNALIST: 'Attack on Journalist',
  ATTACK_ON_OFFICIAL: 'Attack on Electoral Official',
  VOTE_BUYING_INDUCEMENT: 'Vote Buying / Inducement',
  BALLOT_INTEGRITY_BREACH: 'Ballot Integrity Breach',
  PROTEST_UNREST: 'Protest / Unrest',
  OTHER: 'Other',
}

export const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  PHYSICAL_ASSAULT: '#ef4444',
  ARMED_ATTACK: '#dc2626',
  VOTER_INTIMIDATION: '#f97316',
  POLITICAL_PARTY_CLASH: '#eab308',
  POLLING_UNIT_DISRUPTION: '#8b5cf6',
  INFRASTRUCTURE_ATTACK: '#ec4899',
  PROPERTY_DAMAGE: '#06b6d4',
  SECURITY_FORCE_MISCONDUCT: '#3b82f6',
  KIDNAPPING: '#991b1b',
  POST_ELECTION_VIOLENCE: '#7c3aed',
  MASS_ARREST_DETENTION: '#0891b2',
  ABDUCTION_THREAT: '#b91c1c',
  MOB_VIOLENCE: '#ea580c',
  ATTACK_ON_JOURNALIST: '#c026d3',
  ATTACK_ON_OFFICIAL: '#2563eb',
  VOTE_BUYING_INDUCEMENT: '#ca8a04',
  BALLOT_INTEGRITY_BREACH: '#4f46e5',
  PROTEST_UNREST: '#0d9488',
  OTHER: '#6b7280',
}

export const STAGE_LABELS: Record<ElectionStage, string> = {
  PRE_CAMPAIGN: 'Pre-Campaign',
  CAMPAIGN: 'Campaign Period',
  ELECTION_DAY: 'Election Day',
  VOTE_COUNTING: 'Vote Counting',
  POST_ELECTION: 'Post-Election',
  UNKNOWN: 'Unknown',
}

export const WEAPON_LABELS: Record<WeaponType, string> = {
  FIREARMS: 'Firearms',
  KNIVES_MACHETES: 'Knives / Machetes',
  BLUNT_OBJECTS: 'Blunt Objects',
  EXPLOSIVES: 'Explosives',
  IMPROVISED: 'Improvised Weapons',
  NONE: 'No Weapon',
  UNKNOWN: 'Unknown',
}

export const ROLE_LABELS = {
  PUBLIC: 'Public',
  OBSERVER: 'Observer',
  ANALYST: 'Analyst',
  REVIEWER: 'Reviewer',
  EDITOR: 'Editor',
  ADMIN: 'Administrator',
}

export const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc'
export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
export const NOMINATIM_API = 'https://nominatim.openstreetmap.org'