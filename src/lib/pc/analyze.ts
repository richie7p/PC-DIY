import { getPart, partsIn } from "./catalog";
import { HEADROOM_LABEL, RESOLUTIONS } from "./labels";
import { SLOT_META } from "./slots";
import { SLOT_IDS } from "./types";
import type {
  Analysis,
  Bottleneck,
  CasePart,
  Check,
  CheckFix,
  CoolerPart,
  CpuPart,
  Fit,
  MoboPart,
  Part,
  Picks,
  PowerEst,
  RamPart,
  Resolution,
  Resolved,
  Scores,
  SlotId,
  Summary,
} from "./types";

const RES = {
  "1080p": { gpu: 0.5, cpu: 0.36, ram: 0.09, ssd: 0.05, gapStart: 10, gapMul: 0.55, mod: 10, high: 20 },
  "1440p": { gpu: 0.6, cpu: 0.26, ram: 0.09, ssd: 0.05, gapStart: 16, gapMul: 0.35, mod: 14, high: 24 },
  "4k": { gpu: 0.72, cpu: 0.14, ram: 0.09, ssd: 0.05, gapStart: 26, gapMul: 0.16, mod: 22, high: 34 },
} as const;

export function resolvePicks(picks: Picks): Resolved {
  const out: Resolved = {};
  for (const [slot, id] of Object.entries(picks) as [SlotId, string | undefined][]) {
    if (!id) continue;
    const part = getPart(id);
    if (!part || part.slot !== slot) continue;
    (out as Record<string, Part>)[slot] = part;
  }
  return out;
}

export function totalPrice(parts: Resolved): number {
  return (Object.values(parts) as Part[]).reduce((sum, p) => sum + p.priceUsd, 0);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function gpuAtRes(gaming: number, res: Resolution): number {
  if (res === "1080p") return clamp(gaming + (100 - gaming) * 0.15);
  if (res === "4k") return clamp(gaming - (100 - gaming) * 0.4);
  return gaming;
}

export function estimatePower(parts: Resolved): PowerEst {
  const cpuW = parts.cpu ? parts.cpu.tdp * 0.85 : 0;
  const gpuW = parts.gpu ? parts.gpu.tdp : 0;
  const rest =
    (parts.motherboard ? 35 : 0) +
    (parts.ram ? 12 : 0) +
    (parts.ssd ? 8 : 0) +
    (parts.cpu || parts.gpu ? 15 : 0);
  const watts = Math.round(cpuW + gpuW + rest);
  const recommended = Math.ceil((watts * 1.35) / 50) * 50;
  const psu = parts.psu?.wattage ?? 0;
  let headroom: PowerEst["headroom"] = "Tight";
  if (!parts.psu) headroom = "Undersized";
  else if (psu < watts * 1.05) headroom = "Undersized";
  else if (psu < watts * 1.18) headroom = "Tight";
  else if (psu < watts * 1.32) headroom = "Adequate";
  else if (psu < watts * 1.5) headroom = "Comfortable";
  else headroom = "Lots";
  return { watts, recommended: Math.max(recommended, 550), headroom };
}

function ramFit(ram: RamPart, mobo: MoboPart): Fit {
  const fail: string[] = [];
  const warn: string[] = [];
  if (ram.type !== mobo.ramType) fail.push(`這組記憶體是 ${ram.type}，主機板要 ${mobo.ramType}。`);
  if (ram.sticks > mobo.ramSlots) fail.push(`套條有 ${ram.sticks} 根，主機板只有 ${mobo.ramSlots} 槽。`);
  if (ram.capacityGb > mobo.maxRamGb) fail.push(`主機板最多支援 ${mobo.maxRamGb} GB。`);
  if (ram.sticks === 1) warn.push("單通道記憶體會明顯吃掉效能，建議改雙通道。");
  if (ram.speed > mobo.ratedSpeed + 400) {
    warn.push(`主機板標定 DDR5-${mobo.ratedSpeed}。更快的套條常常只是放寬時序。`);
  }
  return { fail, warn };
}

function coolerFit(cooler: CoolerPart, cpu: CpuPart | undefined, pcCase: CasePart | undefined): Fit {
  const fail: string[] = [];
  const warn: string[] = [];
  if (cpu) {
    if (cooler.tdpRating < cpu.tdp * 0.85) {
      fail.push(`${cpu.name} 是 ${cpu.tdp} W，這顆散熱大約只扛 ${cooler.tdpRating} W。`);
    } else if (cooler.tdpRating < cpu.tdp * 1.05) {
      warn.push("散熱剛好卡在這顆 CPU 的功耗邊上，全核時可能被壓頻。");
    }
  }
  if (pcCase) {
    if (cooler.heightMm != null && cooler.heightMm > pcCase.coolerMaxMm) {
      fail.push(`散熱高度 ${cooler.heightMm} mm，機殼淨空只有 ${pcCase.coolerMaxMm} mm。`);
    }
    if (cooler.radiatorMm != null && !pcCase.radiators.includes(cooler.radiatorMm)) {
      fail.push(`這款機殼裝不了 ${cooler.radiatorMm} mm 水冷排。`);
    }
  }
  return { fail, warn };
}

export function fitPart(part: Part, others: Resolved): Fit {
  const fail: string[] = [];
  const warn: string[] = [];
  const cpu = others.cpu;
  const gpu = others.gpu;
  const mobo = others.motherboard;
  const ram = others.ram;
  const pcCase = others.case;
  const psu = others.psu;
  const cooler = others.cooler;

  if (part.slot === "cpu") {
    if (mobo && part.socket !== mobo.socket) {
      fail.push(`${part.name} 是 ${part.socket}，主機板是 ${mobo.socket}。`);
    }
    if (mobo && part.tdp >= 160 && mobo.vrm === "entry") {
      warn.push("入門 VRM 搭配這顆高功耗 CPU，全核負載可能過熱。");
    }
    if (cooler) {
      const c = coolerFit(cooler, part, pcCase);
      fail.push(...c.fail);
      warn.push(...c.warn);
    }
  }

  if (part.slot === "motherboard") {
    if (cpu && part.socket !== cpu.socket) {
      fail.push(`主機板是 ${part.socket}，CPU 是 ${cpu.socket}。`);
    }
    if (pcCase && !pcCase.supports.includes(part.form)) {
      fail.push(`${part.form} 主機板裝不進這款機殼。`);
    }
    if (cpu && cpu.tdp >= 160 && part.vrm === "entry") {
      warn.push("入門 VRM 搭配這顆高功耗 CPU，全核負載可能過熱。");
    }
    if (ram) {
      const r = ramFit(ram, part);
      fail.push(...r.fail);
      warn.push(...r.warn);
    }
  }

  if (part.slot === "gpu") {
    if (pcCase && part.lengthMm > pcCase.gpuMaxMm) {
      fail.push(`顯示卡長 ${part.lengthMm} mm，機殼 GPU 淨空只有 ${pcCase.gpuMaxMm} mm。`);
    } else if (pcCase && part.lengthMm > pcCase.gpuMaxMm - 12) {
      warn.push("顯示卡長度只剩幾毫米餘裕，請核對實際公板／非公版長度。");
    }
    if (part.tdp >= 400 && psu && !psu.atx31) {
      warn.push("高功耗顯示卡配非 ATX 3.1 電源，建議改用原生 12V-2×6。");
    }
  }

  if (part.slot === "ram") {
    if (mobo) {
      const r = ramFit(part, mobo);
      fail.push(...r.fail);
      warn.push(...r.warn);
    }
  }

  if (part.slot === "psu") {
    const power = estimatePower({ ...others, psu: part });
    if (part.wattage < power.watts * 1.08) {
      fail.push(`預估功耗約 ${power.watts} W，${part.wattage} W 電源不夠。`);
    } else if (part.wattage < power.watts * 1.25) {
      warn.push(`預估功耗約 ${power.watts} W，${part.wattage} W 電源餘裕偏少。`);
    }
    if ((gpu?.tdp ?? 0) >= 400 && !part.atx31) {
      warn.push("高功耗 NVIDIA 卡建議配 ATX 3.1、原生 12V-2×6 電源。");
    }
  }

  if (part.slot === "cooler") {
    const c = coolerFit(part, cpu, pcCase);
    fail.push(...c.fail);
    warn.push(...c.warn);
  }

  if (part.slot === "case") {
    if (mobo && !part.supports.includes(mobo.form)) {
      fail.push(`${mobo.form} 主機板裝不進這款機殼。`);
    }
    if (gpu && gpu.lengthMm > part.gpuMaxMm) {
      fail.push(`顯示卡長 ${gpu.lengthMm} mm，這款機殼只清 ${part.gpuMaxMm} mm。`);
    }
    if (cooler) {
      const c = coolerFit(cooler, cpu, part);
      fail.push(...c.fail);
      warn.push(...c.warn);
    }
  }

  return { fail: [...new Set(fail)], warn: [...new Set(warn)] };
}

export function cheapestFit(slot: SlotId, others: Resolved): Part | undefined {
  return partsIn(slot)
    .filter((p) => fitPart(p, others).fail.length === 0)
    .sort((a, b) => a.priceUsd - b.priceUsd)[0];
}

export type SlotChange = {
  slot: SlotId;
  fromName: string | null;
  toName: string | null;
  dUsd: number;
};

export function slotDiffs(current: Picks, baseline: Picks): SlotChange[] {
  const cur = resolvePicks(current);
  const base = resolvePicks(baseline);
  const out: SlotChange[] = [];
  for (const slot of SLOT_IDS) {
    const a = base[slot];
    const b = cur[slot];
    if ((a?.id ?? null) === (b?.id ?? null)) continue;
    out.push({
      slot,
      fromName: a?.name ?? null,
      toName: b?.name ?? null,
      dUsd: (b?.priceUsd ?? 0) - (a?.priceUsd ?? 0),
    });
  }
  return out;
}

function missingSlots(parts: Resolved): SlotId[] {
  const missing: SlotId[] = [];
  for (const slot of SLOT_META) {
    if (slot.id === "gpu") {
      if (!parts.gpu && parts.cpu && !parts.cpu.igpu) missing.push("gpu");
      continue;
    }
    if (slot.required && !parts[slot.id]) missing.push(slot.id);
  }
  return missing;
}

export function runChecks(parts: Resolved, resolution: Resolution): Check[] {
  const checks: Check[] = [];
  const missing = missingSlots(parts);

  if (missing.length) {
    checks.push({
      id: "incomplete",
      severity: "fail",
      title: "還沒組完",
      detail: `還缺：${missing.map((id) => SLOT_META.find((s) => s.id === id)?.short ?? id).join("、")}。`,
    });
  }

  if (parts.cpu && parts.motherboard) {
    if (parts.cpu.socket === parts.motherboard.socket) {
      checks.push({
        id: "socket",
        severity: "ok",
        title: `腳位 ${parts.cpu.socket} 相符`,
        detail: `${parts.cpu.name} 可以上這張 ${parts.motherboard.chipset} 主機板。`,
      });
    } else {
      checks.push({
        id: "socket",
        severity: "fail",
        title: "CPU 腳位不合",
        detail: `${parts.cpu.name} 是 ${parts.cpu.socket}，${parts.motherboard.name} 是 ${parts.motherboard.socket}。`,
      });
    }
    if (parts.cpu.tdp >= 160 && parts.motherboard.vrm === "entry") {
      checks.push({
        id: "vrm",
        severity: "warn",
        title: "主機板 VRM 偏入門",
        detail: "170 W 級處理器放在入門供電上，全核時可能過熱降頻。",
      });
    }
  }

  if (parts.ram && parts.motherboard) {
    const r = ramFit(parts.ram, parts.motherboard);
    if (!r.fail.length && !r.warn.length) {
      checks.push({
        id: "ram",
        severity: "ok",
        title: "記憶體相容",
        detail: `${parts.ram.capacityGb} GB DDR5-${parts.ram.speed}，${parts.ram.sticks} 根。`,
      });
    }
    for (const d of r.fail) checks.push({ id: "ram-fail", severity: "fail", title: "記憶體裝不了", detail: d });
    for (const d of r.warn) checks.push({ id: "ram-warn", severity: "warn", title: "記憶體要注意", detail: d });
  }

  if (parts.motherboard && parts.case) {
    if (parts.case.supports.includes(parts.motherboard.form)) {
      checks.push({
        id: "mobo-form",
        severity: "ok",
        title: `${parts.motherboard.form} 主機板放得進`,
        detail: `${parts.case.name} 支援 ${parts.case.supports.join(" / ")}。`,
      });
    } else {
      checks.push({
        id: "mobo-form",
        severity: "fail",
        title: "主機板放不進機殼",
        detail: `${parts.motherboard.form} 超過這款機殼能裝的尺寸。`,
      });
    }
  }

  if (parts.gpu && parts.case) {
    if (parts.gpu.lengthMm > parts.case.gpuMaxMm) {
      checks.push({
        id: "gpu-length",
        severity: "fail",
        title: "顯示卡太長，機殼裝不下",
        detail: `${parts.gpu.name} 長 ${parts.gpu.lengthMm} mm，淨空 ${parts.case.gpuMaxMm} mm。長度是常見非公版估算。`,
      });
    } else if (parts.gpu.lengthMm > parts.case.gpuMaxMm - 12) {
      checks.push({
        id: "gpu-length",
        severity: "warn",
        title: "顯示卡淨空很緊",
        detail: `只剩 ${parts.case.gpuMaxMm - parts.gpu.lengthMm} mm 餘裕，請核對實際卡長。`,
      });
    } else {
      checks.push({
        id: "gpu-length",
        severity: "ok",
        title: "顯示卡長度沒問題",
        detail: `${parts.gpu.lengthMm} mm 的卡，機殼淨空 ${parts.case.gpuMaxMm} mm。`,
      });
    }
  }

  if (parts.cooler) {
    const c = coolerFit(parts.cooler, parts.cpu, parts.case);
    if (!c.fail.length && !c.warn.length && parts.cpu) {
      checks.push({
        id: "cooler",
        severity: "ok",
        title: "散熱蓋得住這顆 CPU",
        detail: `標定約 ${parts.cooler.tdpRating} W，CPU 是 ${parts.cpu.tdp} W。`,
      });
    }
    for (const d of c.fail) checks.push({ id: "cooler-fail", severity: "fail", title: "散熱裝不下", detail: d });
    for (const d of c.warn) checks.push({ id: "cooler-warn", severity: "warn", title: "散熱偏緊", detail: d });
  }

  const power = estimatePower(parts);
  if (parts.psu) {
    if (power.headroom === "Undersized") {
      checks.push({
        id: "psu",
        severity: "fail",
        title: "電源瓦數不夠",
        detail: `預估功耗約 ${power.watts} W，${parts.psu.wattage} W 不夠——這是估算，不是實驗室數字。`,
      });
    } else if (power.headroom === "Tight") {
      checks.push({
        id: "psu",
        severity: "warn",
        title: "電源餘裕偏緊",
        detail: `預估約 ${power.watts} W，電源 ${parts.psu.wattage} W。顯示卡特態峰值可能跳電。`,
      });
    } else {
      checks.push({
        id: "psu",
        severity: "ok",
        title: `電源餘裕${HEADROOM_LABEL[power.headroom]}`,
        detail: `預估約 ${power.watts} W，電源 ${parts.psu.wattage} W。建議約 ${power.recommended} W。`,
      });
    }
    if ((parts.gpu?.tdp ?? 0) >= 400 && !parts.psu.atx31) {
      checks.push({
        id: "atx31",
        severity: "warn",
        title: "沒有 ATX 3.1 接頭",
        detail: "高功耗 NVIDIA 卡建議用原生 12V-2×6 電源。",
      });
    }
  }

  if (!parts.gpu && parts.cpu && !parts.cpu.igpu) {
    checks.push({
      id: "display",
      severity: "fail",
      title: "沒有畫面輸出",
      detail: "這顆 CPU 沒有內顯，需要獨立顯示卡。",
    });
  } else if (!parts.gpu && parts.cpu?.igpu) {
    checks.push({
      id: "display",
      severity: "warn",
      title: "目前走內顯",
      detail: "文書沒問題。遊戲和本地 AI 會明顯受限。",
    });
  }

  if (parts.cpu && parts.gpu) {
    const cfg = RES[resolution];
    const delta = gpuAtRes(parts.gpu.gaming, resolution) - parts.cpu.gaming;
    if (delta >= cfg.high) {
      checks.push({
        id: "imbalance",
        severity: "warn",
        title: "顯示卡明顯快過處理器",
        detail: `${resolution} 下遊戲會比較吃 CPU。換更強的處理器，或改打更高解析度，會比較平衡。`,
      });
    } else if (delta <= -cfg.high) {
      checks.push({
        id: "imbalance",
        severity: "warn",
        title: "處理器明顯快過顯示卡",
        detail: "遊戲裡你幾乎感覺不到多出來的 CPU——瓶頸在顯示卡。",
      });
    }
  }

  if (parts.gpu && parts.gpu.vramGb <= 8 && parts.gpu.cuda) {
    checks.push({
      id: "vram",
      severity: "warn",
      title: "8 GB 顯存跑本地 AI 偏緊",
      detail: "量化後的 7B 模型還跑得動。16 GB 以上才比較舒服。",
    });
  }

  if (parts.gpu && (parts.gpu.ai >= 70 || parts.gpu.vramGb >= 16) && (parts.ram?.capacityGb ?? 0) < 32) {
    checks.push({
      id: "ai-ram",
      severity: "warn",
      title: "記憶體對本地 AI 偏少",
      detail: "顯示卡開始載模型之後，32 GB 是實務下限。",
    });
  }

  const ranked = attachFixes(checks, parts, missing);
  ranked.sort((a, b) => rankOf(a.severity) - rankOf(b.severity));
  return ranked;
}

function rankOf(severity: Check["severity"]): number {
  if (severity === "fail") return 0;
  if (severity === "warn") return 1;
  return 2;
}

function attachFixes(checks: Check[], parts: Resolved, missing: SlotId[]): Check[] {
  return checks.map((c) => {
    const fixes = fixesFor(c, parts, missing);
    return fixes?.length ? { ...c, fixes } : c;
  });
}

function dualRam(mobo: MoboPart | undefined): RamPart | undefined {
  const rams = partsIn("ram") as RamPart[];
  return rams
    .filter((r) => r.sticks >= 2 && (!mobo || ramFit(r, mobo).fail.length === 0))
    .sort((a, b) => a.priceUsd - b.priceUsd)[0];
}

function biggerRam(mobo: MoboPart | undefined, minGb: number): RamPart | undefined {
  const rams = partsIn("ram") as RamPart[];
  return rams
    .filter((r) => r.sticks >= 2 && r.capacityGb >= minGb && (!mobo || ramFit(r, mobo).fail.length === 0))
    .sort((a, b) => a.priceUsd - b.priceUsd)[0];
}

function without(parts: Resolved, slot: SlotId): Resolved {
  const next = { ...parts };
  delete next[slot];
  return next;
}

function swapFix(slot: SlotId, parts: Resolved, label: (p: Part) => string, fallback: string): CheckFix {
  const alt = cheapestFit(slot, without(parts, slot));
  if (alt && alt.id !== parts[slot]?.id) {
    return { label: label(alt), slot, partId: alt.id };
  }
  return { label: fallback, slot };
}

function fixesFor(c: Check, parts: Resolved, missing: SlotId[]): CheckFix[] | undefined {
  if (c.severity === "ok") return undefined;
  if (c.id === "socket" && c.severity === "fail") {
    return [
      swapFix("motherboard", parts, (p) => `換成 ${p.name}`, "查看相容主機板"),
      { label: "查看相容處理器", slot: "cpu" },
    ];
  }
  if (c.id === "mobo-form") {
    return [swapFix("case", parts, (p) => `換成 ${p.name}`, "查看相容機殼")];
  }
  if (c.id === "gpu-length") {
    return [swapFix("case", parts, (p) => `換成裝得進的機殼（${p.name}）`, "查看裝得進的機殼")];
  }
  if (c.id === "ram-fail" || (c.id === "ram-warn" && (parts.ram?.sticks ?? 2) === 1)) {
    const dual = dualRam(parts.motherboard);
    if (dual && dual.id !== parts.ram?.id) {
      return [{ label: "改雙通道記憶體", slot: "ram", partId: dual.id }];
    }
    return [{ label: "改雙通道記憶體", slot: "ram" }];
  }
  if (c.id === "ram-warn") {
    return [{ label: "查看記憶體", slot: "ram" }];
  }
  if (c.id === "cooler-fail" || c.id === "cooler-warn") {
    return [swapFix("cooler", parts, (p) => `換成 ${p.name}`, "查看相容散熱")];
  }
  if (c.id === "psu" || c.id === "atx31") {
    return [swapFix("psu", parts, (p) => `換成 ${p.slot === "psu" ? p.wattage : ""} W 電源`, "查看足夠的電源")];
  }
  if (c.id === "vrm") {
    return [{ label: "查看更高階主機板", slot: "motherboard" }];
  }
  if (c.id === "display") {
    if (!parts.gpu && parts.cpu && !parts.cpu.igpu) {
      return [swapFix("gpu", parts, (p) => `加上 ${p.name}`, "查看顯示卡")];
    }
    return [{ label: "查看顯示卡", slot: "gpu" }];
  }
  if (c.id === "imbalance") {
    if (c.title.includes("顯示卡明顯快")) return [{ label: "查看處理器", slot: "cpu" }];
    return [{ label: "查看顯示卡", slot: "gpu" }];
  }
  if (c.id === "vram") {
    return [{ label: "查看顯示卡", slot: "gpu" }];
  }
  if (c.id === "ai-ram") {
    const ram = biggerRam(parts.motherboard, 32);
    if (ram) return [{ label: "換成 32GB 以上記憶體", slot: "ram", partId: ram.id }];
    return [{ label: "查看記憶體", slot: "ram" }];
  }
  if (c.id === "incomplete") {
    const slot = missing[0];
    if (!slot) return undefined;
    const label = SLOT_META.find((s) => s.id === slot)?.label ?? slot;
    return [{ label: `去選${label}`, slot }];
  }
  return undefined;
}

function ramScore(ram: RamPart | undefined): number {
  if (!ram) return 20;
  let s = 40;
  if (ram.capacityGb >= 16) s = 55;
  if (ram.capacityGb >= 32) s = 82;
  if (ram.capacityGb >= 64) s = 94;
  if (ram.capacityGb >= 96) s = 98;
  if (ram.sticks === 1) s -= 18;
  if (ram.speed >= 6000) s += 4;
  return clamp(s);
}

function ssdScore(ssd: Resolved["ssd"]): number {
  if (!ssd) return 25;
  let s = 55;
  if (ssd.capacityTb >= 2) s = 78;
  if (ssd.capacityTb >= 4) s = 90;
  if (ssd.gen === "Gen5") s += 6;
  return clamp(s);
}

function vramAi(vram: number): number {
  if (vram >= 32) return 96;
  if (vram >= 24) return 84;
  if (vram >= 16) return 68;
  if (vram >= 12) return 52;
  if (vram >= 8) return 36;
  return 18;
}

function scoreBuild(parts: Resolved, checks: Check[], resolution: Resolution): Scores {
  const cpu = parts.cpu;
  const gpu = parts.gpu;
  const ram = ramScore(parts.ram);
  const ssd = ssdScore(parts.ssd);
  const failN = checks.filter((c) => c.severity === "fail").length;
  const penalty = failN * 8;
  const cfg = RES[resolution];

  const gpuGame = gpuAtRes(gpu?.gaming ?? (cpu?.igpu ? 22 : 8), resolution);
  const cpuGame = cpu?.gaming ?? 20;
  let gaming = gpuGame * cfg.gpu + cpuGame * cfg.cpu + ram * cfg.ram + ssd * cfg.ssd;
  const gap = gpuGame - cpuGame;
  if (gap > cfg.gapStart) gaming -= (gap - cfg.gapStart) * cfg.gapMul;
  if (!gpu) gaming = Math.min(gaming, 32);

  const vram = gpu ? vramAi(gpu.vramGb) : 10;
  const cudaBoost = gpu?.cuda ? 10 : gpu ? -8 : 0;
  const cpuAi = cpu?.ai ?? 20;
  const ramAi = parts.ram ? (parts.ram.capacityGb >= 64 ? 92 : parts.ram.capacityGb >= 32 ? 74 : 38) : 20;
  let localAi = vram * 0.48 + cpuAi * 0.2 + ramAi * 0.22 + ssd * 0.1 + cudaBoost;
  if (!gpu) localAi = Math.min(localAi, 28);

  const cpuCreate = cpu?.creator ?? 20;
  const gpuCreate = gpu?.creator ?? 18;
  let creation = cpuCreate * 0.4 + gpuCreate * 0.3 + ram * 0.2 + ssd * 0.1;

  const single = cpu?.single ?? 20;
  const cores = cpu ? Math.min(100, 30 + cpu.cores * 3.2) : 20;
  let productivity = single * 0.4 + cores * 0.22 + ram * 0.2 + ssd * 0.18;
  if (!cpu) productivity = 10;

  const gamingN = clamp(gaming - penalty);
  const aiN = clamp(localAi - penalty);
  const createN = clamp(creation - penalty);
  const prodN = clamp(productivity - penalty);

  const perf = gamingN * 0.4 + aiN * 0.15 + createN * 0.2 + prodN * 0.25;
  const usd = totalPrice(parts);
  const dpp = usd <= 0 ? 99 : usd / Math.max(perf, 1);
  let value = 100 - (dpp - 8) * 2.15;
  if (missingSlots(parts).length) value -= 12;
  value -= failN * 10;
  if (usd < 400) value -= 8;

  return {
    gaming: gamingN,
    localAi: aiN,
    creation: createN,
    productivity: prodN,
    value: clamp(value),
  };
}

export function bottleneckOf(parts: Resolved, resolution: Resolution): Bottleneck | null {
  const cpu = parts.cpu;
  if (!cpu) return null;
  const gpu = parts.gpu;
  const resLabel = resolution === "4k" ? "4K" : resolution;

  if (!gpu) {
    return {
      level: "High",
      reason: cpu.igpu
        ? "沒有獨立顯示卡。內顯會卡住遊戲和本地 AI。"
        : "完全沒有顯示輸出——這台機器無法接螢幕。",
    };
  }

  const cfg = RES[resolution];
  const delta = gpuAtRes(gpu.gaming, resolution) - cpu.gaming;
  if (delta >= cfg.high) {
    return {
      level: "High",
      reason: `${gpu.name} 在 ${resLabel} 明顯快過 ${cpu.name}。低解析度時 CPU 會拖幀；拉高解析度會比較看不出來。`,
    };
  }
  if (delta >= cfg.mod) {
    return {
      level: "Moderate",
      reason: `在 ${resLabel}，顯示卡還有餘力，處理器餵不太滿。能用；換更快的 CPU 會再挖出一些幀數。`,
    };
  }
  if (delta <= -cfg.high) {
    return {
      level: "High",
      reason: `${cpu.name} 遠快過這張顯示卡。遊戲裡多出來的 CPU 幾乎感覺不到——天花板在顯卡。`,
    };
  }
  if (delta <= -cfg.mod) {
    return {
      level: "Moderate",
      reason: "CPU 還有遊戲用不到的餘裕。若你也會輸出、直播或跑模型，這樣配是合理的。",
    };
  }
  return {
    level: "Low",
    reason: `${cpu.name} 和 ${gpu.name} 在 ${resLabel} 落在同一帶。沒有明顯浪費。`,
  };
}

function summarize(
  parts: Resolved,
  scores: Scores,
  checks: Check[],
  missing: SlotId[],
  resolution: Resolution,
): Summary {
  if (Object.keys(parts).length === 0) {
    return { title: "空機殼", tagline: "先載入預設、依預算自動組，或從處理器和主機板開始。" };
  }
  const fails = checks.filter((c) => c.severity === "fail" && c.id !== "incomplete");
  if (fails.length) {
    const pri = ["socket", "mobo-form", "gpu-length", "ram-fail", "cooler-fail", "psu", "display"];
    const hard = pri.map((id) => fails.find((c) => c.id === id)).find(Boolean) ?? fails[0];
    return {
      title: "衝突的配置",
      tagline: hard.detail || hard.title,
    };
  }
  if (missing.length) {
    return {
      title: "還沒組完",
      tagline: `還開著：${missing.map((id) => SLOT_META.find((s) => s.id === id)?.short).join(" · ")}。`,
    };
  }

  const { gaming, localAi, creation, productivity, value } = scores;
  const gpu = parts.gpu;
  const vram = gpu?.vramGb ?? 0;
  const resLabel = resolution === "4k" ? "4K" : resolution;

  if (localAi >= 88 && vram >= 24 && localAi >= gaming) {
    return { title: "GPU 取向 AI 工作站", tagline: "為了把大模型留在本機，遊戲只是附帶。" };
  }
  if (localAi >= 76 && vram >= 16 && localAi >= gaming) {
    return { title: "本地 AI 工作站", tagline: "這台機器的重點是顯存和主記憶體。" };
  }
  if (localAi >= 60 && vram >= 12 && localAi >= gaming && gaming < 80) {
    return { title: "本地 AI 入門機", tagline: "小模型跑得動。別期待 70B 滿血品質。" };
  }
  if (creation >= 84 && (parts.cpu?.cores ?? 0) >= 12 && creation >= gaming + 5) {
    return { title: "創作工作站", tagline: "核心數、顯存和容量，夠餵輸出佇列和重時間軸。" };
  }
  if (resolution === "4k" && gaming >= 84 && (gpu?.gaming ?? 0) >= 88) {
    return { title: "4K 遊戲旗艦", tagline: "這個目錄裡的光柵上限。預算不是限制。" };
  }
  if (resolution === "1440p" && gaming >= 84) {
    return { title: "1440p 遊戲猛獸", tagline: "高更新 1440p，4K 當畫質選項而不是硬撐。" };
  }
  if (resolution === "1080p" && gaming >= 70) {
    return { title: "1080p 遊戲猛獸", tagline: "1080p 很兇，1440p 中高畫質也夠用。" };
  }
  if (gaming >= 92 && (gpu?.gaming ?? 0) >= 92) {
    return { title: "4K 遊戲旗艦", tagline: "這個目錄裡的光柵上限。預算不是限制。" };
  }
  if (gaming >= 84) {
    return { title: `${resLabel} 遊戲猛獸`, tagline: `針對 ${resLabel} 調過的高幀組合。` };
  }
  if (gaming >= 70) {
    return { title: `${resLabel} 遊戲主力`, tagline: `在 ${resLabel} 能打得舒適，不是極限旗艦。` };
  }
  if (productivity >= 60 && gaming < 50) {
    return { title: "安靜文書機", tagline: "文件、瀏覽器和輕創作。不是遊戲機。" };
  }
  if (gaming >= 58 && gpu) {
    return { title: "堪用的 1080p 遊戲機", tagline: "電競和現代遊戲在 1080p 沒有意外。" };
  }
  if (value >= 80 && totalPrice(parts) < 1200) {
    return { title: "高性價比中階", tagline: "零件合理、浪費少，沒有炫技。" };
  }
  return { title: "均衡中階主機", tagline: "沒有單一用途獨大。通用機器。" };
}

export function analyze(picks: Picks, resolution: Resolution = "1440p"): Analysis {
  const parts = resolvePicks(picks);
  const missing = missingSlots(parts);
  const checks = runChecks(parts, resolution);
  const scores = scoreBuild(parts, checks, resolution);
  const power = estimatePower(parts);
  const filled = (Object.values(parts) as Part[]).length;
  const conflict = checks.some((c) => c.severity === "fail" && c.id !== "incomplete");
  return {
    checks,
    scores,
    bottleneck: bottleneckOf(parts, resolution),
    power,
    totalUsd: totalPrice(parts),
    filled,
    missing,
    complete: missing.length === 0 && !checks.some((c) => c.severity === "fail"),
    conflict,
    summary: summarize(parts, scores, checks, missing, resolution),
  };
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function gamingAtResolutions(picks: Picks): { id: Resolution; label: string; gaming: number }[] {
  return RESOLUTIONS.map((r) => ({
    id: r.id,
    label: r.label,
    gaming: analyze(picks, r.id).scores.gaming,
  }));
}

export function partStats(part: Part): { label: string; value: string }[] {
  switch (part.slot) {
    case "cpu":
      return [
        { label: "腳位", value: part.socket },
        { label: "核心", value: `${part.cores}C / ${part.threads}T` },
        { label: "TDP", value: `${part.tdp} W` },
        { label: "內顯", value: part.igpu ? "有" : "無" },
      ];
    case "gpu":
      return [
        { label: "顯存", value: `${part.vramGb} GB` },
        { label: "TDP", value: `${part.tdp} W` },
        { label: "長度", value: `約 ${part.lengthMm} mm` },
        { label: "CUDA", value: part.cuda ? "有" : "無" },
      ];
    case "motherboard":
      return [
        { label: "腳位", value: part.socket },
        { label: "晶片組", value: part.chipset },
        { label: "尺寸", value: part.form },
        { label: "記憶體", value: `DDR5-${part.ratedSpeed}` },
      ];
    case "ram":
      return [
        { label: "容量", value: `${part.capacityGb} GB` },
        { label: "時脈", value: `DDR5-${part.speed}` },
        { label: "套條", value: `${part.sticks}×` },
        { label: "CL", value: String(part.cl) },
      ];
    case "ssd":
      return [
        { label: "容量", value: `${part.capacityTb} TB` },
        { label: "介面", value: `NVMe ${part.gen}` },
      ];
    case "psu":
      return [
        { label: "瓦數", value: `${part.wattage} W` },
        { label: "轉換", value: part.efficiency },
        { label: "ATX", value: part.atx31 ? "3.1" : "2.x" },
      ];
    case "cooler":
      return [
        { label: "形式", value: part.kind === "aio" ? "水冷" : part.kind === "stock" ? "原廠" : "風冷" },
        { label: "標定", value: `約 ${part.tdpRating} W` },
        {
          label: part.radiatorMm ? "冷排" : "高度",
          value: part.radiatorMm ? `${part.radiatorMm} mm` : `${part.heightMm} mm`,
        },
      ];
    case "case":
      return [
        { label: "板型", value: part.supports.join("/") },
        { label: "GPU", value: `${part.gpuMaxMm} mm` },
        { label: "散熱", value: `${part.coolerMaxMm} mm` },
        { label: "水冷", value: part.radiators.map((n) => `${n}`).join("/") },
      ];
  }
}
