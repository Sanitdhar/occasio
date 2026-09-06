import { themeInputFromPreset } from '@occasio/theme';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { Image } from '../media/Image';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Avatar, type AvatarProps } from './Avatar';

/**
 * The half of Avatar's contract that only exists at runtime.
 *
 * `children` is typed as an element taking `ImageProps`, which constrains the props and not the
 * component — `ReactElement<ImageProps, typeof Image>` does not help, because JSX produces
 * `React.JSX.Element` and that is assignable to anything. So the identity check is a runtime
 * one, and a runtime check with no test is the thing this repo keeps being caught by.
 */

const THEME = themeInputFromPreset('romantic', '#7C3A5A');

/**
 * No cast needed to pass a `<Text>` here, which is the finding restated: `JSX.Element` is
 * `ReactElement<any, any>`, so it satisfies `ReactElement<ImageProps>` — and would satisfy
 * `ReactElement<ImageProps, typeof Image>` just as happily. The prop type cannot reject this
 * child, which is why the component checks at runtime and why this file exists.
 */
const renderAvatar = (children?: AvatarProps['children']) =>
  render(
    <ThemeProvider input={THEME} forceScheme="light">
      <Avatar name="Riya Kapoor">{children}</Avatar>
    </ThemeProvider>,
  );

describe('Avatar', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    warn.mockClear();
  });

  afterAll(() => {
    warn.mockRestore();
  });

  it('falls back to initials when there is no photograph', () => {
    renderAvatar();

    /* Most guests never upload one, so this is the common case rather than the fallback. */
    expect(screen.getByText('RK')).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts the package Image without complaint', () => {
    renderAvatar(<Image source="https://example.test/riya.jpg" alt="Riya Kapoor" />);

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the child is some other element', () => {
    /* What the prop type cannot catch: anything satisfies `ReactElement<ImageProps>`, including
       a component of one's own that renders react-native's `Image` — a spinner and no
       alternative text, inside a circle that is meant to guarantee neither. */
    renderAvatar(<Text>not an image</Text>);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Image');
  });

  it('names the avatar for a screen reader whether or not there is a photo', () => {
    renderAvatar();

    expect(screen.getByLabelText('Riya Kapoor')).toBeTruthy();
  });
});
