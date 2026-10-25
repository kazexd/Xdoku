# xdoku

An iPhone cat logic game built on Windows with Expo and TypeScript. Name and art are provisional.

## Development

Use Node.js 22.16 or later. In `mobile`, run `npm ci`, then `npm start`. Use a compatible Expo Go on iPhone or a development build. `npm run web` opens the browser version.

Validate with `npm test`, `npm run typecheck`, and `npm run lint`. Tests cover uniqueness, connected regions, deterministic generation, UTC daily seeds and placement rules. iPhone testing is still required.

Dependency audit currently reports five high-severity findings in Expo CLI's transitive node-forge/zod dependencies. Compatible automatic fixes did not clear them; reassess upstream updates before distribution.

## Status and roadmap

Implemented: automatically selected 7×7, 8×8, 9×9 or 10×10 unique-solution boards, numbered levels, UTC daily boards, single-tap exclusion marks, double-tap cats, conflict feedback, undo, reveal, restart and local saves. There is no size selector. A mixed level/date seed chooses the size, so replaying a level preserves its board and every player gets the same daily size. The interface is currently Traditional Chinese.

Drag across the board to edit marks quickly. Starting on an empty cell fixes the stroke to add marks; starting on an exclusion mark fixes it to erase marks. Cats are preserved, and starting on a cat does not paint. Fast strokes fill crossed cells, revisiting a cell never toggles it, and a completed stroke is one undo action. Interrupted strokes discard their preview. Small finger movements remain taps. Scrolling is paused while touching the board; scroll from outside it. Screen readers can use each cell's mark/cat accessibility actions.

Generation uses seeded randomized backtracking for cat positions, connected region growth that preserves random small regions as deduction starting points for larger boards, a solver that stops at the second solution, and a deduction-only acceptance check. The deduction pass uses singles and common conflict exclusions across rows, columns and regions. Difficulty is a heuristic: easy uses no group exclusions, medium uses 1–3, and hard uses 4 or more. These labels still need player calibration; board size alone does not determine difficulty.

Classic catalogs exclude duplicate boards across all eight rotations/reflections and region relabeling. Daily boards are deterministic per UTC date and size; they do not check historical daily duplicates. Generation retries at most 5,000 candidates before reporting failure. Catalogs are cached in memory and reproduced from seeds after restart.

Generator v3 stores progress separately by mode, size and versioned puzzle ID. Old v1/v2 saves remain on the device but are not applied to new layouts. Before release: add explanatory deduction hints, localization, non-color region cues, original assets and device testing, including generation latency on older iPhones.

Leaderboards require a trusted backend and validated scores, with assisted attempts separated. Purchases require Apple products, verified entitlements and restore purchases. Neither service is connected; no payments are taken and no rankings are fabricated.

Distribution requires Apple Developer and Expo accounts, final bundle identifier, EAS configuration, signing, TestFlight testing, privacy disclosures, support/privacy pages, store assets and review. This prototype is not ready for submission. Keep credentials out of Git.

Chinese version: [Traditional Chinese](README.zh.md).
