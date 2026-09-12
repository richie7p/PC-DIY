import { useEffect } from "react";
import { CatalogPanel } from "@/components/builder/catalog-panel";
import { MobileDock } from "@/components/builder/mobile-dock";
import { ReportPanel } from "@/components/builder/report-panel";
import { SlotRail } from "@/components/builder/slot-rail";
import { TopBar } from "@/components/builder/top-bar";
import { useBuildStore } from "@/lib/pc/store";

export function BuilderApp() {
  const hydrate = useBuildStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh lg:overflow-hidden">
      <TopBar />
      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[260px_minmax(0,1fr)_340px] lg:overflow-hidden">
        <SlotRail />
        <CatalogPanel />
        <ReportPanel />
      </div>
      <footer className="border-t border-border px-4 py-2.5 pb-20 font-mono text-xs text-faint lg:px-6 lg:pb-2.5">
        代表性 AMD／Intel／NVIDIA 目錄。價格、功耗、淨空與分數皆為估算，非正式報價或實驗室數據。組裝寫在網址裡，可直接分享。
      </footer>
      <MobileDock />
    </div>
  );
}
