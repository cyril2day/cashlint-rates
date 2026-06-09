import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

const fpRestrictedSyntax = [
  'IfStatement',
  'SwitchStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
      'eslint.config.mjs',
      'agent-system/**',
      'docs/**',
      '.agents/**',
      '.codex/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      semi: ['error', 'never'],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'ramda',
              message: 'Import Ramda only through src/shared/fp/index.ts.',
            },
            {
              name: 'date-fns',
              message: 'Import date-fns only through src/shared/date/index.ts.',
            },
          ],
          patterns: [
            {
              group: ['date-fns/*'],
              message: 'Import date-fns only through src/shared/date/index.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...fpRestrictedSyntax.map((selector) => ({
          selector,
          message: 'Use tagged values, combinators, or small named functions instead of imperative branching.',
        })),
      ],
    },
  },
  {
    files: ['src/shared/fp/index.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/shared/date/index.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
