/**
 * Proves the architectural rules actually fire.
 *
 * A lint rule that is configured but silently inert is worse than no rule, because everyone
 * believes it is protecting them. Two such cases were found while writing this repo's config:
 * a boundaries rule that could not resolve workspace imports, and a restricted-import block
 * that a later flat-config block replaced instead of extending. Both looked perfect.
 *
 * Each case below writes a real file, lints it with the repo's own config, asserts the
 * expected rule did (or did not) fire, and removes it. Run by `npm run verify:enforcement`
 * and in CI.
 */
import { ESLint } from 'eslint';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {{ label: string, file: string, rule: string, shouldFire: boolean, code: string }[]} */
const CASES = [
  {
    label: 'D8   theme may not import the data layer',
    file: 'packages/theme/src/__enforcement_probe.ts',
    rule: 'boundaries/dependencies',
    shouldFire: true,
    code: "import { DATA_SCHEMA_VERSION } from '@occasio/data';\nexport const p = DATA_SCHEMA_VERSION;\n",
  },
  {
    label: 'D8   expo-router may not be imported by ui',
    file: 'packages/ui/src/__enforcement_probe.ts',
    rule: 'no-restricted-imports',
    shouldFire: true,
    code: "import { useRouter } from 'expo-router';\nexport const p = useRouter;\n",
  },
  {
    label: 'D16  `as` casts are banned outside mappers and ids',
    file: 'packages/data/src/__enforcement_probe.ts',
    rule: 'no-restricted-syntax',
    shouldFire: true,
    code: "const raw: unknown = 'x';\nexport const p = raw as string;\n",
  },
  {
    label: 'D17  literal colours and spacing are banned in styles',
    file: 'packages/ui/src/__enforcement_probe_style.ts',
    rule: 'occasio/no-literal-style-values',
    shouldFire: true,
    code: "export const s = { card: { backgroundColor: '#fff', padding: 16, margin: 0 } };\n",
  },
  {
    label: 'ELEV raw shadow props are banned in components',
    file: 'packages/ui/src/__enforcement_probe_shadow.ts',
    rule: 'occasio/no-raw-shadow-props',
    shouldFire: true,
    code: "export const s = { card: { shadowColor: 'x', shadowRadius: 4, elevation: 2 } };\n",
  },
  {
    label: 'ELEV the elevation translator IS allowed to use them',
    file: 'packages/ui/src/theme/elevation__enforcement_probe.ts',
    rule: 'occasio/no-raw-shadow-props',
    shouldFire: false,
    code: "export const s = { shadowColor: 'x' };\n",
  },
  {
    label: 'D29  supabase is banned outside its adapter',
    file: 'packages/data/src/__enforcement_probe_sb.ts',
    rule: 'no-restricted-imports',
    shouldFire: true,
    code: "import { createClient } from '@supabase/supabase-js';\nexport const p = createClient;\n",
  },
  {
    label: 'D29  supabase IS allowed inside its adapter',
    file: 'packages/data/src/supabase/__enforcement_probe.ts',
    rule: 'no-restricted-imports',
    shouldFire: false,
    code: "import { createClient } from '@supabase/supabase-js';\nexport const p = createClient;\n",
  },
];

const eslint = new ESLint({ cwd: repoRoot });
let failures = 0;

for (const testCase of CASES) {
  const absolute = join(repoRoot, testCase.file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, testCase.code);
  try {
    const [result] = await eslint.lintFiles([absolute]);
    const fired = (result?.messages ?? []).some((m) => m.ruleId === testCase.rule);
    if (fired === testCase.shouldFire) {
      console.log(`  PASS  ${testCase.label}`);
    } else {
      failures += 1;
      console.error(
        `  FAIL  ${testCase.label}\n        rule ${testCase.rule} fired=${String(fired)}, expected=${String(testCase.shouldFire)}`,
      );
    }
  } finally {
    rmSync(absolute, { force: true });
  }
}

rmSync(join(repoRoot, 'packages/data/src/supabase'), { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${String(failures)} enforcement rule(s) are not doing their job.`);
  process.exit(1);
}
console.log(`\nAll ${String(CASES.length)} enforcement rules verified.`);
