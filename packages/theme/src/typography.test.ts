import { describe, expect, it } from '@jest/globals';
import { themeInputFromPreset } from './presets/index';
import { TYPE_SET_IDS, type ThemeInput, type TypeSetId } from './types';
import {
  LOADABLE_TYPE_SET_IDS,
  SYSTEM_FAMILY,
  TYPE_SETS,
  buildTypography,
  typeSetFaces,
  typeSetSpecimen,
} from './typography';

const SCALES: readonly ThemeInput['typography']['scale'][] = ['compact', 'default', 'grand'];

const inputFor = (setId: TypeSetId, scale: ThemeInput['typography']['scale']): ThemeInput => ({
  ...themeInputFromPreset('minimal', '#3F5B7C'),
  typography: { setId, scale },
});

const tokensOf = (typography: ReturnType<typeof buildTypography>) => [
  typography.display1,
  typography.display2,
  typography.title1,
  typography.title2,
  typography.body,
  typography.bodyStrong,
  typography.caption,
  typography.overline,
];

describe('typography sets', () => {
  it('only ever asks for a face the set declares it ships', () => {
    /* This is the property that keeps the app's static require() map honest: if a token starts
       using the display family at a weight the set does not bundle, the name emitted here would
       not be in typeSetFaces() and nothing would have loaded it. */
    for (const setId of LOADABLE_TYPE_SET_IDS) {
      const declared = new Set(typeSetFaces(setId));
      for (const scale of SCALES) {
        const typography = buildTypography(inputFor(setId, scale));
        for (const token of tokensOf(typography)) {
          expect(declared).toContain(token.fontFamily);
        }
        expect(declared).toContain(typography.family.display);
        expect(declared).toContain(typography.family.body);
      }
    }
  });

  it('names every loadable face the way @expo-google-fonts exports it', () => {
    for (const setId of LOADABLE_TYPE_SET_IDS) {
      for (const face of typeSetFaces(setId)) {
        expect(face).toMatch(/^[A-Za-z]+_(?:400Regular|600SemiBold)$/);
      }
    }
  });

  it('keeps every text token on system families for the system set', () => {
    const typography = buildTypography(inputFor('system', 'default'));
    for (const token of tokensOf(typography)) {
      expect(token.fontFamily).toBe(SYSTEM_FAMILY);
    }
    expect(typeSetFaces('system')).toEqual([]);
    /* The system fallback is where fontWeight is the only lever there is, so the designed
       heading weight has to survive. */
    expect(typography.display1.fontWeight).toBe('600');
    expect(typography.body.fontWeight).toBe('400');
  });

  it('never asks a face for a weight it is not, which is what produces faux bold', () => {
    for (const setId of LOADABLE_TYPE_SET_IDS) {
      const typography = buildTypography(inputFor(setId, 'default'));
      for (const token of tokensOf(typography)) {
        const suffix = token.fontWeight === '600' ? '600SemiBold' : '400Regular';
        expect(token.fontFamily.endsWith(suffix)).toBe(true);
      }
    }
  });

  it('degrades to the nearest bundled weight for a single-weight display face', () => {
    /* Anton is a poster face with no semibold cut at all. The heading must land on the file
       that exists, at the weight that file actually is. */
    const typography = buildTypography(inputFor('festival', 'default'));
    expect(typography.display1.fontFamily).toBe('Anton_400Regular');
    expect(typography.display1.fontWeight).toBe('400');
    expect(typography.body.fontFamily).toBe('WorkSans_400Regular');
    expect(typography.bodyStrong.fontFamily).toBe('WorkSans_600SemiBold');
  });

  it('leaves sizing untouched by the face change', () => {
    const system = buildTypography(inputFor('system', 'grand'));
    const romantic = buildTypography(inputFor('romantic', 'grand'));
    expect(romantic.display1.fontSize).toBe(system.display1.fontSize);
    expect(romantic.display1.lineHeight).toBe(system.display1.lineHeight);
    expect(romantic.body.letterSpacing).toBe(system.body.letterSpacing);
  });

  it('gives every set a specimen a picker can render in the set’s own faces', () => {
    for (const setId of TYPE_SET_IDS) {
      const specimen = typeSetSpecimen(setId);
      expect(specimen.id).toBe(setId);
      expect(specimen.label).toBe(TYPE_SETS[setId].label);
      expect(specimen.sample.length).toBeGreaterThan(0);
      expect(specimen.typefaces.display).toBe(TYPE_SETS[setId].display.family);
      expect(specimen.typefaces.body).toBe(TYPE_SETS[setId].body.family);
      const expected = setId === 'system' ? [] : typeSetFaces(setId);
      if (setId === 'system') {
        expect(specimen.display.fontFamily).toBe(SYSTEM_FAMILY);
        expect(specimen.body.fontFamily).toBe(SYSTEM_FAMILY);
      } else {
        expect(expected).toContain(specimen.display.fontFamily);
        expect(expected).toContain(specimen.body.fontFamily);
      }
    }
  });

  it('samples are distinct, so the picker cannot show five identical rows', () => {
    const samples = TYPE_SET_IDS.map((setId) => TYPE_SETS[setId].sample);
    expect(new Set(samples).size).toBe(samples.length);
  });
});
