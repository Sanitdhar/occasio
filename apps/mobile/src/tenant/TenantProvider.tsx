import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { writeRecentTenant } from './recentTenant';
import { resolveTenant } from './resolveTenant';
import { resolvedAs, resolving, type TenantResolution } from './tenantResolution';

/**
 * Which event the app is currently showing.
 *
 * One abstraction over two platforms that share nothing here: web reads a hostname then a path,
 * native reads a deep link then this device's history. Both arrive as the same three-state
 * union, so a screen never learns which platform it is on — see resolveTenant.ts and
 * resolveTenant.web.ts, which Metro and Jest both pick automatically.
 *
 * Deliberately free of expo-router. The canonical route already knows its own slug and can say
 * so through `slug`, and keeping the router out means this renders under a test, under the theme
 * editor's preview, and anywhere else a screen needs a tenant without a URL.
 */

const TenantContext = createContext<TenantResolution | null>(null);

type Props = {
  /**
   * The slug the caller already knows — the route param under `/e/[slug]`.
   *
   * When given, there is nothing to resolve: the URL is the answer, and asking the platform
   * again would be a second opinion about a fact. When absent, the platform is asked, which is
   * what the root layout and a cold native launch need.
   */
  readonly slug?: string | undefined;
  readonly children: ReactNode;
};

export function TenantProvider({ slug, children }: Props) {
  const [resolution, setResolution] = useState<TenantResolution>(() =>
    slug === undefined ? resolving : resolvedAs(slug, 'path'),
  );

  useEffect(() => {
    if (slug !== undefined) {
      setResolution(resolvedAs(slug, 'path'));
      return;
    }

    /*
     * Resolution is asynchronous on both platforms — storage on web, a deep link on native — so
     * a late answer arriving after this provider has been given a slug, or unmounted, would
     * overwrite a correct state with a stale one. The flag is per-effect, so a `slug` that
     * changes mid-flight abandons the in-flight answer rather than racing it.
     */
    let abandoned = false;
    setResolution(resolving);

    void resolveTenant().then((resolved) => {
      if (!abandoned) setResolution(resolved);
    });

    return () => {
      abandoned = true;
    };
  }, [slug]);

  useEffect(() => {
    /*
     * Remember where we are, so a native launch with no deep link lands back here.
     *
     * Written on every resolution including `recent` itself, which is a harmless rewrite of the
     * same value and one branch fewer to be wrong about.
     */
    if (resolution.kind === 'resolved') void writeRecentTenant(resolution.slug);
  }, [resolution]);

  return <TenantContext.Provider value={resolution}>{children}</TenantContext.Provider>;
}

/**
 * The current resolution, in full.
 *
 * Throws outside a provider rather than returning `unresolved`, because the two mean opposite
 * things: "no event could be identified" is a state screens are built to handle, and "this
 * screen was mounted outside the provider" is a wiring mistake that would otherwise render as a
 * plausible-looking empty state nobody investigates.
 */
export const useTenantResolution = (): TenantResolution => {
  const resolution = useContext(TenantContext);
  if (resolution === null) {
    throw new Error('useTenantResolution must be used inside a <TenantProvider>.');
  }
  return resolution;
};

/**
 * The slug, or `null` while resolving or when nothing resolved.
 *
 * For the screens that only need to ask for data and have somewhere sensible to render while
 * they wait. Anything that has to tell "still looking" apart from "nothing to look at" — the
 * not-found and loading states of #40 — wants the union instead.
 */
export const useTenantSlug = (): string | null => {
  const resolution = useTenantResolution();
  return resolution.kind === 'resolved' ? resolution.slug : null;
};

/** Exported for the tests that need to build a resolution without a platform. */
export { TenantContext };
