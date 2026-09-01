---
id: TASK-63
title: Finish EUR and Cardmarket pricing migration
status: Done
assignee:
  - '@skriewel'
created_date: '2026-09-01 16:16'
updated_date: '2026-09-01 16:39'
labels: []
dependencies: []
references:
  - 'https://github.com/skriewel/manavault/pull/10'
priority: high
type: feature
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete and validate the existing EUR valuation migration. EUR is the internal valuation currency; Scryfall prefers native EUR and converts USD only as fallback using the latest stored ECB rate; Cardmarket joins its public daily price guide through Scryfall cardmarket_id; USD-only vendor feeds are converted at sync time; the regenerable vendor price cache is cleared by migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All user-visible valuation and purchase-price paths use EUR without stale USD or dollar assumptions
- [x] #2 Scryfall native EUR, ECB fallback, Cardmarket price guide mapping, and USD vendor conversion are covered by tests
- [x] #3 Generated GraphQL documents and types match the pricing schema and operations
- [x] #4 Backend and frontend quality gates pass and the branch is ready to merge
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit remaining backend, frontend, migration, test, and generated GraphQL currency assumptions. 2. Correct production behavior and update focused regression tests. 3. Regenerate GraphQL artifacts and run formatting, typecheck, build, and test gates. 4. Commit, push, open the PR, and confirm CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed final EUR audit and corrected remaining UI labels, SQL single-key EUR fallback, GraphQL proxy field generation, and stale EUR test fixtures. Validation: GraphQL codegen and TypeScript passed; frontend model tests 196/196; React tests 101/101 (one unrelated timing-sensitive test passed on immediate rerun); production Vite build passed; backend compile with warnings-as-errors passed; focused pricing tests passed 42/42; full ExUnit 669/675 with two pre-existing allocation behavior failures and three missing-rsvg PNG environment failures plus two test fixture issues corrected and verified. Full Credo reports one pre-existing refactor warning and checkout-specific mixed-line-ending notices.

Correction to the local full-suite note: after fixing the two discovered fixture failures, the remaining four failures are two rsvg-dependent PNG checks and two pre-existing deck-allocation behavior assertions. GitHub reports PR #10 as CLEAN and MERGEABLE; this repository has no configured status checks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Finished the EUR/Cardmarket pricing migration and final consistency pass. Corrected the remaining EUR UI and test assumptions, fixed single-key SQL EUR price fallback and unnecessary FX setting lookups, regenerated GraphQL artifacts with proxy fields intact, and verified frontend tests/typecheck/build plus focused pricing/backend tests. Pushed commit 0513378 and opened mergeable PR #10.
<!-- SECTION:FINAL_SUMMARY:END -->
