# xdoku

An iPhone cat logic game built on Windows with Expo and TypeScript. Name and art are provisional.

## Development

Use Node.js 22.16 or later. In `mobile`, run `npm ci`, then `npm start`. Use a compatible Expo Go on iPhone or a development build. `npm run web` opens the browser version.

Validate with `npm test`, `npm run typecheck`, and `npm run lint`. Tests cover uniqueness, connected regions, deterministic generation, UTC daily seeds and placement rules. iPhone testing is still required.

Dependency audit currently reports five high-severity findings in Expo CLI's transitive node-forge/zod dependencies. Compatible automatic fixes did not clear them; reassess upstream updates before distribution.

## Status and roadmap

Implemented: automatically selected 7×7, 8×8, 9×9 or 10×10 unique-solution boards, numbered levels, UTC daily boards, single-tap exclusion marks, double-tap cats, conflict feedback, undo, reveal, restart and local saves. There is no size selector. A mixed level/date seed chooses the size, so replaying a level preserves its board and every player gets the same daily size. The interface is currently Traditional Chinese.

Drag across the board to edit marks quickly. Starting on an empty cell fixes the stroke to add marks; starting on an exclusion mark fixes it to erase marks. Cats are preserved, and starting on a cat does not paint. Fast strokes fill crossed cells, revisiting a cell never toggles it, and a completed stroke is one undo action. Interrupted strokes discard their preview. Small finger movements remain taps. Scrolling is paused while touching the board; scroll from outside it. Screen readers can use each cell's mark/cat accessibility actions.

Each region has a distinct color from a ten-color palette. Conflicts use a red outline and exclamation badge while retaining the region background. Palette tests guard pairwise CIELAB separation and mark contrast; color-vision accessibility still needs user testing.

Every generated board has at most one single-cell region, and each region is capped at 14% of the board (rounded down). The agreed 7×7 exception allows seven cells: the caps for 7×7, 8×8, 9×9 and 10×10 are 7, 8, 11 and 14 cells.

The generator first fixes a valid cat solution, starts with one connected region per row, then exchanges boundary cells while preserving the solution, connectivity and area limits. Larger boards can also transfer boundary cells within the cap. It first checks the candidate without clues, then tries one and two given cats; only unique solutions completed by the deduction evaluator are accepted. It never adds more than two givens. Clues are part of the puzzle, not hint usage. Locked cats have a lock badge and cannot be changed by taps, drags, accessibility actions, undo, restart or loading saved marks.

The deduction pass starts from the givens and uses singles and common conflict exclusions. Difficulty remains a heuristic based on group exclusions (0 easy, 1–3 medium, 4+ hard), pending player calibration. Classic catalogs exclude rotated/reflected duplicates and region relabeling. Daily boards are deterministic per UTC date and size, without historical daily deduplication. Generation tries at most 500 mutation batches before reporting failure; catalogs are cached in memory and reproduced from seeds.

Generator v5 stores progress separately by mode, size and versioned puzzle ID. Earlier saves remain on the device but are not applied to new layouts. Before release: add explanatory hints, localization, non-color region cues, original assets and device testing, including generation latency on older iPhones.

Leaderboards require a trusted backend and validated scores, with assisted attempts separated. Purchases require Apple products, verified entitlements and restore purchases. Neither service is connected; no payments are taken and no rankings are fabricated.

Distribution requires Apple Developer and Expo accounts, final bundle identifier, EAS configuration, signing, TestFlight testing, privacy disclosures, support/privacy pages, store assets and review. This prototype is not ready for submission. Keep credentials out of Git.

Chinese version: [Traditional Chinese](README.zh.md).
