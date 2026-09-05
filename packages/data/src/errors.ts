import type { TenantId } from '@occasio/core';

/**
 * The three ways a repository call can fail, as types rather than as strings.
 *
 * A screen has to react differently to each: "not found" is a 404 route, "forbidden" is a
 * sign-in or a wrong-event redirect, and "invalid" is a field to highlight in a form. An adapter
 * that reports all three as `Error('failed')` forces every caller to match on message text, and
 * message text is the one part of an error nobody treats as an API — it gets reworded, and three
 * screens quietly stop distinguishing anything.
 *
 * Two mechanisms, deliberately, and they answer different questions:
 *
 *  - `instanceof DataError` narrows an `unknown` from a `catch` in one check. It is the only way
 *    to narrow without a cast, and casts are banned outside `mappers.ts` and `ids.ts`.
 *  - `code` is a literal discriminant, so `switch (error.code)` is checked for exhaustiveness by
 *    `@typescript-eslint/switch-exhaustiveness-check`. Adding a fourth error type then breaks
 *    every incomplete handler at compile time instead of falling through at runtime. It also
 *    survives the JSON round trip that D20's persisted query cache puts errors through, which
 *    `instanceof` does not.
 *
 * `ForbiddenError` is the load-bearing one. The mock adapter throws it when a caller passes a
 * `tenantId` it holds no membership in — a simulated row-level security check, running from the
 * first commit rather than from whenever Supabase arrives. A cross-tenant read that would be a
 * silent data leak in production is a thrown error in a prototype, which is the point.
 */

/** Every code, as a runtime list so an exhaustive UI mapping can be written against it. */
export const DATA_ERROR_CODES = ['not_found', 'forbidden', 'validation'] as const;
export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

/**
 * The shared base. Abstract, because there is no such thing as a generic data error: every
 * failure is one of the three below, and a fourth needs a deliberate decision about how screens
 * render it.
 */
export abstract class DataError extends Error {
  /** Literal in each subclass, so it narrows the union rather than merely describing it. */
  abstract readonly code: DataErrorCode;

  protected constructor(name: string, message: string, options?: ErrorOptions) {
    super(message, options);
    /*
     * The name is passed in as a literal rather than read off `new.target`, so a minifier that
     * renames the class does not rename the error with it — `name` ends up in Sentry (D32) and
     * in every log line, and `class n extends Error` reported as "n" is unreadable.
     */
    this.name = name;
  }
}

/**
 * The row is not there, or the caller is not allowed to know that it is.
 *
 * Under row-level security those two cases are indistinguishable by design, and this error is
 * deliberately the same in both: telling an outsider that `session/abc` exists but is not theirs
 * leaks the existence of the row. `ForbiddenError` is for a tenant the caller cannot touch at
 * all, which they already know, because they named it.
 */
export class NotFoundError extends DataError {
  readonly code = 'not_found' as const;

  /** What was looked for, for the log line — never rendered to an attendee. */
  readonly entity: string;
  readonly id: string;

  constructor(details: { readonly entity: string; readonly id: string }, options?: ErrorOptions) {
    super('NotFoundError', `No ${details.entity} with id ${details.id}`, options);
    this.entity = details.entity;
    this.id = details.id;
  }
}

/**
 * The caller asked for a tenant it has no membership in, or a role it does not hold.
 *
 * This is the simulated RLS check (§6). It carries the `tenantId` and the operation because the
 * pair is what makes a cross-tenant bug readable: "sessions.list on tenant t_devcon" from a
 * screen rendering a wedding is a diagnosis, whereas "Forbidden" is a shrug.
 */
export class ForbiddenError extends DataError {
  readonly code = 'forbidden' as const;

  readonly tenantId: TenantId;
  /** The repository operation, spelled `repository.method` — `gossip.moderate`. */
  readonly action: string;

  constructor(
    details: { readonly tenantId: TenantId; readonly action: string },
    options?: ErrorOptions,
  ) {
    super('ForbiddenError', `Forbidden: ${details.action} on tenant ${details.tenantId}`, options);
    this.tenantId = details.tenantId;
    this.action = details.action;
  }
}

/** One rejected field. `path` is dotted, so a nested config key can point at itself. */
export type ValidationIssue = { readonly path: string; readonly message: string };

/**
 * The input never had a chance — an empty gossip body, an invite with neither an email nor a
 * phone, a `limit` of zero.
 *
 * It carries every issue rather than the first, because a form that reveals one broken field per
 * submission is how a five-field form takes five round trips.
 */
export class ValidationError extends DataError {
  readonly code = 'validation' as const;

  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[], options?: ErrorOptions) {
    super('ValidationError', ValidationError.describe(issues), options);
    /* Copied, so the caller's array cannot be mutated afterwards into disagreeing with the
       message that was already built from it. */
    this.issues = [...issues];
  }

  private static describe(issues: readonly ValidationIssue[]): string {
    if (issues.length === 0) return 'Invalid input';
    return `Invalid input: ${issues.map((issue) => `${issue.path} — ${issue.message}`).join('; ')}`;
  }
}

/**
 * The narrowing helpers. `catch` hands over `unknown`, and without these the only way to reach a
 * field is a cast, which lint forbids outside two files.
 */
export const isDataError = (
  error: unknown,
): error is NotFoundError | ForbiddenError | ValidationError => error instanceof DataError;

export const isNotFoundError = (error: unknown): error is NotFoundError =>
  error instanceof NotFoundError;

export const isForbiddenError = (error: unknown): error is ForbiddenError =>
  error instanceof ForbiddenError;

export const isValidationError = (error: unknown): error is ValidationError =>
  error instanceof ValidationError;
