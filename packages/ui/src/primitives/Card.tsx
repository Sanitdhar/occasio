import { Surface, type SurfaceProps } from './Surface';

export type CardProps = SurfaceProps;

/**
 * A Surface with the card defaults named once.
 *
 * It adds no props and no behaviour, and that is the point: "card" is a set of decisions —
 * raised tone, hairline, large radius, comfortable padding — not a second implementation of a
 * box. Every one of them stays overridable, so a compact list card is `<Card padding="sm">`
 * rather than a `variant` enum that grows a case per screen.
 *
 * Passing `onPress` makes it a pressable card, with hover, press, focus and disabled handled by
 * the same code that handles them for Chip.
 */
export function Card({
  tone = 'raised',
  border = 'hairline',
  radius = 'lg',
  padding = 'md',
  gap = 'sm',
  ...rest
}: CardProps) {
  return (
    <Surface tone={tone} border={border} radius={radius} padding={padding} gap={gap} {...rest} />
  );
}
