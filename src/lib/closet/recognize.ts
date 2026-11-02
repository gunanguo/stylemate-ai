import { createServerFn } from "@tanstack/react-start";
import { COLOR_OPTIONS, STYLE_TAGS, type GarmentCategory } from "@/lib/closet/types";

const CATEGORIES: GarmentCategory[] = ["上衣", "裤子", "裙子", "外套", "鞋子", "包包", "配饰"];

export type RecognizedGarment = {
  name: string;
  category: GarmentCategory;
  color: string;
  cut: string;
  styles: string[];
};

export type RecognizeResult =
  | { ok: true; garment: RecognizedGarment }
  | { ok: false; error: string };

function pickCategory(value: unknown): GarmentCategory {
  return CATEGORIES.includes(value as GarmentCategory) ? (value as GarmentCategory) : "上衣";
}

function pickStyles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 3);
}

export const recognizeGarment = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("请上传衣物照片");
    const image = (input as { image?: unknown }).image;
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      throw new Error("请上传衣物照片");
    }
    if (image.length > 900_000) throw new Error("照片太大，请换一张近景");
    return { image };
  })
  .handler(async ({ data }): Promise<RecognizeResult> => {
    const { xaiChat, parseModelJson } = await import("./xai");
    const allowedColors = COLOR_OPTIONS.join("、");
    const allowedStyles = STYLE_TAGS.join("、");
    const chat = await xaiChat({
      temperature: 0.2,
      maxTokens: 220,
      messages: [
        {
          role: "system",
          content:
            "你只根据照片识别一件服装。只返回 JSON，不要解释：" +
            '{"name":"中文短名","category":"上衣|裤子|裙子|外套|鞋子|包包|配饰","color":"颜色","cut":"款式短句","styles":["风格"]}',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `颜色优先用这些词：${allowedColors}。风格从这些里选 1 到 2 个：${allowedStyles}。不要编造品牌。`,
            },
            { type: "image_url", image_url: { url: data.image } },
          ],
        },
      ],
    });
    if (!chat.ok) {
      return {
        ok: false,
        error: chat.reason === "no-key" ? "识别暂不可用，请手动填写" : "网络不稳定，请稍后再试，或手动填写",
      };
    }
    try {
      const parsed = parseModelJson(chat.content);
      if (!parsed || typeof parsed !== "object") return { ok: false, error: "没有识别出来，请手动填写" };
      const record = parsed as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim().slice(0, 24) : "";
      if (!name) return { ok: false, error: "没有识别出来，请手动填写" };
      const color = typeof record.color === "string" ? record.color.trim().slice(0, 12) : "";
      const cut = typeof record.cut === "string" ? record.cut.trim().slice(0, 24) : "";
      return {
        ok: true,
        garment: {
          name,
          category: pickCategory(record.category),
          color: color || "奶油白",
          cut,
          styles: pickStyles(record.styles),
        },
      };
    } catch {
      return { ok: false, error: "没有识别出来，请手动填写" };
    }
  });
