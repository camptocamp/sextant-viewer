import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs'
import pluginUnicorn from 'eslint-plugin-unicorn'
import unusedImports from 'eslint-plugin-unused-imports'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

// The unicorn-derived rules the SonarQube TypeScript profile activates (the S77xx range of
// "Sonar way"). Listed explicitly because unicorn's own `recommended` preset is far broader —
// no-null, prevent-abbreviations and filename-case alone account for hundreds of findings the
// server never raises. S7787 and S7790 have no equivalent in unicorn 65.
const SONAR_UNICORN_RULES = [
  'catch-error-name',
  'consistent-date-clone',
  'consistent-empty-array-spread',
  'consistent-function-scoping',
  'error-message',
  'new-for-builtins',
  'no-abusive-eslint-disable',
  'no-accessor-recursion',
  'no-anonymous-default-export',
  'no-array-method-this-argument',
  'no-instanceof-builtins',
  'no-invalid-fetch-options',
  'no-named-default',
  'no-negated-condition',
  'no-negation-in-equality-check',
  'no-object-as-default-parameter',
  'no-single-promise-in-promise-methods',
  'no-thenable',
  'no-this-assignment',
  'no-typeof-undefined',
  'no-unnecessary-polyfills',
  'no-unreadable-iife',
  'no-useless-fallback-in-spread',
  'no-useless-length-check',
  'no-useless-promise-resolve-reject',
  'no-useless-spread',
  'no-zero-fractions',
  'numeric-separators-style',
  'prefer-array-find',
  'prefer-array-flat',
  'prefer-array-flat-map',
  'prefer-array-index-of',
  'prefer-array-some',
  'prefer-at',
  'prefer-blob-reading-methods',
  'prefer-class-fields',
  'prefer-code-point',
  'prefer-date-now',
  'prefer-default-parameters',
  'prefer-dom-node-dataset',
  'prefer-dom-node-remove',
  'prefer-export-from',
  'prefer-global-this',
  'prefer-includes',
  'prefer-math-min-max',
  'prefer-math-trunc',
  'prefer-modern-dom-apis',
  'prefer-modern-math-apis',
  'prefer-native-coercion-functions',
  'prefer-negative-index',
  'prefer-node-protocol',
  'prefer-number-properties',
  'prefer-prototype-methods',
  'prefer-set-has',
  'prefer-set-size',
  'prefer-single-call',
  'prefer-string-raw',
  'prefer-string-replace-all',
  'prefer-string-trim-start-end',
  'prefer-structured-clone',
  'prefer-top-level-await',
  'prefer-type-error',
]

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/pages/**', '**/cache/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    name: 'app/unicorn',
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    plugins: { unicorn: pluginUnicorn },
    rules: {
      ...Object.fromEntries(SONAR_UNICORN_RULES.map((rule) => [`unicorn/${rule}`, 'error'])),
      // Options realigned on the server, whose defaults for these two rules are narrower than
      // unicorn's: S7721 spares arrow functions, and S7718 accepts the `e`/`err` used here.
      'unicorn/consistent-function-scoping': ['error', { checkArrowFunctions: false }],
      'unicorn/catch-error-name': ['error', { ignore: [/^e$/, /^err$/] }],
    },
  },

  {
    // Mirrors the SonarQube analysis, which only covers `sonar.sources=src`
    ...sonarjsConfigs.recommended,
    name: 'app/sonarjs',
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    rules: {
      ...sonarjsConfigs.recommended.rules,
      // Superseded by unused-imports/no-unused-vars, which honours the `_` prefix used to
      // drop keys through rest destructuring
      'sonarjs/no-unused-vars': 'off',
      // Tracked work, not a defect — surfaced without failing the lint stage
      'sonarjs/todo-tag': 'warn',
      // Active in the server profile (S125) but off in the plugin's own preset
      'sonarjs/no-commented-code': 'error',
    },
  },

  {
    // Two rules the server profile activates (S6582, S6551) that need type information; the
    // shared config the project extends is the syntax-only one.
    name: 'app/typescript-sonar',
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    rules: {
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
    },
  },

  {
    name: 'app/unused-imports',
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  {
    // Asking for type information anywhere makes defineConfigWithVueTs inject its own
    // `projectService: true` over every TS file. That default rejects files no tsconfig
    // covers, so this comes last to override it with a fallback for the three orphans.
    name: 'app/project-service',
    files: ['**/*.{vue,ts,mts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'vite.app.config.ts',
            'docs/.vitepress/config.mts',
            'docs/.vitepress/theme/index.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  skipFormatting,
)
