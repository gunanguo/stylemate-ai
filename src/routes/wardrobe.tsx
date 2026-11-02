import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { Chip, EmptyClosetCard, GarmentSheet, PiecePhoto } from "@/components/closet-ui";
import { PageHeader } from "@/components/shell";
import { authClient } from "@/lib/auth/client";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { costPerWear, wearStats } from "@/lib/closet/stats";
import { useCloset } from "@/lib/closet/store";
import { CATEGORIES, STYLE_TAGS, type Category, type Garment } from "@/lib/closet/types";

type WardrobeSearch = { add?: boolean; piece?: string };

export const Route = createFileRoute("/wardrobe")({
  validateSearch: (search: Record<string, unknown>): WardrobeSearch => {
    const result: WardrobeSearch = {};
    if (search.add === true || search.add === "1" || search.add === "true") result.add = true;
    if (typeof search.piece === "string" && search.piece) result.piece = search.piece;
    return result;
  },
  component: WardrobePage,
});

function WardrobePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const requireAccount = useRequireAccount();
  const session = authClient.useSession();
  const garments = useCloset((state) => state.garments);
  const wornItems = useCloset((state) => state.wornItems);
  const removeGarment = useCloset((state) => state.removeGarment);
  const [category, setCategory] = useState<Category>("全部");
  const [style, setStyle] = useState("全部");
  const [query, setQuery] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
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

  function openAdd() {
    if (!requireAccount({ kind: "add" })) return;
    setSheet("add");
  }

  useEffect(() => {
    if (!search.piece) return;
    const found = garments.find((item) => item.id === search.piece);
    if (found) setDetail(found);
  }, [search.piece, garments]);

  const styles = useMemo(() => {
    const extra = new Set<string>();
    for (const item of garments) for (const tag of item.styles) extra.add(tag);
    return ["全部", ...STYLE_TAGS.filter((tag) => extra.has(tag))];
  }, [garments]);

  const visible = garments.filter((item) => {
    if (ownedOnly && !item.owned) return false;
    if (category !== "全部" && item.category !== category) return false;
    if (style !== "全部" && !item.styles.includes(style)) return false;
    const hay = `${item.name} ${item.brand} ${item.color} ${item.cut}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const ownedCount = garments.filter((item) => item.owned).length;
  const wishCount = garments.length - ownedCount;

  return (
    <div>
      <PageHeader eyebrow="我的数字衣橱" title="衣柜" />
      {garments.length === 0 ? (
        <>
          <EmptyClosetCard onAdd={openAdd} />
          <WishAsk count={0} />
        </>
      ) : (
        <>
      <div className="flex items-end justify-between px-5 pt-2">
        <p className="text-sm text-muted-foreground">
          已有 {ownedCount} 件 · 想买 {wishCount} 件
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
        >
          <Plus className="h-4 w-4" />
          添加衣物
        </button>
      </div>

      <div className="px-5 pt-4">
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、品牌或颜色"
            aria-label="搜索衣物"
            className="w-full bg-transparent text-sm outline-none"
          />
          {query ? (
            <button type="button" aria-label="清除搜索" onClick={() => setQuery("")}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
        {CATEGORIES.map((item) => (
          <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-5">
        <Chip active={!ownedOnly} onClick={() => setOwnedOnly(false)}>
          含想买
        </Chip>
        <Chip active={ownedOnly} onClick={() => setOwnedOnly(true)}>
          只看已有
        </Chip>
        {styles
          .filter((item) => item !== "全部")
          .map((item) => (
            <Chip key={item} active={style === item} onClick={() => setStyle(style === item ? "全部" : item)}>
              {item}
            </Chip>
          ))}
      </div>

      <WishAsk count={wishCount} />

      {visible.length === 0 ? (
        <Empty onAdd={openAdd} filtered={Boolean(query || ownedOnly || category !== "全部" || style !== "全部")} onReset={() => {
          setQuery("");
          setCategory("全部");
          setStyle("全部");
          setOwnedOnly(false);
        }} />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 px-5">
          {visible.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setDetail(item)} className="w-full text-left">
                <div className="aspect-look overflow-hidden rounded-2xl bg-muted">
                  <PiecePhoto garment={item} />
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{item.brand || "未填写品牌"}</p>
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.color}
                  {item.owned ? "" : " · 新品"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

        </>
      )}

      {sheet === "add" ? <GarmentSheet onClose={() => setSheet(null)} /> : null}
      {sheet && sheet !== "add" ? <GarmentSheet garment={sheet} onClose={() => setSheet(null)} /> : null}

      {detail ? (
        <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md flex-col bg-background">
          <header className="flex items-center justify-between px-5 pt-10">
            <button type="button" onClick={() => setDetail(null)} className="min-h-11 text-sm font-semibold text-primary">
              返回
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAccount({ kind: "piece", id: detail.id })) return;
                setSheet(detail);
                setDetail(null);
              }}
              className="flex min-h-11 items-center gap-1 text-sm font-semibold"
            >
              <Pencil className="h-4 w-4" />
              编辑
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 pb-10">
            <div className="aspect-look overflow-hidden rounded-3xl bg-muted">
              <PiecePhoto garment={detail} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{detail.brand || "未填写品牌"}</p>
            <h2 className="text-2xl font-semibold text-primary">{detail.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.category} · {detail.color}
              {detail.cut ? ` · ${detail.cut}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.styles.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                  {tag}
                </span>
              ))}
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                {detail.owned ? "已拥有" : "新品"}
              </span>
            </div>
            {detail.price > 0 ? <p className="mt-4 text-lg font-bold">{cny(detail.price)}</p> : null}
            <WearLine garment={detail} wornItems={wornItems} />
            {confirming ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm">确定要从衣橱中删除这件衣物吗？</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="min-h-11 flex-1 rounded-xl bg-secondary text-sm font-medium"
                  >
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
                    className="min-h-11 flex-1 rounded-xl bg-destructive text-sm font-semibold text-primary-foreground"
                  >
                    删除
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-6 flex min-h-11 items-center gap-2 text-sm font-medium text-destructive"
              >
                <Trash2 className="h-4 w-4" />
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
    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
      <Stat label="穿过" value={`${stats.count} 次`} />
      <Stat label="闲置" value={stats.idle === 0 ? "今天" : `${stats.idle} 天`} />
      <Stat label="单次" value={cost == null ? "—" : cny(cost)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function WishAsk({ count }: { count: number }) {
  return (
    <Link
      to="/ask"
      className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">买之前先问问衣橱</span>
        <span className="block text-xs text-muted-foreground">
          {count > 0 ? `想买清单里有 ${count} 件` : "想买的时候，先对照衣橱"}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
    </Link>
  );
}

function Empty({
  filtered,
  onAdd,
  onReset,
}: {
  filtered: boolean;
  onAdd: () => void;
  onReset: () => void;
}) {
  if (filtered) {
    return (
      <div className="mx-5 mt-8 rounded-3xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-lg font-semibold">没有找到相关衣物</p>
        <p className="mt-1 text-sm text-muted-foreground">换个关键词、类别或风格标签试试</p>
        <button type="button" onClick={onReset} className="mt-4 min-h-11 text-sm font-semibold text-primary">
          查看全部衣物
        </button>
      </div>
    );
  }
  return <EmptyClosetCard onAdd={onAdd} />;
}
