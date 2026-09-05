import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

/**
 * The `visual` CI gate (D19).
 *
 * Renders every route at phone and desktop widths in both colour schemes, and fails on a page
 * that throws, logs an error, or comes back visually empty. Screenshots are written for a human
 * to look at and are uploaded by CI when the job fails.
 *
 * This captures; it does not yet diff against committed baselines — that is #90. Baselines are
 * deliberately deferred until the UI is real: committing them now, against placeholder screens
 * that v0.2 replaces wholesale, would train everyone to re-approve snapshots reflexively, which
 * is how a visual gate stops meaning anything.
 */

const DIST = 'apps/mobile/dist';
const OUT = '.artifacts/visual';

/** Grows as fixtures land (#26 onward); today the app resolves a single theme. */
const TENANTS = ['santi-riyanks'];

const ROUTES = [
  ['/', 'index'],
  ['/discover', 'discover'],
  ['/join', 'join'],
  ['/no-such-page', 'not-found'],
  ...TENANTS.flatMap((t) => [
    [`/e/${t}`, `${t}-home`],
    [`/e/${t}/schedule`, `${t}-schedule`],
    [`/e/${t}/gossips`, `${t}-gossips`],
    [`/e/${t}/tasks`, `${t}-tasks`],
    [`/e/${t}/info`, `${t}-info`],
    [`/e/${t}/theme`, `${t}-admin-theme`],
  ]),
];

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const SCHEMES = ['light', 'dark'];

const run = async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const server = await serve(DIST);
  const browser = await chromium.launch();
  const failures = [];
  let shots = 0;

  try {
    for (const viewport of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        });
        try {
          for (const [path, name] of ROUTES) {
            const page = await context.newPage();
            const problems = [];
            page.on('pageerror', (e) => problems.push(`threw: ${String(e).slice(0, 160)}`));
            page.on('console', (m) => {
              if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`);
            });

            /* A route that fails to navigate is a finding, not a reason to abandon the run.
               Aborting here would leave later routes uncaptured, the manifest unwritten and
               the browser and server leaked -- and would report one failure while hiding the
               rest, which is the least useful way for a gate to fail. */
            try {
              await page.goto(`http://127.0.0.1:${String(server.port)}${path}`, {
                waitUntil: 'networkidle',
                timeout: 30_000,
              });
              await page.waitForTimeout(400);

              const text = (
                await page
                  .locator('body')
                  .innerText()
                  .catch(() => '')
              ).trim();
              if (text.length < 10) problems.push(`rendered ${String(text.length)} chars of text`);

              await page.screenshot({ path: join(OUT, `${name}-${viewport.name}-${scheme}.png`) });
              shots += 1;
            } catch (error) {
              problems.push(`navigation failed: ${String(error).slice(0, 160)}`);
            } finally {
              await page.close();
            }

            if (problems.length > 0) {
              failures.push(`${path} [${viewport.name}/${scheme}] ${problems[0]}`);
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
    writeFileSync(
      join(OUT, 'manifest.json'),
      JSON.stringify(
        {
          routes: ROUTES.length,
          viewports: VIEWPORTS.length,
          schemes: SCHEMES.length,
          expected: ROUTES.length * VIEWPORTS.length * SCHEMES.length,
          shots,
          failures,
        },
        null,
        2,
      ),
    );
  }

  console.log(`captured ${String(shots)} screenshots into ${OUT}`);
  if (failures.length > 0) {
    console.error(`\n${String(failures.length)} route(s) did not render cleanly:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('every route rendered cleanly');
};

await run();
