module.exports = {
  root: true,
  env: { es2023: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'simple-import-sort',
    'unused-imports',
    'prettier',
    'n',
    'vitest'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:n/recommended',
    'plugin:vitest/recommended',
    'plugin:prettier/recommended',
    'prettier'
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-debugger': 'warn',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
    ],
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'react/react-in-jsx-scope': 'off'
  },
  overrides: [
    { files: ['src/renderer/**/*.{ts,tsx,js,jsx}'], env: { browser: true } },
    { files: ['src/main/**/*.{ts,js}', 'src/preload/**/*.{ts,js}', '*.config.{ts,js,mjs,cjs}'], env: { node: true } },
    { files: ['**/*.{test,spec}.{ts,tsx,js,jsx}'], env: { 'vitest/globals': true } }
  ],
  ignorePatterns: ['dist', 'build', 'out', 'node_modules', '.husky']
};
