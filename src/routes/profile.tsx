import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { AccountCard } from "@/components/account-card";
import { Chip, ShopLinks } from "@/components/closet-ui";
import { PageHeader } from "@/components/shell";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { wearStats } from "@/lib/closet/stats";
import { closetFromText, type ClosetData } from "@/lib/closet/storage";
import { useCloset } from "@/lib/closet/store";
import { isComplete, piecesOf } from "@/lib/closet/stylist";
import { STYLE_TAGS, type Garment } from "@/lib/closet/types";
import { CITIES, nearestCity } from "@/lib/closet/weather";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const profile = useCloset((state) => state.profile);
  const setName = useCloset((state) => state.setName);
  const setCity = useCloset((state) => state.setCity);
  const toggleStyle = useCloset((state) => state.toggleStyle);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const wornItems = useCloset((state) => state.wornItems);
  const markOwned = useCloset((state) => state.markOwned);
  const toggleShopping = useCloset((state) => state.toggleShopping);
  const importCloset = useCloset((state) => state.importCloset);
  const reset = useCloset((state) => state.reset);
  const requireAccount = useRequireAccount();
  const [name, setLocal] = useState(profile.name);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = shanghaiNow().key;

  useEffect(() => {
    setLocal(profile.name);
  }, [profile.name]);

  const owned = garments.filter((item) => item.owned).length;
  const saved = outfits.filter((item) => item.saved);
  const complete = saved.filter((item) => isComplete(piecesOf(item, garments))).length;

  return (
    <div>
      <PageHeader eyebrow="我的" title={profile.name || "StyleMate"} />
      <div className="px-5 pt-4">
        <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-foreground">
            {(profile.name || "S").slice(0, 1)}
          </div>
          <div>
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">用心穿搭，从容生活。</p>
          </div>
        </div>
        <AccountCard />

        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            [owned, "衣物"],
            [saved.length, "收藏"],
            [Object.keys(worn).length, "穿过的日子"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-card px-3 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">{complete} 套收藏不用再买新衣服。</p>

        <label className="mt-8 block text-xs font-medium text-muted-foreground">
          怎么称呼你
          <input
            value={name}
            onChange={(event) => setLocal(event.target.value)}
            onBlur={() => {
              const next = name.trim() || "小满";
              setLocal(next);
              if (next === profile.name) return;
              if (!requireAccount({ kind: "profile" })) return;
              setName(next);
            }}
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
          />
        </label>

        <h2 className="mt-8 text-sm font-semibold">所在城市</h2>
        <p className="mt-1 text-sm text-muted-foreground">天气和日历预报跟着这个城市走。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <Chip
              key={city.name}
              active={profile.city === city.name}
              onClick={() => {
                if (!requireAccount({ kind: "profile" })) return;
                setCity(city.name);
              }}
            >
              {city.name}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) {
              toast("这台设备没有定位");
              return;
            }
            if (!requireAccount({ kind: "profile" })) return;
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const city = nearestCity(position.coords.latitude, position.coords.longitude);
                setCity(city.name);
                toast(`已切换到${city.name}`);
              },
              () => toast("没有获取到位置，仍使用当前城市"),
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
            );
          }}
          className="mt-3 min-h-11 text-sm font-semibold text-primary"
        >
          使用我的位置
        </button>

        <ShoppingList
          garments={garments}
          onBought={(id) => {
            if (!requireAccount({ kind: "own", id })) return;
            markOwned(id);
          }}
          onRemove={(id) => {
            if (!requireAccount({ kind: "shop", ids: [id] })) return;
            toggleShopping(id);
          }}
        />

        <IdleList garments={garments} wornItems={wornItems} today={today} />

        <h2 className="mt-8 text-sm font-semibold">风格偏好</h2>
        <p className="mt-1 text-sm text-muted-foreground">造型师会顺着这些气质来配，而不是定死规则。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STYLE_TAGS.map((style) => (
            <Chip
              key={style}
              active={profile.styles.includes(style)}
              onClick={() => {
                if (!requireAccount({ kind: "profile" })) return;
                toggleStyle(style);
              }}
            >
              {style}
            </Chip>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold">备份</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            登录后的衣橱保存在服务器。也可以导出一份文件，当作额外备份。
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => downloadCloset(useCloset.getState())}
              className="min-h-11 flex-1 rounded-xl bg-secondary text-sm font-medium"
            >
              导出
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAccount({ kind: "profile" })) return;
                fileRef.current?.click();
              }}
              className="min-h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-ink-foreground"
            >
              导入
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const data = closetFromText(await file.text());
              if (!data) {
                toast("这份文件不是衣橱备份");
                return;
              }
              const result = importCloset(data);
              if (!result.ok) {
                toast(result.error);
                return;
              }
              setLocal(data.profile.name);
              toast(result.warning ?? "备份已导入");
            }}
          />
        </section>

        <section className="mt-10 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold">示例衣橱</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            恢复小满的十件示范单品和已收藏造型。你之后添加的衣服会被清掉。
          </p>
          {confirm ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="min-h-11 flex-1 rounded-xl bg-secondary text-sm font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setLocal("小满");
                  setConfirm(false);
                  toast("已恢复示例衣橱");
                }}
                className="min-h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-ink-foreground"
              >
                确认恢复
              </button>
            </div>
          ) : (
            <button
              type="button"
                onClick={() => {
                  if (!requireAccount({ kind: "profile" })) return;
                  setConfirm(true);
                }}
              className="mt-4 min-h-11 text-sm font-semibold text-primary"
            >
              恢复示例衣橱
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function downloadCloset(state: ClosetData) {
  const payload = {
    version: 1,
    state: {
      profile: state.profile,
      garments: state.garments,
      outfits: state.outfits,
      worn: state.worn,
      wornItems: state.wornItems ?? {},
      shopping: state.shopping ?? [],
      dailyDate: state.dailyDate,
      dailyOutfitId: state.dailyOutfitId,
      salt: state.salt,
    },
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stylemate-${shanghaiNow().key}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ShoppingList({
  garments,
  onBought,
  onRemove,
}: {
  garments: Garment[];
  onBought: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const seen = new Set<string>();
  const items = garments.filter((item) => {
    if (item.owned || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">购买清单</h2>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">还没有想买的单品。缺的衣服可以在今日页加入。</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.price > 0 ? cny(item.price) : "未标价"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ShopLinks item={item} />
                <button type="button" onClick={() => onBought(item.id)} className="min-h-11 text-sm font-semibold">
                  已买
                </button>
                <button type="button" onClick={() => onRemove(item.id)} className="min-h-11 text-sm text-muted-foreground">
                  移除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IdleList({
  garments,
  wornItems,
  today,
}: {
  garments: Garment[];
  wornItems: Record<string, string[]>;
  today: string;
}) {
  const idle = garments
    .filter((item) => item.owned)
    .map((item) => ({ item, days: wearStats(item.id, item.addedAt, wornItems, today).idle }))
    .filter((entry) => entry.days >= 14)
    .sort((a, b) => b.days - a.days)
    .slice(0, 3);
  if (idle.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">闲置</h2>
      <ul className="mt-3 space-y-2">
        {idle.map(({ item, days }) => (
          <li key={item.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-3 text-sm">
            <span className="truncate font-medium">{item.name}</span>
            <span className="text-muted-foreground">{days} 天没穿</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
