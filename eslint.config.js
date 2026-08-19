// @ts-check
// Flat config (ESLint 9/10). Ported from the legacy .eslintrc.json.
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'storybook-static/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...storybook.configs['flat/recommended'],
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    jsx: true,
    arrowParens: true,
    braceStyle: '1tbs',
  }),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Classic react-hooks rules, matching the prior .eslintrc setup.
      // (eslint-plugin-react-hooks v7's full "recommended" set adds many
      // opinionated React Compiler rules; opt into those separately if desired.)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript itself reports undefined identifiers; no-undef is redundant
      // here and produces false positives (chrome.*, test globals, etc.).
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'consistent-return': 'error',
      // Statements are semicolon-terminated in this codebase; a defensive
      // leading `;(` is never needed and reads as noise.
      '@stylistic/no-extra-semi': 'error',
      // Deviations from the customize() defaults, matching established style:
      // operators (incl. `&&` in JSX) stay at end of line, ternary branches
      // lead with ?/: when split.
      '@stylistic/operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
      // Single-line JSX ternaries and `{ clearDrag(); return; }`-style guard
      // one-liners are intentional; don't force them multiline.
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/jsx-one-expression-per-line': 'off',
      '@stylistic/max-statements-per-line': 'off',
    },
  },
)
