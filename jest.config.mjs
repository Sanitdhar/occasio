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

/*
 * `runtime: 'automatic'` matches `"jsx": "react-jsx"` in tsconfig.base.json. Without it swc
 * emits `React.createElement`, and every component test fails with `React is not defined` --
 * the files do not import React, because with the automatic runtime they do not have to.
 */
const transform = {
  /* `.mjs` included: the tools are written as ES modules and are tested like anything else. */
  '^.+\\.(m?[tj]s|[tj]sx)$': [
    '@swc/jest',
    {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
    },
  ],
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
        /* The tools decide what merges and what lints. They are not support scripts to this
           repo, they are part of it, and the ones with real logic are tested like it. */
        '<rootDir>/tools/**/*.test.ts',
      ],
      testPathIgnorePatterns: ['\\.contract\\.test\\.', '\\.dom\\.test\\.'],
      moduleNameMapper,
      modulePathIgnorePatterns,
      transform,
    },
    {
      /*
       * Components, rendered. Not `jest-expo`: that preset pulls `react-server-dom-webpack`,
       * whose peer range does not include the React that Expo SDK 57 pins, so installing it
       * requires `--legacy-peer-deps` and silences every genuine peer conflict from then on
       * (#110). Rendering through `react-native-web` needs no such concession — it is the same
       * translation the web export already ships, so a component proved here is proved on the
       * platform D30 ships first.
       *
       * What this does not cover is the native rendering path; that stays the visual gate's and
       * the device's job. A test that runs is worth more than one blocked on a dependency
       * argument, as long as its limits are written down.
       */
      displayName: 'components',
      rootDir: '.',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/*/src/**/*.dom.test.tsx'],
      /*
       * `react-native` becomes its web build; the two Expo packages become stubs.
       *
       * Not a transform of the real ones: they reach for the Expo runtime and the native module
       * registry, which a jsdom test has no use for, and pulling all of it in makes the suite
       * slow and its failures unreadable — the first attempt reported a syntax error inside a
       * doc comment. See test/stubs for what the substitution gives up.
       */
      moduleNameMapper: {
        ...moduleNameMapper,
        '^react-native$': 'react-native-web',
        '^expo-image$': '<rootDir>/test/stubs/expo-image.tsx',
        '^expo-linear-gradient$': '<rootDir>/test/stubs/expo-linear-gradient.tsx',
      },
      /*
       * `.web` first, so the platform split resolves the way Metro resolves it for web.
       *
       * `js` before `ts` for the rest, which is not cosmetic: a dependency shipping both a
       * compiled `dist/index.js` and the `sources/index.ts` it was built from must resolve to
       * the former. With `ts` first, Jest picks the untranspiled source and dies on its ESM --
       * `dom-accessibility-api`, reached through @testing-library, does exactly this.
       */
      moduleFileExtensions: ['web.tsx', 'web.ts', 'js', 'jsx', 'mjs', 'ts', 'tsx', 'json'],
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
