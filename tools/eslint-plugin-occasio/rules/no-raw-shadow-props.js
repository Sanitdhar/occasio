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
