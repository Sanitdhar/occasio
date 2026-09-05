import { describe, expect, it } from '@jest/globals';
import { FIXTURE_NAV, planTabs, type NavConfig } from './navigation';

const nav = (over: Partial<NavConfig>): NavConfig => ({ ...FIXTURE_NAV, ...over });

describe('planTabs', () => {
  it('renders tabs in the order the event configured, not the order they are declared in code', () => {
    const plan = planTabs(nav({ tabs: ['schedule', 'info', 'home'] }));
    expect(plan.filter((t) => !t.hidden).map((t) => t.key)).toEqual(['schedule', 'info', 'home']);
  });

  it('keeps disabled features routable but out of the visible order', () => {
    const plan = planTabs(
      nav({
        tabs: ['home', 'gossips', 'schedule'],
        features: { home: true, schedule: true, gossips: false, tasks: false, info: false },
      }),
    );
    expect(plan.filter((t) => !t.hidden).map((t) => t.key)).toEqual(['home', 'schedule']);
    /* Still declared, so a deep link into a switched-off feature resolves rather than 404s. */
    expect(
      plan
        .filter((t) => t.hidden)
        .map((t) => t.key)
        .sort(),
    ).toEqual(['gossips', 'info', 'tasks']);
  });

  it('survives a config that lists the same tab twice', () => {
    /* Tenant config is data — a hand-edited row can repeat a key, which would declare the same
       route twice and collide React keys. */
    const plan = planTabs(nav({ tabs: ['home', 'schedule', 'home'] }));
    expect(plan.filter((t) => !t.hidden).map((t) => t.key)).toEqual(['home', 'schedule']);
  });

  it('declares every feature exactly once, however the event is configured', () => {
    const keys = planTabs(nav({ tabs: ['info'] })).map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(5);
  });
});
