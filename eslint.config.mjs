import { createRequire } from "module";

const require = createRequire(import.meta.url);
/** @type {import("eslint").Linter.Config[]} */
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

export default [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
