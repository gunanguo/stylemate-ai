import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bell, CloudSun, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyClosetCard, LookCollage, PiecePhoto, RemotePhoto, ShopLinks } from "@/components/closet-ui";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { buildNotices, markNoticesRead, readNoticeIds } from "@/lib/closet/notices";
import { wearStats } from "@/lib/closet/stats";
import { useCloset } from "@/lib/closet/store";
import { isComplete, missingPrice, piecesOf } from "@/lib/closet/stylist";
import type { Garment } from "@/lib/closet/types";
import { useLiveWeather } from "@/lib/closet/weather";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const profile = useCloset((state) => state.profile);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const dailyDate = useCloset((state) => state.dailyDate);
  const dailyOutfitId = useCloset((state) => state.dailyOutfitId);
  const toggleSave = useCloset((state) => state.toggleSave);
  const wear = useCloset((state) => state.wear);
  const markOwned = useCloset((state) => state.markOwned);
  const addShopping = useCloset((state) => state.addShopping);
  const wornItems = useCloset((state) => state.wornItems);
  const shopping = useCloset((state) => state.shopping);
  const [panel, setPanel] = useState<"notice" | "buy" | null>(null);
  const now = shanghaiNow();
  const forecast = useLiveWeather(profile.city);

  const owned = garments.filter((item) => item.owned);
  const saved = outfits.filter((item) => item.saved && piecesOf(item, garments).length > 0);
  const complete = saved.filter((item) => isComplete(piecesOf(item, garments)));
  const featured =
    outfits.find((item) => item.id === (dailyDate === now.key ? dailyOutfitId : "look-commute")) ??
    saved[0] ??
    outfits[0];
  const pieces = featured ? piecesOf(featured, garments) : [];
  const missing = pieces.filter((item) => !item.owned);
  const categoryCards: Array<{ key: string; label: string; src: string; items: Garment[] }> = [
    {
      key: "tops",
      label: "上衣",
      src: "/categories/tops.jpg",
      items: garments.filter((item) => item.category === "上衣"),
    },
    {
      key: "dresses",
      label: "连衣裙",
      src: "/categories/dresses.jpg",
      items: garments.filter((item) => item.slot === "onepiece" || /连衣/.test(`${item.name}${item.cut}`)),
    },
    {
      key: "shoes",
      label: "鞋子与包包",
      src: "/categories/shoes.jpg",
      items: garments.filter((item) => item.category === "鞋子" || item.category === "包包"),
    },
  ];
  const idle = owned
    .map((item) => ({ name: item.name, days: wearStats(item.id, item.addedAt, wornItems, now.key).idle }))
    .filter((item) => item.days >= 21)
    .sort((a, b) => b.days - a.days);
  const [readIds, setReadIds] = useState<string[] | null>(null);
  const notices = buildNotices({
    today: now.key,
    wornToday: Boolean(worn[now.key]),
    forecastLive: forecast.live,
    forecastLabel: forecast.label,
    forecastAdvice: forecast.advice,
    missingNames: missing.map((item) => item.name),
    idle,
    shoppingCount: shopping.length,
  });
  const unread = readIds ? notices.filter((notice) => !readIds.includes(notice.id)) : [];

  useEffect(() => {
    setReadIds(readNoticeIds());
  }, []);

  function markRead(ids: string[]) {
    setReadIds(markNoticesRead(ids));
  }

  return (
    <div>
      <header className="flex items-center justify-between px-5 pt-12 pb-2">
        <p className="text-xl font-semibold tracking-tight italic">
          StyleMate <span className="text-primary">AI</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="通知"
            onClick={() => setPanel("notice")}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unread.length > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unread.length}
              </span>
            ) : null}
          </button>
          <Link
            to="/profile"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
          >
            {profile.name.slice(0, 1)}
          </Link>
        </div>
      </header>

      {unread[0] ? (
        <section className="animate-rise mx-5 mt-3 rounded-2xl border border-primary/25 bg-card px-4 py-3 shadow-soft">
          <p className="text-xs font-medium text-primary">新提醒{unread.length > 1 ? ` · 还有 ${unread.length - 1} 条` : ""}</p>
          <p className="mt-1 font-semibold">{unread[0].title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{unread[0].body}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPanel("notice")}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              查看
            </button>
            <button
              type="button"
              onClick={() => markRead([unread[0].id])}
              className="min-h-11 px-3 text-sm font-semibold text-primary"
            >
              知道了
            </button>
          </div>
        </section>
      ) : null}

      {garments.length === 0 ? (
        <>
          <EmptyClosetCard onAdd={() => void navigate({ to: "/wardrobe", search: { add: true } })} />
          <AskClosetCard className="mt-5" count={0} />
        </>
      ) : (
        <>
      <section className="animate-rise px-5 pt-5">
        <p className="text-xs font-medium text-muted-foreground">{now.label}</p>
        <h1 className="mt-1 text-3xl leading-tight">
          {now.hello}，<span className="font-semibold text-primary">{profile.name}</span>
        </h1>
        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CloudSun className="h-4 w-4" strokeWidth={1.75} />
          <span>{forecast.label}</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            [saved.length, "收藏造型"],
            [owned.length, "衣物"],
            [complete.length, "完整搭配"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-card px-4 py-3.5">
              <p className="text-xl font-semibold">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {featured ? (
        <section className="animate-rise mt-8 px-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="shrink-0 text-base font-semibold">今日穿搭</h2>
            <div className="flex min-w-0 flex-col items-end gap-1">
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                {missing.length === 0 ? "全部来自衣橱" : `差 ${missing.length} 件`}
              </span>
              {featured.note ? (
                <p className="line-clamp-2 text-right text-xs leading-snug text-primary">{featured.note}</p>
              ) : null}
            </div>
          </div>
          <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="relative aspect-look">
              <RemotePhoto
                src="/hero/outfit-today.jpg"
                alt="今日穿搭"
                className="h-full w-full object-cover"
                fallback={<LookCollage pieces={pieces} className="aspect-auto h-full rounded-none" />}
              />
              <span className="absolute top-3 right-3 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                今日首选
              </span>
            </div>
            <div className="px-4 pt-4 pb-4">
              <h3 className="text-lg font-semibold">{featured.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {featured.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
                {pieces.map((piece) => (
                  <li key={piece.id} className="w-28 shrink-0 rounded-xl border border-border bg-background px-3 py-2">
                    <p className="truncate text-xs text-muted-foreground">{piece.brand || "未填写品牌"}</p>
                    <p className="truncate text-xs font-semibold">{piece.name}</p>
                    {!piece.owned ? <p className="mt-0.5 text-xs font-semibold text-primary">新品</p> : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">{missing.length > 0 ? "补齐新品" : "这套都在衣橱里"}</p>
                  <p className="text-lg font-bold">{missing.length > 0 ? cny(missingPrice(pieces)) : cny(0)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => (missing.length > 0 ? setPanel("buy") : toast("没有要买的单品"))}
                  className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
                >
                  去购买 <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                衣橱已有 {pieces.length - missing.length} 件 · 新品 {missing.length} 件
              </p>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    toggleSave(featured.id);
                    toast(featured.saved ? "已取消收藏" : "已收藏造型");
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-secondary text-sm font-medium"
                >
                  {featured.saved ? "已收藏" : "收藏造型"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wear(now.key, featured.id);
                    toast(worn[now.key] === featured.id ? "今天就穿这套" : "已记下，今天就穿");
                  }}
                  className="min-h-12 flex-[1.6] rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-float"
                >
                  {worn[now.key] === featured.id ? "今天穿着" : "今天就穿"}
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <AskClosetCard className="animate-rise mt-5" count={owned.length} />

      <section className="animate-rise mt-8 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">衣物分类</h2>
          <Link to="/wardrobe" className="text-sm font-semibold text-primary">
            查看全部
          </Link>
        </div>
        <div className="mt-3 grid gap-3">
          {categoryCards.map((card) => (
            <Link
              key={card.key}
              to="/wardrobe"
              className="relative block h-36 overflow-hidden rounded-3xl bg-muted shadow-soft"
            >
              <RemotePhoto
                src={card.src}
                alt={card.label}
                className="h-full w-full object-cover"
                fallback={<CategoryFallback items={card.items} label={card.label} />}
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent px-4 pt-10 pb-3 text-ink-foreground">
                <span className="block text-lg font-semibold">{card.label}</span>
                <span className="block text-xs">{card.items.length} 件</span>
              </span>
            </Link>
          ))}
        </div>
        <Link
          to="/wardrobe"
          search={{ add: true }}
          className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-card text-sm font-semibold text-primary"
        >
          添加衣物
        </Link>
      </section>
        </>
      )}

      {panel === "notice" ? (
        <Sheet title="通知" onClose={() => setPanel(null)}>
          {unread.length > 0 ? (
            <button
              type="button"
              onClick={() => markRead(unread.map((notice) => notice.id))}
              className="mb-3 min-h-11 text-sm font-semibold text-primary"
            >
              全部标为已读
            </button>
          ) : null}
          {notices.map((notice) => (
            <Notice
              key={notice.id}
              title={notice.title}
              body={notice.body}
              unread={readIds ? !readIds.includes(notice.id) : false}
              onRead={() => markRead([notice.id])}
            />
          ))}
          {notices.length === 0 ? <p className="text-sm text-muted-foreground">今天没有新的提醒。</p> : null}
        </Sheet>
      ) : null}

      {panel === "buy" ? (
        <Sheet title="补齐这套" onClose={() => setPanel(null)}>
          <ul className="space-y-3">
            {missing.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-2xl border border-border bg-card p-2">
                <div className="h-20 w-16 overflow-hidden rounded-xl bg-muted">
                  <PiecePhoto garment={item} />
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <p className="text-xs text-muted-foreground">{item.brand || "设计师单品"}</p>
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-sm font-semibold">{cny(item.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-center">
                  <ShopLinks item={item} className="flex-col items-end gap-0" />
                  <button
                    type="button"
                    onClick={() => {
                      markOwned(item.id);
                      toast(`「${item.name}」已放入衣橱`);
                    }}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    我买了
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {missing.length === 0 ? <p className="text-sm text-muted-foreground">新品都标好了。</p> : (
            <button
              type="button"
              onClick={() => {
                addShopping(missing.map((item) => item.id));
                toast("已加入购买清单");
              }}
              className="mt-4 min-h-11 w-full rounded-xl bg-ink text-sm font-semibold text-ink-foreground"
            >
              全部加入购买清单
            </button>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}

function AskClosetCard({ className, count }: { className?: string; count: number }) {
  return (
    <Link
      to="/ask"
      className={`mx-5 flex items-center justify-between gap-3 rounded-3xl bg-primary p-5 text-primary-foreground shadow-float ${className ?? ""}`}
    >
      <span className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
          <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold">买之前先问问衣橱</span>
          <span className="block text-xs opacity-80">
            {count > 0 ? `先看它能配出几套，衣橱里已有 ${count} 件` : "先看它能配出几套，再决定要不要买"}
          </span>
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0" />
    </Link>
  );
}

function CategoryFallback({ items, label }: { items: Garment[]; label: string }) {
  const covers = items.slice(0, 3);
  if (covers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-accent text-sm font-semibold text-accent-foreground">
        {label}
      </div>
    );
  }
  const columns = covers.length === 1 ? "grid-cols-1" : covers.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid h-full ${columns}`}>
      {covers.map((item) => (
        <PiecePhoto key={item.id} garment={item} />
      ))}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md items-end bg-ink/40" onClick={onClose}>
      <div
        className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-background px-5 pt-4 pb-10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-semibold text-primary">
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Notice({
  title,
  body,
  unread,
  onRead,
}: {
  title: string;
  body: string;
  unread: boolean;
  onRead: () => void;
}) {
  return (
    <article className="mb-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {unread ? (
        <button type="button" onClick={onRead} className="mt-2 min-h-11 text-sm font-semibold text-primary">
          标为已读
        </button>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">已读</p>
      )}
    </article>
  );
}
