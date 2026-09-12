import { analyze } from "@/lib/pc/analyze";
import { useBuildStore } from "@/lib/pc/store";
import type { Scores } from "@/lib/pc/types";

const ROWS: { key: keyof Scores; label: string }[] = [
  { key: "gaming", label: "遊戲" },
  { key: "localAi", label: "AI" },
  { key: "creation", label: "創作" },
  { key: "productivity", label: "文書" },
  { key: "value", label: "性價" },
];

export function MobileDock() {
  const picks = useBuildStore((s) => s.picks);
  const resolution = useBuildStore((s) => s.resolution);
  const scores = analyze(picks, resolution).scores;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-bg/95 px-1 py-2 backdrop-blur-sm lg:hidden">
      {ROWS.map((row) => (
        <a
          key={row.key}
          href="#build-report"
          className="flex flex-col items-center gap-0.5 py-1 text-center"
        >
          <span className="font-mono text-sm text-fg tabular-nums">{scores[row.key]}</span>
          <span className="font-mono text-xs tracking-wide text-faint">{row.label}</span>
        </a>
      ))}
    </div>
  );
}
