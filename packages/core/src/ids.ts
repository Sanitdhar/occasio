/**
 * D16 — branded ids.
 *
 * In a multi-tenant app every id is a string, so `sessions.list(sessionId)` when the signature
 * wants a `TenantId` compiles cleanly and leaks one event's data into another. Branding makes
 * that a compile error instead of an incident.
 *
 * The brand is a `unique symbol` that is declared but never defined, so it exists only in the
 * type system: at runtime these values are ordinary strings with no wrapper and no cost.
 */

declare const brand: unique symbol;

export type Branded<TBrand extends string> = string & { readonly [brand]: TBrand };

export type TenantId = Branded<'Tenant'>;
export type UserId = Branded<'User'>;
export type SessionId = Branded<'Session'>;
export type VenueId = Branded<'Venue'>;
export type PersonId = Branded<'Person'>;
export type MediaId = Branded<'Media'>;
export type GossipPostId = Branded<'GossipPost'>;
export type PersonaId = Branded<'Persona'>;
export type TaskId = Branded<'Task'>;
export type UnitId = Branded<'Unit'>;
export type AssignmentId = Branded<'Assignment'>;
export type MembershipId = Branded<'Membership'>;
export type AnnouncementId = Branded<'Announcement'>;

/*
 * The constructors below are the only place in the repo (with mappers.ts) where a raw string
 * becomes a branded id, so every untrusted string has exactly one door into the type system.
 */

export const tenantId = (value: string): TenantId => value as TenantId;
export const userId = (value: string): UserId => value as UserId;
export const sessionId = (value: string): SessionId => value as SessionId;
export const venueId = (value: string): VenueId => value as VenueId;
export const personId = (value: string): PersonId => value as PersonId;
export const mediaId = (value: string): MediaId => value as MediaId;
export const gossipPostId = (value: string): GossipPostId => value as GossipPostId;
export const personaId = (value: string): PersonaId => value as PersonaId;
export const taskId = (value: string): TaskId => value as TaskId;
export const unitId = (value: string): UnitId => value as UnitId;
export const assignmentId = (value: string): AssignmentId => value as AssignmentId;
export const membershipId = (value: string): MembershipId => value as MembershipId;
export const announcementId = (value: string): AnnouncementId => value as AnnouncementId;
