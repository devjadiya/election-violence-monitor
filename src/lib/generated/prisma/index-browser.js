
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  emailVerified: 'emailVerified',
  image: 'image',
  password: 'password',
  role: 'role',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  expires_at: 'expires_at',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId',
  expires: 'expires'
};

exports.Prisma.VerificationTokenScalarFieldEnum = {
  identifier: 'identifier',
  token: 'token',
  expires: 'expires'
};

exports.Prisma.ElectionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  country: 'country',
  countryCode: 'countryCode',
  electionDate: 'electionDate',
  electionType: 'electionType',
  wikidataId: 'wikidataId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.IncidentScalarFieldEnum = {
  id: 'id',
  referenceId: 'referenceId',
  title: 'title',
  description: 'description',
  category: 'category',
  status: 'status',
  verificationStatus: 'verificationStatus',
  electionStage: 'electionStage',
  confidenceScore: 'confidenceScore',
  isAutoDetected: 'isAutoDetected',
  isDemo: 'isDemo',
  evidence: 'evidence',
  extractionModel: 'extractionModel',
  promptVersion: 'promptVersion',
  country: 'country',
  countryCode: 'countryCode',
  region: 'region',
  district: 'district',
  community: 'community',
  specificLocation: 'specificLocation',
  latitude: 'latitude',
  longitude: 'longitude',
  occurredAt: 'occurredAt',
  reportedAt: 'reportedAt',
  injured: 'injured',
  fatalities: 'fatalities',
  arrested: 'arrested',
  propertyDamage: 'propertyDamage',
  votingDisrupted: 'votingDisrupted',
  weaponType: 'weaponType',
  weaponDetails: 'weaponDetails',
  wikidataId: 'wikidataId',
  electionId: 'electionId',
  createdById: 'createdById',
  reviewedById: 'reviewedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt',
  rejectedAt: 'rejectedAt'
};

exports.Prisma.VictimScalarFieldEnum = {
  id: 'id',
  incidentId: 'incidentId',
  role: 'role',
  gender: 'gender',
  ageGroup: 'ageGroup',
  count: 'count',
  nameAnonymized: 'nameAnonymized',
  hasDisability: 'hasDisability',
  ethnicGroup: 'ethnicGroup',
  religiousGroup: 'religiousGroup',
  createdAt: 'createdAt'
};

exports.Prisma.ActorScalarFieldEnum = {
  id: 'id',
  incidentId: 'incidentId',
  actorType: 'actorType',
  name: 'name',
  partyName: 'partyName',
  isPerpetratorSuspected: 'isPerpetratorSuspected',
  createdAt: 'createdAt'
};

exports.Prisma.MonitoredSourceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  url: 'url',
  rssUrl: 'rssUrl',
  apiEndpoint: 'apiEndpoint',
  sourceType: 'sourceType',
  country: 'country',
  language: 'language',
  isActive: 'isActive',
  trustScore: 'trustScore',
  lastFetchedAt: 'lastFetchedAt',
  lastSuccessAt: 'lastSuccessAt',
  lastError: 'lastError',
  consecutiveFailures: 'consecutiveFailures',
  electionId: 'electionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RawArticleScalarFieldEnum = {
  id: 'id',
  urlHash: 'urlHash',
  url: 'url',
  title: 'title',
  content: 'content',
  publishedAt: 'publishedAt',
  fetchedAt: 'fetchedAt',
  language: 'language',
  isElectionRelated: 'isElectionRelated',
  isViolenceRelated: 'isViolenceRelated',
  pass1Score: 'pass1Score',
  pass1At: 'pass1At',
  isProcessed: 'isProcessed',
  pass2At: 'pass2At',
  bodyFetchedAt: 'bodyFetchedAt',
  bodyMethod: 'bodyMethod',
  sourceId: 'sourceId'
};

exports.Prisma.IncidentSourceScalarFieldEnum = {
  id: 'id',
  incidentId: 'incidentId',
  sourceUrl: 'sourceUrl',
  sourceName: 'sourceName',
  sourceType: 'sourceType',
  publishedAt: 'publishedAt',
  isVerified: 'isVerified',
  createdAt: 'createdAt'
};

exports.Prisma.FollowUpScalarFieldEnum = {
  id: 'id',
  incidentId: 'incidentId',
  actionType: 'actionType',
  description: 'description',
  date: 'date',
  isConfirmed: 'isConfirmed',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  incidentId: 'incidentId',
  userId: 'userId',
  action: 'action',
  previousData: 'previousData',
  newData: 'newData',
  notes: 'notes',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

exports.Prisma.TipSubmissionScalarFieldEnum = {
  id: 'id',
  description: 'description',
  location: 'location',
  occurredAt: 'occurredAt',
  category: 'category',
  isAnonymous: 'isAnonymous',
  submitterId: 'submitterId',
  isReviewed: 'isReviewed',
  reviewNotes: 'reviewNotes',
  createdAt: 'createdAt'
};

exports.Prisma.IngestionLogScalarFieldEnum = {
  id: 'id',
  sourceId: 'sourceId',
  jobType: 'jobType',
  articlesFound: 'articlesFound',
  articlesNew: 'articlesNew',
  incidentsCreated: 'incidentsCreated',
  errors: 'errors',
  durationMs: 'durationMs',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  title: 'title',
  message: 'message',
  link: 'link',
  isRead: 'isRead',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  PUBLIC: 'PUBLIC',
  OBSERVER: 'OBSERVER',
  ANALYST: 'ANALYST',
  REVIEWER: 'REVIEWER',
  EDITOR: 'EDITOR',
  ADMIN: 'ADMIN'
};

exports.IncidentCategory = exports.$Enums.IncidentCategory = {
  PHYSICAL_ASSAULT: 'PHYSICAL_ASSAULT',
  ARMED_ATTACK: 'ARMED_ATTACK',
  VOTER_INTIMIDATION: 'VOTER_INTIMIDATION',
  POLITICAL_PARTY_CLASH: 'POLITICAL_PARTY_CLASH',
  POLLING_UNIT_DISRUPTION: 'POLLING_UNIT_DISRUPTION',
  INFRASTRUCTURE_ATTACK: 'INFRASTRUCTURE_ATTACK',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  SECURITY_FORCE_MISCONDUCT: 'SECURITY_FORCE_MISCONDUCT',
  KIDNAPPING: 'KIDNAPPING',
  POST_ELECTION_VIOLENCE: 'POST_ELECTION_VIOLENCE',
  OTHER: 'OTHER'
};

exports.IncidentStatus = exports.$Enums.IncidentStatus = {
  RAW: 'RAW',
  FLAGGED: 'FLAGGED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED'
};

exports.VerificationStatus = exports.$Enums.VerificationStatus = {
  CONFIRMED: 'CONFIRMED',
  UNCONFIRMED: 'UNCONFIRMED',
  UNDER_VERIFICATION: 'UNDER_VERIFICATION'
};

exports.ElectionStage = exports.$Enums.ElectionStage = {
  PRE_CAMPAIGN: 'PRE_CAMPAIGN',
  CAMPAIGN: 'CAMPAIGN',
  ELECTION_DAY: 'ELECTION_DAY',
  VOTE_COUNTING: 'VOTE_COUNTING',
  POST_ELECTION: 'POST_ELECTION',
  UNKNOWN: 'UNKNOWN'
};

exports.WeaponType = exports.$Enums.WeaponType = {
  FIREARMS: 'FIREARMS',
  KNIVES_MACHETES: 'KNIVES_MACHETES',
  BLUNT_OBJECTS: 'BLUNT_OBJECTS',
  EXPLOSIVES: 'EXPLOSIVES',
  IMPROVISED: 'IMPROVISED',
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN'
};

exports.VictimRole = exports.$Enums.VictimRole = {
  VOTER: 'VOTER',
  CANDIDATE: 'CANDIDATE',
  CAMPAIGN_STAFF: 'CAMPAIGN_STAFF',
  ELECTION_OFFICIAL: 'ELECTION_OFFICIAL',
  ELECTION_OBSERVER: 'ELECTION_OBSERVER',
  JOURNALIST: 'JOURNALIST',
  PARTY_SUPPORTER: 'PARTY_SUPPORTER',
  SECURITY_PERSONNEL: 'SECURITY_PERSONNEL',
  COMMUNITY_MEMBER: 'COMMUNITY_MEMBER',
  UNKNOWN: 'UNKNOWN'
};

exports.VictimGender = exports.$Enums.VictimGender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  NON_BINARY: 'NON_BINARY',
  UNKNOWN: 'UNKNOWN'
};

exports.AgeGroup = exports.$Enums.AgeGroup = {
  UNDER_18: 'UNDER_18',
  AGE_18_25: 'AGE_18_25',
  AGE_26_40: 'AGE_26_40',
  AGE_41_60: 'AGE_41_60',
  ABOVE_60: 'ABOVE_60',
  UNKNOWN: 'UNKNOWN'
};

exports.SourceType = exports.$Enums.SourceType = {
  RSS_FEED: 'RSS_FEED',
  API: 'API',
  MANUAL: 'MANUAL',
  WEB_SCRAPE: 'WEB_SCRAPE',
  OBSERVER_REPORT: 'OBSERVER_REPORT',
  NGO_REPORT: 'NGO_REPORT'
};

exports.AuditAction = exports.$Enums.AuditAction = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  VERIFIED: 'VERIFIED',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  DELETED: 'DELETED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Account: 'Account',
  Session: 'Session',
  VerificationToken: 'VerificationToken',
  Election: 'Election',
  Incident: 'Incident',
  Victim: 'Victim',
  Actor: 'Actor',
  MonitoredSource: 'MonitoredSource',
  RawArticle: 'RawArticle',
  IncidentSource: 'IncidentSource',
  FollowUp: 'FollowUp',
  AuditLog: 'AuditLog',
  TipSubmission: 'TipSubmission',
  IngestionLog: 'IngestionLog',
  Notification: 'Notification'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
