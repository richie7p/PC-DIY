import { create } from "zustand";
import { analyze, formatUsd } from "./analyze";
import { autoBuild, cheapestComplete, type UseCase } from "./autobuild";
import { FAMILY_ALL } from "./labels";
import { SLOT_IDS } from "./types";
import type { Picks, Resolution, SlotId } from "./types";

const STORAGE_KEY = "rigforge-v2";

export type AutoOffer = {
  useCase: UseCase;
  cheapestUsd: number;
  shortfall: number;
  picks: Picks;
};

export type BuildState = {
  picks: Picks;
  activeSlot: SlotId;
  query: string;
  family: string;
  compatibleOnly: boolean;
  budgetCap: number;
  resolution: Resolution;
  hydrated: boolean;
  autoOpen: boolean;
  lastUseCase: UseCase | null;
  autoReasons: string[] | null;
  autoOffer: AutoOffer | null;
  floorDismissed: boolean;
  pin: { picks: Picks; title: string } | null;
  setActiveSlot: (slot: SlotId) => void;
  setQuery: (q: string) => void;
  setFamily: (f: string) => void;
  setCompatibleOnly: (v: boolean) => void;
  setBudgetCap: (n: number) => void;
  setResolution: (r: Resolution) => void;
  setAutoOpen: (v: boolean) => void;
  selectPart: (slot: SlotId, id: string) => void;
  clearSlot: (slot: SlotId) => void;
  applyPreset: (picks: Picks, resolution?: Resolution) => void;
  autoFill: (useCase: UseCase) => "ok" | "short" | "fail";
  applyFloor: () => void;
  dismissFloor: () => void;
  applyFix: (slot: SlotId, partId?: string) => void;
  pinCurrent: () => void;
  clearPin: () => void;
  reset: () => void;
  hydrate: () => void;
};


type Persisted = {
  picks: Picks;
  budgetCap: number;
  resolution: Resolution;
};

function isResolution(v: string | null | undefined): v is Resolution {
  return v === "1080p" || v === "1440p" || v === "4k";
}

function persist(state: Pick<BuildState, "picks" | "budgetCap" | "resolution">) {
  const data: Persisted = {
    picks: state.picks,
    budgetCap: state.budgetCap,
    resolution: state.resolution,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
  try {
    const params = new URLSearchParams();
    for (const slot of SLOT_IDS) {
      const id = state.picks[slot];
      if (id) params.set(slot, id);
    }
    params.set("budget", String(state.budgetCap));
    params.set("res", state.resolution);
    const next = `#${params.toString()}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  } catch {
    /* ignore */
  }
}

function readHash(): Persisted | null {
  try {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return null;
    const params = new URLSearchParams(raw);
    const picks: Picks = {};
    let any = false;
    for (const slot of SLOT_IDS) {
      const id = params.get(slot);
      if (id) {
        picks[slot] = id;
        any = true;
      }
    }
    const budgetRaw = Number(params.get("budget"));
    const resRaw = params.get("res");
    if (!any && !params.has("budget") && !params.has("res")) return null;
    return {
      picks,
      budgetCap: Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 1500,
      resolution: isResolution(resRaw) ? resRaw : "1440p",
    };
  } catch {
    return null;
  }
}

export const useBuildStore = create<BuildState>((set, get) => ({
  picks: {},
  activeSlot: "cpu",
  query: "",
  family: FAMILY_ALL,
  compatibleOnly: false,
  budgetCap: 1500,
  resolution: "1440p",
  hydrated: false,
  autoOpen: false,
  lastUseCase: null,
  autoReasons: null,
  autoOffer: null,
  floorDismissed: false,
  pin: null,
  setActiveSlot: (slot) => set({ activeSlot: slot, query: "", family: FAMILY_ALL }),
  setQuery: (query) => set({ query }),
  setFamily: (family) => set({ family }),
  setCompatibleOnly: (compatibleOnly) => set({ compatibleOnly }),
  setBudgetCap: (budgetCap) => {
    const floor = cheapestComplete();
    const stillShort = Boolean(floor && budgetCap + 1 < floor.totalUsd);
    set({
      budgetCap,
      floorDismissed: stillShort ? get().floorDismissed : false,
    });
    persist(get());
  },
  setResolution: (resolution) => {
    set({ resolution });
    persist(get());
  },
  setAutoOpen: (autoOpen) => set({ autoOpen }),
  selectPart: (slot, id) => {
    const current = get().picks[slot];
    const picks = { ...get().picks };
    if (current === id) delete picks[slot];
    else picks[slot] = id;
    set({ picks, lastUseCase: null, autoReasons: null, autoOffer: null });
    persist({ ...get(), picks });
  },
  clearSlot: (slot) => {
    const picks = { ...get().picks };
    delete picks[slot];
    set({ picks, lastUseCase: null, autoReasons: null, autoOffer: null });
    persist({ ...get(), picks });
  },
  applyPreset: (next, resolution) => {
    set({
      picks: { ...next },
      activeSlot: "cpu",
      query: "",
      family: FAMILY_ALL,
      lastUseCase: null,
      autoReasons: null,
      autoOffer: null,
      ...(resolution ? { resolution } : {}),
    });
    persist(get());
  },
  autoFill: (useCase) => {
    const { budgetCap, resolution } = get();
    const result = autoBuild(budgetCap, useCase, resolution);
    if (result.status === "short") {
      set({
        autoOffer: {
          useCase,
          cheapestUsd: result.cheapestUsd,
          shortfall: result.shortfall,
          picks: result.picks,
        },
        autoOpen: true,
        floorDismissed: false,
        lastUseCase: null,
        autoReasons: result.reasons,
      });
      return "short";
    }
    set({
      picks: { ...result.picks },
      activeSlot: "cpu",
      query: "",
      family: FAMILY_ALL,
      lastUseCase: useCase,
      autoOpen: false,
      autoOffer: null,
      autoReasons: result.reasons,
    });
    persist(get());
    return "ok";
  },
  applyFloor: () => {
    const offer = get().autoOffer;
    const floor = cheapestComplete();
    const picks = offer?.picks ?? floor?.picks;
    if (!picks || !Object.keys(picks).length) return;
    const a = analyze(picks, get().resolution);
    set({
      picks: { ...picks },
      activeSlot: "cpu",
      query: "",
      family: FAMILY_ALL,
      lastUseCase: offer?.useCase ?? "office",
      autoOpen: false,
      autoOffer: null,
      floorDismissed: true,
      autoReasons: [
        `已套用最低完整配置（約 ${formatUsd(a.totalUsd)}）。這組超過目前預算，是你主動選擇套用的。`,
        "沒用獨顯，走內顯壓低花費。",
        "若要遊戲或本地 AI，請先把預算加到能蓋住獨顯。",
      ],
    });
    persist(get());
  },
  dismissFloor: () => set({ floorDismissed: true, autoOffer: null, autoReasons: null }),
  applyFix: (slot, partId) => {
    if (partId) {
      const picks = { ...get().picks, [slot]: partId };
      set({
        picks,
        activeSlot: slot,
        query: "",
        family: FAMILY_ALL,
        compatibleOnly: true,
        lastUseCase: null,
        autoReasons: null,
        autoOffer: null,
      });
      persist({ ...get(), picks });
      return;
    }
    set({ activeSlot: slot, query: "", family: FAMILY_ALL, compatibleOnly: true });
  },
  pinCurrent: () => {
    const { picks, resolution } = get();
    if (!Object.keys(picks).length) return;
    const title = analyze(picks, resolution).summary.title;
    set({ pin: { picks: { ...picks }, title } });
  },
  clearPin: () => set({ pin: null }),
  reset: () => {
    set({ picks: {}, query: "", family: FAMILY_ALL, lastUseCase: null, autoReasons: null, autoOffer: null, floorDismissed: false });
    persist(get());
  },
  hydrate: () => {
    if (get().hydrated) return;
    const fromHash = readHash();
    if (fromHash) {
      set({ ...fromHash, hydrated: true });
      persist(get());
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("rigforge-v1");
      if (raw) {
        const data = JSON.parse(raw) as Partial<Persisted> & { picks?: Picks };
        set({
          picks: data.picks ?? {},
          budgetCap: typeof data.budgetCap === "number" ? data.budgetCap : 1500,
          resolution: isResolution(data.resolution) ? data.resolution : "1440p",
          hydrated: true,
        });
        persist(get());
        return;
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },
}));
