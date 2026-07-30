# @ctm/ui

Design tokens and presentational components for the CTM web app.

## What belongs here

A component belongs in this package if it can be described without mentioning the API. It
takes data and copy as props, calls handlers, and knows nothing about routing, queries or
side effects. Those stay in `apps/web`.

Copy is always a prop. This package never imports i18next: the app owns the translation
catalogue, which keeps components testable without a provider and keeps wording decisions
where the context is.

## Tokens

`src/styles/tokens.css` holds the Quiet Slate palette as Tailwind v4 `@theme` custom
properties, with the dark values under `:where(.dark)`. Both consumers import it:
`apps/web/src/index.css` and the Storybook preview.

Row density is driven by `--ctm-row-y`, switched through a `data-density` attribute on the
document element: `compact` (6px), unset or `comfortable` (10px), `spacious` (16px). Touch
targets stay at 44px minimum below 768px whatever the density says.

The only shadow in the system is `--shadow-overlay`, for surfaces that float above blurred
content. There are no offset shadows.

## Every component ships three files

`Name.tsx`, `Name.spec.tsx`, `Name.stories.tsx`, side by side. A component without a story
is not finished, because the story is where the tokens get judged.

## Testing policy

```bash
pnpm --filter @ctm/ui test
```

Specs assert behaviour: role, accessible name, ARIA state, keyboard interaction, callback
contracts, and no axe violations. They must not assert Tailwind class strings, DOM
snapshots or colour values, because those change with every design pass and testing them
would make the suite an obstacle to design work.

Axe is a floor, not a ceiling. It cannot judge focus order, reading order or contrast in
context, so each phase also ends with a keyboard-only pass and a contrast check.

## Storybook

```bash
pnpm --filter @ctm/storybook dev
```

Serves on port 6006 with Theme and Density toolbar controls. It is a development tool with
no deploy target, and it is where new components get built before they are wired to data.
