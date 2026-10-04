# PDF audit follow-up — PC-DIY

Scope: portfolio audit pages 23–24, reviewed 2026-10-04.

| Finding | Change and evidence |
| --- | --- |
| Windows build ENOENT | Node launches the resolved Vite entry; Windows junction fixtures and a real Vite version invocation test the wrapper. |
| Dependencies/lint | Repaired reproducible lockfile, updated affected transitive dependencies, fixed lint errors. CI audits the full tree. |
| No planner domain tests | Tests cover incompatible sockets, PSU headroom, malformed saved builds, insufficient/invalid budgets and compatible builds for all five goals under budget. Fractional budgets are floored so a rounded budget cannot authorize overspending. |
| Saved/share state can be malformed | Restore accepts only known catalog IDs in their correct slots, finite bounded budgets and supported resolutions. Invalid content recovers to defaults. |
| Prices/catalog provenance | See [catalog policy](CATALOG-POLICY.md). Snapshot values remain explicitly illustrative; no unverified price or SKU is relabelled as current. |
| Browser workflow not verified | Desktop/mobile production tests exercise automatic builds, low-budget protection, share-link reload and corrupted saved-state recovery. |

Node 22 reproduction: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm audit --audit-level=low`, `npm run build`, `npx playwright install chromium`, `npm run test:e2e`. Set `E2E_DEV=1` to exercise development mode. The CI matrix verifies clean installs and official builds on Windows/Ubuntu; Ubuntu runs both browser sizes.

Tests validate this simulator's rules. Prices, relative performance, power and physical fit still need real-SKU manufacturer/retailer evidence before use as purchasing advice. Browser graphics/Grok extensions and third-party fonts depend on their hosts; no external deployment is changed by this PR.

## Content and function acceptance update

See [the 2026-10-04 acceptance record](CONTENT-FUNCTION-ACCEPTANCE.md) for the additional content review, fixes, regression cases and limits. Earlier counts above describe the audit baseline.
