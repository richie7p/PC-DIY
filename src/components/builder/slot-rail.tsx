import { X } from "lucide-react";
import { SlotIcon } from "@/components/builder/slot-icon";
import { formatUsd, fitPart, resolvePicks } from "@/lib/pc/analyze";
import { SLOT_INDEX, SLOT_META } from "@/lib/pc/slots";
import { useBuildStore } from "@/lib/pc/store";
import { cn } from "@/lib/utils";

export function SlotRail() {
  const picks = useBuildStore((s) => s.picks);
  const activeSlot = useBuildStore((s) => s.activeSlot);
  const setActiveSlot = useBuildStore((s) => s.setActiveSlot);
  const clearSlot = useBuildStore((s) => s.clearSlot);
  const parts = resolvePicks(picks);

  return (
    <aside className="border-b border-border lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:border-r lg:border-b-0">
      <div className="hidden items-center justify-between px-4 py-3 lg:flex">
        <span className="font-mono text-xs tracking-widest text-faint">配裝</span>
        <span className="font-mono text-xs text-muted tabular-nums">
          {Object.keys(parts).length}/8
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 lg:hidden">
          {SLOT_META.map((slot) => {
            const part = parts[slot.id];
            const on = activeSlot === slot.id;
            const others = { ...parts };
            delete others[slot.id];
            const clash = Boolean(part && fitPart(part, others).fail.length);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setActiveSlot(slot.id)}
                className={cn(
                  "flex h-11 min-w-20 shrink-0 items-center gap-2 rounded-lg px-3 text-left transition-[background-color,box-shadow,color] duration-150",
                  on ? "bg-elevated text-fg shadow-[var(--shadow-border-hover)]" : "text-muted shadow-[var(--shadow-border)]",
                )}
              >
                <SlotIcon slot={slot.id} className={cn("size-4 shrink-0", clash && "text-fail")} />
                <span className={cn("max-w-28 truncate font-mono text-xs", clash && "text-fail")}>
                  {part ? part.name : slot.short}
                </span>
              </button>
            );
          })}
      </div>

      <nav className="hidden min-h-0 flex-1 overflow-y-auto px-3 pb-4 lg:block">
        <ul className="flex flex-col gap-1.5">
          {SLOT_META.map((slot) => {
            const part = parts[slot.id];
            const on = activeSlot === slot.id;
            const others = { ...parts };
            delete others[slot.id];
            const clash = Boolean(part && fitPart(part, others).fail.length);
            return (
              <li key={slot.id}>
                <div
                  className={cn(
                    "group relative rounded-lg transition-[background-color,box-shadow] duration-150",
                    on ? "bg-elevated shadow-[var(--shadow-border-hover)]" : "hover:bg-surface",
                    clash && "ring-1 ring-fail",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSlot(slot.id)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="mt-0.5 font-mono text-xs text-faint tabular-nums">
                      {SLOT_INDEX[slot.id]}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                        clash ? "bg-fail/15 text-fail" : part ? "bg-accent/15 text-accent" : "bg-bg text-faint",
                      )}
                    >
                      <SlotIcon slot={slot.id} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs tracking-wide text-faint">
                        {slot.short}
                      </span>
                      <span className={cn("block truncate text-sm", clash ? "text-fail" : part ? "text-fg" : "text-muted")}>
                        {part ? part.name : "未安裝"}
                      </span>
                      {part ? (
                        <span className="mt-0.5 block font-mono text-xs text-muted tabular-nums">
                          {formatUsd(part.priceUsd)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {part ? (
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.id)}
                      className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-bg hover:text-fg"
                      aria-label={`移除${slot.label}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
