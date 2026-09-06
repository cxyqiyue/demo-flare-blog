/**
 * Compile-time theme flag. Vite folds this constant at build time
 * (see vite.config.ts `define.__THEME_NAME__`), so the dead branch is
 * tree-shaken away and the build never mixes theme class systems.
 */
export const isFuwari = __THEME_NAME__ === "fuwari";
