import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { ShopLinks } from "@/components/closet-ui";
import { signOut } from "@/lib/auth/client";
import { authClient } from "@/lib/auth/client";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { wearStats } from "@/lib/closet/stats";
import { closetFromText, type ClosetData } from "@/lib/closet/storage";
import { useCloset } from "@/lib/closet/store";
import { STYLE_TAGS, type Garment } from "@/lib/closet/types";
import { CITIES, nearestCity } from "@/lib/closet/weather";

const SECTIONS = ["shopping", "idle", "styles", "city", "backup", "sample"] as const;
type Section = (typeof SECTIONS)[number];

const TITLES: Record<Section, string> = {
  shopping: "购买清单",
  idle: "很久没穿",
  styles: "风格偏好",
  city: "城市",
  backup: "备份与导入",
  sample: "示例衣橱",
};

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): { section?: Section } => {
    const section = search.section;
    if (typeof section === "string" && (SECTIONS as readonly string[]).includes(section)) {
      return { section: section as Section };
    }
    return {};
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { section } = Route.useSearch();
  if (section) return <Subpage section={section} />;
  return <ProfileHome />;
}

function ProfileHome() {
  const profile = useCloset((state) => state.profile);
  const setName = useCloset((state) => state.setName);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const requireAccount = useRequireAccount();
  const session = authClient.useSession();
  const user = session.data?.user;
  const [name, setLocal] = useState(profile.name);

  useEffect(() => {
    setLocal(profile.name);
  }, [profile.name]);

  const owned = garments.filter((item) => item.owned).length;
  const saved = outfits.filter((item) => item.saved).length;
  const days = Object.keys(worn).length;

  const rows: Array<{ section: Section; label: string }> = [
    { section: "shopping", label: "购买清单" },
    { section: "idle", label: "很久没穿" },
    { section: "styles", label: "风格偏好" },
    { section: "city", label: "城市" },
    { section: "backup", label: "备份与导入" },
    { section: "sample", label: "示例衣橱" },
  ];

  return (
    <div className="px-6 pt-12">
      <h1 className="display">我的</h1>

      <section className="mt-8">
        {user ? (
          <label className="block">
            <span className="sr-only">怎么称呼你</span>
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
              className="w-full bg-transparent text-[17px] font-medium outline-none"
            />
            <span className="mt-1 block text-sm text-muted-foreground">{user.email}</span>
          </label>
        ) : (
          <Link to="/login" className="text-[17px] font-medium">
            登录后衣橱跟着你走 →
          </Link>
        )}
      </section>

      <p className="mt-8 text-sm">
        衣物 {owned} · 收藏 {saved} · 穿过 {days} 天
      </p>

      <ul className="mt-8 border-t border-border">
        {rows.map((row) => (
          <li key={row.section} className="border-b border-border">
            <Link
              to="/profile"
              search={{ section: row.section }}
              className="flex min-h-14 items-center text-sm"
            >
              {row.label}
            </Link>
          </li>
        ))}
        {user ? (
          <li className="border-b border-border">
            <button
              type="button"
              onClick={() => {
                void signOut("/").catch(() => toast("这次没退出，请再试一次"));
              }}
              className="flex min-h-14 items-center text-sm"
            >
              退出登录
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Subpage({ section }: { section: Section }) {
  const navigate = useNavigate();
  return (
    <div className="px-6 pt-12">
      <button
        type="button"
        onClick={() => void navigate({ to: "/profile", search: {} })}
        className="text-sm text-muted-foreground"
      >
        返回
      </button>
      <h1 className="display mt-4">{TITLES[section]}</h1>
      <div className="mt-8">
        {section === "shopping" ? <ShoppingList /> : null}
        {section === "idle" ? <IdleList /> : null}
        {section === "styles" ? <StylePrefs /> : null}
        {section === "city" ? <CityPrefs /> : null}
        {section === "backup" ? <Backup /> : null}
        {section === "sample" ? <SampleCloset /> : null}
      </div>
    </div>
  );
}

function ShoppingList() {
  const garments = useCloset((state) => state.garments);
  const markOwned = useCloset((state) => state.markOwned);
  const toggleShopping = useCloset((state) => state.toggleShopping);
  const requireAccount = useRequireAccount();
  const seen = new Set<string>();
  const items = garments.filter((item) => {
    if (item.owned || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有想买的单品。</p>;
  }
  return (
    <ul className="border-t border-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px]">{item.name}</p>
            <p className="text-sm text-muted-foreground">{item.price > 0 ? cny(item.price) : "未标价"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <ShopLinks item={item} />
            <button
              type="button"
              onClick={() => {
                if (!requireAccount({ kind: "own", id: item.id })) return;
                markOwned(item.id);
              }}
              className="text-sm underline underline-offset-4"
            >
              已买
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAccount({ kind: "shop", ids: [item.id] })) return;
                toggleShopping(item.id);
              }}
              className="text-sm text-muted-foreground"
            >
              移除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IdleList() {
  const garments = useCloset((state) => state.garments);
  const wornItems = useCloset((state) => state.wornItems);
  const today = shanghaiNow().key;
  const idle = garments
    .filter((item) => item.owned)
    .map((item) => ({ item, days: wearStats(item.id, item.addedAt, wornItems, today).idle }))
    .filter((entry) => entry.days >= 14)
    .sort((a, b) => b.days - a.days);
  if (idle.length === 0) return <p className="text-sm text-muted-foreground">最近穿过的衣服都还新鲜。</p>;
  return (
    <ul className="border-t border-border">
      {idle.map(({ item, days }) => (
        <li key={item.id} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm">
          <span className="truncate">{item.name}</span>
          <span className="text-muted-foreground">{days} 天没穿</span>
        </li>
      ))}
    </ul>
  );
}

function StylePrefs() {
  const styles = useCloset((state) => state.profile.styles);
  const toggleStyle = useCloset((state) => state.toggleStyle);
  const requireAccount = useRequireAccount();
  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">造型师会顺着这些气质来配。</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {STYLE_TAGS.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => {
              if (!requireAccount({ kind: "profile" })) return;
              toggleStyle(style);
            }}
            className={styles.includes(style) ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
          >
            {style}
          </button>
        ))}
      </div>
    </div>
  );
}

function CityPrefs() {
  const city = useCloset((state) => state.profile.city);
  const setCity = useCloset((state) => state.setCity);
  const requireAccount = useRequireAccount();
  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">天气和日历预报跟着这个城市走。</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {CITIES.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => {
              if (!requireAccount({ kind: "profile" })) return;
              setCity(item.name);
            }}
            className={city === item.name ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
          >
            {item.name}
          </button>
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
              const next = nearestCity(position.coords.latitude, position.coords.longitude);
              setCity(next.name);
              toast(`已切换到${next.name}`);
            },
            () => toast("没有获取到位置，仍使用当前城市"),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
          );
        }}
        className="mt-6 text-sm text-muted-foreground"
      >
        使用我的位置
      </button>
    </div>
  );
}

function Backup() {
  const importCloset = useCloset((state) => state.importCloset);
  const setName = useCloset((state) => state.setName);
  const requireAccount = useRequireAccount();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        登录后的衣橱保存在服务器。也可以导出一份文件，当作额外备份。
      </p>
      <div className="mt-6 flex gap-5">
        <button type="button" onClick={() => downloadCloset(useCloset.getState())} className="text-sm text-muted-foreground">
          导出
        </button>
        <button
          type="button"
          onClick={() => {
            if (!requireAccount({ kind: "profile" })) return;
            fileRef.current?.click();
          }}
          className="text-sm underline underline-offset-4"
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
          setName(data.profile.name);
          toast(result.warning ?? "备份已导入");
        }}
      />
    </div>
  );
}

function SampleCloset() {
  const reset = useCloset((state) => state.reset);
  const requireAccount = useRequireAccount();
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        恢复小满的十件示范单品和已收藏造型。你之后添加的衣服会被清掉。
      </p>
      {confirm ? (
        <div className="mt-6 flex gap-5">
          <button type="button" onClick={() => setConfirm(false)} className="text-sm text-muted-foreground">
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setConfirm(false);
              toast("已恢复示例衣橱");
            }}
            className="text-sm underline underline-offset-4"
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
          className="mt-6 text-sm underline underline-offset-4"
        >
          恢复示例衣橱
        </button>
      )}
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
