import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, estimatePower, fitPart, resolvePicks } from "./analyze";
import { autoBuild, cheapestComplete, USE_CASES } from "./autobuild";
import { PARTS } from "./catalog";
import { normalizeBuild } from "./persistence";
test("saved builds discard stale, wrong-slot and inherited catalog identifiers", () => {
  const cpu = PARTS.find((p) => p.slot === "cpu")!;
  const result = normalizeBuild({ picks: { cpu: cpu.id, gpu: cpu.id, ram: "toString" }, budgetCap: Infinity, resolution: "invalid" });
  assert.deepEqual(result, { picks: { cpu: cpu.id }, budgetCap: 1500, resolution: "1440p" });
  for (const value of [null, [], "oops", 123]) assert.deepEqual(normalizeBuild(value).picks, {});
});
test("mismatched sockets are a compatibility failure", () => {
  const cpu = PARTS.find((p) => p.slot === "cpu" && p.socket === "AM5")!;
  const mobo = PARTS.find((p) => p.slot === "motherboard" && p.socket === "LGA1700")!;
  assert.ok(fitPart(mobo, resolvePicks({ cpu: cpu.id })).fail.length > 0);
});
test("power headroom increases for a discrete GPU", () => {
  const cpu = PARTS.find((p) => p.slot === "cpu")!; const gpu = PARTS.find((p) => p.slot === "gpu")!;
  const empty = estimatePower(resolvePicks({ cpu: cpu.id }));
  const full = estimatePower(resolvePicks({ cpu: cpu.id, gpu: gpu.id }));
  assert.ok(full.watts > empty.watts); assert.ok(full.recommended >= full.watts * 1.35);
});
test("insufficient and invalid budgets explicitly report a shortfall", () => {
  const floor = cheapestComplete()!; assert.ok(floor.totalUsd > 0);
  for (const budget of [0, floor.totalUsd - 1, NaN, Infinity]) assert.equal(autoBuild(budget, "office", "1080p").status, "short");
});
for (const use of USE_CASES) test(`autobuild ${use.id} respects the budget and has no compatibility conflicts`, () => {
  const result = autoBuild(2000, use.id, "1440p"); assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const analysis = analyze(result.picks, "1440p"); assert.equal(analysis.conflict, false);
  assert.ok(result.totalUsd <= 2000); assert.equal(result.totalUsd, analysis.totalUsd);
  for (const slot of ["cpu", "motherboard", "ram", "ssd", "psu", "cooler", "case"] as const) assert.ok(result.picks[slot], slot);
});
