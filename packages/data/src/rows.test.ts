import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * These conventions are the whole point of the row layer, and none of them can be checked by
 * `tsc`: a camelCase column, a dropped `author_device_hash` or a row that forgot `tenant_id`
 * all compile perfectly. So the test reads the declarations themselves.
 *
 * It parses `rows.ts`, `domain.ts` and `mappers.ts` with the TypeScript compiler rather than a
 * regex, because a regex over type declarations passes for exactly as long as nobody writes a
 * generic, a union or a comment containing a colon.
 *
 * Every assertion below fails on a real, plausible mistake — the ones listed in the design doc
 * as impossible to retrofit fail loudest.
 */

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

type Member = { readonly name: string; readonly optional: boolean };
type Alias = { readonly name: string; readonly members: readonly Member[] };

const parse = (file: string): ts.SourceFile => {
  const path = join(__dirname, file);
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
};

/** Exported `type X = { … }` declarations, with their top-level property names. */
const objectAliases = (source: ts.SourceFile): readonly Alias[] =>
  source.statements.flatMap((statement) => {
    if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeLiteralNode(statement.type)) return [];
    const members = statement.type.members.flatMap((member) =>
      ts.isPropertySignature(member) && ts.isIdentifier(member.name)
        ? [{ name: member.name.text, optional: member.questionToken !== undefined }]
        : [],
    );
    return [{ name: statement.name.text, members }];
  });

/** Exported `export const toX = (row: XRow): X => …`, keyed by the row type it consumes. */
const mapperParameterTypes = (source: ts.SourceFile): readonly string[] =>
  source.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.flatMap((declaration) => {
      const initializer = declaration.initializer;
      if (initializer === undefined || !ts.isArrowFunction(initializer)) return [];
      return initializer.parameters.flatMap((parameter) => {
        const type = parameter.type;
        return type !== undefined && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)
          ? [type.typeName.text]
          : [];
      });
    });
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

const rowsSource = parse('rows.ts');
const domainSource = parse('domain.ts');
const mappersSource = parse('mappers.ts');
const indexSource = parse('index.ts');

const rows = objectAliases(rowsSource).filter((alias) => alias.name.endsWith('Row'));
const domainTypes = objectAliases(domainSource);
const rowNames = rows.map((row) => row.name);

/**
 * Three tables carry no `tenant_id`, and each has a reason that is not "we forgot". Anything
 * else appearing here is a multi-tenancy hole: without the column, a row-level security policy
 * has nothing to check and the query that reads it has nothing to scope.
 */
const NOT_TENANT_SCOPED = new Set([
  // The tenant is the tenant. Its `id` is what every other table's `tenant_id` points at.
  'TenantRow',
  // A person is one account across every event they attend.
  'UserRow',
  // A device belongs to a person, not an event; per-tenant copies could not be revoked at once.
  'DeviceTokenRow',
]);

describe('row types', () => {
  it('declares a row type for every table (this suite is worth nothing if it finds none)', () => {
    expect(rows.length).toBeGreaterThan(10);
    expect(rowNames).toContain('GossipPostRow');
  });

  it('spells every column in snake_case, because that is what Postgres will spell', () => {
    const offenders = rows.flatMap((row) =>
      row.members.filter((m) => !SNAKE_CASE.test(m.name)).map((m) => `${row.name}.${m.name}`),
    );
    expect(offenders).toEqual([]);
  });

  it('uses `| null` rather than `?`, because a nullable column is present and null', () => {
    const offenders = rows.flatMap((row) =>
      row.members.filter((m) => m.optional).map((m) => `${row.name}.${m.name}?`),
    );
    expect(offenders).toEqual([]);
  });

  it('scopes every table to a tenant except the three that deliberately are not', () => {
    const unscoped = rows
      .filter((row) => !NOT_TENANT_SCOPED.has(row.name))
      .filter((row) => !row.members.some((m) => m.name === 'tenant_id'))
      .map((row) => row.name);
    expect(unscoped).toEqual([]);
  });

  /**
   * The design doc's "cannot be retrofitted" list, as assertions. Each of these is either a
   * privacy guarantee or a rendering guarantee that no later migration can recover, so deleting
   * one should break the build rather than be noticed at an event.
   */
  it.each([
    ['GossipPostRow', 'author_device_hash'],
    ['TenantConfigRow', 'draft_config'],
    ['TenantConfigRow', 'published_config'],
    ['MediaAssetRow', 'blurhash'],
    ['MediaAssetRow', 'dominant_color'],
    ['TenantRow', 'timezone'],
  ])('keeps the un-retrofittable column %s.%s', (rowName, column) => {
    const row = rows.find((candidate) => candidate.name === rowName);
    expect(row).toBeDefined();
    expect(row?.members.map((m) => m.name)).toContain(column);
  });

  /**
   * The salted device hash is the one value in the schema that would deanonymise a poster, so
   * the set of tables allowed to hold it is pinned rather than left to reviewer attention.
   * `gossip_posts` needs it to rate-limit and block; `personas` needs it because assignment and
   * reset have to find the mask a device wears, and a device that has not posted yet has no
   * gossip row to find it from. A third table appearing here is a decision, not a detail.
   */
  it('keeps the device hash to the two tables that need it', () => {
    const carriers = rows
      .filter((row) => row.members.some((m) => m.name.includes('device_hash')))
      .map((row) => row.name);
    expect([...carriers].sort()).toEqual(['GossipPostRow', 'PersonaRow']);
  });

  it('never stores a user id against a gossip post (D15 — anonymity is a schema property)', () => {
    const gossip = rows.find((row) => row.name === 'GossipPostRow');
    const identifying = gossip?.members.filter((m) => m.name.includes('user_id')) ?? [];
    expect(identifying).toEqual([]);
  });
});

describe('domain types', () => {
  it('spells every field in camelCase, so the boundary is visible at a glance', () => {
    const offenders = domainTypes.flatMap((type) =>
      type.members.filter((m) => !CAMEL_CASE.test(m.name)).map((m) => `${type.name}.${m.name}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never exposes the device hash, under any spelling', () => {
    const offenders = domainTypes.flatMap((type) =>
      type.members
        .filter((m) => /device/i.test(m.name) && /hash/i.test(m.name))
        .map((m) => `${type.name}.${m.name}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('mappers', () => {
  /**
   * Matches on the parameter *types* rather than on a `to<Name>` naming convention, so adding a
   * table and forgetting its mapper fails here even when the natural mapper name differs from
   * the row name (`TenantConfigRow` maps to `toTenantConfigRecord`).
   */
  it('has exactly one mapper per row type', () => {
    const mapped = mapperParameterTypes(mappersSource).filter((name) => name.endsWith('Row'));
    expect([...mapped].sort()).toEqual([...rowNames].sort());
  });
});

describe('the package barrel', () => {
  /**
   * `packages/data/index.ts` is the single swap point (§6), so a row type it does not re-export
   * is invisible to the adapters and the contract suite that will be written against it — and
   * invisible in a way nothing else complains about, since the deep import still resolves.
   * This found a missing `UserRow` the first time it ran.
   */
  it('re-exports every row type', () => {
    const exported = new Set(reExportedNames(indexSource));
    expect(rowNames.filter((name) => !exported.has(name))).toEqual([]);
  });

  it('re-exports every mapper', () => {
    const exported = new Set(reExportedNames(indexSource));
    const mappers = mappersSource.statements.flatMap((statement) =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.flatMap((d) =>
            ts.isIdentifier(d.name) ? [d.name.text] : [],
          )
        : [],
    );
    expect(mappers.filter((name) => !exported.has(name))).toEqual([]);
  });
});
