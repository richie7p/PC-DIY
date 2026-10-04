# Catalog provenance and update policy

Catalog implementation reviewed: 2026-10-04. This is a representative teaching catalog, not a live shop feed. No price was checked with a retailer during this audit. The review date must not be presented as the price's effective date.

`src/lib/pc/catalog.ts` contains the current snapshot. Prices in USD, performance scores, power estimates and clearances are illustrative inputs. A component family name alone does not identify a purchasable SKU; boards, graphics cards, coolers and cases have manufacturer-specific dimensions and revisions.

Before promoting a row to verified purchasing data, record its exact manufacturer part number, revision, official specification URL, retrieved date, currency, retailer price URL/date and whether taxes/shipping are included. Verify socket/BIOS support, memory QVL, GPU/cooler dimensions, radiator support and PSU connectors against the selected SKU. Keep unverified fields labelled as estimates. Never infer a current retail price from a performance score.

Every update must preserve unique IDs used in saved builds and share links. Retired IDs need an explicit migration or must be discarded by `normalizeBuild`; they must not resolve to a different component. Run planner tests after changing prices or compatibility fields, including all five autobuild goals and the cheapest-build boundary. Hardware benchmark calibration and real-SKU verification remain external work.
