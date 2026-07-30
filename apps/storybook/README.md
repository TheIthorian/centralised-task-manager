# @ctm/storybook

Storybook harness for `@ctm/ui`.

```bash
pnpm --filter @ctm/storybook dev
```

Serves on http://localhost:6006 with Theme and Density toolbar controls, so every story
can be judged in both palettes and at all three row densities.

Stories live next to their component in `packages/ui/src`, because a component and its
examples should change in the same commit. This app is only the configuration.

There is no `build` script and no deploy target on purpose: this is a development tool for
building components before they are wired to data, not a published site.
