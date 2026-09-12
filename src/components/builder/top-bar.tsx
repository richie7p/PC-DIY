import { Check, Copy, Link2, RotateCcw, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { analyze, formatUsd } from "@/lib/pc/analyze";
import { cheapestComplete, floorPreview, USE_CASES } from "@/lib/pc/autobuild";
import { buildPlaintext } from "@/lib/pc/copy";
import { RESOLUTIONS } from "@/lib/pc/labels";
import { PRESETS } from "@/lib/pc/presets";
import { SLOT_IDS } from "@/lib/pc/types";
import { useBuildStore } from "@/lib/pc/store";
import { cn } from "@/lib/utils";

function samePicks(picks: Record<string, string | undefined>, presetPicks: Record<string, string | undefined>) {
  return SLOT_IDS.every((id) => (picks[id] ?? undefined) === (presetPicks[id] ?? undefined));
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export function TopBar() {
  const picks = useBuildStore((s) => s.picks);
  const budgetCap = useBuildStore((s) => s.budgetCap);
  const resolution = useBuildStore((s) => s.resolution);
  const applyPreset = useBuildStore((s) => s.applyPreset);
  const reset = useBuildStore((s) => s.reset);
  const setBudgetCap = useBuildStore((s) => s.setBudgetCap);
  const setResolution = useBuildStore((s) => s.setResolution);
  const autoOpen = useBuildStore((s) => s.autoOpen);
  const setAutoOpen = useBuildStore((s) => s.setAutoOpen);
  const autoFill = useBuildStore((s) => s.autoFill);
  const lastUseCase = useBuildStore((s) => s.lastUseCase);
  const autoOffer = useBuildStore((s) => s.autoOffer);
  const applyFloor = useBuildStore((s) => s.applyFloor);
  const dismissFloor = useBuildStore((s) => s.dismissFloor);
  const floorDismissed = useBuildStore((s) => s.floorDismissed);
  const analysis = analyze(picks, resolution);
  const over = analysis.totalUsd > budgetCap;
  const [copied, setCopied] = useState<"parts" | "link" | null>(null);
  const floor = cheapestComplete();
  const shortBy = floor ? Math.max(0, floor.totalUsd - budgetCap) : 0;
  const underFloor = Boolean(floor && shortBy > 0);

  async function onCopy() {
    await writeClipboard(buildPlaintext(picks, resolution));
    setCopied("parts");
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function onShare() {
    await writeClipboard(window.location.href);
    setCopied("link");
    window.setTimeout(() => setCopied(null), 1600);
  }

  const fill = budgetCap > 0 ? Math.min(100, (analysis.totalUsd / budgetCap) * 100) : 0;
  const resLabel = resolution === "4k" ? "4K" : resolution;

  return (
    <header className="border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-2 flex items-baseline gap-2.5">
          <span className="font-sans text-lg font-semibold tracking-tight text-fg">RIGFORGE</span>
          <span className="hidden font-mono text-xs tracking-widest text-faint sm:inline">組裝模擬</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={autoOpen ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setAutoOpen(!autoOpen);
            }}
            aria-expanded={autoOpen}
            aria-controls="auto-fill"
          >
            <Wand2 className="size-4" />
            自動組
          </Button>
          <Button variant="outline" size="sm" onClick={onShare} aria-label="複製分享連結">
            {copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
            <span className="hidden sm:inline">{copied === "link" ? "已複製連結" : "分享"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy} className="min-w-20">
            {copied === "parts" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "parts" ? "已複製" : "複製"}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-4" />
            清空
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 basis-full sm:basis-40">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="font-mono text-xs tracking-wide text-muted">花費</span>
            <span className={cn("font-mono text-sm tabular-nums", over ? "text-fail" : "text-fg")}>
              {formatUsd(analysis.totalUsd)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className={cn(
                "h-full rounded-full transition-[width,background-color] duration-200",
                over ? "bg-fail" : "bg-accent",
              )}
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>

        <label className="shrink-0">
          <span className="mb-1 block font-mono text-xs tracking-wide text-muted">預算</span>
          <span className="flex h-9 items-center rounded-md bg-elevated pl-2 shadow-[var(--shadow-border)] focus-within:shadow-[var(--shadow-border-hover)]">
            <span className="font-mono text-sm text-faint">$</span>
            <input
              type="number"
              min={100}
              max={20000}
              step={50}
              aria-label="預算上限（美元）"
              value={budgetCap}
              onChange={(e) => setBudgetCap(Number(e.target.value) || 0)}
              className="h-9 w-20 bg-transparent pr-2 text-right font-mono text-sm text-fg tabular-nums outline-none"
            />
          </span>
        </label>

        <div className="shrink-0">
          <div className="mb-1 font-mono text-xs tracking-wide text-muted">目標解析度</div>
          <div className="flex h-9 rounded-md bg-elevated p-0.5 shadow-[var(--shadow-border)]">
            {RESOLUTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setResolution(r.id)}
                aria-pressed={resolution === r.id}
                className={cn(
                  "h-8 rounded-sm px-2.5 font-mono text-xs transition-colors duration-150",
                  resolution === r.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <div className="mb-1 font-mono text-xs tracking-wide text-muted">預估功耗</div>
          <div className="h-9 font-mono text-sm leading-9 text-fg tabular-nums">約 {analysis.power.watts} W</div>
        </div>
      </div>

      {underFloor && floor ? (
        samePicks(picks, floor.picks) ? (
          <p className="mt-2 text-xs leading-relaxed text-warn">
            這是目錄最低完整配置，仍超過預算 {formatUsd(shortBy)}。自動組不會無聲超支。
          </p>
        ) : !floorDismissed ? (
          <div className="mt-3 rounded-lg bg-elevated px-3 py-2.5">
            <p className="text-sm leading-relaxed text-fg">
              目前目錄最低配置約 {formatUsd(floor.totalUsd)}，尚差 {formatUsd(shortBy)}。
              不會自動套用，原配裝仍在。
            </p>
            <p className="mt-1 text-xs text-muted">{floorPreview(floor.picks)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={applyFloor}>
                套用最低配置
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissFloor}>
                維持原配裝
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-warn">
            目前目錄最低配置約 {formatUsd(floor.totalUsd)}，尚差 {formatUsd(shortBy)}。自動組不會無聲超支。
          </p>
        )
      ) : null}

      {autoOpen ? (
        <div
          id="auto-fill"
          className="mt-3 rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]"
        >
          <div className="font-mono text-xs text-faint">
            依 {formatUsd(budgetCap)}／{resLabel} 自動組一套相容配置，分數與價格皆為估算
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {USE_CASES.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => autoFill(u.id)}
                title={u.blurb}
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
                  lastUseCase === u.id
                    ? "bg-accent text-accent-fg"
                    : "text-muted shadow-[var(--shadow-border)] hover:text-fg hover:shadow-[var(--shadow-border-hover)]",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
          {autoOffer && (floorDismissed || !underFloor) ? (
            <div className="mt-3 rounded-md bg-elevated px-3 py-2.5">
              <p className="text-sm leading-relaxed text-fg">
                目前目錄最低配置約 {formatUsd(autoOffer.cheapestUsd)}，尚差 {formatUsd(autoOffer.shortfall)}。
                不會自動套用，原配裝仍在。
              </p>
              <p className="mt-1 text-xs text-muted">{floorPreview(autoOffer.picks)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={applyFloor}>
                  套用最低配置
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissFloor}>
                  維持原配裝
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="no-scrollbar -mx-4 mt-3 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:px-0">
        {PRESETS.map((p) => {
          const on = samePicks(picks, p.picks);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.picks, p.resolution)}
              className={cn(
                "h-9 shrink-0 rounded-md px-3 font-medium text-sm transition-[background-color,color,box-shadow] duration-150",
                on
                  ? "bg-accent text-accent-fg"
                  : "text-muted shadow-[var(--shadow-border)] hover:text-fg hover:shadow-[var(--shadow-border-hover)]",
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    </header>
  );
}
