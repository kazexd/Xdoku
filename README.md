# xdoku

An iPhone cat logic game built on Windows with Expo and TypeScript. Name and art are provisional.

## Development

Use Node.js 22.16 or later. In `mobile`, run `npm ci`, then `npm start`. Use a compatible Expo Go on iPhone or a development build. `npm run web` opens the browser version.

Validate with `npm test`, `npm run typecheck`, and `npm run lint`. Tests cover uniqueness, connected regions, deterministic generation, UTC daily seeds and placement rules. iPhone testing is still required.

Dependency audit currently reports five high-severity findings in Expo CLI's transitive node-forge/zod dependencies. Compatible automatic fixes did not clear them; reassess upstream updates before distribution.

## Status and roadmap

Implemented: 5×5 unique-solution boards, numbered levels, UTC daily boards, placement and exclusion tools, conflict feedback, undo, reveal, restart and local saves. The interface is currently Traditional Chinese.

Before release: expand the small solution-pattern family and difficulty grading; add deduction hints, localization, non-color region cues, original assets and device testing.

Leaderboards require a trusted backend and validated scores, with assisted attempts separated. Purchases require Apple products, verified entitlements and restore purchases. Neither service is connected; no payments are taken and no rankings are fabricated.

Distribution requires Apple Developer and Expo accounts, final bundle identifier, EAS configuration, signing, TestFlight testing, privacy disclosures, support/privacy pages, store assets and review. This prototype is not ready for submission. Keep credentials out of Git.

Chinese version: [Traditional Chinese](README.zh.md).
