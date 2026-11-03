The re-review confirmed all twenty findings and found one regression and three small items. Fix them, in this thread, on branch `m5-evidence`:

1. Important: in `src/ui/markdown.tsx` the list branch's local `const base = indent(line)` shadows the new heading `base`, so a heading inside a nested list renders at the wrong level (as low as `<h0>`). Rename the local (for example `indentBase`) and add nested-list cases to the `headingBase` test (`"- a\n  - b\n  # H"` → h3 by default; with `headingBase={1}`, `## H` → h2).
2. `placeBeside`'s overlap check uses each element's true bounds: for arrows and lines, the min and max of `x + point[0]` and `y + point[1]` over its points (keep ghosts.ts free of Excalidraw imports). Test a left-pointing arrow.
3. The proposals bar centers in the board area right of Excalidraw's properties panel (the same left inset focus uses), so it never covers the panel's last row at 1280 by 800; re-shoot `after-board-proposal.png` and re-run `pnpm demo` so `01-plan-ask-accept.webm` matches.
4. `FileStore` recreates any missing `.blueprint/` subdirectory a write needs (not only when `.blueprint/` itself is gone). Test deleting `.blueprint/boards/` then saving a board.

Run `pnpm check` once and `pnpm e2e` three times, commit with conventional messages and NO co-author trailer, append a "Fix round 2" section to final-fix-report.md, and end with the short status contract only.
