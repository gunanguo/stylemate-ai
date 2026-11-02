import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { LookPhoto, PiecePhoto, ShopLinks } from "@/components/closet-ui";
import { OutfitSwap } from "@/components/outfit-swap";
import { cny } from "@/lib/closet/dates";
import { useCloset } from "@/lib/closet/store";
import { missingPrice, piecesOf } from "@/lib/closet/stylist";
import type { Outfit } from "@/lib/closet/types";

export function OutfitDetail({
  outfit,
  weather,
  rain,
  onClose,
}: {
  outfit: Outfit;
  weather: string;
  rain: boolean;
  onClose: () => void;
}) {
  const garments = useCloset((state) => state.garments);
  const live = useCloset((state) => state.outfits.find((item) => item.id === outfit.id) ?? outfit);
  const toggleSave = useCloset((state) => state.toggleSave);
  const markOwned = useCloset((state) => state.markOwned);
  const addShopping = useCloset((state) => state.addShopping);
  const rememberOutfit = useCloset((state) => state.rememberOutfit);
  const requireAccount = useRequireAccount();
  const pieces = piecesOf(live, garments);
  const missing = pieces.filter((item) => !item.owned);
  const owned = pieces.length - missing.length;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] mx-auto flex w-full max-w-md flex-col bg-background">
      <header className="flex items-center justify-between px-6 pt-12">
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
          关闭
        </button>
        <button
          type="button"
          onClick={() => {
            if (!requireAccount({ kind: "save", outfitId: live.id })) return;
            if (!useCloset.getState().outfits.some((item) => item.id === live.id)) rememberOutfit(live);
            const saved = useCloset.getState().outfits.find((item) => item.id === live.id)?.saved;
            toggleSave(live.id);
            toast(saved ? "已取消收藏" : "已收藏造型");
          }}
          className="text-sm underline underline-offset-4"
        >
          {live.saved ? "已收藏" : "收藏"}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-12">
        <div className="aspect-look">
          <LookPhoto ids={live.garmentIds} pieces={pieces} alt={live.name} />
        </div>
        <h2 className="mt-4 text-[17px] font-medium">{live.name}</h2>
        {live.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{live.note}</p> : null}
        <p className="mt-3 text-sm text-muted-foreground">
          {pieces.length} 件 · 衣橱已有 {owned} 件
        </p>
        <OutfitSwap outfit={live} pieces={pieces} weather={weather} rain={rain} hideShuffle />
        {missing.length > 0 ? (
          <section className="mt-8">
            <h3 className="text-[17px] font-medium">还缺的单品</h3>
            <p className="mt-1 text-sm text-muted-foreground">补齐大约 {cny(missingPrice(pieces))}</p>
            <ul className="mt-2 border-t border-border">
              {missing.map((item) => (
                <li key={item.id} className="flex items-center gap-3 border-b border-border py-3">
                  <span className="h-16 w-12 shrink-0 overflow-hidden">
                    <PiecePhoto garment={item} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{item.name}</span>
                    <span className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {item.brand || "—"}
                      <span className="text-accent"> · 想买</span>
                    </span>
                    <span className="mt-1 block text-sm">{item.price > 0 ? cny(item.price) : "未标价"}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <ShopLinks item={item} className="flex-col items-end gap-0" />
                    <button
                      type="button"
                      onClick={() => {
                        if (!requireAccount({ kind: "own", id: item.id })) return;
                        markOwned(item.id);
                        toast(`「${item.name}」已放入衣橱`);
                      }}
                      className="text-sm text-muted-foreground"
                    >
                      我买了
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                const ids = missing.map((item) => item.id);
                if (!requireAccount({ kind: "shop", ids })) return;
                addShopping(ids);
                toast("已加入购买清单");
              }}
              className="mt-4 text-sm underline underline-offset-4"
            >
              全部加入购买清单
            </button>
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
