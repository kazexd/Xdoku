# xdoku

An iPhone cat logic game built on Windows with Expo and TypeScript. Name and art are provisional.

## Development

Use Node.js 22.16 or later. In `mobile`, run `npm ci`, then `npm start`. Use a compatible Expo Go on iPhone or a development build. `npm run web` opens the browser version.

Validate with `npm test`, `npm run typecheck`, and `npm run lint`. Tests validate every shipped puzzle plus the generator, data loading, UTC daily selection, exhaustion, corruption handling and placement rules. iPhone testing is still required.

Dependency audit currently reports five high-severity findings in Expo CLI's transitive node-forge/zod dependencies. Compatible automatic fixes did not clear them; reassess upstream updates before distribution.

## Status and roadmap

Implemented: automatically selected 7×7, 8×8, 9×9 or 10×10 unique-solution boards, numbered levels, UTC daily boards, single-tap exclusion marks, double-tap cats, conflict feedback, new-game action, reveal, restart and local saves. There is no size selector or undo button. New game advances to the next classic puzzle even from daily mode; restart keeps the current puzzle. The app reads prebuilt JSON data only: 200 classic puzzles and a separate 365-puzzle daily pool. Classic order is fixed; UTC dates select the daily puzzle, with an explicit 365-day cycle. Once classic puzzles run out, New game is disabled instead of generating or silently repeating puzzles. The interface is currently Traditional Chinese.

Drag across the board to edit marks quickly. Starting on an empty cell fixes the stroke to add marks; starting on an exclusion mark fixes it to erase marks. Cats are preserved, and starting on a cat does not paint. Fast strokes fill crossed cells, revisiting a cell never toggles it, and a completed stroke is one edit. Interrupted strokes discard their preview. Small finger movements remain taps. Scrolling is paused while touching the board; scroll from outside it. Screen readers can use each cell's mark/cat accessibility actions.

Each region has a distinct color from a ten-color palette. Conflicts use a red outline and exclamation badge while retaining the region background. Palette tests guard pairwise CIELAB separation and mark contrast; color-vision accessibility still needs user testing.

Generator v6 never preplaces cats. Hard region caps for 7×7, 8×8, 9×9 and 10×10 are 11, 13, 15 and 17 cells, with at most one singleton region. The existing v5 bank stays in place until a complete new bank is generated; the app supports both versions.

The development generator fixes a legal answer, then exchanges or transfers region boundaries while preserving connectivity, area caps and one answer cat per region. It accepts only clue-free, unique, deductively solvable puzzles. Failed searches move to another seed without adding cats or relaxing caps.

Deduction uses singles and common conflict exclusions. Difficulty is a heuristic based on group exclusions (0 easy, 1–3 medium, 4+ hard). The builder excludes rotations, reflections and region relabelings. The app imports no generation or search code.

Content-derived puzzle IDs keep classic saves attached to the same puzzle. Daily save keys also include the UTC date, so yearly repeats start fresh. Earlier saves remain on the device but are not applied to new layouts. Before release: add explanatory hints, localization, non-color region cues, original assets and device testing, including startup performance on older iPhones.

Leaderboards require a trusted backend and validated scores, with assisted attempts separated. Purchases require Apple products, verified entitlements and restore purchases. Neither service is connected; no payments are taken and no rankings are fabricated.

Distribution requires Apple Developer and Expo accounts, final bundle identifier, EAS configuration, signing, TestFlight testing, privacy disclosures, support/privacy pages, store assets and review. This prototype is not ready for submission. Keep credentials out of Git.

Chinese version: [Traditional Chinese](README.zh.md).

## Prebuild puzzle data

In `mobile`, run `npm.cmd run puzzles:generate -- --classic 200 --daily 365 --seed 100000 --max-seeds 20000 --attempts 500`. Each seed searches up to 500 batches, with 20,000 seeds in total. A fixed seed selects each target size; failures cannot substitute another size. Progress and `.puzzle-generation/checkpoint.json` are saved after every seed. Rerun the same command to resume; increase `--max-seeds` after exhaustion. Other settings must match, or use `--checkpoint <new-path>` for a separate run. Finding 10×10 puzzles is difficult; the budget may not fill the bank. Only a complete validated bank replaces `src/data/puzzles.json`; interruption or failure preserves existing data. Commit the generated JSON when complete.

Treat shipped ordering as release data: keep existing classic entries and daily ordering stable when editing the bank. Changing a daily pool length/order changes its date mapping; plan such changes as a new schedule. The current finite daily pool repeats every 365 days. Older procedural puzzle saves remain on the device but are not mapped onto the new bank.


Each round starts with three fish (🐟). Placing a cat outside the stored solution shows a cat, flashes dark red, then leaves an X and consumes one fish. Input pauses during feedback. Fish persist with saved progress; zero fish shows Game Over with a New game action. Restart explicitly resets the same puzzle and all three fish. Marks and hints cost no fish. At the end of the classic bank, Game Over offers a retry of the current puzzle.
