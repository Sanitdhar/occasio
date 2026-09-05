import noLiteralStyleValues from './rules/no-literal-style-values.js';
import noRawShadowProps from './rules/no-raw-shadow-props.js';

/**
 * Project-local lint rules that enforce the frozen architectural decisions.
 * See docs/decisions.md — a rule here should always trace back to a numbered decision.
 */
export default {
  meta: { name: 'eslint-plugin-occasio', version: '0.0.0' },
  rules: {
    'no-literal-style-values': noLiteralStyleValues,
    'no-raw-shadow-props': noRawShadowProps,
  },
};
