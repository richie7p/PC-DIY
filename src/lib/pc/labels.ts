import type { Bottleneck, PowerEst, Resolution } from "./types";

export const HEADROOM_LABEL: Record<PowerEst["headroom"], string> = {
  Undersized: "不足",
  Tight: "偏緊",
  Adequate: "足夠",
  Comfortable: "充裕",
  Lots: "很充裕",
};

export const BOTTLENECK_LABEL: Record<Bottleneck["level"], string> = {
  Low: "低",
  Moderate: "中",
  High: "高",
};

export const RESOLUTIONS: { id: Resolution; label: string }[] = [
  { id: "1080p", label: "1080p" },
  { id: "1440p", label: "1440p" },
  { id: "4k", label: "4K" },
];

export const SCORE_LABELS = {
  gaming: "遊戲",
  localAi: "本地 AI",
  creation: "影像創作",
  productivity: "生產力",
  value: "性價比",
} as const;

export const FAMILY_ALL = "全部";

export const SCORE_SHORT = {
  gaming: "遊戲",
  localAi: "AI",
  creation: "創作",
  productivity: "生產",
  value: "性價比",
} as const;
