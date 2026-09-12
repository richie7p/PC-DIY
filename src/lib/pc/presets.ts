import type { Picks, Resolution } from "./types";

export type Preset = {
  id: string;
  name: string;
  hint: string;
  resolution: Resolution;
  picks: Picks;
};

export const PRESETS: Preset[] = [
  {
    id: "1080",
    name: "1080p 遊戲",
    hint: "Ryzen 5 + 4060",
    resolution: "1080p",
    picks: {
      cpu: "cpu-r5-7600",
      gpu: "gpu-4060",
      motherboard: "mb-b650-matx",
      ram: "ram-32-6000",
      ssd: "ssd-1tb-g4",
      psu: "psu-650-g",
      cooler: "cool-tower",
      case: "case-matx",
    },
  },
  {
    id: "1440",
    name: "1440p 猛獸",
    hint: "X3D + 5070 Ti",
    resolution: "1440p",
    picks: {
      cpu: "cpu-r7-7800x3d",
      gpu: "gpu-5070ti",
      motherboard: "mb-x870-atx",
      ram: "ram-32-6000",
      ssd: "ssd-2tb-g4",
      psu: "psu-850-g",
      cooler: "cool-dual",
      case: "case-air",
    },
  },
  {
    id: "ai",
    name: "AI 工作站",
    hint: "9950X + 5090",
    resolution: "1440p",
    picks: {
      cpu: "cpu-r9-9950x",
      gpu: "gpu-5090",
      motherboard: "mb-x870e-atx",
      ram: "ram-64-6000",
      ssd: "ssd-4tb-g4",
      psu: "psu-1200-p",
      cooler: "cool-360",
      case: "case-full",
    },
  },
  {
    id: "create",
    name: "創作機",
    hint: "16 核 + 5080",
    resolution: "1440p",
    picks: {
      cpu: "cpu-r9-9950x",
      gpu: "gpu-5080",
      motherboard: "mb-x870e-atx",
      ram: "ram-64-6000",
      ssd: "ssd-2tb-g5",
      psu: "psu-1000-g",
      cooler: "cool-360",
      case: "case-air",
    },
  },
  {
    id: "office",
    name: "文書機",
    hint: "內顯、無獨顯",
    resolution: "1080p",
    picks: {
      cpu: "cpu-r5-7600",
      motherboard: "mb-b650-matx",
      ram: "ram-16-2x8",
      ssd: "ssd-1tb-g4",
      psu: "psu-550-br",
      cooler: "cool-stock",
      case: "case-matx",
    },
  },
];
