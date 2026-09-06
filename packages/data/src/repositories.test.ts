import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * `repositories.ts` declares types and nothing else, so there is no behaviour to call — and the
 * rules that matter about it are exactly the ones `tsc` cannot see. A repository method that
 * takes `tenantId` second, returns a bare array, or forgets to be async compiles perfectly and
 * is only wrong architecturally. That is what this suite reads for.
 *
 * It parses the declarations with the TypeScript compiler rather than a regex, the same way
 * `rows.test.ts` does, because a regex over type declarations holds up until somebody writes a
 * generic, a union or a comment containing a colon — all three of which are in this file.
 *
 * Every assertion fails on a real, plausible mistake. Reordering one `tenantId`, dropping the
 * `page?` from one list method, or adding a cross-tenant method anywhere outside
 * `TenantDirectory` each turns this suite red.
 */

type Parameter = { readonly name: string; readonly type: string; readonly optional: boolean };
type Method = {
  readonly owner: string;
  readonly name: string;
  readonly parameters: readonly Parameter[];
  readonly returns: string;
};
type Alias = {
  readonly name: string;
  readonly methods: readonly Method[];
  /** Properties that are not functions — a repository should have none. */
  readonly fields: readonly string[];
};

const parseSource = (name: string, text: string): ts.SourceFile =>
  ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);

const parse = (file: string): ts.SourceFile => {
  const path = join(__dirname, file);
  return parseSource(path, readFileSync(path, 'utf8'));
};

const normalise = (node: ts.Node): string => node.getText().replace(/\s+/g, ' ').trim();

/** Exported `type X = { … }` aliases, split into their function and non-function members. */
const objectAliases = (source: ts.SourceFile): readonly Alias[] =>
  source.statements.flatMap((statement) => {
    if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeLiteralNode(statement.type)) return [];
    const owner = statement.name.text;
    const methods: Method[] = [];
    const fields: string[] = [];

    const parametersOf = (declared: ts.NodeArray<ts.ParameterDeclaration>): readonly Parameter[] =>
      declared.map((parameter) => ({
        name: ts.isIdentifier(parameter.name) ? parameter.name.text : '<destructured>',
        type: parameter.type === undefined ? '<untyped>' : normalise(parameter.type),
        optional: parameter.questionToken !== undefined,
      }));

    for (const member of statement.type.members) {
      /*
       * Both ways of writing a method, because TypeScript has two and this file only knew one.
       *
       *     list: (tenantId: TenantId) => Promise<Page<Session>>   // PropertySignature
       *     list(tenantId: TenantId): Promise<Page<Session>>       // MethodSignature
       *
       * They mean the same thing to `tsc` and meant nothing at all here: a shorthand member is
       * neither a property nor a field, so it fell out of the loop entirely and every rule
       * below — tenant-first, async, no bare arrays, PageRequest last — silently skipped it.
       * A contract test with a syntax it cannot see is one anybody can step around without
       * ever meaning to, and `repositories.ts` happens to use the other form throughout, which
       * is why nothing was wrong yet and why nothing would have said so.
       */
      if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) {
        methods.push({
          owner,
          name: member.name.text,
          parameters: parametersOf(member.parameters),
          returns: member.type === undefined ? '<untyped>' : normalise(member.type),
        });
        continue;
      }

      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
      const type = member.type;
      if (type !== undefined && ts.isFunctionTypeNode(type)) {
        methods.push({
          owner,
          name: member.name.text,
          parameters: parametersOf(type.parameters),
          returns: normalise(type.type),
        });
      } else {
        fields.push(member.name.text);
      }
    }
    return [{ name: owner, methods, fields }];
  });

/** Every name in an `export { … }` / `export type { … }` list. */
const reExportedNames = (source: ts.SourceFile): readonly string[] =>
  source.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)) return [];
    const clause = statement.exportClause;
    return clause !== undefined && ts.isNamedExports(clause)
      ? clause.elements.map((element) => element.name.text)
      : [];
  });

const repositoriesSource = parse('repositories.ts');
const indexSource = parse('index.ts');

const aliases = objectAliases(repositoriesSource);
const byName = (name: string): Alias | undefined => aliases.find((alias) => alias.name === name);

const repositories = aliases.filter((alias) => alias.name.endsWith('Repository'));
const repositoryNames = repositories.map((repository) => repository.name);

/**
 * The inventory, written down rather than counted.
 *
 * Every size assertion here used to be a floor — *at least* 16 repositories, 30 methods, 10
 * paged ones — and the adapter and barrel requirements were derived from the same parsed source
 * they were checking. So deleting a repository along with its adapter entry and its export left
 * the whole suite green: the floor still held, and "every repository is in the adapter" is
 * trivially true of a repository that no longer exists. A suite that measures its subject
 * against itself agrees with it by construction.
 *
 * Pinned literally, so removing one is a decision somebody makes here in writing. Adding one
 * costs a line in this list, which is the intended price.
 */
const EXPECTED_REPOSITORIES = [
  'TenantRepository',
  'UserRepository',
  'MembershipRepository',
  'ApprovalRequestRepository',
  'VenueRepository',
  'SessionRepository',
  'PersonRepository',
  'MediaRepository',
  'PersonaRepository',
  'GossipRepository',
  'TaskRepository',
  'UnitRepository',
  'AssignmentRepository',
  'AnnouncementRepository',
  'RsvpRepository',
  'NotificationPreferenceRepository',
] as const;

/** Repository methods, excluding `TenantDirectory`'s two. */
const EXPECTED_REPOSITORY_METHODS = 50;

/** Methods returning a `Page`, across repositories and the directory alike. */
const EXPECTED_PAGED_METHODS = 15;

/**
 * `TenantDirectory` is the documented exception: its two methods are how a caller obtains a
 * `TenantId` in the first place, so they cannot be given one. It is held apart from the
 * tenant-first rule here and pinned by size below, so a third cross-tenant method has to be a
 * decision somebody makes rather than one that happens.
 */
const directory = byName('TenantDirectory');

const methodsOf = (list: readonly Alias[]): readonly Method[] =>
  list.flatMap((alias) => alias.methods);

const repositoryMethods = methodsOf(repositories);
const everyMethod = [...repositoryMethods, ...(directory?.methods ?? [])];

const label = (method: Method): string => `${method.owner}.${method.name}`;

describe('the repository surface', () => {
  it('is exactly the set of repositories this package is documented to have', () => {
    /* Equality, not a floor: a floor cannot tell a deletion from a suite that never looked. */
    expect([...repositoryNames].sort()).toEqual([...EXPECTED_REPOSITORIES].sort());
  });

  it('has exactly the number of methods it had when this was written', () => {
    expect(repositoryMethods.length).toBe(EXPECTED_REPOSITORY_METHODS);
  });

  it('declares only methods on a repository, never a data field', () => {
    const offenders = repositories.flatMap((repository) =>
      repository.fields.map((field) => `${repository.name}.${field}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the parser sees both ways of writing a method', () => {
  /**
   * The rules below are only as wide as what the parser reads, and it read one of TypeScript's
   * two spellings. `repositories.ts` happens to use the other form throughout — so nothing was
   * wrong, nothing would have said so, and the first person to write the shorthand would have
   * got a method exempt from every check in this file.
   *
   * Parsed from a literal rather than from the real file, because the case worth proving is the
   * one the real file does not contain.
   */
  const fixture = `
    export type ExampleRepository = {
      readonly asProperty: (tenantId: TenantId, page?: PageRequest) => Promise<Page<Thing>>;
      asMethod(tenantId: TenantId, page?: PageRequest): Promise<Page<Thing>>;
      readonly notAMethod: string;
    };
  `;

  const parsed = objectAliases(parseSource('fixture.ts', fixture))[0];

  it('records a method-shorthand member as a method', () => {
    expect(parsed?.methods.map((method) => method.name).sort()).toEqual(['asMethod', 'asProperty']);
  });

  it('does not quietly drop it into fields, or out of the file altogether', () => {
    /* Before this, `asMethod` appeared in neither list — invisible rather than misfiled, which
       is why no assertion anywhere failed. */
    expect(parsed?.fields).toEqual(['notAMethod']);
  });

  it('reads the same parameters and return type from both spellings', () => {
    const asProperty = parsed?.methods.find((method) => method.name === 'asProperty');
    const asMethod = parsed?.methods.find((method) => method.name === 'asMethod');

    expect(asMethod?.parameters).toEqual(asProperty?.parameters);
    expect(asMethod?.returns).toEqual(asProperty?.returns);
    /* Spelled out, so this cannot pass by both being empty. */
    expect(asMethod?.parameters).toEqual([
      { name: 'tenantId', type: 'TenantId', optional: false },
      { name: 'page', type: 'PageRequest', optional: true },
    ]);
    expect(asMethod?.returns).toBe('Promise<Page<Thing>>');
  });
});

describe('tenantId is the first argument (the rule that prevents cross-tenant leaks)', () => {
  it('holds for every method of every repository', () => {
    const offenders = repositoryMethods
      .filter((method) => {
        const first = method.parameters[0];
        if (first === undefined) return true;
        return first.name !== 'tenantId' || first.type !== 'TenantId';
      })
      .map(label);
    expect(offenders).toEqual([]);
  });

  it('leaves TenantDirectory as the only cross-tenant surface, at exactly two methods', () => {
    expect(directory).toBeDefined();
    expect(directory?.methods.map((method) => method.name).sort()).toEqual([
      'bySlug',
      'listForUser',
    ]);
  });
});

/**
 * `DataAdapter` holds type references rather than function types or literals, so it falls into
 * neither bucket above and needs reading directly.
 */
const dataAdapterMemberTypes = (): readonly string[] =>
  repositoriesSource.statements.flatMap((statement) => {
    if (
      !ts.isTypeAliasDeclaration(statement) ||
      statement.name.text !== 'DataAdapter' ||
      !ts.isTypeLiteralNode(statement.type)
    ) {
      return [];
    }
    return statement.type.members.flatMap((member) =>
      ts.isPropertySignature(member) && member.type !== undefined ? [normalise(member.type)] : [],
    );
  });

describe('DataAdapter', () => {
  /**
   * Without this, a new cross-tenant repository could be added and simply left out of the
   * adapter's shape while still being exported and used — or named `SomethingDirectory` to slip
   * past the check above. The adapter is the whole surface, so pinning it pins the rule.
   */
  it('exposes every repository and the directory, and nothing else', () => {
    /* Against the written inventory rather than against the parsed source. Derived from
       `repositoryNames`, this passed for a repository that had been deleted from both. */
    const expected = [...EXPECTED_REPOSITORIES, 'TenantDirectory'].sort();
    expect([...dataAdapterMemberTypes()].sort()).toEqual(expected);
  });
});

describe('every method is async', () => {
  it('returns a Promise, including the ones a mock could answer from an array', () => {
    const offenders = everyMethod.filter((method) => !method.returns.startsWith('Promise<'));
    expect(offenders.map(label)).toEqual([]);
  });
});

describe('collections are pages, not arrays', () => {
  /**
   * The retrofit this whole file exists to avoid. A method that returns `Promise<Session[]>`
   * compiles, works against the mock's forty fixture rows, and is a rewrite of every caller the
   * day the list is longer than a screen.
   */
  it('never returns a bare array', () => {
    const offenders = everyMethod.filter((method) => /\[\]\s*>?$/.test(method.returns));
    expect(offenders.map((method) => `${label(method)}: ${method.returns}`)).toEqual([]);
  });

  it('takes an optional PageRequest as the last argument wherever it returns a Page', () => {
    const paged = everyMethod.filter((method) => method.returns.startsWith('Promise<Page<'));
    expect(paged.length).toBe(EXPECTED_PAGED_METHODS);

    const offenders = paged
      .filter((method) => {
        const last = method.parameters.at(-1);
        if (last === undefined) return true;
        return last.type !== 'PageRequest' || !last.optional;
      })
      .map(label);
    expect(offenders).toEqual([]);
  });

  it('never takes a PageRequest anywhere but last, where a caller would miss it', () => {
    const offenders = everyMethod
      .filter((method) =>
        method.parameters.slice(0, -1).some((parameter) => parameter.type === 'PageRequest'),
      )
      .map(label);
    expect(offenders).toEqual([]);
  });
});

describe('the gossip realtime seam (#36 implements it; the shape has to exist now)', () => {
  const gossip = byName('GossipRepository');
  const subscribe = gossip?.methods.find((method) => method.name === 'subscribe');

  it('exists on the gossip repository', () => {
    expect(subscribe).toBeDefined();
  });

  it('takes tenantId first and hands back an Unsubscribe, asynchronously', () => {
    expect(subscribe?.parameters[0]?.name).toBe('tenantId');
    expect(subscribe?.returns).toBe('Promise<Unsubscribe>');
  });

  it('delivers changes rather than whole lists, so a listener can apply one', () => {
    const listener = subscribe?.parameters.at(-1);
    expect(listener?.type).toBe('(change: GossipChange) => void');
  });
});

describe('the package barrel', () => {
  /**
   * `packages/data/index.ts` is the single swap point (§6). A repository type it does not
   * re-export is invisible to the adapters and the contract suite written against it, in a way
   * nothing else complains about — the deep import still resolves.
   */
  it('re-exports every repository, the adapter and the pagination types', () => {
    /* The required names are listed here, not read back out of the source being checked. */
    const exported = new Set(reExportedNames(indexSource));
    const required = [
      ...EXPECTED_REPOSITORIES,
      'DataAdapter',
      'TenantDirectory',
      'Unsubscribe',
      'Page',
      'PageRequest',
      'Cursor',
      /* The realtime and pagination surface a consumer cannot reach any other way. Omitted
         before, so the barrel could drop them and this suite would have agreed. */
      'Change',
      'GossipChange',
      'DEFAULT_PAGE_SIZE',
      'MAX_PAGE_SIZE',
    ];
    expect(required.filter((name) => !exported.has(name))).toEqual([]);
  });

  it('re-exports the typed errors and their guards', () => {
    const exported = new Set(reExportedNames(indexSource));
    const required = [
      'DataError',
      'NotFoundError',
      'ForbiddenError',
      'ValidationError',
      'isDataError',
      'isNotFoundError',
      'isForbiddenError',
      'isValidationError',
    ];
    expect(required.filter((name) => !exported.has(name))).toEqual([]);
  });
});
