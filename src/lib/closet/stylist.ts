import type { Garment, Outfit } from "@/lib/closet/types";

const WARM = new Set(["奶油白", "驼色", "象牙白", "燕麦色", "白色", "棕色"]);

const MOOD_STYLES: Record<string, string[]> = {
  休闲: ["休闲", "街头"],
  优雅: ["优雅", "法式", "静奢风"],
  自信: ["职场通勤", "极简"],
  甜美: ["甜美", "法式", "约会"],
  酷飒: ["街头", "极简"],
  简约: ["极简", "静奢风"],
};

const OCCASION_RANGE: Record<string, [number, number]> = {
  日常: [1, 2],
  上班: [2, 3],
  约会: [2, 3],
  聚会: [2, 3],
  旅行: [1, 2],
  运动: [1, 1],
};

export type StyleRequest = {
  occasion: string;
  mood: string;
  weather: string;
  rain?: boolean;
  salt: number;
  preferred: string[];
  limit?: number;
};

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weatherOk(garment: Garment, weather: string) {
  if (weather === "炎热") return garment.warmth <= 1 && garment.slot !== "outer";
  if (weather === "温暖") return garment.warmth <= 2 || garment.slot !== "outer";
  if (weather === "寒冷") return garment.warmth >= 2 || garment.slot === "outer" || garment.slot === "shoes";
  return true;
}

function formalityOk(garment: Garment, range: [number, number], strict: boolean) {
  if (!strict) return true;
  return garment.formality >= range[0] - 1 && garment.formality <= range[1] + 1;
}

function wantsOuter(weather: string, rain: boolean) {
  return rain || weather === "凉爽" || weather === "寒冷";
}

const SEED_LOOK_NAMES = new Set(["温柔通勤风", "黑白利落", "夜色简笔", "周末叠穿", "风衣与半裙"]);

const MOOD_WORD: Record<string, string> = {
  休闲: "松弛",
  优雅: "温柔",
  自信: "利落",
  甜美: "柔和",
  酷飒: "干净",
  简约: "安静",
};

/** Occasion words. 上班 stays on the commute side of the wardrobe. */
const OCCASION_WORD: Record<string, string[]> = {
  上班: ["通勤", "开会", "办公"],
  日常: ["出门", "散步", "日常"],
  约会: ["赴约", "晚餐", "傍晚"],
  聚会: ["入席", "聚会", "灯光"],
  旅行: ["出发", "旅途", "轻装"],
  运动: ["活动", "伸展", "快走"],
};

function namesForBatch(occasion: string, mood: string, count: number) {
  const words = OCCASION_WORD[occasion] ?? OCCASION_WORD.日常;
  const moodWord = MOOD_WORD[mood] ?? "今日";
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const word = words[index % words.length] ?? "出门";
    let name = `${moodWord}${word}`;
    let extra = 2;
    while (names.includes(name) || SEED_LOOK_NAMES.has(name)) {
      name = `${moodWord}${word}${extra}`;
      extra += 1;
    }
    names.push(name);
  }
  return names;
}

function noteFor(pieces: Garment[], weather: string, rain: boolean) {
  const names = pieces
    .filter((piece) => piece.slot !== "shoes" && piece.slot !== "bag" && piece.slot !== "extra")
    .slice(0, 2)
    .map((piece) => piece.name);
  const weatherLine: Record<string, string> = {
    炎热: "热天把外套留在家里。",
    温暖: "薄薄一层就够，不必裹太严。",
    凉爽: "微风天适合叠穿，领口留一点空气。",
    寒冷: "把最厚的那件穿在最外面。",
  };
  const rainLine = rain ? "今天有雨，外套带着更稳。" : "";
  return `${names.join("配")}${names.length ? "。" : ""}${rainLine}${weatherLine[weather] ?? ""}`;
}

function scoreLook(pieces: Garment[], request: StyleRequest) {
  const moodStyles = new Set([...(MOOD_STYLES[request.mood] ?? []), ...request.preferred]);
  let score = 62;
  for (const piece of pieces) {
    score += piece.owned ? 7 : -4;
    if (piece.styles.some((style) => moodStyles.has(style))) score += 4;
  }
  const warm = pieces.filter((piece) => WARM.has(piece.color)).length;
  if (warm >= 2) score += 8;
  if (pieces.some((piece) => piece.color === "黑色") && warm >= 1) score += 3;
  if (request.weather === "寒冷" && pieces.some((piece) => piece.slot === "outer")) score += 6;
  if (request.weather === "炎热" && !request.rain && pieces.some((piece) => piece.slot === "outer")) score -= 12;
  if (request.rain && pieces.some((piece) => piece.slot === "outer")) score += 8;
  if (request.rain && !pieces.some((piece) => piece.slot === "outer")) score -= 6;
  return score;
}

type Draft = { pieces: Garment[] };

function assemble(
  base: Garment[],
  outers: Garment[],
  shoes: Garment[],
  bags: Garment[],
  extras: Garment[],
  request: StyleRequest,
  saltNudge: number,
): Draft {
  const pieces = [...base];
  const rain = Boolean(request.rain);
  if (wantsOuter(request.weather, rain) && outers.length > 0) {
    const pick = outers[hash(`outer:${request.salt}:${saltNudge}`) % outers.length];
    if (pick && !pieces.some((piece) => piece.id === pick.id)) pieces.push(pick);
  } else if (request.weather === "温暖" && outers.length > 0 && hash(`maybe:${request.salt}:${saltNudge}`) % 2 === 0) {
    const light = outers.filter((piece) => piece.formality <= 2);
    const pool = light.length > 0 ? light : outers;
    const pick = pool[hash(`light:${request.salt}:${saltNudge}`) % pool.length];
    if (pick) pieces.push(pick);
  }
  if (request.occasion !== "运动" && shoes.length > 0 && !pieces.some((piece) => piece.slot === "shoes")) {
    pieces.push(shoes[hash(`shoes:${request.salt}:${saltNudge}`) % shoes.length]!);
  }
  if (request.occasion !== "运动" && bags.length > 0) {
    const bag = bags[hash(`bag:${request.salt}:${saltNudge}`) % bags.length];
    if (bag) pieces.push(bag);
  }
  if (request.occasion !== "运动" && extras.length > 0 && hash(`extra:${request.salt}:${saltNudge}`) % 2 === 0) {
    const extra = extras[hash(`extra:${request.salt}:${saltNudge}`) % extras.length];
    if (extra) pieces.push(extra);
  }
  return { pieces };
}

export function suggestOutfits(garments: Garment[], request: StyleRequest): Outfit[] {
  const range = OCCASION_RANGE[request.occasion] ?? [1, 3];
  const strictWeather = request.weather === "炎热" || request.weather === "寒冷";
  const pool = (slot: Garment["slot"], strict: boolean) =>
    garments.filter(
      (garment) =>
        garment.slot === slot &&
        (strict ? weatherOk(garment, request.weather) : true) &&
        formalityOk(garment, range, strict && slot !== "shoes"),
    );

  let tops = pool("top", true);
  let bottoms = pool("bottom", true);
  let dresses = pool("onepiece", true);
  let outers = pool("outer", strictWeather);
  let shoes = pool("shoes", false);
  const bags = garments.filter((garment) => garment.slot === "bag");
  const extras = garments.filter((garment) => garment.slot === "extra");
  if (tops.length === 0) tops = pool("top", false);
  if (bottoms.length === 0) bottoms = pool("bottom", false);
  if (dresses.length === 0) dresses = pool("onepiece", false);
  if (outers.length === 0) outers = garments.filter((garment) => garment.slot === "outer");
  if (shoes.length === 0) shoes = garments.filter((garment) => garment.slot === "shoes");

  const drafts: Draft[] = [];
  dresses.forEach((dress, index) => {
    drafts.push(assemble([dress], outers, shoes, bags, extras, request, index));
  });
  tops.forEach((top, i) => {
    bottoms.forEach((bottom, j) => {
      if (top.color === bottom.color && top.color === "黑色" && request.mood === "甜美") return;
      drafts.push(assemble([top, bottom], outers, shoes, bags, extras, request, i * 10 + j));
    });
  });

  const ranked = drafts
    .map((draft) => {
      const pieces = draft.pieces.filter(
        (piece, index, list) => list.findIndex((item) => item.id === piece.id) === index,
      );
      const owned = pieces.filter((piece) => piece.owned).length;
      if (pieces.length === 0 || owned === 0) return null;
      const signature = pieces
        .map((piece) => piece.id)
        .sort()
        .join("-");
      return {
        pieces,
        signature,
        score: scoreLook(pieces, request),
        order: hash(`${signature}:${request.salt}:${request.occasion}`),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const unique: typeof ranked = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    if (seen.has(item.signature)) continue;
    seen.add(item.signature);
    unique.push(item);
    if (unique.length >= (request.limit ?? 3)) break;
  }

  const names = namesForBatch(request.occasion, request.mood, unique.length);
  return unique.map((item, index) => ({
    id: `gen-${request.salt}-${index}-${hash(item.signature).toString(36)}`,
    name: names[index] ?? `${request.mood}${request.occasion}`,
    tags: [request.mood, request.occasion === "上班" ? "通勤" : request.occasion],
    garmentIds: item.pieces.map((piece) => piece.id),
    score: 0,
    occasion: request.occasion,
    note: noteFor(item.pieces, request.weather, Boolean(request.rain)),
    saved: false,
    createdAt: 0,
  }));
}

export function piecesOf(outfit: Outfit, garments: Garment[]) {
  return outfit.garmentIds
    .map((id) => garments.find((garment) => garment.id === id))
    .filter((garment): garment is Garment => Boolean(garment));
}

export function missingPrice(pieces: Garment[]) {
  return pieces.filter((piece) => !piece.owned).reduce((sum, piece) => sum + piece.price, 0);
}

export function isComplete(pieces: Garment[]) {
  return pieces.length > 0 && pieces.every((piece) => piece.owned);
}

function wearable(pieces: Garment[]) {
  const slots = new Set(pieces.map((piece) => piece.slot));
  return (slots.has("top") && slots.has("bottom")) || slots.has("onepiece");
}

/** Turn a model JSON payload into outfits that only use real closet ids. */
export function coerceOutfits(
  raw: unknown,
  garments: Garment[],
  request: Pick<StyleRequest, "occasion" | "mood"> & { limit?: number },
): Outfit[] | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { outfits?: unknown }).outfits;
  if (!Array.isArray(list)) return null;
  const byId = new Map(garments.map((garment) => [garment.id, garment]));
  const outfits: Outfit[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as { name?: unknown; garmentIds?: unknown; note?: unknown };
    if (!Array.isArray(record.garmentIds)) continue;
    const pieces: Garment[] = [];
    for (const id of record.garmentIds) {
      if (typeof id !== "string") continue;
      const garment = byId.get(id);
      if (!garment || pieces.some((piece) => piece.id === garment.id)) continue;
      pieces.push(garment);
    }
    if (!wearable(pieces) || !pieces.some((piece) => piece.owned)) continue;
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 16) : "";
    const note = typeof record.note === "string" ? record.note.trim().slice(0, 80) : "";
    outfits.push({
      id: `gen-${outfits.length}-${pieces.map((piece) => piece.id).join("-")}`,
      name: name || "今日搭配",
      tags: [request.mood, request.occasion === "上班" ? "通勤" : request.occasion],
      garmentIds: pieces.map((piece) => piece.id),
      score: 0,
      occasion: request.occasion,
      note: note || "这套只用了你衣橱里的单品。",
      saved: false,
      createdAt: 0,
    });
    if (outfits.length >= (request.limit ?? 3)) break;
  }
  return outfits.length > 0 ? outfits : null;
}
