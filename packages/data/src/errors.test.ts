import { describe, expect, it } from '@jest/globals';
import { tenantId } from '@occasio/core';
import {
  DATA_ERROR_CODES,
  DataError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type ValidationIssue,
  isDataError,
  isForbiddenError,
  isNotFoundError,
  isValidationError,
} from './errors';

/**
 * Two of these look like they are testing the language rather than the code, and they are not.
 *
 * The three classes have almost no logic, so what is worth asserting is the part callers depend
 * on and nothing enforces: that each error carries the fields a screen needs, that the guards
 * separate the three rather than merely recognising a data error, and that `ValidationError`
 * reports every issue instead of the first.
 *
 * Each assertion was checked against a deliberately broken `errors.ts` before being trusted:
 * dropping the `name` assignment, the defensive copy of `issues`, or the tenant from
 * `ForbiddenError`'s message each turns one of these red.
 */

const TENANT = tenantId('t_santi-riyanks');

describe('typed errors', () => {
  it('are real Errors, with a stack and a name that survives the class', () => {
    const error = new NotFoundError({ entity: 'session', id: 's_1' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NotFoundError');
    expect(typeof error.stack).toBe('string');
  });

  it('share DataError, so one `instanceof` narrows an unknown from a catch', () => {
    expect(new NotFoundError({ entity: 'session', id: 's_1' })).toBeInstanceOf(DataError);
    expect(new ForbiddenError({ tenantId: TENANT, action: 'gossip.list' })).toBeInstanceOf(
      DataError,
    );
    expect(new ValidationError([])).toBeInstanceOf(DataError);
  });

  it('carry a code for every declared code, and no other', () => {
    const codes = [
      new NotFoundError({ entity: 'session', id: 's_1' }).code,
      new ForbiddenError({ tenantId: TENANT, action: 'gossip.list' }).code,
      new ValidationError([]).code,
    ];
    expect([...codes].sort()).toEqual([...DATA_ERROR_CODES].sort());
  });

  it('accepts a cause, so an adapter can wrap a driver error without losing it', () => {
    const cause = new Error('socket hang up');
    expect(new NotFoundError({ entity: 'venue', id: 'v_1' }, { cause }).cause).toBe(cause);
  });
});

describe('NotFoundError', () => {
  it('names what was missing, in the message and as fields', () => {
    const error = new NotFoundError({ entity: 'session', id: 's_42' });
    expect(error.entity).toBe('session');
    expect(error.id).toBe('s_42');
    expect(error.message).toContain('session');
    expect(error.message).toContain('s_42');
  });
});

describe('ForbiddenError', () => {
  /**
   * The simulated RLS check (§6). The tenant and the operation are both in the message because
   * the pair is the diagnosis — a wedding screen calling `gossip.moderate` on the conference is
   * unreadable as either half alone.
   */
  it('names the tenant and the operation that was refused', () => {
    const error = new ForbiddenError({ tenantId: TENANT, action: 'gossip.moderate' });
    expect(error.tenantId).toBe(TENANT);
    expect(error.action).toBe('gossip.moderate');
    expect(error.message).toContain(TENANT);
    expect(error.message).toContain('gossip.moderate');
  });
});

describe('ValidationError', () => {
  it('reports every issue rather than the first', () => {
    const error = new ValidationError([
      { path: 'email', message: 'required when phone is absent' },
      { path: 'role', message: 'not a known role' },
    ]);
    expect(error.issues).toHaveLength(2);
    expect(error.message).toContain('email');
    expect(error.message).toContain('role');
  });

  it('has a message even with no issues, so it is never an empty alert', () => {
    expect(new ValidationError([]).message).not.toBe('');
  });

  it('copies the issues, so a caller reusing its array cannot rewrite history', () => {
    const issues = [{ path: 'body', message: 'must not be empty' }];
    const error = new ValidationError(issues);
    issues.push({ path: 'mediaId', message: 'unknown media' });
    expect(error.issues).toHaveLength(1);
  });

  it('copies each issue, not just the array holding them', () => {
    /*
     * `[...issues]` closed the longer route and left the shorter one open: the entries were
     * shared, so these assignments used to reach straight into the error. `message` is built
     * once in the constructor, so the result was one error object describing itself two ways —
     * `issues[0].message` saying one thing and `error.message` still saying the other.
     *
     * The array is held in a variable and its entry replaced as well as mutated, so this covers
     * detachment from the caller's array and from the objects in it. An inline literal would
     * have proved only the second.
     */
    const issue = { path: 'body', message: 'must not be empty' };
    const issues = [issue];
    const error = new ValidationError(issues);

    issue.message = 'something else entirely';
    issues[0] = { path: 'mediaId', message: 'unknown media' };

    expect(error.issues[0]).toEqual({ path: 'body', message: 'must not be empty' });
    expect(error.message).toContain('must not be empty');
  });

  it('does not freeze the caller’s own issues on the way past', () => {
    /* Freezing `issue` rather than the copy of it would reach back out and immobilise an object
       the caller still owns — a constructor with an opinion about somebody else's data. */
    const issue = { path: 'body', message: 'must not be empty' };
    new ValidationError([issue]);

    expect(Object.isFrozen(issue)).toBe(false);
  });

  it('copies fields that a spread would not see', () => {
    /*
     * `ValidationIssue` is a structural type, so an object whose fields come from a prototype
     * getter satisfies it completely — and `{ ...issue }` copies own enumerable properties, so
     * it would have produced `{}`. `describe` reads the values directly, so the message would
     * come out right while `issues[0]` was empty: the same error describing itself two ways,
     * through the line written to prevent exactly that.
     */
    class PrototypeIssue implements ValidationIssue {
      /* Private, so the instance has no own enumerable property at all and spreading it yields
         `{}` — which a `readonly` field, the shape lint would rather see here, would quietly
         not be, leaving the test green against the very code it is meant to catch. */
      readonly #field: string;

      constructor(field: string) {
        this.#field = field;
      }

      get path(): string {
        return this.#field;
      }

      get message(): string {
        return `${this.#field} must not be empty`;
      }
    }

    const error = new ValidationError([new PrototypeIssue('body')]);

    expect(error.issues[0]).toEqual({ path: 'body', message: 'body must not be empty' });
    expect(error.message).toContain('body must not be empty');
  });

  it('will not let the error’s own copy drift from its message either', () => {
    /*
     * The same desync from the other side. `readonly` is erased at build time and stops nobody
     * at runtime, so the issues are frozen: under a module's strict mode this throws instead of
     * quietly reintroducing the defect the copy above exists to prevent.
     */
    const error = new ValidationError([{ path: 'body', message: 'must not be empty' }]);

    expect(() => {
      const [first] = error.issues;
      if (first !== undefined) Object.assign(first, { message: 'rewritten' });
    }).toThrow(TypeError);

    expect(error.issues[0]?.message).toBe('must not be empty');
    /* The array too, not only the entries — otherwise an issue could still be appended to an
       error whose message was built before it existed. Asserted through `Object.isFrozen`
       rather than by calling `push`, which `readonly ValidationIssue[]` does not offer and
       which reaching for a cast to obtain would be its own lint error. */
    expect(Object.isFrozen(error.issues)).toBe(true);
  });
});

describe('the narrowing guards', () => {
  /**
   * `catch` gives `unknown`, and narrowing it with a cast is a lint error in this repo
   * (CONTRIBUTING), so these guards are the only door. Each must reject the other two errors —
   * a guard implemented against the base class would pass the positive cases and quietly let a
   * `ForbiddenError` into a not-found branch.
   */
  const notFound = new NotFoundError({ entity: 'session', id: 's_1' });
  const forbidden = new ForbiddenError({ tenantId: TENANT, action: 'sessions.list' });
  const validation = new ValidationError([{ path: 'body', message: 'empty' }]);

  it('recognises all three as data errors, and nothing else', () => {
    expect(isDataError(notFound)).toBe(true);
    expect(isDataError(forbidden)).toBe(true);
    expect(isDataError(validation)).toBe(true);
    expect(isDataError(new Error('socket hang up'))).toBe(false);
    expect(isDataError('forbidden')).toBe(false);
    expect(isDataError(null)).toBe(false);
  });

  it('does not confuse one kind for another', () => {
    expect([isNotFoundError(notFound), isNotFoundError(forbidden), isNotFoundError(validation)]) //
      .toEqual([true, false, false]);
    expect([isForbiddenError(notFound), isForbiddenError(forbidden), isForbiddenError(validation)]) //
      .toEqual([false, true, false]);
    expect([
      isValidationError(notFound),
      isValidationError(forbidden),
      isValidationError(validation),
    ]).toEqual([false, false, true]);
  });

  it('narrows enough to reach the fields, which is the entire point', () => {
    const thrown: unknown = forbidden;
    expect(isForbiddenError(thrown) ? thrown.tenantId : null).toBe(TENANT);
  });
});
