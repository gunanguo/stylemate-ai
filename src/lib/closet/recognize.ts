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
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "识别暂不可用，请手动填写" };

    const allowedColors = COLOR_OPTIONS.join("、");
    const allowedStyles = STYLE_TAGS.join("、");
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 220,
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
        }),
      });
      if (!res.ok) return { ok: false, error: "网络不稳定，请稍后再试，或手动填写" };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = body.choices?.[0]?.message?.content ?? "";
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      if (jsonStart < 0 || jsonEnd < jsonStart) {
        return { ok: false, error: "没有识别出来，请手动填写" };
      }
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 24) : "";
      if (!name) return { ok: false, error: "没有识别出来，请手动填写" };
      const color = typeof parsed.color === "string" ? parsed.color.trim().slice(0, 12) : "";
      const cut = typeof parsed.cut === "string" ? parsed.cut.trim().slice(0, 24) : "";
      return {
        ok: true,
        garment: {
          name,
          category: pickCategory(parsed.category),
          color: color || "奶油白",
          cut,
          styles: pickStyles(parsed.styles),
        },
      };
    } catch {
      return { ok: false, error: "网络不稳定，请稍后再试，或手动填写" };
    }
  });
