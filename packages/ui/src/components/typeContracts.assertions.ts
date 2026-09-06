import type { TextStyle, ViewStyle } from 'react-native';
import type { LayoutTextStyle, LayoutViewStyle } from './layoutStyle';
import type { TextProps } from './Text';

/**
 * Compile-time proof that two type-level rules in this folder actually reject what they claim
 * to reject.
 *
 * Not ceremony: a narrowing type that silently admits everything looks exactly like one that
 * works, and this repo has already shipped two lint rules that were configured, read correctly
 * and did nothing. The architectural equivalent lives in tools/enforcement; a *type* contract
 * cannot be probed from there, so it is proved here instead — `tsc` is the assertion, and every
 * line below fails to compile the moment its rule stops biting.
 *
 * Nothing here runs. It is a source file rather than a test because jest strips types, so a
 * suite could not fail on any of it.
 */

/** `true` when `Wide` is NOT assignable to `Narrow` — i.e. the narrowing rejects it. */
type Rejects<Wide, Narrow> = [Wide] extends [Narrow] ? false : true;

/** `true` when `Value` IS assignable to `Narrow` — i.e. a legitimate call still compiles. */
type Accepts<Value, Narrow> = [Value] extends [Narrow] ? true : false;

export const TYPE_CONTRACTS: {
  /* D17 through the type system: a token cannot be smuggled in through `style`. `Pick` alone
     would stop only object literals; these two lines are what prove the `never` exclusions
     close the variable route as well. */
  readonly fullViewStyleIsRejected: Rejects<ViewStyle, LayoutViewStyle>;
  readonly fullTextStyleIsRejected: Rejects<TextStyle, LayoutTextStyle>;
  readonly colourIsRejected: Rejects<{ backgroundColor: string }, LayoutViewStyle>;
  readonly radiusIsRejected: Rejects<{ borderRadius: number }, LayoutViewStyle>;
  readonly paddingIsRejected: Rejects<{ paddingHorizontal: number }, LayoutViewStyle>;
  readonly marginIsRejected: Rejects<{ marginTop: number }, LayoutViewStyle>;
  readonly fontSizeIsRejected: Rejects<{ fontSize: number }, LayoutTextStyle>;
  readonly textColourIsRejected: Rejects<{ color: string }, LayoutTextStyle>;

  /* …while the layout properties the prop exists for still go through. A contract that rejects
     everything is not a contract, it is a broken prop. */
  readonly layoutIsAccepted: Accepts<{ alignSelf: 'stretch'; maxWidth: number }, LayoutViewStyle>;
  readonly textAlignIsAccepted: Accepts<{ textAlign: 'center' }, LayoutTextStyle>;

  /* The variant/tone pairing: `faint` only clears WCAG at large-text sizes. */
  readonly faintOnDefaultVariantIsRejected: Rejects<{ tone: 'faint' }, TextProps>;
  readonly faintOnSmallVariantIsRejected: Rejects<{ variant: 'caption'; tone: 'faint' }, TextProps>;
  readonly faintOnDisplayIsAccepted: Accepts<{ variant: 'display1'; tone: 'faint' }, TextProps>;
  readonly mutedOnSmallVariantIsAccepted: Accepts<{ variant: 'caption'; tone: 'muted' }, TextProps>;
} = {
  fullViewStyleIsRejected: true,
  fullTextStyleIsRejected: true,
  colourIsRejected: true,
  radiusIsRejected: true,
  paddingIsRejected: true,
  marginIsRejected: true,
  fontSizeIsRejected: true,
  textColourIsRejected: true,
  layoutIsAccepted: true,
  textAlignIsAccepted: true,
  faintOnDefaultVariantIsRejected: true,
  faintOnSmallVariantIsRejected: true,
  faintOnDisplayIsAccepted: true,
  mutedOnSmallVariantIsAccepted: true,
};
