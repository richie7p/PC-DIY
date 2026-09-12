import { SCORE_SHORT } from "@/lib/pc/labels";
import type { Scores } from "@/lib/pc/types";
import { cn } from "@/lib/utils";

const KEYS = ["gaming", "localAi", "creation", "productivity", "value"] as const;
const LABELS = KEYS.map((k) => SCORE_SHORT[k]);

function pt(cx: number, cy: number, r: number, i: number, n: number, t = 1) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * t * Math.cos(a), cy + r * t * Math.sin(a)] as const;
}

export function ScoreRadar({ scores, muted = false }: { scores: Scores; muted?: boolean }) {
  const cx = 100;
  const cy = 102;
  const r = 56;
  const n = KEYS.length;
  const rings = [0.25, 0.5, 0.75, 1];

  const poly = KEYS.map((k, i) => {
    const [x, y] = pt(cx, cy, r, i, n, scores[k] / 100);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 200 200" className={cn("mx-auto h-40 w-40 text-accent", muted && "opacity-40")} aria-hidden="true">
      {rings.map((t) => (
        <polygon
          key={t}
          fill="none"
          stroke="currentColor"
          strokeOpacity={t === 1 ? 0.28 : 0.12}
          strokeWidth="1"
          points={KEYS.map((_, i) => pt(cx, cy, r, i, n, t).join(",")).join(" ")}
        />
      ))}
      {KEYS.map((_, i) => {
        const [x, y] = pt(cx, cy, r, i, n, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.14" />;
      })}
      <polygon points={poly} fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.5" />
      {KEYS.map((k, i) => {
        const [x, y] = pt(cx, cy, r, i, n, scores[k] / 100);
        return <circle key={k} cx={x} cy={y} r="2.4" fill="currentColor" />;
      })}
      {LABELS.map((label, i) => {
        const [x, y] = pt(cx, cy, r + 18, i, n, 1);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted"
            style={{ fontSize: 9, fontFamily: "var(--font-sans)" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
