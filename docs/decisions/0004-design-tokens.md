# 0004: Design tokens as the single source of the visual identity

Date: 2026-11-03
Status: Accepted

## Context

The first visual identity (Leaf, Ink, Mist, Stone, Sun and Chili; Barlow Condensed and Atkinson
Hyperlegible; the order-ticket motif) was approved for now, with the expectation that it may change
as we learn from real restaurant owners and customers.

## Decision

All raw colors, font names, sizes, radii and motion values live in `public/css/tokens.css`.
Components (`components.css`) and pages (`style.css`) use only semantic tokens such as
`--color-action` and `--space-4`. Fonts are declared in `fonts.css`. The `/styleguide.html` page
renders every component from the live tokens.

## Consequences

- A rebrand means editing `tokens.css` and `fonts.css`, then checking the style guide.
- Never write a hex value, font name or pixel size in a component or page. Add or change a token.
- Revisit the identity after the first round of usability sessions (Step 1 discovery).
