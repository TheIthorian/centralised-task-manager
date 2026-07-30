# Plan: reskin apps/landing to Quiet Slate

Spec: `.claude/specs/landing-quiet-slate.md`. Closes #31.

1. **`packages/ui`: share the button skin.**
    - `button-styles.ts` exports `buttonClassName({ variant, className })` and the `ButtonVariant` type.
    - `Button.tsx` uses it; no API change.
    - `LinkButton.tsx` + `LinkButton.spec.tsx` + `LinkButton.stories.tsx` render an `<a>` with the same skin.
    - Export both from `src/index.ts`.

2. **`apps/landing`: wire the shared package.**
    - `package.json`: add `@ctm/ui` and `clsx` deps, `vite-plugin-svgr` dev dep.
    - `astro.config.mjs`: add the `svgr()` vite plugin so `BrandIcon`'s `?react` imports resolve.
    - `global.css`: import `tokens.css`, add `@source` for `packages/ui/src`, add the `dark` custom
      variant, drop the `nb-*` block, set body ground from tokens.

3. **`BaseLayout.astro`.** Blocking head script resolves `localStorage.theme` then
   `prefers-color-scheme` onto `documentElement.classList`. Body takes `bg-bg text-fg`.

4. **Rewrite the six components** per the spec table, using `LinkButton`, `Badge` and `BrandIcon`.

5. **Verify.** `pnpm install`, `pnpm --filter @ctm/ui test`, `pnpm --filter @ctm/landing build`,
   `pnpm lint`, `pnpm format`.

6. **Ship.** Conventional commit, PR with What/Why/How, line comments on the judgement calls.
