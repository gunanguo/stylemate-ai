import { createServerFn } from "@tanstack/react-start";
import { coerceOutfits, suggestOutfits, type StyleRequest } from "@/lib/closet/stylist";
import type { Garment, Outfit } from "@/lib/closet/types";

export type SuggestResult = {
  source: "model" | "rules";
  outfits: Outfit[];
};

type SlimGarment = Pick<
  Garment,
  "id" | "name" | "brand" | "category" | "slot" | "color" | "styles" | "cut" | "owned" | "warmth" | "formality"
>;

function asGarment(item: SlimGarment): Garment {
  return {
    ...item,
    hex: "#d9d0c5",
    price: 0,
    image: "",
    addedAt: 0,
  };
}

function rulesFor(garments: Garment[], request: StyleRequest): SuggestResult {
  return { source: "rules", outfits: suggestOutfits(garments, request) };
}

export const suggestLooks = createServerFn({ method: "POST" })
  .validator((input: unknown): { garments: Garment[]; request: StyleRequest } => {
    if (!input || typeof input !== "object") throw new Error("请先选择场合");
    const body = input as { garments?: unknown; request?: unknown };
    if (!Array.isArray(body.garments) || !body.request || typeof body.request !== "object") {
      throw new Error("请先选择场合");
    }
    const request = body.request as Partial<StyleRequest>;
    if (typeof request.occasion !== "string" || typeof request.weather !== "string") {
      throw new Error("请先选择场合");
    }
    const garments = body.garments.slice(0, 80).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<SlimGarment>;
      if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.slot !== "string") return [];
      return [
        asGarment({
          id: row.id,
          name: row.name.slice(0, 24),
          brand: typeof row.brand === "string" ? row.brand.slice(0, 24) : "",
          category: (row.category ?? "上衣") as Garment["category"],
          slot: row.slot as Garment["slot"],
          color: typeof row.color === "string" ? row.color.slice(0, 12) : "",
          styles: Array.isArray(row.styles) ? row.styles.filter((style): style is string => typeof style === "string").slice(0, 4) : [],
          cut: typeof row.cut === "string" ? row.cut.slice(0, 24) : "",
          owned: Boolean(row.owned),
          warmth: row.warmth === 2 || row.warmth === 3 ? row.warmth : 1,
          formality: row.formality === 1 || row.formality === 3 ? row.formality : 2,
        }),
      ];
    });
    return {
      garments,
      request: {
        occasion: request.occasion,
        mood: typeof request.mood === "string" ? request.mood : "简约",
        weather: request.weather,
        rain: Boolean(request.rain),
        salt: typeof request.salt === "number" ? request.salt : 1,
        preferred: Array.isArray(request.preferred)
          ? request.preferred.filter((item): item is string => typeof item === "string").slice(0, 6)
          : [],
        limit: request.limit === 1 || request.limit === 2 ? request.limit : 3,
      },
    };
  })
  .handler(async ({ data }): Promise<SuggestResult> => {
    const { xaiChat, parseModelJson } = await import("./xai");
    const chat = await xaiChat({
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "你是穿搭顾问。只从用户列出的衣物 id 里搭配，禁止编造单品。" +
            "每套必须能穿出门：上衣加下装，或一条连衣裙，外套鞋子包包可选。" +
            "优先使用 owned 为 true 的衣服。给每套起一个中文短名，并用一两句中文说明为什么适合今天。" +
            '只返回 JSON：{"outfits":[{"name":"","garmentIds":["id"],"note":""}]}',
        },
        {
          role: "user",
          content: JSON.stringify({
            occasion: data.request.occasion,
            mood: data.request.mood,
            weather: data.request.weather,
            rain: data.request.rain,
            preferred: data.request.preferred,
            variant: data.request.salt,
            limit: data.request.limit ?? 3,
            garments: data.garments.map((garment) => ({
              id: garment.id,
              name: garment.name,
              brand: garment.brand,
              category: garment.category,
              slot: garment.slot,
              color: garment.color,
              styles: garment.styles,
              owned: garment.owned,
              warmth: garment.warmth,
            })),
          }),
        },
      ],
    });
    if (chat.ok) {
      const parsed = coerceOutfits(parseModelJson(chat.content), data.garments, data.request);
      if (parsed) {
        return {
          source: "model",
          outfits: parsed.map((outfit, index) => ({
            ...outfit,
            id: `gen-${data.request.salt}-${index}-${outfit.garmentIds.join("-")}`,
          })),
        };
      }
    }
    return rulesFor(data.garments, data.request);
  });
