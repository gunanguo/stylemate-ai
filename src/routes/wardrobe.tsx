import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { EmptyClosetCard, GarmentSheet, PiecePhoto } from "@/components/closet-ui";
import { authClient } from "@/lib/auth/client";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { costPerWear, wearStats } from "@/lib/closet/stats";
import { useCloset } from "@/lib/closet/store";
import { STYLE_TAGS, type Garment, type GarmentCategory } from "@/lib/closet/types";

type WardrobeSearch = { add?: boolean; piece?: string };
type Group = "全部" | "上衣" | "裤子" | "裙子" | "外套" | "鞋包";

const GROUPS: Array<{ id: Group; label: string }> = [
  { id: "全部", label: "全部" },
  { id: "上衣", label: "上衣" },
  { id: "裤子", label: "裤装" },
  { id: "裙子", label: "裙装" },
  { id: "外套", label: "外套" },
  { id: "鞋包", label: "鞋包" },
];

export const Route = createFileRoute("/wardrobe")({
  validateSearch: (search: Record<string, unknown>): WardrobeSearch => {
    const result: WardrobeSearch = {};
    if (search.add === true || search.add === "1" || search.add === "true") result.add = true;
    if (typeof search.piece === "string" && search.piece) result.piece = search.piece;
    return result;
  },
  component: WardrobePage,
});

function matchesGroup(item: Garment, group: Group) {
  if (group === "全部") return true;
  if (group === "鞋包") return item.category === "鞋子" || item.category === "包包";
  return item.category === (group as GarmentCategory);
}

function WardrobePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const requireAccount = useRequireAccount();
  const session = authClient.useSession();
  const garments = useCloset((state) => state.garments);
  const wornItems = useCloset((state) => state.wornItems);
  const removeGarment = useCloset((state) => state.removeGarment);
  const [group, setGroup] = useState<Group>("全部");
  const [style, setStyle] = useState("全部");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [sheet, setSheet] = useState<"add" | Garment | null>(null);
  const [detail, setDetail] = useState<Garment | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!search.add || session.isPending) return;
    if (!requireAccount({ kind: "add" })) {
      void navigate({ to: "/wardrobe", search: search.piece ? { piece: search.piece } : {}, replace: true });
      return;
    }
    setSheet("add");
    void navigate({ to: "/wardrobe", search: search.piece ? { piece: search.piece } : {}, replace: true });
  }, [search.add, search.piece, navigate, requireAccount, session.isPending]);

  useEffect(() => {
    if (!search.piece) return;
    const found = garments.find((item) => item.id === search.piece);
    if (found) setDetail(found);
  }, [search.piece, garments]);

  function openAdd() {
    setMenu(false);
    if (!requireAccount({ kind: "add" })) return;
    setSheet("add");
  }

  const styles = useMemo(() => {
    const extra = new Set<string>();
    for (const item of garments) for (const tag of item.styles) extra.add(tag);
    return STYLE_TAGS.filter((tag) => extra.has(tag));
  }, [garments]);

  const visible = garments.filter((item) => {
    if (ownedOnly && !item.owned) return false;
    if (wishOnly && item.owned) return false;
    if (!matchesGroup(item, group)) return false;
    if (style !== "全部" && !item.styles.includes(style)) return false;
    const hay = `${item.name} ${item.brand} ${item.color} ${item.cut}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const wishCount = garments.filter((item) => !item.owned).length;
  const filtered = Boolean(query || ownedOnly || wishOnly || group !== "全部" || style !== "全部");

  function resetFilters() {
    setQuery("");
    setGroup("全部");
    setStyle("全部");
    setOwnedOnly(false);
    setWishOnly(false);
  }

  return (
    <div className="px-6 pt-12">
      <header className="flex items-center justify-between gap-4">
        {searching ? (
          <label className="flex min-w-0 flex-1 items-center gap-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、品牌或颜色"
              aria-label="搜索衣物"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </label>
        ) : (
          <h1 className="display">衣橱</h1>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={searching ? "关闭搜索" : "搜索"}
            onClick={() => {
              setSearching((open) => !open);
              if (searching) setQuery("");
            }}
            className="flex h-11 w-8 items-center justify-center"
          >
            {searching ? <X className="h-5 w-5" strokeWidth={1.25} /> : <Search className="h-5 w-5" strokeWidth={1.25} />}
          </button>
          <button
            type="button"
            aria-label="更多"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className="flex h-11 w-8 items-center justify-center"
          >
            <Plus className="h-5 w-5" strokeWidth={1.25} />
          </button>
        </div>
      </header>
      {menu ? (
        <div className="relative">
          <div className="absolute right-0 z-20 mt-1 min-w-40 border border-border bg-background">
            <button type="button" onClick={openAdd} className="block w-full px-4 py-3 text-left text-sm">
              添加衣物
            </button>
            <Link to="/ask" onClick={() => setMenu(false)} className="block px-4 py-3 text-sm">
              买之前问一问
            </Link>
          </div>
        </div>
      ) : null}

      {garments.length === 0 ? (
        <EmptyClosetCard onAdd={openAdd} />
      ) : (
        <>
          <section className="mt-8">
            <div className="no-scrollbar -mx-6 flex gap-5 overflow-x-auto px-6">
              {GROUPS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGroup(item.id)}
                  className={
                    group === item.id
                      ? "shrink-0 pb-2 text-sm text-foreground underline decoration-foreground underline-offset-8"
                      : "shrink-0 pb-2 text-sm text-muted-foreground"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {garments.length} 件 · 想买 {wishCount}
              </p>
              <button type="button" onClick={() => setFilter(true)} className="text-sm text-muted-foreground">
                筛选
              </button>
            </div>
          </section>

          {visible.length === 0 ? (
            <div className="mt-8">
              <p className="text-[17px] font-medium">没有找到相关衣物</p>
              <button type="button" onClick={resetFilters} className="mt-3 text-sm text-muted-foreground">
                查看全部衣物
              </button>
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-x-2.5 gap-y-7">
              {visible.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setDetail(item)} className="w-full text-left">
                    <span className="block aspect-look overflow-hidden">
                      <PiecePhoto garment={item} />
                    </span>
                    <span className="mt-2 block truncate text-[13px]">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {item.brand || "—"}
                      {item.owned ? null : <span className="text-accent"> · 想买</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {filter
        ? createPortal(
            <div className="fixed inset-0 z-[70] mx-auto flex w-full max-w-md items-end bg-ink/40" onClick={() => setFilter(false)}>
              <div
                role="dialog"
                aria-labelledby="filter-title"
                className="max-h-[80dvh] w-full overflow-y-auto bg-background px-6 pt-6 pb-10"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 id="filter-title" className="text-[17px] font-medium">
                    筛选
                  </h2>
                  <button type="button" onClick={() => setFilter(false)} className="text-sm underline underline-offset-4">
                    完成
                  </button>
                </div>
                <div className="mt-6 flex gap-5">
                  {(
                    [
                      ["全部", !ownedOnly && !wishOnly],
                      ["只看已有", ownedOnly],
                      ["只看想买", wishOnly],
                    ] as const
                  ).map(([label, active]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setOwnedOnly(label === "只看已有");
                        setWishOnly(label === "只看想买");
                      }}
                      className={active ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
                  <button
                    type="button"
                    onClick={() => setStyle("全部")}
                    className={style === "全部" ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
                  >
                    全部风格
                  </button>
                  {styles.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStyle(style === item ? "全部" : item)}
                      className={style === item ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {sheet === "add" ? <GarmentSheet onClose={() => setSheet(null)} /> : null}
      {sheet && sheet !== "add" ? <GarmentSheet garment={sheet} onClose={() => setSheet(null)} /> : null}

      {detail ? (
        <div className="fixed inset-0 z-[60] mx-auto flex w-full max-w-md flex-col bg-background">
          <header className="flex items-center justify-between px-6 pt-12">
            <button type="button" onClick={() => setDetail(null)} className="text-sm text-muted-foreground">
              返回
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAccount({ kind: "piece", id: detail.id })) return;
                setSheet(detail);
                setDetail(null);
              }}
              className="text-sm underline underline-offset-4"
            >
              编辑
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-12">
            <div className="aspect-look overflow-hidden">
              <PiecePhoto garment={detail} />
            </div>
            <p className="eyebrow mt-4">{detail.brand || "未填写品牌"}</p>
            <h2 className="mt-2 text-[17px] font-medium">{detail.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.category} · {detail.color}
              {detail.cut ? ` · ${detail.cut}` : ""}
              {detail.owned ? "" : <span className="text-accent"> · 想买</span>}
            </p>
            {detail.styles.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{detail.styles.join(" · ")}</p>
            ) : null}
            {detail.price > 0 ? <p className="mt-3 text-sm">{cny(detail.price)}</p> : null}
            <WearLine garment={detail} wornItems={wornItems} />
            {confirming ? (
              <div className="mt-8">
                <p className="text-sm">确定要从衣橱中删除这件衣物吗？</p>
                <div className="mt-3 flex gap-5">
                  <button type="button" onClick={() => setConfirming(false)} className="text-sm text-muted-foreground">
                    保留
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireAccount({ kind: "piece", id: detail.id })) return;
                      const result = removeGarment(detail.id);
                      if (!result.ok) {
                        toast(result.error);
                        return;
                      }
                      toast.dismiss();
                      toast(`「${detail.name}」已删除`);
                      setDetail(null);
                      setConfirming(false);
                    }}
                    className="text-sm underline underline-offset-4"
                  >
                    删除
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="mt-8 text-sm text-muted-foreground">
                删除衣物
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WearLine({ garment, wornItems }: { garment: Garment; wornItems: Record<string, string[]> }) {
  const today = shanghaiNow().key;
  const stats = wearStats(garment.id, garment.addedAt, wornItems, today);
  const cost = costPerWear(garment.price, garment.owned, stats.count);
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      穿过 {stats.count} 次 · 闲置 {stats.idle === 0 ? "今天" : `${stats.idle} 天`}
      {cost == null ? "" : ` · 单次 ${cny(cost)}`}
    </p>
  );
}
