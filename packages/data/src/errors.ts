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
    /*
     * `message` is built once, here, from these issues — so anything that can change an issue
     * afterwards produces one error object describing itself two ways: `issues[0].message`
     * saying one thing and `error.message` still saying what it said when it was thrown.
     *
     * `[...issues]` was a copy of the array and not of the issues in it, which closes the route
     * through the caller's array and leaves the shorter one wide open: the entries were shared,
     * so `issues[0].message = '…'` reached straight into the error.
     *
     * The two fields by name rather than `{ ...issue }`. A spread copies own enumerable
     * properties, and a `ValidationIssue` is a structural type: an object whose `path` and
     * `message` come from a prototype getter, or from a property defined as non-enumerable,
     * satisfies it completely and spreads to `{}`. `describe` reads the values directly, so
     * the message would come out right and `issues[0]` would be empty — the same error
     * describing itself two ways, rebuilt by the line meant to prevent it.
     *
     * Frozen as well as copied, because that is the only route left and it runs the other way —
     * `error.issues[0].message = '…'` on the error's own copy. `readonly` is erased at build
     * time and stops nobody at runtime. Under a module's strict mode the assignment now throws
     * rather than being ignored, which is the intended outcome: mutating a thrown error's issues
     * is a bug in the caller either way, and the alternative to a loud failure here is silently
     * reintroducing the exact defect this constructor exists to prevent.
     */
    this.issues = Object.freeze(
      issues.map((issue) => Object.freeze({ path: issue.path, message: issue.message })),
    );
  }

  private static describe(issues: readonly ValidationIssue[]): string {
    if (issues.length === 0) return 'Invalid input';
    return `Invalid input: ${issues.map((issue) => `${issue.path} — ${issue.message}`).join('; ')}`;
  }
}

/**
 * The narrowing helpers. `catch` hands over `unknown`, and without these the only way to reach a
 * field is a cast, which lint forbids outside two files.
 *
 * `isDataError` widens to the three subclasses by hand rather than to `DataError`, so that
 * `error.code` narrows the union and reaches `issues` or `tenantId`. A fourth error type has to
 * be added to that union as well as to `DATA_ERROR_CODES` — which is the point at which someone
 * has to think about how screens render it.
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
