import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { compressGarmentPhoto } from "@/components/closet-ui";
import { PageHeader } from "@/components/shell";
import { askCloset } from "@/lib/closet/ask";
import type { BuyAdvice } from "@/lib/closet/buy-advice";
import { useCloset } from "@/lib/closet/store";
import type { Garment } from "@/lib/closet/types";

export const Route = createFileRoute("/ask")({ component: AskPage });

const VERDICT_STYLE = {
  buy: "bg-success-soft text-success",
  skip: "bg-accent text-accent-foreground",
  maybe: "bg-secondary text-secondary-foreground",
} as const;

function AskPage() {
  const garments = useCloset((state) => state.garments);
  const ask = useServerFn(askCloset);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<BuyAdvice | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await compressGarmentPhoto(file));
    } catch (error) {
      toast(error instanceof Error ? error.message : "这张照片读不了");
    }
  }

  async function submit() {
    if (!text.trim() && !image) {
      toast("贴上商品描述，或上传一张照片");
      return;
    }
    setBusy(true);
    try {
      const result = await ask({
        data: { text, image, garments: slimGarments(garments) },
      });
      setAdvice(result);
    } catch (error) {
      toast(error instanceof Error ? error.message : "这次没问成，请再试一次");
    } finally {
      setBusy(false);
    }
  }

  const owned = garments.filter((item) => item.owned).length;

  return (
    <div>
      <PageHeader eyebrow="买之前" title="问一问衣橱" />
      <p className="px-5 pt-2 text-sm leading-relaxed text-muted-foreground">
        看到想买的衣服，先让它和你已经有的 {owned} 件比一比。能配出几套、是不是已经有类似的，再决定下单。
      </p>

      <section className="mx-5 mt-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <label className="block text-xs font-medium text-muted-foreground">
          商品链接或描述
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="例如：优衣库白色牛津纺衬衫，或贴一条淘宝链接"
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none"
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          淘宝和京东的页面打不开，链接只会当作文字。上传照片，或者写上颜色和品类，判断会准一些。
        </p>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-medium">
            <Camera className="h-4 w-4" />
            {image ? "换一张照片" : "上传照片"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
          {image ? (
            <button type="button" onClick={() => setImage("")} className="min-h-11 text-sm text-muted-foreground">
              不用照片
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              也可以只贴文字
            </span>
          )}
        </div>
        {image ? (
          <img src={image} alt="想买的单品" className="mt-3 h-40 w-full rounded-2xl object-cover" />
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-4 min-h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "正在对照衣橱…" : "问问衣橱"}
        </button>
      </section>

      {advice ? <Result advice={advice} garments={garments} /> : null}
    </div>
  );
}

function Result({ advice, garments }: { advice: BuyAdvice; garments: Garment[] }) {
  const byId = new Map(garments.map((item) => [item.id, item]));
  return (
    <section className="mx-5 mt-5 mb-4 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-primary">{advice.headline}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${VERDICT_STYLE[advice.verdict]}`}>
          {advice.verdict === "buy" ? "建议买" : advice.verdict === "skip" ? "建议跳过" : "先观望"}
        </span>
      </div>
      <p className="mt-3 text-sm">
        大约能多出 <span className="font-semibold">{advice.outfitCount}</span> 套穿法
        {advice.similar.length > 0 ? `，衣橱里已有 ${advice.similar.length} 件相近的` : "，衣橱里没有太像的"}。
      </p>
      <ul className="mt-3 space-y-2">
        {advice.reasons.map((reason) => (
          <li key={reason} className="text-sm leading-relaxed text-muted-foreground">
            {reason}
          </li>
        ))}
      </ul>
      {advice.similar.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">相近：{advice.similar.map((item) => item.name).join("、")}</p>
      ) : null}
      {advice.outfits.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {advice.outfits.map((outfit) => (
            <li key={outfit.garmentIds.join("-")} className="rounded-2xl bg-background px-3 py-3">
              <p className="text-sm font-semibold">{outfit.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {outfit.garmentIds.map((id) => byId.get(id)?.name ?? id).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        {advice.source === "model" ? "造型师对照了你的衣橱。" : "没有连上造型师，这是按颜色和品类做的估计。"}
      </p>
    </section>
  );
}

function slimGarments(garments: Garment[]) {
  return garments.map(({ id, name, brand, category, slot, color, styles, owned, warmth, formality }) => ({
    id,
    name,
    brand,
    category,
    slot,
    color,
    styles,
    owned,
    warmth,
    formality,
  }));
}
