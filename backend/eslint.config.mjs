import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'drizzle', 'dist'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-namespace': 'off',
    },
  },
);
