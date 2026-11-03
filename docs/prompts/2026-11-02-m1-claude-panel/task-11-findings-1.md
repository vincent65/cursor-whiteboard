# Task 11 findings, round 1 (from review thr_yf4ykt5kud, with controller ruling)

## Important
1. `mermaid@^12.2.0` requires Node >= 22.12 (so do `@mermaid-js/parser@2` and `commander@15`), while the project floor is Node 22.1 and the global constraint says so. Ruling: use `mermaid@^11` as the dev dependency; `mermaid@11.17.2` is already in the lockfile as a transitive dependency with no engine constraint, so the lockfile shrinks and nothing new ships. Keep the test unchanged unless mermaid 11's parser API differs; if it does, adapt the import or call and say so.

## Minor (deferred, do not address)
- Node and edge builders are duplicated from markdown.test.ts.
- One test covers all blocks; test.each would name the failing block.
