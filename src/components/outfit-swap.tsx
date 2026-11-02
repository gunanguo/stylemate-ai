import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PiecePhoto } from "@/components/closet-ui";
import { useCloset } from "@/lib/closet/store";
import { rerollOutfit, swapGarment, swapOptions } from "@/lib/closet/stylist";
import type { Garment, Outfit } from "@/lib/closet/types";

const toastStyle = {
  background: "#faf8f5",
  color: "#1c1b19",
  border: "1px solid #e9e5df",
};

export function OutfitSwap({
  outfit,
  pieces,
  weather,
  rain,
  hidePieces = false,
  hideShuffle = false,
  shuffleClassName = "text-sm text-muted-foreground",
}: {
  outfit: Outfit;
  pieces: Garment[];
  weather: string;
  rain: boolean;
  hidePieces?: boolean;
  hideShuffle?: boolean;
  shuffleClassName?: string;
}) {
  const garments = useCloset((state) => state.garments);
  const replaceOutfit = useCloset((state) => state.replaceOutfit);
  const navigate = useNavigate();
  const [target, setTarget] = useState<Garment | null>(null);
  const options = target ? swapOptions(garments, target, outfit.garmentIds) : [];

  function apply(next: Outfit, label: string, previous: Outfit) {
    replaceOutfit(next);
    toast(label, {
      id: "outfit-swap",
      style: toastStyle,
      action: {
        label: "撤销",
        onClick: () => replaceOutfit(previous),
      },
    });
  }

  function choose(item: Garment) {
    if (!target) return;
    const previous = outfit;
    const next = swapGarment(outfit, target.id, item, garments, weather, rain);
    setTarget(null);
    apply(next, `已换成 ${item.name}`, previous);
  }

  function shuffle() {
    const next = rerollOutfit(outfit, garments, weather, rain, Date.now() % 100000);
    if (!next) {
      toast("衣柜里暂时没有另一套", { id: "outfit-swap", style: toastStyle });
      return;
    }
    apply(next, "已换成一套新的", outfit);
  }

  return (
    <div>
      {hidePieces ? null : (
        <ul className="mt-6 border-t border-border">
          {pieces.map((piece) => (
            <li key={piece.id} className="flex items-center gap-3 border-b border-border py-3">
              <button
                type="button"
                onClick={() => setTarget(piece)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="h-16 w-12 shrink-0 overflow-hidden">
                  <PiecePhoto garment={piece} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{piece.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    {piece.brand || "—"}
                    {piece.owned ? "" : <span className="text-accent"> · 想买</span>}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => setTarget(piece)} className="shrink-0 text-sm text-muted-foreground">
                换一件
              </button>
            </li>
          ))}
        </ul>
      )}
      {hideShuffle ? null : (
        <button type="button" onClick={shuffle} className={shuffleClassName}>
          换一套
        </button>
      )}
      {target
        ? createPortal(
        <div className="fixed inset-0 z-[70] mx-auto flex w-full max-w-md items-end bg-ink/40" onClick={() => setTarget(null)}>
          <div
            role="dialog"
            aria-labelledby="swap-title"
            className="max-h-[75dvh] w-full overflow-y-auto bg-background px-6 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 id="swap-title" className="text-[17px] font-medium">
                换成别的{target.category}
              </h2>
              <button type="button" onClick={() => setTarget(null)} className="min-h-11 text-sm text-muted-foreground">
                关闭
              </button>
            </div>
            {options.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setTarget(null);
                  void navigate({ to: "/wardrobe", search: { add: true } });
                }}
                className="w-full border border-border px-4 py-5 text-left text-sm"
              >
                衣柜里没有别的{target.category}，去添加
              </button>
            ) : (
              <ul className="space-y-2">
                {options.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      className="flex min-h-16 w-full items-center gap-3 border-b border-border py-3 text-left"
                    >
                      <span className="h-16 w-12 shrink-0 overflow-hidden">
                        <PiecePhoto garment={item} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{item.name}</span>
                        <span className="block truncate text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                          {item.brand || item.color}
                          {item.owned ? "" : <span className="text-accent"> · 想买</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
