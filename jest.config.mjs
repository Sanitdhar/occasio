/**
 * Types are checked by `tsc --noEmit`, so the test transform deliberately does not typecheck —
 * @swc/jest just strips types, which keeps the suite fast.
 *
 * The `contracts` project (D29) runs one shared suite against every adapter implementation.
 * That is what makes the mock -> Supabase swap a proven property rather than an intention.
 */
const moduleNameMapper = {
  '^@occasio/([^/]+)$': '<rootDir>/packages/$1/src/index.ts',
  '^@occasio/([^/]+)/(.*)$': '<rootDir>/packages/$1/src/$2',
};

const transform = {
  '^.+\\.(t|j)sx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: true } } }],
};

export default {
  passWithNoTests: true,
  /* Agent worktrees are created at .claude/worktrees/<name>/, inside the repo. Each contains a
     full copy of every workspace package, so Metro's Haste map — which Jest shares — finds
     several modules claiming the name `@occasio/theme` and refuses to resolve any of them.
     Invisible until someone runs a git worktree, then it breaks every suite at once. */
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  projects: [
    {
      displayName: 'unit',
      rootDir: '.',
      testMatch: [
        '<rootDir>/packages/*/src/**/*.test.ts',
        '<rootDir>/packages/*/src/**/*.test.tsx',
        // App-level logic is testable too — navigation ordering is pure and had a real bug.
        '<rootDir>/apps/*/src/**/*.test.ts',
      ],
      testPathIgnorePatterns: ['\\.contract\\.test\\.'],
      moduleNameMapper,
      transform,
    },
    {
      displayName: 'contracts',
      rootDir: '.',
      testMatch: ['<rootDir>/packages/*/src/**/*.contract.test.ts'],
      moduleNameMapper,
      transform,
    },
  ],
};
