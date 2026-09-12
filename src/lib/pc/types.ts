export const SLOT_IDS = [
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "ssd",
  "psu",
  "cooler",
  "case",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export type Socket = "AM5" | "LGA1700" | "LGA1851";
export type FormFactor = "ITX" | "mATX" | "ATX";
export type RamType = "DDR5";
export type VrmTier = "entry" | "mid" | "high";
export type CoolerKind = "stock" | "air" | "aio";
export type PsuEff = "Bronze" | "Gold" | "Platinum";
export type NvmeGen = "Gen4" | "Gen5";
export type BrandFamily = "AMD" | "Intel" | "NVIDIA" | "Other";

export type BasePart = {
  id: string;
  name: string;
  brand: string;
  family: BrandFamily;
  priceUsd: number;
  blurb: string;
};

export type CpuPart = BasePart & {
  slot: "cpu";
  socket: Socket;
  cores: number;
  threads: number;
  tdp: number;
  igpu: boolean;
  gaming: number;
  creator: number;
  ai: number;
  single: number;
};

export type GpuPart = BasePart & {
  slot: "gpu";
  vramGb: number;
  tdp: number;
  lengthMm: number;
  gaming: number;
  creator: number;
  ai: number;
  cuda: boolean;
};

export type MoboPart = BasePart & {
  slot: "motherboard";
  socket: Socket;
  chipset: string;
  form: FormFactor;
  ramType: RamType;
  ramSlots: number;
  maxRamGb: number;
  ratedSpeed: number;
  vrm: VrmTier;
  wifi: boolean;
};

export type RamPart = BasePart & {
  slot: "ram";
  type: RamType;
  speed: number;
  capacityGb: number;
  sticks: number;
  cl: number;
};

export type SsdPart = BasePart & {
  slot: "ssd";
  capacityTb: number;
  gen: NvmeGen;
};

export type PsuPart = BasePart & {
  slot: "psu";
  wattage: number;
  efficiency: PsuEff;
  atx31: boolean;
};

export type CoolerPart = BasePart & {
  slot: "cooler";
  kind: CoolerKind;
  tdpRating: number;
  heightMm: number | null;
  radiatorMm: number | null;
};

export type CasePart = BasePart & {
  slot: "case";
  supports: FormFactor[];
  gpuMaxMm: number;
  coolerMaxMm: number;
  radiators: number[];
};

export type Part =
  | CpuPart
  | GpuPart
  | MoboPart
  | RamPart
  | SsdPart
  | PsuPart
  | CoolerPart
  | CasePart;

export type Resolution = "1080p" | "1440p" | "4k";

export type Picks = Partial<Record<SlotId, string>>;

export type Resolved = {
  [K in SlotId]?: Extract<Part, { slot: K }>;
};

export type CheckSeverity = "fail" | "warn" | "ok";

export type CheckFix = {
  label: string;
  slot: SlotId;
  partId?: string;
};

export type Check = {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  fixes?: CheckFix[];
};


export type Scores = {
  gaming: number;
  localAi: number;
  creation: number;
  productivity: number;
  value: number;
};

export type Bottleneck = {
  level: "Low" | "Moderate" | "High";
  reason: string;
};

export type PowerEst = {
  watts: number;
  recommended: number;
  headroom: "Undersized" | "Tight" | "Adequate" | "Comfortable" | "Lots";
};

export type Summary = {
  title: string;
  tagline: string;
};

export type Analysis = {
  checks: Check[];
  scores: Scores;
  bottleneck: Bottleneck | null;
  power: PowerEst;
  totalUsd: number;
  filled: number;
  missing: SlotId[];
  complete: boolean;
  conflict: boolean;
  summary: Summary;
};


export type Fit = {
  fail: string[];
  warn: string[];
};
