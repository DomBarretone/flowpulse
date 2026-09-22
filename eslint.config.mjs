import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/out/**',
      '.agents/**',
      'scripts/**',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
    settings: {
      next: {
        rootDir: ['apps/web/', '.'],
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
