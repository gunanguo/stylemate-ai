import { COLOR_OPTIONS, type Garment, type GarmentCategory } from "./types.ts";

export type BuyVerdict = "buy" | "skip" | "maybe";

export type BuyAdvice = {
  source: "model" | "rules";
  verdict: BuyVerdict;
  headline: string;
  outfitCount: number;
  similar: { id: string; name: string }[];
  reasons: string[];
  outfits: { name: string; garmentIds: string[] }[];
};

const CATEGORY_HINTS: Array<{ category: GarmentCategory; slot: Garment["slot"]; words: string[] }> = [
  { category: "上衣", slot: "top", words: ["衬衫", "上衣", "T恤", "针织", "毛衣", "卫衣", "背心", "吊带"] },
  { category: "裤子", slot: "bottom", words: ["裤子", "西裤", "牛仔裤", "短裤", "阔腿裤"] },
  { category: "裙子", slot: "bottom", words: ["裙子", "半裙", "连衣裙", "长裙", "短裙"] },
  { category: "外套", slot: "outer", words: ["外套", "大衣", "风衣", "西装", "夹克", "羽绒"] },
  { category: "鞋子", slot: "shoes", words: ["鞋子", "鞋", "靴", "乐福", "凉鞋", "运动鞋"] },
  { category: "包包", slot: "bag", words: ["包包", "手袋", "背包", "托特"] },
  { category: "配饰", slot: "extra", words: ["围巾", "帽子", "腰带", "耳环", "配饰"] },
];

const VERDICT_HEADLINE: Record<BuyVerdict, string> = {
  buy: "值得买",
  skip: "先不买",
  maybe: "可以再想想",
};

export function guessPiece(text: string) {
  const color = COLOR_OPTIONS.find((name) => text.includes(name)) ?? "";
  let best: (typeof CATEGORY_HINTS)[number] | null = null;
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => text.includes(word))) best = hint;
  }
  const dress = text.includes("连衣裙");
  return {
    color,
    category: best?.category ?? null,
    slot: dress ? ("onepiece" as const) : (best?.slot ?? null),
  };
}

function owned(garments: Garment[]) {
  return garments.filter((garment) => garment.owned);
}

function pairCount(slot: Garment["slot"] | null, garments: Garment[]) {
  const mine = owned(garments);
  const tops = mine.filter((item) => item.slot === "top").length;
  const bottoms = mine.filter((item) => item.slot === "bottom").length;
  const dresses = mine.filter((item) => item.slot === "onepiece").length;
  const bases = Math.min(tops, 6) * (bottoms > 0 ? 1 : 0) + dresses;
  if (slot === "top") return Math.min(bottoms, 6);
  if (slot === "bottom") return Math.min(tops, 6);
  if (slot === "onepiece") return Math.min(1 + mine.filter((item) => item.slot === "outer").length, 4);
  if (slot === "outer" || slot === "shoes" || slot === "bag" || slot === "extra") return Math.min(bases, 6);
  return Math.min(bases, 6);
}

export function adviseFromCloset(text: string, garments: Garment[]): BuyAdvice {
  const guess = guessPiece(text);
  const mine = owned(garments);
  const similar = mine.filter((item) => {
    if (guess.category && item.category !== guess.category && !(guess.slot === "onepiece" && item.slot === "onepiece")) {
      return false;
    }
    if (!guess.category && !guess.color) return false;
    if (guess.color && item.color !== guess.color) return false;
    return true;
  });
  const outfitCount = pairCount(guess.slot, garments);
  let verdict: BuyVerdict = "maybe";
  if (mine.length === 0) verdict = "skip";
  else if (similar.length > 0) verdict = "skip";
  else if (outfitCount === 0) verdict = "skip";
  else if (outfitCount >= 3) verdict = "buy";

  const reasons: string[] = [];
  if (mine.length === 0) reasons.push("衣橱里还没有已拥有的衣服，先添几件再决定买什么。");
  if (similar.length > 0) {
    reasons.push(`你已经有相近的：${similar.slice(0, 3).map((item) => item.name).join("、")}。`);
  }
  if (guess.category) reasons.push(`按「${guess.color || "这个"}${guess.category}」来算，它大约能和现有衣服配出 ${outfitCount} 套。`);
  else reasons.push("描述里没有看清品类，套数只是按你现有的上衣和下装估的。");
  if (outfitCount === 0 && mine.length > 0) reasons.push("它和现在的衣橱几乎配不出一套完整穿搭。");
  if (verdict === "buy") reasons.push("没有太接近的单品，而且能反复和现有衣服一起穿。");

  return {
    source: "rules",
    verdict,
    headline: VERDICT_HEADLINE[verdict],
    outfitCount,
    similar: similar.slice(0, 4).map((item) => ({ id: item.id, name: item.name })),
    reasons,
    outfits: [],
  };
}

const MODEL_VERDICTS = new Set<BuyVerdict>(["buy", "skip", "maybe"]);

/** Keep the model's verdict, but only closet ids it actually named. */
export function coerceBuyAdvice(raw: unknown, garments: Garment[], fallback: BuyAdvice): BuyAdvice {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as {
    verdict?: unknown;
    headline?: unknown;
    reasons?: unknown;
    similarIds?: unknown;
    outfits?: unknown;
  };
  const verdict = MODEL_VERDICTS.has(record.verdict as BuyVerdict) ? (record.verdict as BuyVerdict) : fallback.verdict;
  const byId = new Map(garments.map((garment) => [garment.id, garment]));
  const similar = Array.isArray(record.similarIds)
    ? record.similarIds.flatMap((id) => {
        if (typeof id !== "string") return [];
        const garment = byId.get(id);
        if (!garment?.owned) return [];
        return [{ id: garment.id, name: garment.name }];
      })
    : fallback.similar;
  const outfits = Array.isArray(record.outfits)
    ? record.outfits.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as { name?: unknown; garmentIds?: unknown };
        if (!Array.isArray(row.garmentIds)) return [];
        const ids = row.garmentIds.filter((id): id is string => typeof id === "string" && byId.has(id));
        if (ids.length === 0) return [];
        const name = typeof row.name === "string" ? row.name.trim().slice(0, 16) : "可以这样穿";
        return [{ name: name || "可以这样穿", garmentIds: [...new Set(ids)] }];
      })
    : [];
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4).map((item) => item.trim().slice(0, 80))
    : fallback.reasons;
  return {
    source: "model",
    verdict,
    headline: typeof record.headline === "string" && record.headline.trim() ? record.headline.trim().slice(0, 12) : VERDICT_HEADLINE[verdict],
    outfitCount: outfits.length > 0 ? outfits.length : fallback.outfitCount,
    similar: similar.slice(0, 4),
    reasons: reasons.length > 0 ? reasons : fallback.reasons,
    outfits: outfits.slice(0, 3),
  };
}
