import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideOptions = {
  project: "./project.inlang",
  outdir: "./src/paraglide",
  strategy: ["cookie", "preferredLanguage", "baseLocale"],
  cookieName: "LOCALE",
  // Keep the build graph bounded as the message catalog grows.
  outputStructure: "locale-modules",
} satisfies CompilerOptions;
