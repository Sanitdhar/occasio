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
  '^(\\.{1,2}/.*)\\.js$': '$1',
};

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
