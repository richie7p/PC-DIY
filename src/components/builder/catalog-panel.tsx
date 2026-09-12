import { Search } from "lucide-react";
import { SlotIcon } from "@/components/builder/slot-icon";
import { fitPart, formatUsd, partStats, resolvePicks } from "@/lib/pc/analyze";
import { partsIn } from "@/lib/pc/catalog";
import { FAMILY_ALL } from "@/lib/pc/labels";
import { SLOT_META } from "@/lib/pc/slots";
import { useBuildStore } from "@/lib/pc/store";
import type { Part } from "@/lib/pc/types";
import { cn } from "@/lib/utils";

function familiesOf(list: Part[]): string[] {
  const set = new Set(list.map((p) => p.family));
  return [FAMILY_ALL, ...set];
}

export function CatalogPanel() {
  const activeSlot = useBuildStore((s) => s.activeSlot);
  const picks = useBuildStore((s) => s.picks);
  const query = useBuildStore((s) => s.query);
  const family = useBuildStore((s) => s.family);
  const compatibleOnly = useBuildStore((s) => s.compatibleOnly);
  const setQuery = useBuildStore((s) => s.setQuery);
  const setFamily = useBuildStore((s) => s.setFamily);
  const setCompatibleOnly = useBuildStore((s) => s.setCompatibleOnly);
  const selectPart = useBuildStore((s) => s.selectPart);

  const meta = SLOT_META.find((s) => s.id === activeSlot)!;
  const all = partsIn(activeSlot);
  const families = familiesOf(all);
  const resolved = resolvePicks(picks);
  const others = { ...resolved };
  delete others[activeSlot];

  const q = query.trim().toLowerCase();
  const rows = all.filter((p) => {
    if (family !== FAMILY_ALL && p.family !== family) return false;
    if (q && !`${p.name} ${p.brand} ${p.blurb}`.toLowerCase().includes(q)) return false;
    if (compatibleOnly && fitPart(p, others).fail.length) return false;
    return true;
  });

  return (
    <section id="catalog" className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
      <div className="border-b border-border px-4 py-3 lg:px-5">
        <div className="flex items-center gap-2">
          <SlotIcon slot={activeSlot} className="size-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-tight">{meta.label}</h2>
          <span className="font-mono text-xs text-faint">{all.length} 件</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`搜尋${meta.label}…`}
              className="h-10 w-full rounded-lg bg-elevated pr-3 pl-9 text-sm text-fg outline-none shadow-[var(--shadow-border)] placeholder:text-faint focus:shadow-[var(--shadow-border-hover)]"
            />
          </label>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-muted shadow-[var(--shadow-border)]">
            <input
              type="checkbox"
              checked={compatibleOnly}
              onChange={(e) => setCompatibleOnly(e.target.checked)}
              className="size-4 accent-accent"
            />
            只看裝得進
          </label>
        </div>
        {compatibleOnly ? (
          <p className="mt-2 font-mono text-xs text-accent">只列出裝得進目前其他零件的。</p>
        ) : null}
        {families.length > 2 ? (
          <div className="mt-2 flex gap-1.5">
            {families.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                className={cn(
                  "h-8 rounded-md px-2.5 font-mono text-xs tracking-wide transition-colors duration-150",
                  family === f ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-4">
        {rows.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">沒有符合篩選的零件。</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-2">
            {rows.map((part) => {
              const selected = picks[activeSlot] === part.id;
              const fit = fitPart(part, others);
              const stats = partStats(part);
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => selectPart(part.slot, part.id)}
                    className={cn(
                      "flex h-full w-full flex-col rounded-xl p-3.5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.99]",
                      selected
                        ? "bg-elevated shadow-[var(--shadow-border-hover)]"
                        : "bg-surface shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs tracking-wide text-faint uppercase">{part.brand}</div>
                        <div className="mt-0.5 text-sm font-semibold leading-snug text-fg">{part.name}</div>
                      </div>
                      <div className="font-mono text-sm text-accent tabular-nums">{formatUsd(part.priceUsd)}</div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{part.blurb}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
                      {stats.map((s) => (
                        <div key={s.label} className="flex justify-between gap-2">
                          <dt className="text-faint">{s.label}</dt>
                          <dd className="text-fg tabular-nums">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {fit.fail.length ? (
                      <div className="mt-3 font-mono text-xs text-fail">{fit.fail[0]}</div>
                    ) : fit.warn.length ? (
                      <div className="mt-3 font-mono text-xs text-warn">{fit.warn[0]}</div>
                    ) : selected ? (
                      <div className="mt-3 font-mono text-xs text-accent">已裝備</div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
