/**
 * The data layer (D5, D29) — repository interfaces, row types matching Postgres exactly, and
 * the adapter swap point. Mock adapters land in build-order step 4; the Supabase adapter lives
 * under ./supabase/ and is the only place `@supabase/*` may be imported.
 *
 * Three layers meet here and only here:
 *
 *   rows.ts     snake_case, one type per eventual Postgres table
 *   mappers.ts  the single conversion point, and one of two files allowed a cast
 *   domain.ts   camelCase, the shapes every hook, screen and test above this package sees
 *
 * On top of them sits the seam itself:
 *
 *   repositories.ts  every method async and tenant-first, every collection a Page, and
 *                    `DataAdapter` as the one value an app is handed
 *   pagination.ts    cursor pagination, in the signature before anything needs it
 *   errors.ts        NotFoundError / ForbiddenError / ValidationError
 *
 * Everything above the data layer imports from `domain.ts`. Rows are exported too, because the
 * adapters and the contract suite are written against them, but a row reaching a component means
 * the boundary has been crossed in the wrong place.
 */

export type { FeatureKey, TenantConfig } from './config';
export { FEATURE_KEYS } from './config';

export { DATA_ERROR_CODES } from './errors';
export type { DataErrorCode, ValidationIssue } from './errors';
export {
  DataError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  isDataError,
  isForbiddenError,
  isNotFoundError,
  isValidationError,
} from './errors';

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';
export type { Cursor, Page, PageRequest } from './pagination';

export type {
  AnnouncementQuery,
  AnnouncementRepository,
  ApprovalDecision,
  ApprovalRequestRepository,
  AssignmentQuery,
  AssignmentRepository,
  Change,
  DataAdapter,
  GossipChange,
  GossipModeration,
  GossipQuery,
  GossipRepository,
  MediaQuery,
  MediaRepository,
  MembershipInvite,
  MembershipQuery,
  MembershipRepository,
  NewAnnouncement,
  NewAssignment,
  NewGossipPost,
  NewTask,
  NotificationPreferenceRepository,
  NotificationPreferencesInput,
  PersonRepository,
  PersonaRepository,
  RsvpInput,
  RsvpQuery,
  RsvpRepository,
  SessionQuery,
  SessionRepository,
  TaskQuery,
  TaskRepository,
  TenantDirectory,
  TenantRepository,
  UnitQuery,
  UnitRepository,
  Unsubscribe,
  UserRepository,
  VenueRepository,
} from './repositories';

export type {
  Announcement,
  ApprovalRequest,
  Assignment,
  Coordinates,
  DeviceToken,
  Dimensions,
  GossipPost,
  MediaAsset,
  Membership,
  NotificationDelivery,
  NotificationPreferences,
  Person,
  Persona,
  QuietHours,
  Rsvp,
  Session,
  SessionPerson,
  Task,
  Tenant,
  TenantConfigRecord,
  Unit,
  User,
  Venue,
} from './domain';

export {
  toAnnouncement,
  toApprovalRequest,
  toAssignment,
  toDeviceToken,
  toGossipPost,
  toMediaAsset,
  toMembership,
  toNotificationDelivery,
  toNotificationPreferences,
  toPerson,
  toPersona,
  toRsvp,
  toSession,
  toSessionPerson,
  toTask,
  toTenant,
  toTenantConfigRecord,
  toUnit,
  toUser,
  toVenue,
} from './mappers';

export {
  APPROVAL_REQUEST_STATUSES,
  DEVICE_PLATFORMS,
  MEDIA_KINDS,
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  MODERATION_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  RSVP_STATUSES,
  SESSION_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_VISIBILITIES,
  TENANT_KINDS,
  TENANT_STATUSES,
  TENANT_VISIBILITIES,
  UNIT_KINDS,
} from './rows';

export type {
  AnnouncementRow,
  ApprovalRequestId,
  ApprovalRequestRow,
  ApprovalRequestStatus,
  AssignmentRow,
  DateOnly,
  DevicePlatform,
  DeviceTokenId,
  DeviceTokenRow,
  GossipPostRow,
  IanaTimeZone,
  JsonObject,
  MediaAssetRow,
  MediaKind,
  MembershipRole,
  MembershipRow,
  MembershipStatus,
  ModerationStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryId,
  NotificationDeliveryRow,
  NotificationDeliveryStatus,
  NotificationPreferenceRow,
  PersonRow,
  PersonaRow,
  RsvpRow,
  RsvpStatus,
  SessionPersonRow,
  SessionRow,
  SessionStatus,
  TaskPriority,
  TaskRow,
  TaskStatus,
  TaskVisibility,
  TenantConfigRow,
  TenantKind,
  TenantRow,
  TenantStatus,
  TenantVisibility,
  Timestamptz,
  UnitKind,
  UnitRow,
  UserRow,
  VenueRow,
} from './rows';

export const DATA_SCHEMA_VERSION = 1 as const;
