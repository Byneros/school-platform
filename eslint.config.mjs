import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

import eslintConfigPrettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import security from "eslint-plugin-security";

export default [
  // ======================================
  // Ignorar archivos
  // ======================================
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.vite/**",
      "**/coverage/**",
      "**/public/**",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/*.log",
      "**/*.zip",
      "**/*.dump",
      "**/*.bak",
      "apps/api/**/*.js",
      "apps/web/**/*.js",
      "apps/web/**/*.jsx",
    ],
  },

  // ======================================
  // Configuración base
  // ======================================
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ======================================
  // Backend
  // ======================================
  {
    files: [
      "apps/api/**/*.{ts,js,mjs,cjs}"
    ],

    languageOptions: {
      globals: {
        ...globals.node,

        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        AbortController: "readonly",
        fetch: "readonly"
      },
    },
  },

  // ======================================
  // Node Scripts / CommonJS
  // ======================================

  {
    files: [
      "**/*.{mjs,cjs}",
      "*.mjs",
      "*.cjs",
      "scripts/**/*.{js,mjs,cjs}",
      "apps/api/scripts/**/*.{ts,js,mjs,cjs}",
      "apps/api/prisma/**/*.{ts,js}",
      "infra/**/*.js",
      "infra/**/*.mjs",
      "infra/**/*.cjs"
    ],

    languageOptions: {
      globals: {
        ...globals.node,

        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        AbortController: "readonly",
        fetch: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "readonly"
      }
    },

    rules: {
      "no-console": "off"
    }
  },

  // ======================================
  // Frontend
  // ======================================
  {
    files: ["apps/web/**/*.{ts,tsx}"],

    languageOptions: {
      globals: {
        ...globals.browser,

        AbortController: "readonly",
        fetch: "readonly"
      },
    },

    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      "jsx-a11y": jsxA11y,
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",

      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "import/first": "error",
      "import/no-duplicates": "error",

      "import/order": "off",
    },
  },

  // ======================================
  // Seguridad
  // ======================================

  {
    plugins: {
      security,
    },

    rules: {
      ...security.configs.recommended.rules,

      "security/detect-object-injection": "off",
    },
  },

  // ======================================
  // Scripts operativos
  // ======================================
  {
    files: [
      "scripts/**/*.{js,mjs,cjs}",
      "apps/api/scripts/**/*.{ts,js,mjs,cjs}",
    ],

    rules: {
      "security/detect-non-literal-fs-filename": "off",
    },
  },

  // ======================================
  // TypeScript
  // ======================================
  {
    files: ["**/*.{ts,tsx}"],

    rules: {
      "no-debugger": "error",
      "no-var": "error",
      "prefer-const": "error",

      eqeqeq: ["error", "always"],
      curly: ["error", "all"],

      "object-shorthand": "error",
      "prefer-template": "warn",

      "no-unused-vars": "off",

      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },

  // ======================================
  // Console permitido
  // ======================================
  {
    files: [
      "apps/api/src/**/*.ts",
      "apps/api/src/app.ts",
      "apps/api/src/index.ts",
      "apps/api/src/workers/**/*.ts",
      "apps/api/src/services/**/*Queue.ts",
      "apps/api/src/utils/redisClient.ts",
      "apps/api/prisma/**/*.ts",
      "apps/api/scripts/**/*.ts",
      "scripts/**/*.{js,ts,mjs,cjs}",
    ],

    rules: {
      "no-console": "off",
    },
  },

  // ======================================
  // Console restringido
  // ======================================
  {
    files: ["**/*.{js,jsx,ts,tsx}"],

    ignores: [
      "apps/api/src/**/*.ts",
      "apps/api/src/app.ts",
      "apps/api/src/index.ts",
      "apps/api/src/workers/**/*.ts",
      "apps/api/src/services/**/*Queue.ts",
      "apps/api/src/utils/redisClient.ts",
      "apps/api/prisma/**/*.ts",
      "apps/api/scripts/**/*.ts",
      "scripts/**/*.{js,ts,mjs,cjs}",
    ],

    rules: {
      "no-console": "warn",
    },
  },

  // ======================================
  // Prettier (SIEMPRE AL FINAL)
  // ======================================
  eslintConfigPrettier,
];
