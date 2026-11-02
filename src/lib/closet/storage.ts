import type { Garment, Outfit, Profile } from "@/lib/closet/types";

export const CLOSET_STORAGE_KEY = "stylemate-closet-v1";

let closetOwner: string | null = null;

export function setClosetOwner(id: string | null) {
  closetOwner = id;
}

export function getClosetOwner() {
  return closetOwner;
}

function closetStorageKey() {
  return closetOwner ? `${CLOSET_STORAGE_KEY}:${closetOwner}` : CLOSET_STORAGE_KEY;
}

export type ClosetData = {
  profile: Profile;
  garments: Garment[];
  outfits: Outfit[];
  worn: Record<string, string>;
  wornItems: Record<string, string[]>;
  shopping: string[];
  dailyDate: string;
  dailyOutfitId: string;
  salt: number;
};

export type WriteResult =
  | { ok: true; garments?: Garment[]; warning?: string }
  | { ok: false; error: string };

function isGarment(value: unknown): value is Garment {
  if (!value || typeof value !== "object") return false;
  const garment = value as Partial<Garment>;
  return typeof garment.id === "string" && typeof garment.name === "string";
}

function isOutfit(value: unknown): value is Outfit {
  if (!value || typeof value !== "object") return false;
  const outfit = value as Partial<Outfit>;
  return typeof outfit.id === "string" && Array.isArray(outfit.garmentIds);
}

function wornItemMap(raw: unknown, worn: Record<string, string>, outfits: Outfit[]) {
  const items: Record<string, string[]> = {};
  if (raw && typeof raw === "object") {
    for (const [date, ids] of Object.entries(raw)) {
      if (!Array.isArray(ids)) continue;
      items[date] = ids.filter((id): id is string => typeof id === "string");
    }
  }
  for (const [date, outfitId] of Object.entries(worn)) {
    if (items[date]) continue;
    const outfit = outfits.find((item) => item.id === outfitId);
    if (outfit) items[date] = [...outfit.garmentIds];
  }
  return items;
}

export function closetFromText(text: string): ClosetData | null {
  try {
    return readClosetFromUnknown(JSON.parse(text));
  } catch {
    return null;
  }
}

function readClosetFromUnknown(parsed: unknown): ClosetData | null {
  if (!parsed || typeof parsed !== "object") return null;
  const wrapped = parsed as { state?: Partial<ClosetData> };
  const state = wrapped.state && typeof wrapped.state === "object" ? wrapped.state : (parsed as Partial<ClosetData>);
  if (!state || !Array.isArray(state.garments) || !state.profile || typeof state.profile.name !== "string") {
    return null;
  }
  const outfits = Array.isArray(state.outfits) ? state.outfits.filter(isOutfit) : [];
  const worn = state.worn && typeof state.worn === "object" ? state.worn : {};
  return {
    profile: {
      name: state.profile.name,
      styles: Array.isArray(state.profile.styles) ? state.profile.styles.filter((item) => typeof item === "string") : [],
      city: typeof state.profile.city === "string" && state.profile.city ? state.profile.city : "元林",
    },
    garments: state.garments.filter(isGarment),
    outfits,
    worn,
    wornItems: wornItemMap(state.wornItems, worn, outfits),
    shopping: Array.isArray(state.shopping) ? state.shopping.filter((item) => typeof item === "string") : [],
    dailyDate: typeof state.dailyDate === "string" ? state.dailyDate : "",
    dailyOutfitId: typeof state.dailyOutfitId === "string" ? state.dailyOutfitId : "",
    salt: typeof state.salt === "number" ? state.salt : 1,
  };
}

export function readCloset(): ClosetData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(closetStorageKey());
    if (!raw) return null;
    return readClosetFromUnknown(JSON.parse(raw));
  } catch {
    return null;
  }
}

function largestDataImage(garments: Garment[]) {
  let index = -1;
  let size = 0;
  garments.forEach((garment, i) => {
    if (garment.image.startsWith("data:") && garment.image.length > size) {
      size = garment.image.length;
      index = i;
    }
  });
  return index;
}

export function writeCloset(data: ClosetData): WriteResult {
  if (typeof window === "undefined") return { ok: true };
  const garments = data.garments.map((garment) => ({ ...garment, styles: [...garment.styles] }));
  let stripped = false;
  for (let attempt = 0; attempt < garments.length + 1; attempt += 1) {
    try {
      localStorage.setItem(
        closetStorageKey(),
        JSON.stringify({
          version: 1,
          state: { ...data, garments },
        }),
      );
      return stripped
        ? { ok: true, garments, warning: "空间不足，衣物已保存，部分过大的照片未能写入" }
        : { ok: true };
    } catch {
      const index = largestDataImage(garments);
      if (index < 0) {
        return { ok: false, error: "存储空间已满，请先删除几件衣物再试" };
      }
      const current = garments[index];
      if (!current) return { ok: false, error: "存储空间已满，请先删除几件衣物再试" };
      garments[index] = { ...current, image: "" };
      stripped = true;
    }
  }
  return { ok: false, error: "存储空间已满，请先删除几件衣物再试" };
}
