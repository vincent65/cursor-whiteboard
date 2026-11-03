# Task 5 findings, round 1 (from review thr_uwnxdh9ss5, with controller rulings)

## Important
1. An op that targets an element already ghosted by a different pending proposal corrupts both proposals (snapshots merge only within one proposal; the element's tag moves to the new proposal; accept leaves it dashed; the first proposal's snapshot is lost). Ruling: in the validation loop, throw `Error("element <id> is in pending proposal <p>")` when the target carries a ghost tag for another proposal id; same-proposal re-targeting keeps the existing first-op-wins merge. Add a test.
2. The label snapshot stores the wrapped `text`, so rejecting a wrapped label writes line breaks into `originalText`. Ruling: snapshot `before.label = label.originalText ?? label.text`; reject writes it to both `text` and `originalText` (Task 8's `restoreElements` with `refreshDimensions` re-wraps). Add a test whose fixture has `text` with `\n` and a different `originalText`, asserting the original `originalText` comes back and `text` equals it after reject.

## Minor (fix in this round)
3. An add op whose rendered group is empty is skipped silently. Ruling: throw `Error("op <i> rendered nothing")` in validation.
4. A delete ghost restyles only the container, so its label stays at full opacity. Ruling: the bound text of a delete target gets `opacity: 40` too, with its own `before.opacity` snapshot and a ghost tag `{ origin: "ai", proposalId, ghost: "delete" }` so reject restores it and accept deletes it with the container (`pendingProposals` must count the pair once: count only elements without a `containerId`). Add a test.

## Minor (deferred, do not address)
- The two extra throws (`has no label`, `was not rendered`) have no test.
- `bounds` uses an arrow's `x` as its left edge; later points can lie left of it.
- `toEqual` with `customData: undefined` cannot tell a missing key from an undefined one (the reject test covers it).
