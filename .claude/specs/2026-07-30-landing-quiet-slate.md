# Landing site on Quiet Slate

## Problem

`apps/landing` carries its own neobrutalist palette in `src/styles/global.css` (`--color-nb-yellow`,
`--color-nb-black`, `--color-nb-red`, `--color-nb-green`). It is a second definition of the product
palette, and now that the app is Quiet Slate, "Sign in" walks the visitor into what looks like a
different product.

## Outcome

The marketing site spends the same tokens as the app: `packages/ui/src/styles/tokens.css` is the only
palette definition in the repo, and the six landing components are built from `@ctm/ui` primitives
where a primitive exists.

## Design

**Tokens.** `apps/landing/src/styles/global.css` imports `packages/ui/src/styles/tokens.css` and
declares `@source "../../../packages/ui/src"` so Tailwind scans the shared components. The `nb-*`
block is deleted. `@custom-variant dark` matches the app.

**Theme.** Both themes. The landing page follows the OS preference and honours the `theme` key the
app writes to `localStorage`, so a visitor who set dark in the app does not get flashed white on the
way back out. Applied by a small blocking script in `<head>`, before first paint.

**Language.** Hairline `border-line`, `rounded-ctm`, one pine `accent`, no offset shadows, no
`font-black uppercase`. The hero is allowed more type scale than the app, but no more colour: the
only saturated thing on the page is the primary CTA.

**Reuse.** `Badge` and `BrandIcon` come from `@ctm/ui` as they are. Every landing CTA is a link, not
a button, so `@ctm/ui` gains a `LinkButton` that renders an `<a>` with the `Button` skin. `Button`
and `LinkButton` share one class builder so the two skins cannot drift.

**Sections.**

| Section        | Ground                           | Notes                                                     |
| -------------- | -------------------------------- | --------------------------------------------------------- |
| `Nav`          | `bg/85` blurred, hairline bottom | wordmark + one primary CTA                                |
| `Hero`         | `bg`                             | large but not shouting headline, two CTAs, accent eyebrow |
| `Features`     | `bg`                             | four `panel` cards, hairline borders, monochrome glyphs   |
| `HowItWorks`   | `panel`                          | three numbered steps, accent numerals on `nav-on-bg`      |
| `Integrations` | `bg`                             | `BrandIcon` rows, dashed "more soon" card                 |
| `FooterCta`    | `panel`                          | closing CTA and copyright                                 |

Section rhythm is a hairline `border-line` between bands, never a 4px slab.

## Accessibility

- 44px minimum target on every link below 768px, via the shared button skin and explicit `min-h-11`
  on the bare nav links.
- 2px `outline-accent` focus ring with a 2px offset on every interactive element; nothing sets
  `outline: none`.
- Emoji feature glyphs are replaced by inline SVG marked `aria-hidden="true"`: an emoji is announced
  by a screen reader as its CLDR name, which is noise next to the heading it decorates.
- Step numerals are decorative and hidden from the accessibility tree; the step heading carries the
  meaning, so order is not signalled by the numeral alone.
- All text meets AA in both themes: body copy uses `fg`, secondary copy uses `muted` (both AA on
  `bg` and `panel` in the token set), and the accent is only ever used behind `accent-fg`.
- `motion-safe:` gates every transition, so `prefers-reduced-motion` collapses them.

## Out of scope

- Copy changes; the words stay as they are.
- i18n for the landing site. The `t()` rule in `CLAUDE.md` is scoped to `apps/web`, and the
  marketing site has no i18next runtime.
- Wiring the CTA `href`s to real URLs. They are `#` today and stay `#`.
