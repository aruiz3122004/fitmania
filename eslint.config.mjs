import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Deuda conocida: ~200 `any` heredados. Se reportan sin romper la CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Reglas del React Compiler (no se usa): señalan patrones que funcionan hoy.
      // Reescribir esos efectos sin pruebas de UI es más riesgoso que el aviso.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      // `_x` = descarte intencional (p. ej. quitar campos con destructuring).
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
    },
  },
  globalIgnores([
    // Ignorados por defecto de eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Scripts locales sin versionar (ver .gitignore) y recursos estáticos.
    'scripts/**',
    'tmp/**',
    'public/**',
    '*.js',
  ]),
])

export default eslintConfig
