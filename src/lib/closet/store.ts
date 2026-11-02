import { toast } from "sonner";
import { create } from "zustand";
import { SEED_GARMENTS, SEED_OUTFITS, SEED_WORN } from "@/lib/closet/catalog";
import { shanghaiNow } from "@/lib/closet/dates";
import { shouldImportLocalCloset } from "@/lib/closet/snapshot";
import { loadCloset, saveCloset } from "@/lib/closet/sync";
import {
  getClosetOwner,
  importFlagKey,
  readCloset,
  readClosetByOwner,
  setClosetOwner,
  writeCloset,
  type ClosetData,
  type WriteResult,
} from "@/lib/closet/storage";
import type { Garment, Outfit } from "@/lib/closet/types";

type Closet = ClosetData & {
  addGarment: (garment: Garment) => WriteResult;
  updateGarment: (garment: Garment) => WriteResult;
  removeGarment: (id: string) => WriteResult;
  markOwned: (id: string) => void;
  toggleShopping: (id: string) => void;
  addShopping: (ids: string[]) => void;
  toggleSave: (id: string) => void;
  rememberOutfit: (outfit: Outfit) => void;
  wear: (date: string, outfitId: string) => void;
  clearDay: (date: string) => void;
  setDaily: (outfit: Outfit) => void;
  setName: (name: string) => void;
  setCity: (city: string) => void;
  toggleStyle: (style: string) => void;
  bumpSalt: () => number;
  importCloset: (data: ClosetData) => WriteResult;
  reset: () => void;
};

function wornItemsFrom(worn: Record<string, string>, outfits: ClosetData["outfits"]) {
  return Object.fromEntries(
    Object.entries(worn).map(([date, id]) => [date, outfits.find((outfit) => outfit.id === id)?.garmentIds ?? []]),
  );
}

function freshData(): ClosetData {
  const outfits = SEED_OUTFITS.map((outfit) => ({
    ...outfit,
    tags: [...outfit.tags],
    garmentIds: [...outfit.garmentIds],
  }));
  const worn = { ...SEED_WORN };
  return {
    profile: { name: "小满", styles: ["静奢风", "职场通勤"], city: "上海" },
    garments: SEED_GARMENTS.map((garment) => ({ ...garment, styles: [...garment.styles] })),
    outfits,
    worn,
    wornItems: wornItemsFrom(worn, outfits),
    shopping: [],
    dailyDate: "",
    dailyOutfitId: "look-commute",
    salt: 1,
  };
}

function emptyAccount(name?: string): ClosetData {
  return {
    profile: { name: name?.trim() || "我的衣橱", styles: [], city: "上海" },
    garments: [],
    outfits: [],
    worn: {},
    wornItems: {},
    shopping: [],
    dailyDate: "",
    dailyOutfitId: "",
    salt: 1,
  };
}

let dirty = 0;
let hydrated = false;
let closetEpoch = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveRevision = 0;

function rememberImport(userId: string) {
  try {
    localStorage.setItem(importFlagKey(userId), "1");
  } catch {
    // the server copy is still the source of truth
  }
}

function alreadyImported(userId: string) {
  try {
    return localStorage.getItem(importFlagKey(userId)) === "1";
  } catch {
    return false;
  }
}

function localClosetFor(userId: string) {
  return readClosetByOwner(userId) ?? readClosetByOwner(null);
}

async function pushCloset(epoch: number, revision: number, data: ClosetData) {
  try {
    const result = await saveCloset({ data });
    if (epoch !== closetEpoch || revision !== saveRevision) return;
    if (result.closet) useCloset.setState(result.closet);
    if (result.warning) toast(result.warning);
  } catch (error) {
    if (epoch !== closetEpoch) return;
    toast(error instanceof Error ? error.message : "衣橱没有同步到服务器，请再试一次");
  }
}

function scheduleServerSave() {
  const epoch = closetEpoch;
  const data = pick(useCloset.getState());
  const urgent = data.garments.some((garment) => garment.image.startsWith("data:image/"));
  saveRevision += 1;
  const revision = saveRevision;
  if (saveTimer) clearTimeout(saveTimer);
  if (urgent) {
    void pushCloset(epoch, revision, data);
    return;
  }
  saveTimer = setTimeout(() => {
    void pushCloset(epoch, revision, pick(useCloset.getState()));
  }, 350);
}

export async function switchCloset(userId: string | null, displayName?: string) {
  if (hydrated && getClosetOwner() === userId) return;
  if (saveTimer) clearTimeout(saveTimer);
  closetEpoch += 1;
  const epoch = closetEpoch;
  setClosetOwner(userId);
  hydrated = true;
  if (!userId) {
    const saved = readCloset();
    useCloset.setState(saved ?? freshData());
    return;
  }
  try {
    const remote = await loadCloset();
    if (epoch !== closetEpoch) return;
    const local = localClosetFor(userId);
    if (
      shouldImportLocalCloset({
        server: remote.closet,
        local,
        alreadyImported: alreadyImported(userId),
      }) &&
      local
    ) {
      const imported = await saveCloset({ data: local });
      if (epoch !== closetEpoch) return;
      rememberImport(userId);
      if (imported.closet) useCloset.setState(imported.closet);
      if (imported.warning) toast(imported.warning);
      toast("已把这台设备上的衣橱导入账号");
      return;
    }
    useCloset.setState(remote.closet ?? emptyAccount(displayName));
  } catch {
    if (epoch !== closetEpoch) return;
    const local = localClosetFor(userId);
    useCloset.setState(local ?? emptyAccount(displayName));
    toast("衣橱暂时没能从服务器读取，先显示这台设备上的副本");
  }
}

function pick(state: Closet): ClosetData {
  return {
    profile: state.profile,
    garments: state.garments,
    outfits: state.outfits,
    worn: state.worn,
    wornItems: state.wornItems,
    shopping: state.shopping,
    dailyDate: state.dailyDate,
    dailyOutfitId: state.dailyOutfitId,
    salt: state.salt,
  };
}

export const useCloset = create<Closet>()((set, get) => {
  function commit(): WriteResult {
    if (getClosetOwner()) {
      scheduleServerSave();
      return { ok: true };
    }
    const written = writeCloset(pick(get()));
    if (written.ok && written.garments) set({ garments: written.garments });
    return written;
  }

  function update(partial: Partial<ClosetData>): WriteResult {
    dirty += 1;
    set(partial);
    return commit();
  }

  return {
    ...freshData(),
    addGarment: (garment) => update({ garments: [garment, ...get().garments] }),
    updateGarment: (garment) =>
      update({ garments: get().garments.map((item) => (item.id === garment.id ? garment : item)) }),
    removeGarment: (id) =>
      update({
        garments: get().garments.filter((item) => item.id !== id),
        outfits: get().outfits.map((outfit) => ({
          ...outfit,
          garmentIds: outfit.garmentIds.filter((garmentId) => garmentId !== id),
        })),
        shopping: get().shopping.filter((item) => item !== id),
        wornItems: Object.fromEntries(
          Object.entries(get().wornItems).map(([date, ids]) => [date, ids.filter((item) => item !== id)]),
        ),
      }),
    markOwned: (id) =>
      update({
        garments: get().garments.map((item) => (item.id === id ? { ...item, owned: true } : item)),
        shopping: get().shopping.filter((item) => item !== id),
      }),
    toggleShopping: (id) =>
      update({
        shopping: get().shopping.includes(id)
          ? get().shopping.filter((item) => item !== id)
          : [id, ...get().shopping],
      }),
    addShopping: (ids) => {
      const shopping = [...get().shopping];
      for (const id of ids) {
        if (!shopping.includes(id)) shopping.push(id);
      }
      return update({ shopping });
    },
    toggleSave: (id) =>
      update({
        outfits: get().outfits.map((outfit) => (outfit.id === id ? { ...outfit, saved: !outfit.saved } : outfit)),
      }),
    rememberOutfit: (outfit) => {
      const exists = get().outfits.some((item) => item.id === outfit.id);
      const outfits = exists
        ? get().outfits.map((item) => (item.id === outfit.id ? outfit : item))
        : [outfit, ...get().outfits].slice(0, 48);
      update({ outfits });
    },
    wear: (date, outfitId) => {
      const today = shanghaiNow().key;
      const outfit = get().outfits.find((item) => item.id === outfitId);
      const wornItems = { ...get().wornItems };
      if (outfit) wornItems[date] = [...outfit.garmentIds];
      update({
        worn: { ...get().worn, [date]: outfitId },
        wornItems,
        ...(date === today ? { dailyDate: date, dailyOutfitId: outfitId } : {}),
      });
    },
    clearDay: (date) => {
      const worn = { ...get().worn };
      const wornItems = { ...get().wornItems };
      delete worn[date];
      delete wornItems[date];
      update({ worn, wornItems });
    },
    setDaily: (outfit) => {
      get().rememberOutfit(outfit);
      update({ dailyDate: shanghaiNow().key, dailyOutfitId: outfit.id });
    },
    setName: (name) => update({ profile: { ...get().profile, name } }),
    setCity: (city) => update({ profile: { ...get().profile, city } }),
    toggleStyle: (style) => {
      const styles = get().profile.styles.includes(style)
        ? get().profile.styles.filter((item) => item !== style)
        : [...get().profile.styles, style];
      update({ profile: { ...get().profile, styles } });
    },
    bumpSalt: () => {
      const salt = get().salt + 1;
      update({ salt });
      return salt;
    },
    importCloset: (data) => {
      dirty += 1;
      set(data);
      return commit();
    },
    reset: () => {
      dirty += 1;
      set(freshData());
      commit();
    },
  };
});

export function hydrateClosetFromStorage() {
  if (dirty > 0 || hydrated) return;
  hydrated = true;
  const saved = readCloset();
  if (!saved) return;
  useCloset.setState(saved);
}
