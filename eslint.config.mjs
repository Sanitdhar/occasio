import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import occasio from 'eslint-plugin-occasio';
import globals from 'globals';

/**
 * Every rule here traces back to a numbered decision in docs/decisions.md.
 * The meta-rule (D16-D19): a convention is machine-enforced, or it does not exist.
 *
 * TWO TRAPS, both hit while writing this file, both verified by probe afterwards:
 *
 *  1. In flat config, a later block that sets the same rule name REPLACES the earlier one —
 *     it does not merge. So every scope below declares ALL of its restricted imports in one
 *     place, and scopes are ordered general -> specific.
 *  2. eslint-plugin-boundaries needs a TypeScript-aware resolver. Without it, `@occasio/data`
 *     resolves through the workspace symlink, is treated as an external package, and the rule
 *     reports nothing at all.
 *
 * When you add a restriction, add a probe file, confirm it errors, then delete it.
 */

/** eslint-plugin-boundaries v7 entity-selector shorthand. */
const allowTypes = (...types) => types.map((type) => ({ to: { element: { type } } }));

/* D29 — Supabase exists only inside its adapter, so "portable to any backend" is provable. */
const NO_SUPABASE = {
  group: ['@supabase/*'],
  message:
    'Supabase may only be imported inside packages/data/src/supabase/**. Everything else talks to DataAdapter / AuthAdapter / StorageAdapter / NotifierAdapter / MailerAdapter.',
};

/* D8 — screens are pure components, so the theme editor can render them under a preview
   provider and a separate web front end stays possible. */
const NO_EXPO_ROUTER = {
  group: ['expo-router', 'expo-router/*'],
  message:
    'Screens are pure components. Read route params in the route file (app/**) and pass them as props — importing the router here breaks live preview.',
};

/* D10 — the resolver stays pure so it is synchronously testable and usable outside the app. */
const NO_DATA_LAYER = {
  group: ['@occasio/data', '@occasio/data/*'],
  message: 'The theme resolver must not depend on the data layer.',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/web-build/**',
      '**/*.tsbuildinfo',
    ],
  },

  js.configs.recommended,

  /* D16 — maximum: strict type-checked lint across the repo. */
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      /* `as` hides real type errors. Allowed only in mappers.ts and ids.ts, the two places a
         cast is genuinely load-bearing. `as const` stays legal. */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression[typeAnnotation.typeName.name!="const"]',
          message:
            'Type assertion. Narrow with a type guard or fix the type — casts are allowed only in mappers.ts and ids.ts.',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  /* Config files, the lint plugin and the enforcement probes are plain JS run by Node,
     outside any tsconfig. They are build tooling, so logging is their job. */
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      'no-console': 'off',
    },
  },

  /* ---------------------------------------------------------------------------------------
   * D8/D29 — layer boundaries. Dependencies flow one way:
   *   core -> theme -> data -> ui -> features -> app
   * ------------------------------------------------------------------------------------- */
  {
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true, project: './tsconfig.json' } },
      'boundaries/elements': [
        { type: 'core', pattern: 'packages/core/**' },
        { type: 'theme', pattern: 'packages/theme/**' },
        { type: 'data', pattern: 'packages/data/**' },
        { type: 'ui', pattern: 'packages/ui/**' },
        { type: 'features', pattern: 'apps/*/src/features/**' },
        { type: 'app', pattern: 'apps/*/app/**' },
      ],
      'boundaries/ignore': ['**/*.test.ts', '**/*.test.tsx', 'tools/**'],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: [{ element: { type: 'core' } }], allow: [] },
            { from: [{ element: { type: 'theme' } }], allow: allowTypes('core') },
            { from: [{ element: { type: 'data' } }], allow: allowTypes('core', 'theme') },
            { from: [{ element: { type: 'ui' } }], allow: allowTypes('core', 'theme') },
            {
              from: [{ element: { type: 'features' } }],
              allow: allowTypes('core', 'theme', 'data', 'ui'),
            },
            {
              from: [{ element: { type: 'app' } }],
              allow: allowTypes('core', 'theme', 'data', 'ui', 'features'),
            },
          ],
        },
      ],
    },
  },

  /* Restricted imports, general -> specific. Each scope repeats what the broader scope said,
     because a later block replaces the rule rather than extending it. */
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx', 'apps/**/*.ts', 'apps/**/*.tsx'],
    ignores: ['packages/data/src/supabase/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [NO_SUPABASE] }] },
  },
  {
    files: ['packages/ui/**/*.ts', 'packages/ui/**/*.tsx', 'apps/*/src/features/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NO_SUPABASE, NO_EXPO_ROUTER] }],
    },
  },
  {
    files: [
      'packages/theme/src/resolve.ts',
      'packages/theme/src/color.ts',
      'packages/theme/src/presets/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The theme resolver must stay pure — no React here.' },
            {
              name: 'react-native',
              message: 'The theme resolver must stay pure — no React Native here.',
            },
          ],
          patterns: [NO_SUPABASE, NO_DATA_LAYER],
        },
      ],
    },
  },

  /* D17 — literal colours and spacing are errors wherever styles are written. */
  {
    files: ['packages/ui/**', 'apps/**'],
    plugins: { occasio },
    rules: { 'occasio/no-literal-style-values': 'error' },
  },

  /* Mappers are where row shapes meet domain shapes, and ids.ts is where a plain string
     becomes a branded id. Those are the only two legitimate homes for a cast. */
  {
    files: [
      'packages/data/src/mappers.ts',
      'packages/data/src/**/mappers.ts',
      'packages/core/src/ids.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },

  prettier,
);
