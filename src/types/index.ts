import type { UserRole, IncidentStatus, IncidentCategory, ElectionStage, WeaponType, VerificationStatus } from '@/lib/generated/prisma'

export type { UserRole, IncidentStatus, IncidentCategory, ElectionStage, WeaponType, VerificationStatus }

export interface SessionUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role: UserRole
}

export interface IncidentWithRelations {
  id: string
  referenceId: string
  title: string
  description: string
  category: IncidentCategory
  status: IncidentStatus
  verificationStatus: VerificationStatus
  electionStage: ElectionStage
  confidenceScore: number
  country: string
  countryCode?: string | null
  region?: string | null
  district?: string | null
  community?: string | null
  specificLocation?: string | null
  latitude?: number | null
  longitude?: number | null
  occurredAt: Date
  reportedAt: Date
  injured: number
  fatalities: number
  arrested: number
  propertyDamage: boolean
  votingDisrupted: boolean
  weaponType: WeaponType
  isAutoDetected: boolean
  publishedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  victims?: VictimData[]
  actors?: ActorData[]
  sources?: SourceData[]
  election?: { id: string; name: string; country: string } | null
  createdBy?: { id: string; name: string | null; email: string } | null
  reviewedBy?: { id: string; name: string | null; email: string } | null
}

export interface VictimData {
  id: string
  role: string
  gender: string
  ageGroup: string
  count: number
}

export interface ActorData {
  id: string
  actorType: string
  name?: string | null
  partyName?: string | null
}

export interface SourceData {
  id: string
  sourceUrl: string
  sourceName: string
  sourceType: string
  publishedAt?: Date | null
  isVerified: boolean
}

export interface MapIncident {
  id: string
  referenceId: string
  title: string
  category: IncidentCategory
  latitude: number
  longitude: number
  country: string
  occurredAt: Date
  fatalities: number
  injured: number
  confidenceScore: number
}

export interface DashboardStats {
  totalIncidents: number
  publishedIncidents: number
  pendingReview: number
  totalFatalities: number
  totalInjured: number
  incidentsByCategory: Record<string, number>
  incidentsByStage: Record<string, number>
  incidentsByCountry: Record<string, number>
  recentIncidents: IncidentWithRelations[]
  trend: { date: string; count: number }[]
}

export interface ClassificationResult {
  isElectionRelated: boolean
  isViolenceRelated: boolean
  confidence: number
  category?: IncidentCategory
  stage?: ElectionStage
  location?: {
    country?: string
    region?: string
    district?: string
    community?: string
  }
  weapons?: WeaponType
  victims?: {
    roles: string[]
    estimatedCount: number
  }
  summary?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface IncidentFilters {
  status?: IncidentStatus
  category?: IncidentCategory
  country?: string
  electionStage?: ElectionStage
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}