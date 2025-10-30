const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
  {
    ignores: ["node_modules/"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["frontend/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        "marked": "readonly",
        "CodeMirror": "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
    },
  },
];

