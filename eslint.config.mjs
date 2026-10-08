import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure/**",
                "@/application/**",
                "@/components/**",
                "@/app/**",
                "@supabase/**",
                "drizzle-orm",
                "drizzle-orm/**",
                "next",
                "next/**",
                "openai",
              ],
              message:
                "domain/ must not import Supabase, Drizzle, Next.js, OpenAI, or outer layers",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
