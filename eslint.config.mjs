import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Built directly on @next/eslint-plugin-next instead of eslint-config-next:
// eslint-config-next@16.3.5's bundled preset currently crashes ESLint
// (circular structure in eslint-plugin-react-hooks@7's flat config object,
// reproducible on both ESLint 8 and 9) — an upstream bug, not something
// fixable from this project. This gets the same real coverage (Next.js
// rules, React rules, react-hooks rules, TypeScript rules) without it.
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["next.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
    settings: { react: { version: "detect" } },
  }
);
