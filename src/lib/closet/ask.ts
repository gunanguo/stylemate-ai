import { createServerFn } from "@tanstack/react-start";
import { adviseFromCloset, coerceBuyAdvice, type BuyAdvice } from "@/lib/closet/buy-advice";
import type { Garment } from "@/lib/closet/types";

type Slim = Pick<
  Garment,
  "id" | "name" | "brand" | "category" | "slot" | "color" | "styles" | "owned" | "warmth" | "formality"
>;

function asGarment(row: Partial<Slim>): Garment | null {
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.slot !== "string") return null;
  return {
    id: row.id,
    name: row.name.slice(0, 24),
    brand: typeof row.brand === "string" ? row.brand.slice(0, 24) : "",
    category: (row.category ?? "上衣") as Garment["category"],
    slot: row.slot as Garment["slot"],
    color: typeof row.color === "string" ? row.color.slice(0, 12) : "",
    hex: "#d9d0c5",
    styles: Array.isArray(row.styles) ? row.styles.filter((style): style is string => typeof style === "string").slice(0, 4) : [],
    cut: "",
    price: 0,
    owned: Boolean(row.owned),
    image: "",
    warmth: row.warmth === 2 || row.warmth === 3 ? row.warmth : 1,
    formality: row.formality === 1 || row.formality === 3 ? row.formality : 2,
    addedAt: 0,
  };
}

export const askCloset = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("先写下想买的东西");
    const body = input as { text?: unknown; image?: unknown; garments?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : "";
    if (!text && !image) throw new Error("贴上商品描述，或上传一张照片");
    if (image.length > 900_000) throw new Error("照片太大，请换一张近景");
    const garments = Array.isArray(body.garments)
      ? body.garments.slice(0, 80).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const garment = asGarment(item as Partial<Slim>);
          return garment ? [garment] : [];
        })
      : [];
    return { text, image, garments };
  })
  .handler(async ({ data }): Promise<BuyAdvice> => {
    const fallback = adviseFromCloset(data.text, data.garments);
    if (!data.text && data.image) {
      fallback.reasons = ["单靠照片时需要造型师看图。也可以再补一句，比如「米色风衣」。", ...fallback.reasons].slice(0, 4);
    }
    const { xaiChat, parseModelJson } = await import("./xai");
    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: "text",
        text: JSON.stringify({
          note: "链接打不开，只根据这段文字和照片判断。不要编造衣橱里没有的 id。",
          considering: data.text,
          closet: data.garments.map((garment) => ({
            id: garment.id,
            name: garment.name,
            category: garment.category,
            slot: garment.slot,
            color: garment.color,
            owned: garment.owned,
          })),
        }),
      },
    ];
    if (data.image) userContent.push({ type: "image_url", image_url: { url: data.image } });
    const chat = await xaiChat({
      temperature: 0.3,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "你帮用户决定要不要买一件还没入手的衣服。对照他的衣橱：" +
            "数一数它能和已有衣服配出几套，指出是否已经有相近单品，并给出买或先不买。" +
            "similarIds 和 outfits.garmentIds 只能使用衣橱里的 id。" +
            '只返回 JSON：{"verdict":"buy|skip|maybe","headline":"四到八个字","reasons":["原因"],"similarIds":["id"],"outfits":[{"name":"","garmentIds":["id"]}]}',
        },
        { role: "user", content: userContent },
      ],
    });
    if (!chat.ok) return fallback;
    const parsed = parseModelJson(chat.content);
    return coerceBuyAdvice(parsed, data.garments, fallback);
  });
