import {
  Box,
  CircuitBoard,
  Cpu,
  Fan,
  HardDrive,
  MemoryStick,
  Microchip,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SlotId } from "@/lib/pc/types";

const ICONS: Record<SlotId, LucideIcon> = {
  cpu: Cpu,
  gpu: Microchip,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  ssd: HardDrive,
  psu: Zap,
  cooler: Fan,
  case: Box,
};

export function SlotIcon({ slot, className }: { slot: SlotId; className?: string }) {
  const Icon = ICONS[slot];
  return <Icon className={className} strokeWidth={1.75} />;
}
