/**
 * D-elevation — shadows come from `theme.elevation` via `toElevationStyle`, never from raw props.
 *
 * iOS wants offset/radius/opacity, Android wants a single `elevation` number, and web wants
 * `boxShadow`. Hand-written shadow props therefore look right on whichever platform the author
 * happened to be testing and wrong or absent on the others — a class of bug that is invisible
 * until someone opens the app on the platform you were not using.
 */

const SHADOW_PROPERTIES = new Set([
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'boxShadow',
  'elevation',
]);

/**
 * The property this node writes, or `null` when it cannot be known without running the code.
 *
 * Computed keys are read rather than skipped. `{ ['boxShadow']: … }` and `{ [`elevation`]: … }`
 * produce exactly the property this rule exists to ban, and skipping every computed key made
 * the brackets an opt-out — which is the shape of an escape hatch, not of a rule. A key built
 * from a variable still returns `null`, because there is nothing to compare against; that is a
 * limit of static analysis rather than a hole anyone can aim for.
 */
const staticKeyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

const propertyName = (node) => {
  /* An unbracketed key is an Identifier or a string Literal; a bracketed one is any expression,
     and only the ones with a knowable value are checked. */
  if (node.computed) return staticKeyName(node.key);
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require theme elevation instead of hand-written platform shadow properties',
    },
    schema: [],
    messages: {
      rawShadow:
        "'{{property}}' is a platform-specific shadow property. Use `toElevationStyle(t.elevation.md)` so the shadow renders on iOS, Android and web rather than on whichever one you tested.",
    },
  },

  create(context) {
    return {
      Property(node) {
        const name = propertyName(node);
        if (name !== null && SHADOW_PROPERTIES.has(name)) {
          context.report({ node, messageId: 'rawShadow', data: { property: name } });
        }
      },
    };
  },
};
