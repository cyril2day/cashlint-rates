import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

const fpRestrictedSyntax = [
  {
    selector: 'IfStatement',
    message: 'Use tagged values, combinators, or small named functions instead of imperative branching.',
  },
  {
    selector: 'SwitchStatement',
    message: 'Use tagged values, combinators, or small named functions instead of imperative branching.',
  },
  {
    selector: 'ConditionalExpression',
    message: 'Use tagged values, combinators, or small named functions instead of imperative branching.',
  },
  {
    selector: 'ForStatement',
    message: 'Use map, reduce, traverse, sequence, or small recursion helpers instead of imperative loops.',
  },
  {
    selector: 'ForInStatement',
    message: 'Use typed object helpers instead of imperative loops.',
  },
  {
    selector: 'ForOfStatement',
    message: 'Use map, reduce, traverse, sequence, or small recursion helpers instead of imperative loops.',
  },
  {
    selector: 'WhileStatement',
    message: 'Use recursion or declarative helpers instead of imperative loops.',
  },
  {
    selector: 'DoWhileStatement',
    message: 'Use recursion or declarative helpers instead of imperative loops.',
  },
  {
    selector: "LogicalExpression[operator='&&']",
    message: 'Logical AND is not allowed. Extract named predicates or use allTrue/allPass.',
  },
  {
    selector: "LogicalExpression[operator='||']",
    message: 'Logical OR is not allowed. Extract named predicates or use anyTrue/anyPass.',
  },
  {
    selector: "UnaryExpression[operator='!']",
    message: 'Logical NOT is not allowed. Use isFalse, complement, or a named negated predicate.',
  },
  {
    selector: "LogicalExpression[operator='??']",
    message: 'Nullish coalescing is not allowed. Use foldMaybe or matchMaybe with fromNullable.',
  },
  {
    selector: 'ChainExpression',
    message: 'Optional chaining is not allowed. Use fromNullable with matchMaybe or chainMaybe.',
  },
  {
    selector: "CallExpression[callee.name='chainResult'] CallExpression[callee.name='chainResult']",
    message: 'Nested Result binding is not allowed. Use liftResultN, sequenceResult, traverseResult, or named steps.',
  },
  {
    selector: "CallExpression[callee.property.name='flatMap'] CallExpression[callee.name='matchMaybe']",
    message: 'Inline filter-map through Maybe inside flatMap is not allowed. Extract a named helper function.',
  },
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
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
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
        ...fpRestrictedSyntax,
      ],
    },
  },
  {
    files: ['src/shared/fp/index.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-restricted-syntax': 'off',
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
