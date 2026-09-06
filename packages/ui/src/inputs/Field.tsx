import { useId, type ReactNode } from 'react';
import { Text as RNText, TextInput, View } from 'react-native';
import type { LayoutViewStyle } from '../components/layoutStyle';
import { createStyles } from '../theme/createStyles';
import { fieldAria, fieldMessage } from './fieldState';

/**
 * A labelled input, with the one line beneath it that a form actually needs.
 *
 * The label is a real label rather than a placeholder. A placeholder disappears the moment
 * someone types, so a form filled in with placeholders is a form nobody can check before
 * submitting — and it is invisible to a screen reader as a name for the field.
 *
 * Colour is never the only signal. An error changes the message text, the border and
 * `aria-invalid`, because a red border alone is nothing to someone who cannot distinguish it
 * from the resting one, and nothing at all to a screen reader.
 */

type Props = {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  /** Advice for filling the field in. Replaced by an error rather than joined by one. */
  readonly hint?: string | null | undefined;
  /**
   * The problem with what is currently in the field.
   *
   * An empty string still means invalid — it is what a validator produces when it knows the
   * field is wrong and has nothing printable to say — so `null` and `undefined` are the only
   * ways to say "this is fine".
   */
  readonly error?: string | null | undefined;
  readonly placeholder?: string | undefined;
  readonly multiline?: boolean;
  readonly editable?: boolean;
  readonly testID?: string | undefined;
  readonly style?: LayoutViewStyle | undefined;
};

const useStyles = createStyles((t) => ({
  root: { gap: t.space(1) },
  label: { ...t.type.bodyStrong, color: t.color.text },
  input: {
    ...t.type.body,
    color: t.color.text,
    backgroundColor: t.color.surface,
    borderWidth: t.border.standard,
    borderColor: t.color.border,
    borderRadius: t.radius.sm,
    paddingHorizontal: t.space(3),
    paddingVertical: t.space(2),
  },
  /* The invalid border is a *different* border, not a tinted one: it has to be distinguishable
     from the resting state without relying on hue. */
  inputInvalid: { borderColor: t.color.danger, borderWidth: t.border.standard * 2 },
  inputDisabled: { backgroundColor: t.color.surfaceSunken, color: t.color.textMuted },
  multiline: { minHeight: t.space(20), textAlignVertical: 'top' },
  hint: { ...t.type.caption, color: t.color.textMuted },
  error: { ...t.type.caption, color: t.color.danger },
}));

export function Field({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder,
  multiline = false,
  editable = true,
  testID,
  style,
}: Props) {
  const styles = useStyles();
  /* `useId` rather than a prop: the ids only exist to wire this field's own parts together, and
     making the caller invent one is how two fields end up sharing a `describedby`. */
  const id = useId();
  const message = fieldMessage(hint, error);
  const { labelId, messageId, describedBy } = fieldAria(id, message);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <RNText nativeID={labelId} style={styles.label}>
        {label}
      </RNText>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        multiline={multiline}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        /* Announced as invalid even when there is no message to read out — a required field
           left empty has no text of its own and must still not read as fine. */
        aria-invalid={message.invalid}
        aria-disabled={!editable}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          message.invalid ? styles.inputInvalid : null,
          editable ? null : styles.inputDisabled,
        ]}
      />

      {message.text === null ? null : (
        <RNText
          nativeID={messageId}
          style={message.tone === 'error' ? styles.error : styles.hint}
          /* An error that appears after a form is submitted has to interrupt; a hint that was
             always there must not. */
          role={message.tone === 'error' ? 'alert' : undefined}
        >
          {message.text}
        </RNText>
      )}
    </View>
  );
}

export type FieldProps = Props;
export type { ReactNode };
