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

/*
 * Agent worktrees are created at .claude/worktrees/<name>/, inside the repo, each holding a
 * full copy of every workspace package. The Haste map Jest shares with Metro then finds several
 * packages claiming `@occasio/theme` and refuses to resolve any of them.
 *
 * This MUST live inside each project. Jest does not pass top-level options down to `projects`,
 * so setting it alongside `projects` silently does nothing — which is exactly what happened the
 * first time, and it looked fixed because the only suite importing a workspace package by name
 * was not running at that moment.
 */
const modulePathIgnorePatterns = ['<rootDir>/.claude/'];

const transform = {
  '^.+\\.(t|j)sx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: true } } }],
};

export default {
  passWithNoTests: true,
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
      modulePathIgnorePatterns,
      transform,
    },
    {
      displayName: 'contracts',
      rootDir: '.',
      testMatch: ['<rootDir>/packages/*/src/**/*.contract.test.ts'],
      moduleNameMapper,
      modulePathIgnorePatterns,
      transform,
    },
  ],
};
