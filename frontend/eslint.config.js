import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // `const { items, ...rest } = obj` per omettere un campo, e `_x` per scarti voluti.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // Regole React 19 in warning (debito noto, ~50 occorrenze, non bloccanti):
      //  - set-state-in-effect: reset dei form modali all'apertura (useEffect + setState);
      //  - only-export-components: hook/costanti esportati accanto a provider e componenti
      //    (impatta solo il fast-refresh in dev);
      //  - static-components / refs: Tour e useUnsavedGuard.
      // Da risanare con un refactor dedicato dei form (key/derivazione dello stato).
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    // Nei test i mock e i cast parziali sono legittimi.
    files: ['src/__tests__/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
])
