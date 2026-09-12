import type { SlotId } from "./types";

export const SLOT_META: {
  id: SlotId;
  label: string;
  short: string;
  required: boolean;
}[] = [
  { id: "cpu", label: "處理器", short: "CPU", required: true },
  { id: "gpu", label: "顯示卡", short: "GPU", required: false },
  { id: "motherboard", label: "主機板", short: "主機板", required: true },
  { id: "ram", label: "記憶體", short: "RAM", required: true },
  { id: "ssd", label: "儲存", short: "SSD", required: true },
  { id: "psu", label: "電源", short: "PSU", required: true },
  { id: "cooler", label: "散熱", short: "散熱", required: true },
  { id: "case", label: "機殼", short: "機殼", required: true },
];

export const SLOT_INDEX: Record<SlotId, string> = {
  cpu: "01",
  gpu: "02",
  motherboard: "03",
  ram: "04",
  ssd: "05",
  psu: "06",
  cooler: "07",
  case: "08",
};
