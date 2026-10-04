import { getPart } from "./catalog";
import { SLOT_IDS, type Picks, type Resolution } from "./types";
export function normalizeBuild(raw: unknown): { picks: Picks; budgetCap: number; resolution: Resolution } {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const values = data.picks && typeof data.picks === "object" ? data.picks as Record<string, unknown> : {};
  const picks: Picks = {};
  for (const slot of SLOT_IDS) {
    const id = values[slot];
    if (typeof id === "string" && getPart(id)?.slot === slot) picks[slot] = id;
  }
  const n = data.budgetCap;
  return { picks, budgetCap: typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(20_000, Math.round(n))) : 1500,
    resolution: data.resolution === "1080p" || data.resolution === "4k" ? data.resolution : "1440p" };
}
