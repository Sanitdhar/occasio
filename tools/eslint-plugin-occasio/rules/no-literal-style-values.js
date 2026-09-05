/**
 * D17 — literal colours and spacing are lint errors.
 *
 * Every tenant re-themes the app from a single seed colour, so one hardcoded `#fff` silently
 * breaks that tenant and stays invisible until somebody views the event in dark mode. Values
 * must come from the resolved theme: `t.color.*`, `t.space(n)`, `t.radius.*`.
 */

const COLOR_PROPERTIES = new Set([
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderStartColor',
  'borderEndColor',
  'shadowColor',
  'textShadowColor',
  'tintColor',
  'placeholderTextColor',
  'overlayColor',
  'textDecorationColor',
]);

const SPACING_PROPERTIES = new Set([
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingHorizontal',
  'paddingVertical',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'fontSize',
  'lineHeight',
  'letterSpacing',
]);

/** `padding: 0` and `margin: 0` are unambiguous and carry no design intent. */
const isZero = (node) =>
  (node.type === 'Literal' && node.value === 0) ||
  (node.type === 'UnaryExpression' &&
    node.argument.type === 'Literal' &&
    node.argument.value === 0);

const propertyName = (node) => {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require theme tokens instead of literal colours and spacing in style objects',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowZero: { type: 'boolean' },
          extraColorProperties: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      literalColor:
        "Literal colour '{{value}}' in '{{property}}'. Use a theme token (t.color.*) — a hardcoded colour breaks every tenant's theme.",
      literalSpacing:
        "Literal value '{{value}}' in '{{property}}'. Use t.space(n), t.radius.* or a t.type.* text style so density and shape tokens apply.",
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const allowZero = options.allowZero !== false;
    const colorProperties = new Set([...COLOR_PROPERTIES, ...(options.extraColorProperties ?? [])]);

    return {
      Property(node) {
        const name = propertyName(node);
        if (name === null) return;

        if (colorProperties.has(name) && node.value.type === 'Literal') {
          if (typeof node.value.value !== 'string') return;
          context.report({
            node: node.value,
            messageId: 'literalColor',
            data: { value: String(node.value.value), property: name },
          });
          return;
        }

        if (SPACING_PROPERTIES.has(name)) {
          if (allowZero && isZero(node.value)) return;
          const isNumericLiteral =
            node.value.type === 'Literal' && typeof node.value.value === 'number';
          const isNegativeNumericLiteral =
            node.value.type === 'UnaryExpression' &&
            node.value.operator === '-' &&
            node.value.argument.type === 'Literal' &&
            typeof node.value.argument.value === 'number';

          if (isNumericLiteral || isNegativeNumericLiteral) {
            const raw = context.sourceCode.getText(node.value);
            context.report({
              node: node.value,
              messageId: 'literalSpacing',
              data: { value: raw, property: name },
            });
          }
        }
      },
    };
  },
};
