import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs'
import unusedImports from 'eslint-plugin-unused-imports'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/pages/**', '**/cache/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

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

  skipFormatting,
)
