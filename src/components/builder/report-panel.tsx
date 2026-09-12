import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Gamepad2,
  Briefcase,
  Bot,
  Pin,
  PinOff,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreRadar } from "@/components/builder/score-radar";
import { analyze, formatUsd, gamingAtResolutions, slotDiffs } from "@/lib/pc/analyze";
import { BOTTLENECK_LABEL, HEADROOM_LABEL, SCORE_LABELS } from "@/lib/pc/labels";
import { SLOT_META } from "@/lib/pc/slots";
import { SLOT_IDS } from "@/lib/pc/types";
import { useBuildStore } from "@/lib/pc/store";
import type { Analysis, Check, CheckFix, CheckSeverity, Picks, Scores } from "@/lib/pc/types";
import { cn } from "@/lib/utils";

const SCORE_ROWS: { key: keyof Scores; label: string; icon: typeof Gamepad2 }[] = [
  { key: "gaming", label: SCORE_LABELS.gaming, icon: Gamepad2 },
  { key: "localAi", label: SCORE_LABELS.localAi, icon: Bot },
  { key: "creation", label: SCORE_LABELS.creation, icon: Clapperboard },
  { key: "productivity", label: SCORE_LABELS.productivity, icon: Briefcase },
  { key: "value", label: SCORE_LABELS.value, icon: Scale },
];

function SeverityIcon({ severity }: { severity: CheckSeverity }) {
  if (severity === "fail") return <CircleAlert className="size-3.5 text-fail" />;
  if (severity === "warn") return <AlertTriangle className="size-3.5 text-warn" />;
  return <CheckCircle2 className="size-3.5 text-ok" />;
}

function bottleneckTone(level: "Low" | "Moderate" | "High") {
  if (level === "High") return "text-fail";
  if (level === "Moderate") return "text-warn";
  return "text-ok";
}

function samePicks(a: Picks, b: Picks) {
  return SLOT_IDS.every((id) => (a[id] ?? undefined) === (b[id] ?? undefined));
}

function deltaClass(n: number) {
  if (n > 0) return "text-ok";
  if (n < 0) return "text-fail";
  return "text-faint";
}

function formatDelta(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatUsdDelta(n: number) {
  const abs = formatUsd(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

function spendStory(cur: Analysis, base: Analysis): string {
  const dUsd = cur.totalUsd - base.totalUsd;
  const dW = cur.power.watts - base.power.watts;
  const deltas = SCORE_ROWS.map((row) => ({
    label: row.label,
    d: cur.scores[row.key] - base.scores[row.key],
  })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const top = deltas.filter((x) => Math.abs(x.d) >= 4).slice(0, 2);
  const scoreBit = top.map((x) => `${x.label} ${formatDelta(x.d)}`).join("、");
  const wattBit = dW === 0 ? "" : `；預估功耗${dW > 0 ? "多" : "少"} ${Math.abs(dW)} W`;
  if (dUsd >= 40) {
    return `多花 ${formatUsd(dUsd)}，${scoreBit ? `主要換到${scoreBit}` : "零件組合不同"}${wattBit}。`;
  }
  if (dUsd <= -40) {
    return `少花 ${formatUsd(Math.abs(dUsd))}，${scoreBit || "配置較精簡"}${wattBit}。`;
  }
  return `花費接近（${formatUsdDelta(dUsd)}），${scoreBit || "配置細節不同"}${wattBit}。`;
}

function CompatibilityList({
  checks,
  onFix,
}: {
  checks: Check[];
  onFix: (fix: CheckFix) => void;
}) {
  if (checks.length === 0) {
    return <p className="text-sm text-muted">選零件後會即時檢查。</p>;
  }
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={`${c.id}-${i}`} className="flex gap-2.5 rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]">
          <span className="mt-0.5 shrink-0">
            <SeverityIcon severity={c.severity} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-fg">{c.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">{c.detail}</span>
            {c.fixes?.length ? (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {c.fixes.map((fix) => (
                  <button
                    key={`${fix.slot}-${fix.label}`}
                    type="button"
                    onClick={() => onFix(fix)}
                    className="h-8 rounded-md px-2.5 font-mono text-xs text-accent shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
                  >
                    {fix.label}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReportPanel() {
  const picks = useBuildStore((s) => s.picks);
  const resolution = useBuildStore((s) => s.resolution);
  const setResolution = useBuildStore((s) => s.setResolution);
  const pin = useBuildStore((s) => s.pin);
  const pinCurrent = useBuildStore((s) => s.pinCurrent);
  const clearPin = useBuildStore((s) => s.clearPin);
  const autoReasons = useBuildStore((s) => s.autoReasons);
  const applyFix = useBuildStore((s) => s.applyFix);
  const a = analyze(picks, resolution);
  const pinA = pin ? analyze(pin.picks, resolution) : null;
  const pinnedSame = pin ? samePicks(pin.picks, picks) : false;
  const canPin = a.filled > 0;
  const resRows = a.filled >= 2 ? gamingAtResolutions(picks) : [];
  const comparing = Boolean(pinA && pin && !pinnedSame);
  const changes = comparing && pin ? slotDiffs(picks, pin.picks) : [];

  function onFix(fix: CheckFix) {
    applyFix(fix.slot, fix.partId);
    window.requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const checksBlock = (
    <div>
      <div className="mb-2 font-mono text-xs tracking-widest text-faint">相容性</div>
      <CompatibilityList checks={a.checks} onFix={onFix} />
    </div>
  );

  return (
    <aside id="build-report" className="flex flex-col border-t border-border lg:h-full lg:overflow-hidden lg:border-t-0 lg:border-l">
      <div className="space-y-5 px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-5">
        <div className="rise-in">
          <div className="flex items-start justify-between gap-3">
            <div className="font-mono text-xs tracking-widest text-faint">組裝摘要</div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPin && !pin}
              onClick={() => (pin ? clearPin() : pinCurrent())}
              className="h-8 px-2 text-xs"
            >
              {pin ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {pin ? "取消對照" : "釘選對照"}
            </Button>
          </div>
          <h2 className={cn("mt-1 text-xl font-semibold tracking-tight", a.conflict ? "text-fail" : "text-fg")}>
            {a.summary.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{a.summary.tagline}</p>
          {autoReasons?.length ? (
            <ul className="mt-3 space-y-1.5">
              {autoReasons.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-muted">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {a.conflict ? checksBlock : null}

        {comparing && pinA && pin ? (
          <div className="rounded-xl bg-surface p-3.5 shadow-[var(--shadow-border)]">
            <div className="font-mono text-xs tracking-widest text-faint">對照釘選組</div>
            <div className="mt-1 text-sm text-fg">{pin.title}</div>
            <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <dt className="text-faint">價差</dt>
                <dd className={cn("mt-0.5 text-sm tabular-nums", a.totalUsd - pinA.totalUsd > 0 ? "text-warn" : "text-ok")}>
                  {formatUsdDelta(a.totalUsd - pinA.totalUsd)}
                </dd>
              </div>
              <div>
                <dt className="text-faint">功耗差</dt>
                <dd className="mt-0.5 text-sm text-fg tabular-nums">
                  {formatDelta(a.power.watts - pinA.power.watts)} W
                </dd>
              </div>
              {SCORE_ROWS.map((row) => {
                const d = a.scores[row.key] - pinA.scores[row.key];
                return (
                  <div key={row.key}>
                    <dt className="text-faint">{row.label}</dt>
                    <dd className={cn("mt-0.5 text-sm tabular-nums", deltaClass(d))}>{formatDelta(d)}</dd>
                  </div>
                );
              })}
            </dl>
            {changes.length ? (
              <ul className="mt-3 space-y-1">
                {changes.map((ch) => {
                  const label = SLOT_META.find((s) => s.id === ch.slot)?.label ?? ch.slot;
                  return (
                    <li key={ch.slot} className="text-xs leading-relaxed text-muted">
                      {label} {ch.fromName ?? "空"} → {ch.toName ?? "空"}{" "}
                      <span className={cn("font-mono tabular-nums", deltaClass(ch.dUsd))}>
                        {formatUsdDelta(ch.dUsd)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-muted">{spendStory(a, pinA)}</p>
            {a.conflict || pinA.conflict ? (
              <p className="mt-2 font-mono text-xs text-warn">其中一組有相容衝突，分數僅供參考。</p>
            ) : null}
          </div>
        ) : pinA && pinnedSame ? (
          <p className="font-mono text-xs text-faint">已釘選這組，改零件後會顯示價差、功耗與分數。</p>
        ) : null}

        <div className={a.conflict ? "opacity-50" : undefined}>
          <ScoreRadar scores={a.scores} muted={a.conflict} />
        </div>

        <ul className={cn("space-y-2.5", a.conflict && "opacity-50")}>
          {SCORE_ROWS.map((row) => {
            const value = a.scores[row.key];
            const Icon = row.icon;
            const delta = comparing && pinA ? value - pinA.scores[row.key] : null;
            return (
              <li key={row.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    {row.label}
                  </span>
                  <span className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
                    {delta != null ? <span className={deltaClass(delta)}>{formatDelta(delta)}</span> : null}
                    <span className="text-fg">{value}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="font-mono text-xs text-faint">
          {a.conflict
            ? "相容後才有參考價值。腳位或淨空衝突時，分數不能當成能組出來的效能。"
            : "分數來自精選目錄的估算，不是跑分實驗室數據。"}
        </p>

        {resRows.length ? (
          <div className={a.conflict ? "opacity-50" : undefined}>
            <div className="mb-2 font-mono text-xs tracking-widest text-faint">遊戲分數 · 解析度</div>
            <ul className="space-y-2">
              {resRows.map((row) => {
                const on = row.id === resolution;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setResolution(row.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className={cn("w-12 font-mono text-xs", on ? "text-accent" : "text-faint")}>
                        {row.label}
                      </span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width,background-color] duration-200",
                            on ? "bg-accent" : "bg-muted",
                          )}
                          style={{ width: `${row.gaming}%` }}
                        />
                      </div>
                      <span className={cn("w-8 text-right font-mono text-sm tabular-nums", on ? "text-fg" : "text-muted")}>
                        {row.gaming}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {a.bottleneck && !a.conflict ? (
          <div className="rounded-xl bg-surface p-3.5 shadow-[var(--shadow-border)]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs tracking-widest text-faint">瓶頸</span>
              <span className={cn("font-mono text-sm", bottleneckTone(a.bottleneck.level))}>
                {BOTTLENECK_LABEL[a.bottleneck.level]}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{a.bottleneck.reason}</p>
          </div>
        ) : a.conflict ? (
          <p className="font-mono text-xs text-faint">瓶頸在相容衝突排除後才有意義。</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
            <div className="font-mono text-xs tracking-wide text-faint">預估功耗</div>
            <div className="mt-1 font-mono text-lg text-fg tabular-nums">約 {a.power.watts} W</div>
            <div className="mt-1 text-xs text-muted">餘裕{HEADROOM_LABEL[a.power.headroom]}</div>
          </div>
          <div className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
            <div className="font-mono text-xs tracking-wide text-faint">總價</div>
            <div className="mt-1 font-mono text-lg text-fg tabular-nums">{formatUsd(a.totalUsd)}</div>
            <div className="mt-1 text-xs text-muted">美元，估算</div>
          </div>
        </div>

        {a.conflict ? null : checksBlock}
      </div>
    </aside>
  );
}
