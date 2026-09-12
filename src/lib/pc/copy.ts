import { analyze, formatUsd, resolvePicks } from "./analyze";
import { BOTTLENECK_LABEL, HEADROOM_LABEL, SCORE_LABELS } from "./labels";
import { SLOT_META } from "./slots";
import type { Picks, Resolution } from "./types";

export function buildPlaintext(picks: Picks, resolution: Resolution = "1440p"): string {
  const a = analyze(picks, resolution);
  const parts = resolvePicks(picks);
  const resLabel = resolution === "4k" ? "4K" : resolution;
  const rows = SLOT_META.map((slot) => {
    const p = parts[slot.id];
    const name = p ? p.name : "（空）";
    const price = p ? formatUsd(p.priceUsd) : "—";
    return `${slot.short.padEnd(6)} ${name.padEnd(34)} ${price}`;
  });
  const bottleneck = a.bottleneck
    ? [`瓶頸    ${BOTTLENECK_LABEL[a.bottleneck.level]}`, a.bottleneck.reason]
    : [];
  return [
    `RIGFORGE — ${a.summary.title}`,
    a.summary.tagline,
    `目標解析度：${resLabel}`,
    "",
    ...rows,
    "",
    `總價     ${formatUsd(a.totalUsd)}   （價格為估算）`,
    `功耗     約 ${a.power.watts} W（估算） · 電源餘裕${HEADROOM_LABEL[a.power.headroom]}`,
    ...bottleneck,
    "",
    `${SCORE_LABELS.gaming} ${a.scores.gaming}  ${SCORE_LABELS.localAi} ${a.scores.localAi}  ${SCORE_LABELS.creation} ${a.scores.creation}  ${SCORE_LABELS.productivity} ${a.scores.productivity}  ${SCORE_LABELS.value} ${a.scores.value}`,
    "",
    "分數、功耗與價格皆為估算，非正式報價或跑分。",
    ...(typeof window !== "undefined" ? [`分享連結：${window.location.href}`] : []),
  ].join("\n");
}
