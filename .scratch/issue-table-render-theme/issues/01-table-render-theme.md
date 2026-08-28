# Table rendering on published article pages

Status: ready-for-agent

## Problem

After publishing a blog post, tables render incorrectly on the public article page:
formatting/borders are missing, long cell content does not wrap, and the table only
shows the raw cell text. In the editor preview, the same table renders correctly
(borders visible, cells auto-wrap).

## Root cause

- Admin editor always uses the default theme's CSS (`.ProseMirror table` =
  `table-fixed w-full border-collapse`), so the preview wraps and shows borders
  regardless of the deployed theme.
- The public static renderer emitted `className="w-max min-w-full"` with
  `style={{tableLayout:"auto"}}`. `w-max` = `width:max-content` prevents cell
  wrapping and lets the table overflow its container.

## Resolution

Both themes (`default` and `fuwari`) were updated so the published table behaves like
the editor preview:

- `default/components/content/render.tsx` and `fuwari/components/content/render.tsx`:
  table className changed from `w-max min-w-full` to `w-full border-collapse content-table`
  (kept `tableLayout:"auto"`).
- `default/styles/index.css`: `.ProseMirror td/th` gained
  `overflow-wrap:anywhere; word-break:break-word`.
- `default/styles/markdown.css`: `.default-md th/td` gained the same word-wrap rules.
- `fuwari/styles/markdown.css`: explicit `table`, `th/td`, `th` rules added using the
  fuwari palette vars, cell padding, `align-top`, word-wrap, and `table-layout:auto`.
- `content-render.test.ts`: added assertions verifying the table renders
  `w-full border-collapse content-table` and not `w-max`.

## Verification

- 262 node tests pass; content-render test passes; biome lint clean; tsc typecheck clean.
- Client builds for both themes compile the CSS (respects `@apply` / arbitrary values).

## Comments

- `vite build` SSR portion fails on `cloudflare:workers` import resolution in this
  environment (pre-existing, unrelated); deploy uses the `wrangler deploy` flow.
- User requested both themes fixed; desired behavior matches the editor preview.
