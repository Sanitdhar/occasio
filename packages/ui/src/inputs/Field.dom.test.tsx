import { themeInputFromPreset } from '@occasio/theme';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Field } from './Field';

/**
 * The wiring a screen reader depends on, which the pure tests cannot see.
 *
 * `fieldState` decides *what* to say; whether the message element actually exists and whether
 * the input points at it are facts about the rendered tree. Getting them wrong produces a field
 * that looks correct and is silent — the failure nobody notices without a screen reader.
 */

const THEME = themeInputFromPreset('conference', '#2563EB');

const renderField = (props: Partial<Parameters<typeof Field>[0]> = {}) =>
  render(
    <ThemeProvider input={THEME} forceScheme="light">
      <Field label="Email" value="" onChangeText={() => undefined} testID="field" {...props} />
    </ThemeProvider>,
  );

const input = () => screen.getByLabelText('Email');

describe('Field', () => {
  it('labels the input with a real label, not a placeholder', () => {
    /* A placeholder disappears the moment somebody types, so a form filled in with placeholders
       cannot be checked before submitting — and it is not a name for the field at all. */
    renderField({ placeholder: 'you@example.com' });

    expect(input()).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('describes the input by its hint', () => {
    renderField({ hint: 'We only use this for the seating plan' });

    const described = input().getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(screen.getByText('We only use this for the seating plan')).toBeTruthy();
  });

  it('points at nothing when there is no message', () => {
    /* `aria-describedby` naming an element that does not exist is worse than omitting it: the
       reader announces nothing and the author believes a description is being read. */
    renderField();

    expect(input().getAttribute('aria-describedby')).toBeNull();
  });

  it('announces invalid, and replaces the hint with the error', () => {
    renderField({ hint: 'Any format is fine', error: 'That is not an email address' });

    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('That is not an email address')).toBeTruthy();
    expect(screen.queryByText('Any format is fine')).toBeNull();
  });

  it('announces invalid even when there is no message to read', () => {
    /* A required field left blank on submit: the validator knows it is wrong and has nothing
       printable to say. Reading as valid there is the failure. */
    renderField({ error: '' });

    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('does not announce a valid field as invalid', () => {
    renderField({ hint: 'Optional' });

    expect(input().getAttribute('aria-invalid')).not.toBe('true');
  });
});
