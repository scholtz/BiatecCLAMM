module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Align with workspace Prettier settings (printWidth 200, tabWidth 2)
    'prettier/prettier': [
      'error',
      {
        printWidth: 200,
        tabWidth: 2,
        endOfLine: 'auto',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'import/prefer-default-export': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/*.test.ts'],
      },
    ],
  },
  overrides: [
    {
      files: ['*.algo.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'object-shorthand': 'off',
        'class-methods-use-this': 'off',
        'no-undef': 'off',
        'max-classes-per-file': 'off',
        'no-bitwise': 'off',
        'operator-assignment': 'off',
        'prefer-template': 'off',
        'prefer-destructuring': 'off',
        // TEALScript transpiler equivalence is safe with == / != in this context
        eqeqeq: 'off',
        'no-nested-ternary': 'off',
      },
    },
    {
      files: ['__test__/**/*.ts'],
      rules: {
        // Allow diagnostic logging in tests
        'no-console': 'off',
        // Tests frequently iterate; relax loop restrictions
        'no-await-in-loop': 'off',
        'no-restricted-syntax': 'off',
        // Allow flexible typing in test scaffolding
        '@typescript-eslint/no-explicit-any': 'off',
        // Reduce noise from unused helpers/constants in fixtures
        'no-unused-vars': 'off',
        'no-shadow': 'off',
        // Allow mutation of tx objects in grouped transaction assembly inside tests
        'no-param-reassign': 'off',
      },
    },
    {
      files: ['src/bin/**/*.ts'],
      rules: {
        // CLI scripts may legitimately use console output
        'no-console': 'off',
        'no-await-in-loop': 'off',
        'no-restricted-syntax': 'off',
        'no-plusplus': 'off',
        'no-unused-vars': 'off',
        'no-shadow': 'off',
        'no-param-reassign': 'off',
      },
    },
    {
      files: ['src/**/txs/*.ts'],
      rules: {
        // Transaction builder functions intentionally mutate tx fields for group assignment
        'no-param-reassign': 'off',
        'no-shadow': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
