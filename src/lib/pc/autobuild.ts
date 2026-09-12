import { analyze, estimatePower, fitPart, formatUsd, resolvePicks } from "./analyze";
import { partsIn } from "./catalog";
import { HEADROOM_LABEL } from "./labels";
import type {
  CasePart,
  CoolerPart,
  CpuPart,
  GpuPart,
  MoboPart,
  Part,
  Picks,
  PsuPart,
  RamPart,
  Resolution,
  Resolved,
  Scores,
  SlotId,
  SsdPart,
} from "./types";

export type UseCase = "gaming" | "localAi" | "creation" | "office" | "value";

export const USE_CASES: { id: UseCase; label: string; blurb: string }[] = [
  { id: "gaming", label: "遊戲", blurb: "幀數優先，顯卡吃較多預算" },
  { id: "localAi", label: "本地 AI", blurb: "顯存與主記憶體優先" },
  { id: "creation", label: "創作", blurb: "核心數、顯存、容量" },
  { id: "office", label: "文書", blurb: "內顯、安靜、少浪費" },
  { id: "value", label: "性價比", blurb: "每分預算換最多效能" },
];

export type AutoOffer = {
  cheapestUsd: number;
  shortfall: number;
  picks: Picks;
};

export type AutoBuildOk = {
  status: "ok";
  picks: Picks;
  totalUsd: number;
  reasons: string[];
};

export type AutoBuildShort = {
  status: "short";
  cheapestUsd: number;
  shortfall: number;
  picks: Picks;
  reasons: string[];
};

export type AutoBuildResult = AutoBuildOk | AutoBuildShort;

function objective(scores: Scores, useCase: UseCase, totalUsd: number, budget: number, power?: { headroom: string }): number {
  const over = Math.max(0, totalUsd - budget);
  const spend = Math.min(1, totalUsd / Math.max(budget, 1));
  let core = 0;
  switch (useCase) {
    case "gaming":
      core = scores.gaming * 0.9 + scores.value * 0.1;
      core += spend * 1.2;
      break;
    case "localAi":
      core = scores.localAi * 0.8 + scores.value * 0.2;
      core += spend * 1.4;
      break;
    case "creation":
      core = scores.creation * 0.72 + scores.value * 0.28;
      core += spend * 1.4;
      break;
    case "office":
      core = scores.productivity * 0.48 + scores.value * 0.52;
      core -= Math.max(0, scores.gaming - 42) * 0.18;
      break;
    case "value":
      core = scores.value * 0.55 + scores.gaming * 0.2 + scores.productivity * 0.15 + scores.creation * 0.1;
      break;
  }
  const psuPen =
    power?.headroom === "Undersized" ? 14 : power?.headroom === "Tight" ? 8 : 0;
  return core - over * 0.35 - psuPen;
}

function list<T extends Part>(slot: T["slot"]): T[] {
  return partsIn(slot) as T[];
}

function toPicks(parts: Resolved): Picks {
  const picks: Picks = {};
  (Object.entries(parts) as [SlotId, Part | undefined][]).forEach(([slot, part]) => {
    if (part) picks[slot] = part.id;
  });
  return picks;
}

function pickFit<T extends Part>(
  items: T[],
  others: Resolved,
  budgetLeft: number,
  score: (p: T) => number,
  allowOver = false,
): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const p of items) {
    if (p.priceUsd > budgetLeft) continue;
    if (fitPart(p, others).fail.length) continue;
    const s = score(p);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  if (best || !allowOver) return best;
  for (const p of items) {
    if (fitPart(p, others).fail.length) continue;
    const s = score(p) - p.priceUsd * 0.02;
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

function pairHint(cpu: CpuPart, gpu: GpuPart | undefined, useCase: UseCase, res: Resolution): number {
  const price = cpu.priceUsd + (gpu?.priceUsd ?? 0);
  const den = Math.max(price, 1);
  let gpuGame = gpu?.gaming ?? (cpu.igpu ? 22 : 6);
  if (res === "1080p") gpuGame = gpuGame + (100 - gpuGame) * 0.15;
  if (res === "4k") gpuGame = gpuGame - (100 - gpuGame) * 0.4;
  if (useCase === "gaming") return (gpuGame * 0.62 + cpu.gaming * 0.38) / den;
  if (useCase === "localAi") return ((gpu?.vramGb ?? 0) * 4 + (gpu?.ai ?? 8) + cpu.ai * 0.25) / den;
  if (useCase === "creation") return (cpu.creator * 0.55 + (gpu?.creator ?? 12) * 0.45) / den;
  if (useCase === "office") return (cpu.single * 1.2 + (cpu.igpu ? 20 : 0) - (gpu ? 40 : 0)) / den;
  return (gpuGame * 0.4 + cpu.single * 0.25 + cpu.creator * 0.15) / den;
}

function fillRest(
  cpu: CpuPart,
  gpu: GpuPart | undefined,
  budget: number,
  useCase: UseCase,
  allowOver = false,
): Resolved | null {
  const spent0 = cpu.priceUsd + (gpu?.priceUsd ?? 0);
  const base: Resolved = gpu ? { cpu, gpu } : { cpu };
  const remain0 = budget - spent0;

  const mobo = pickFit(list<MoboPart>("motherboard"), base, remain0, (m) => {
    let q = 3;
    if (cpu.tdp >= 160 && m.vrm === "entry") q = 0.4;
    else if (cpu.tdp >= 160 && m.vrm === "high") q = 4;
    else if (m.vrm === "mid") q = 3.2;
    if (useCase === "office" && m.form !== "ATX") q += 0.4;
    return q * 4000 - m.priceUsd;
  }, allowOver);
  if (!mobo) return null;

  const afterMobo: Resolved = { ...base, motherboard: mobo };
  const remain1 = remain0 - mobo.priceUsd;

  const pcCase = pickFit(list<CasePart>("case"), afterMobo, remain1, (c) => {
    let q = 4000 - c.priceUsd;
    if (useCase === "office" || useCase === "value") {
      if (c.gpuMaxMm >= 420) q -= 80;
    }
    return q;
  }, allowOver);
  if (!pcCase) return null;

  const afterCase: Resolved = { ...afterMobo, case: pcCase };
  const remain2 = remain1 - pcCase.priceUsd;

  const cooler = pickFit(list<CoolerPart>("cooler"), afterCase, remain2, (c) => {
    const cover = c.tdpRating >= cpu.tdp * 1.15 ? 3 : c.tdpRating >= cpu.tdp * 0.95 ? 2 : 0.2;
    return cover * 3000 - c.priceUsd;
  }, allowOver);
  if (!cooler) return null;

  const afterCool: Resolved = { ...afterCase, cooler };
  const remain3 = remain2 - cooler.priceUsd;

  const ram = pickFit(list<RamPart>("ram"), afterCool, remain3, (r) => {
    if (r.sticks === 1) return -500;
    if (useCase === "localAi" || useCase === "creation") {
      if (r.capacityGb >= 64) return 9000 - r.priceUsd;
      if (r.capacityGb >= 32) return 6000 - r.priceUsd;
      return 2000 - r.priceUsd;
    }
    if (useCase === "office") {
      if (r.capacityGb === 16 && r.sticks === 2) return 8000 - r.priceUsd;
      if (r.capacityGb <= 32) return 5000 - r.priceUsd;
      return 1000 - r.priceUsd;
    }
    if (r.capacityGb === 32) return 8000 - r.priceUsd;
    if (r.capacityGb >= 64) return 3500 - r.priceUsd;
    return 2500 - r.priceUsd;
  }, allowOver);
  if (!ram) return null;

  const afterRam: Resolved = { ...afterCool, ram };
  const remain4 = remain3 - ram.priceUsd;

  const ssd = pickFit(list<SsdPart>("ssd"), afterRam, remain4, (s) => {
    if (useCase === "creation" || useCase === "localAi") {
      return s.capacityTb * 2500 - s.priceUsd + (s.gen === "Gen5" ? 80 : 0);
    }
    return 8000 - s.priceUsd - Math.max(0, s.capacityTb - 1) * 200;
  }, allowOver);
  if (!ssd) return null;

  const afterSsd: Resolved = { ...afterRam, ssd };
  const remain5 = remain4 - ssd.priceUsd;

  const psu = pickFit(list<PsuPart>("psu"), afterSsd, remain5, (p) => {
    const power = estimatePower({ ...afterSsd, psu: p });
    if (p.wattage < power.watts * 1.08) return -1e6;
    if (p.wattage < power.watts * 1.22) return 400 - p.priceUsd;
    let q = 7200 - p.priceUsd;
    if (p.efficiency === "Bronze") q -= 500;
    if ((gpu?.tdp ?? 0) >= 220 && p.atx31) q += 800;
    if (p.wattage > power.watts * 2.5) q -= 280;
    return q;
  }, allowOver);
  if (!psu) return null;

  return { ...afterSsd, psu };
}

const UPGRADE: Record<UseCase, SlotId[]> = {
  gaming: ["psu", "gpu", "cpu", "ram", "ssd", "cooler", "motherboard", "case"],
  localAi: ["psu", "gpu", "ram", "ssd", "cpu", "cooler", "motherboard", "case"],
  creation: ["psu", "cpu", "gpu", "ram", "ssd", "cooler", "motherboard", "case"],
  office: ["cpu", "ram", "ssd", "motherboard", "cooler", "case", "psu"],
  value: ["psu", "gpu", "cpu", "ram", "ssd", "motherboard", "cooler", "case"],
};

function upgrade(picks: Picks, budget: number, useCase: UseCase, resolution: Resolution): Picks {
  let current = picks;
  let a = analyze(current, resolution);
  for (let round = 0; round < 2; round++) {
    for (const slot of UPGRADE[useCase]) {
      const resolved = resolvePicks(current);
      const others = { ...resolved };
      delete others[slot];
      const currentPart = resolved[slot];
      let bestId: string | undefined;
      let bestScore = objective(a.scores, useCase, a.totalUsd, budget, a.power);
      for (const cand of partsIn(slot)) {
        if (cand.id === currentPart?.id) continue;
        if (fitPart(cand, others).fail.length) continue;
        const next = { ...current, [slot]: cand.id };
        const nextA = analyze(next, resolution);
        if (nextA.checks.some((c) => c.severity === "fail")) continue;
        if (nextA.totalUsd > budget) continue;
        const sc = objective(nextA.scores, useCase, nextA.totalUsd, budget, nextA.power);
        if (sc > bestScore + 0.25) {
          bestScore = sc;
          bestId = cand.id;
        }
      }
      if (bestId) {
        current = { ...current, [slot]: bestId };
        a = analyze(current, resolution);
      }
    }
  }
  return current;
}

export function explainBuild(
  picks: Picks,
  useCase: UseCase,
  budget: number,
  resolution: Resolution,
): string[] {
  const parts = resolvePicks(picks);
  const a = analyze(picks, resolution);
  const reasons: string[] = [];
  const gpuShare = parts.gpu && a.totalUsd ? Math.round((parts.gpu.priceUsd / a.totalUsd) * 100) : 0;

  if (useCase === "gaming" && parts.gpu) {
    reasons.push(`為了遊戲效能，把較多預算分給 GPU（${parts.gpu.name}，約 ${gpuShare}%）。`);
  } else if (useCase === "localAi" && parts.gpu) {
    reasons.push(`本地 AI 看顯存：${parts.gpu.name} ${parts.gpu.vramGb} GB。`);
  } else if (useCase === "creation" && parts.cpu) {
    reasons.push(`創作用核心與顯存：${parts.cpu.name}${parts.gpu ? ` + ${parts.gpu.name}` : ""}。`);
  } else if (useCase === "office" && !parts.gpu) {
    reasons.push("沒用獨顯，走內顯壓低功耗與花費。");
  } else if (useCase === "value" && parts.gpu) {
    reasons.push(`性價比取向：顯卡拿 ${parts.gpu.name}，沒追旗艦。`);
  }

  if (parts.ram) {
    if ((useCase === "gaming" || useCase === "value") && parts.ram.capacityGb <= 32 && parts.ram.sticks >= 2) {
      reasons.push(`記憶體維持 ${parts.ram.capacityGb} GB 雙通道，這是遊戲甜點，差額留給顯卡。`);
    } else if (parts.ram.capacityGb >= 64) {
      reasons.push(`記憶體 ${parts.ram.capacityGb} GB，給創作／模型留空間。`);
    } else if (parts.ram.sticks === 1) {
      reasons.push("目前是單通道記憶體，效能會留在桌上。");
    } else {
      reasons.push(`記憶體 ${parts.ram.capacityGb} GB 雙通道。`);
    }
  }

  if (parts.psu) {
    reasons.push(
      `電源 ${parts.psu.wattage} W，預估功耗約 ${a.power.watts} W，餘裕${HEADROOM_LABEL[a.power.headroom]}。`,
    );
  }

  const leftover = budget - a.totalUsd;
  if (leftover >= 80) {
    reasons.push(`預算還剩 ${formatUsd(leftover)}，沒硬加用不到的零件。`);
  }

  return reasons.slice(0, 4);
}

function fillCheapest(cpu: CpuPart): Resolved | null {
  const base: Resolved = { cpu };
  const cheapest = <T extends Part>(slot: T["slot"], others: Resolved, score: (p: T) => number) =>
    pickFit(list<T>(slot), others, 20000, score, true);

  const mobo = cheapest<MoboPart>("motherboard", base, (m) => -m.priceUsd);
  if (!mobo) return null;
  const afterMobo: Resolved = { ...base, motherboard: mobo };

  const pcCase = cheapest<CasePart>("case", afterMobo, (c) => -c.priceUsd);
  if (!pcCase) return null;
  const afterCase: Resolved = { ...afterMobo, case: pcCase };

  const cooler = cheapest<CoolerPart>("cooler", afterCase, (c) => {
    if (c.tdpRating < cpu.tdp * 0.85) return -1e6;
    return -c.priceUsd;
  });
  if (!cooler) return null;
  const afterCool: Resolved = { ...afterCase, cooler };

  const ram = cheapest<RamPart>("ram", afterCool, (r) => (r.sticks < 2 ? -1e6 : -r.priceUsd));
  if (!ram) return null;
  const afterRam: Resolved = { ...afterCool, ram };

  const ssd = cheapest<SsdPart>("ssd", afterRam, (s) => -s.priceUsd);
  if (!ssd) return null;
  const afterSsd: Resolved = { ...afterRam, ssd };

  const psu = cheapest<PsuPart>("psu", afterSsd, (p) => {
    const power = estimatePower({ ...afterSsd, psu: p });
    if (p.wattage < power.watts * 1.08) return -1e6;
    return -p.priceUsd;
  });
  if (!psu) return null;
  return { ...afterSsd, psu };
}

let floorCache: { picks: Picks; totalUsd: number } | null | undefined;

export function cheapestComplete(): { picks: Picks; totalUsd: number } | null {
  if (floorCache !== undefined) return floorCache;
  const cpus = list<CpuPart>("cpu")
    .filter((c) => c.igpu)
    .sort((a, b) => a.priceUsd - b.priceUsd);
  let best: { picks: Picks; totalUsd: number } | null = null;
  for (const cpu of cpus.slice(0, 6)) {
    const filled = fillCheapest(cpu);
    if (!filled) continue;
    const picks = toPicks(filled);
    const a = analyze(picks, "1080p");
    if (a.conflict) continue;
    if (!best || a.totalUsd < best.totalUsd) best = { picks, totalUsd: a.totalUsd };
  }
  floorCache = best;
  return best;
}

export function floorPreview(picks: Picks): string {
  const p = resolvePicks(picks);
  const bits: string[] = [];
  if (p.cpu) bits.push(p.cpu.name);
  bits.push(p.gpu ? p.gpu.name : "內顯、無獨顯");
  if (p.ram) bits.push(`${p.ram.capacityGb} GB`);
  return bits.join(" · ");
}

function shortResult(budget: number): AutoBuildShort | AutoBuildOk {
  const floor = cheapestComplete();
  if (!floor) {
    return {
      status: "short",
      cheapestUsd: 0,
      shortfall: Math.max(0, 500 - budget),
      picks: {},
      reasons: ["這個目錄組不出完整的一套。"],
    };
  }
  const shortfall = Math.max(0, floor.totalUsd - budget);
  if (shortfall <= 0) {
    return {
      status: "ok",
      picks: floor.picks,
      totalUsd: floor.totalUsd,
      reasons: ["這是目錄裡能組完的最低配置。", ...explainBuild(floor.picks, "office", budget, "1080p")].slice(0, 4),
    };
  }
  return {
    status: "short",
    cheapestUsd: floor.totalUsd,
    shortfall,
    picks: floor.picks,
    reasons: [
      `目前目錄最低配置約 ${formatUsd(floor.totalUsd)}，尚差 ${formatUsd(shortfall)}。`,
      "自動組不會無聲超支。要的話再套用最低配置。",
    ],
  };
}

export function autoBuild(budget: number, useCase: UseCase, resolution: Resolution): AutoBuildResult {
  const cap = Math.max(0, Math.round(budget));
  const floor = cheapestComplete();
  if (floor && cap + 1 < floor.totalUsd) {
    return shortResult(cap);
  }

  const cpus = list<CpuPart>("cpu");
  const gpus = list<GpuPart>("gpu");
  const wantGpu = useCase !== "office";
  const restNeed = wantGpu ? 480 : 360;

  type Pair = { cpu: CpuPart; gpu?: GpuPart; hint: number };
  const pairs: Pair[] = [];

  for (const cpu of cpus) {
    if (cpu.priceUsd > cap * 0.5) continue;
    if (wantGpu) {
      for (const gpu of gpus) {
        if (cpu.priceUsd + gpu.priceUsd > cap - restNeed) continue;
        pairs.push({ cpu, gpu, hint: pairHint(cpu, gpu, useCase, resolution) });
      }
      if (cpu.igpu && (useCase === "value" || cap < 900)) {
        pairs.push({ cpu, hint: pairHint(cpu, undefined, useCase, resolution) });
      }
    } else if (cpu.igpu) {
      pairs.push({ cpu, hint: pairHint(cpu, undefined, useCase, resolution) });
    }
  }

  if (!pairs.length) {
    const cpu = cpus.filter((c) => c.igpu).sort((a, b) => a.priceUsd - b.priceUsd)[0];
    if (cpu) pairs.push({ cpu, hint: 1 });
  }

  const beam = pairs.sort((a, b) => b.hint - a.hint).slice(0, 22);

  let best: { picks: Picks; score: number; total: number } | null = null;

  for (const { cpu, gpu } of beam) {
    const filled = fillRest(cpu, gpu, cap, useCase, false);
    if (!filled) continue;
    let picks = toPicks(filled);
    const first = analyze(picks, resolution);
    if (first.conflict || first.totalUsd > cap) continue;
    picks = upgrade(picks, cap, useCase, resolution);
    const a = analyze(picks, resolution);
    if (a.conflict || a.totalUsd > cap) continue;
    const score = objective(a.scores, useCase, a.totalUsd, cap, a.power);
    if (!best || score > best.score) best = { picks, score, total: a.totalUsd };
  }

  if (!best) return shortResult(cap);

  return {
    status: "ok",
    picks: best.picks,
    totalUsd: best.total,
    reasons: explainBuild(best.picks, useCase, cap, resolution),
  };
}
