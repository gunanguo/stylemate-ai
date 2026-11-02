import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PiecePhoto } from "@/components/closet-ui";
import { useCloset } from "@/lib/closet/store";
import { rerollOutfit, swapGarment, swapOptions } from "@/lib/closet/stylist";
import type { Garment, Outfit } from "@/lib/closet/types";

const toastStyle = {
  background: "#fffdfb",
  color: "#2c2825",
  border: "1px solid #e7e0d8",
};

export function OutfitSwap({
  outfit,
  pieces,
  weather,
  rain,
}: {
  outfit: Outfit;
  pieces: Garment[];
  weather: string;
  rain: boolean;
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
      <ul className="mt-3 space-y-2">
        {pieces.map((piece) => (
          <li key={piece.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTarget(piece)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                <PiecePhoto garment={piece} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{piece.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {piece.owned ? "已有" : "想买"}
                  {piece.brand ? ` · ${piece.brand}` : ""}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTarget(piece)}
              className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground"
            >
              换一件
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={shuffle}
        className="mt-3 min-h-11 text-sm font-semibold text-primary"
      >
        换一套
      </button>
      {target ? (
        <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md items-end bg-ink/40" onClick={() => setTarget(null)}>
          <div
            role="dialog"
            aria-labelledby="swap-title"
            className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl bg-background px-5 pt-4 pb-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <h2 id="swap-title" className="text-xl font-semibold">
                换成别的{target.category}
              </h2>
              <button type="button" onClick={() => setTarget(null)} className="min-h-11 px-2 text-sm font-semibold text-primary">
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
                className="w-full rounded-2xl border border-dashed border-primary/40 bg-card px-4 py-5 text-left text-sm font-semibold text-primary"
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
                      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-left"
                    >
                      <span className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <PiecePhoto garment={item} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.color}
                          {item.brand ? ` · ${item.brand}` : ""}
                        </span>
                      </span>
                      <span className={item.owned ? "text-xs text-success" : "text-xs font-semibold text-primary"}>
                        {item.owned ? "已有" : "想买"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
