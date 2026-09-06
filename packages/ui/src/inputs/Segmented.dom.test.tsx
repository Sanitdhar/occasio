import { themeInputFromPreset } from '@occasio/theme';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Segmented } from './Segmented';

/**
 * The keyboard half of the `radiogroup` contract, which the pure tests cannot see.
 *
 * `nextIndexForKey` decides *where* a key moves the selection; whether the group is one Tab
 * stop, whether focus follows the selection, and whether an unrelated key is left alone are
 * facts about the rendered tree. Getting them wrong produces a control that looks correct and
 * announces correctly, and cannot be operated without a mouse.
 */

const THEME = themeInputFromPreset('conference', '#2563EB');

const OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'list', label: 'List' },
] as const;

type View = (typeof OPTIONS)[number]['value'];

const renderSegmented = (value: View, disabled = false) => {
  const onChange = jest.fn<(next: View) => void>();
  render(
    <ThemeProvider input={THEME} forceScheme="light">
      <Segmented
        options={OPTIONS}
        value={value}
        onChange={onChange}
        label="Schedule view"
        disabled={disabled}
        testID="view"
      />
    </ThemeProvider>,
  );
  return onChange;
};

const segment = (value: View) => screen.getByTestId(`view-${value}`);
const tabStops = () =>
  OPTIONS.filter((option) => segment(option.value).getAttribute('tabindex') === '0').map(
    (option) => option.value,
  );

describe('Segmented keyboard behaviour', () => {
  it('is a single Tab stop, entered at the selected option', () => {
    /* One stop for the whole group is the difference between a radiogroup and three buttons.
       react-native-web gives every enabled Pressable `tabIndex={0}`, so this is not the
       default — without the roving index, Tab would stop three times on one control. */
    renderSegmented('week');

    expect(tabStops()).toEqual(['week']);
  });

  it('moves the selection with the arrow keys and takes focus with it', () => {
    const onChange = renderSegmented('day');

    fireEvent.keyDown(segment('day'), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('week');
    /* Focus, not only selection: the roving `tabIndex` decides where the *next* Tab lands and
       does nothing for the caret already inside the group. Leaving focus behind is how a
       keyboard user ends up moving the selection while the ring stays put. */
    expect(document.activeElement).toBe(segment('week'));
  });

  it('treats the vertical arrows as the same movement', () => {
    const onChange = renderSegmented('week');

    fireEvent.keyDown(segment('week'), { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledWith('day');
  });

  it('wraps at both ends', () => {
    const first = renderSegmented('day');
    fireEvent.keyDown(segment('day'), { key: 'ArrowLeft' });
    expect(first).toHaveBeenCalledWith('list');

    screen.getByTestId('view').remove();
    const last = renderSegmented('list');
    fireEvent.keyDown(segment('list'), { key: 'ArrowRight' });
    expect(last).toHaveBeenCalledWith('day');
  });

  it('jumps to the ends with Home and End', () => {
    const onChange = renderSegmented('week');

    fireEvent.keyDown(segment('week'), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('list');

    fireEvent.keyDown(segment('week'), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('day');
  });

  it('consumes the keys it owns, so the arrows do not scroll the page', () => {
    renderSegmented('day');

    /* fireEvent answers false when the handler called preventDefault. */
    expect(fireEvent.keyDown(segment('day'), { key: 'ArrowRight' })).toBe(false);
  });

  it('leaves keys it does not own alone', () => {
    const onChange = renderSegmented('day');

    /* Tab has to leave the group and the browser keeps its own shortcuts. A widget that
       swallows every key is a focus trap, which is the failure this guards. */
    expect(fireEvent.keyDown(segment('day'), { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(segment('day'), { key: 'a' })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores the arrow keys when the group is disabled', () => {
    const onChange = renderSegmented('day', true);

    expect(fireEvent.keyDown(segment('day'), { key: 'ArrowRight' })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
