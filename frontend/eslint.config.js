import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import { boundaries } from "./eslint-rules/architecture.js";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "public/mockServiceWorker.js",
      "playwright-report",
      "test-results",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks, "react-refresh": refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { architecture: { rules: { boundaries } } },
    rules: { "architecture/boundaries": "error" },
  },
  {
    files: [
      "src/entities/*/model/**/*.{ts,tsx}",
      "src/features/*/model/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "fetch",
      ],
    },
  },
);
