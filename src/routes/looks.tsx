import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { LookPhoto } from "@/components/closet-ui";
import { OutfitDetail } from "@/components/outfit-detail";
import { authClient } from "@/lib/auth/client";
import { dateKey, daysInMonth, firstWeekday, shanghaiNow, shiftChinaKey } from "@/lib/closet/dates";
import { suggestLooks, type SuggestResult } from "@/lib/closet/suggest";
import { useCloset } from "@/lib/closet/store";
import { piecesOf, suggestOutfits } from "@/lib/closet/stylist";
import { MOODS, WEATHERS, type Garment, type Outfit } from "@/lib/closet/types";
import { dayForecastCaption, loadWeather, useLiveWeather } from "@/lib/closet/weather";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "generate", label: "生成" },
  { id: "calendar", label: "日历" },
  { id: "saved", label: "收藏" },
] as const;

type LooksTab = (typeof TABS)[number]["id"];
const OCCASION_ROW = ["日常", "上班", "约会", "聚会", "旅行"] as const;
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export const Route = createFileRoute("/looks")({
  validateSearch: (search: Record<string, unknown>): { tab: LooksTab } => {
    const tab = search.tab;
    if (tab === "calendar" || tab === "saved" || tab === "generate") return { tab };
    return { tab: "generate" };
  },
  loader: () => loadWeather("上海"),
  component: LooksPage,
});

function LooksPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="px-6 pt-12">
      <h1 className="display">搭配</h1>
      <div className="mt-6 flex gap-6 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void navigate({ to: "/looks", search: { tab: item.id } })}
            className={cn(
              "pb-2 text-sm",
              tab === item.id ? "text-foreground underline underline-offset-8" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "calendar" ? <CalendarPane /> : tab === "saved" ? <SavedPane /> : <GeneratePane />}
    </div>
  );
}

function GeneratePane() {
  const garments = useCloset((state) => state.garments);
  const profile = useCloset((state) => state.profile);
  const bumpSalt = useCloset((state) => state.bumpSalt);
  const rememberOutfit = useCloset((state) => state.rememberOutfit);
  const outfits = useCloset((state) => state.outfits);
  const forecast = useLiveWeather(profile.city, Route.useLoaderData());
  const [occasion, setOccasion] = useState("上班");
  const [mood, setMood] = useState("优雅");
  const [weather, setWeather] = useState(forecast.band);
  const [weatherTouched, setWeatherTouched] = useState(false);
  const [more, setMore] = useState(false);
  const [results, setResults] = useState<Outfit[]>([]);
  const [source, setSource] = useState<SuggestResult["source"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Outfit | null>(null);
  const ask = useServerFn(suggestLooks);
  const session = authClient.useSession();

  useEffect(() => {
    if (!weatherTouched && forecast.live) setWeather(forecast.band);
  }, [forecast.band, forecast.live, weatherTouched]);

  async function generate() {
    const signedIn = Boolean(session.data?.user);
    const request = {
      occasion,
      mood,
      weather,
      rain: weatherTouched ? false : forecast.rain,
      salt: signedIn ? bumpSalt() : 1,
      preferred: profile.styles,
      limit: 3,
    };
    setBusy(true);
    try {
      let result: SuggestResult;
      try {
        result = await ask({ data: { garments: slimGarments(garments), request } });
      } catch {
        result = { source: "rules", outfits: suggestOutfits(garments, request) };
      }
      const next = result.outfits.map((outfit) => ({ ...outfit, createdAt: Date.now(), score: 0 }));
      if (next.length === 0) {
        toast("衣橱里还不够配一套，先去添加衣物");
        setResults([]);
        setSource(null);
        return;
      }
      if (signedIn) for (const outfit of next) rememberOutfit(outfit);
      setResults(next);
      setSource(result.source);
    } finally {
      setBusy(false);
    }
  }

  const liveOpen = open ? (outfits.find((item) => item.id === open.id) ?? open) : null;

  return (
    <>
      <section className="mt-8">
        <h2 className="text-[17px] font-medium">今天去哪儿？</h2>
        <div className="no-scrollbar -mx-6 mt-4 flex gap-5 overflow-x-auto px-6">
          {OCCASION_ROW.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setOccasion(item)}
              className={cn(
                "shrink-0 pb-1 text-sm",
                occasion === item ? "text-foreground underline underline-offset-8" : "text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setMore((value) => !value)} className="mt-4 text-sm text-muted-foreground">
          更多条件 · {mood} · {weather}
          {forecast.rain && !weatherTouched ? " · 有雨" : ""}
        </button>
        {more ? (
          <div className="mt-4">
            <p className="eyebrow">心情</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {MOODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMood(item)}
                  className={item === mood ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="eyebrow mt-4">天气</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {WEATHERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setWeatherTouched(true);
                    setWeather(item);
                  }}
                  className={item === weather ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOccasion("运动");
                }}
                className={occasion === "运动" ? "text-sm underline underline-offset-8" : "text-sm text-muted-foreground"}
              >
                运动
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="mt-6 min-h-12 w-full bg-ink text-sm text-ink-foreground disabled:opacity-60"
        >
          {busy ? "正在看你的衣橱…" : "给我搭一套"}
        </button>
        {source ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {source === "model"
              ? "造型师根据你的衣橱、天气和场合写了这几套。"
              : "没有连上造型师，这几套是按天气和场合从衣橱里排的。"}
          </p>
        ) : null}
      </section>

      {results.length > 0 ? (
        <section className="mt-8 space-y-8">
          {results.map((outfit) => {
            const live = outfits.find((item) => item.id === outfit.id) ?? outfit;
            const pieces = piecesOf(live, garments);
            return (
              <article key={live.id}>
                <button type="button" onClick={() => setOpen(live)} className="block w-full text-left">
                  <div className="aspect-look">
                    <LookPhoto ids={live.garmentIds} pieces={pieces} alt={live.name} />
                  </div>
                  <h3 className="mt-4 text-[17px] font-medium">{live.name}</h3>
                  {live.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{live.note}</p> : null}
                </button>
              </article>
            );
          })}
        </section>
      ) : null}

      {liveOpen ? (
        <OutfitDetail
          outfit={liveOpen}
          weather={weather}
          rain={!weatherTouched && forecast.rain}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function CalendarPane() {
  const now = shanghaiNow();
  const [cursor, setCursor] = useState({ year: now.year, month: now.month });
  const [selected, setSelected] = useState(now.key);
  const [monthOpen, setMonthOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const profile = useCloset((state) => state.profile);
  const wear = useCloset((state) => state.wear);
  const clearDay = useCloset((state) => state.clearDay);
  const bumpSalt = useCloset((state) => state.bumpSalt);
  const rememberOutfit = useCloset((state) => state.rememberOutfit);
  const dailyOutfitId = useCloset((state) => state.dailyOutfitId);
  const dailyDate = useCloset((state) => state.dailyDate);
  const ask = useServerFn(suggestLooks);
  const requireAccount = useRequireAccount();
  const [planning, setPlanning] = useState(false);
  const forecast = useLiveWeather(profile.city, Route.useLoaderData());
  const dayForecast = forecast.days.find((day) => day.date === selected);
  const forecastCaption = dayForecastCaption(selected, forecast.days);
  const outfitId = worn[selected];
  const outfit = outfits.find((item) => item.id === outfitId);
  const pieces = outfit ? piecesOf(outfit, garments) : [];
  const saved = outfits.filter((item) => item.saved && piecesOf(item, garments).length > 0);
  const todayRecommendation =
    selected === now.key && !(outfit && pieces.length > 0)
      ? (outfits.find((item) => item.id === (dailyDate === now.key ? dailyOutfitId : "look-commute")) ??
        saved[0] ??
        outfits[0])
      : undefined;
  const todayPieces = todayRecommendation ? piecesOf(todayRecommendation, garments) : [];
  const week = weekKeys(selected);

  function choose(key: string) {
    setSelected(key);
    const [year, month] = key.split("-").map(Number);
    setCursor({ year, month });
  }

  function plan(id: string) {
    if (!id) return;
    if (!requireAccount({ kind: "wear", date: selected, outfitId: id })) return;
    wear(selected, id);
    toast("这天的穿搭已安排");
  }

  async function planFresh() {
    if (!requireAccount({ kind: "calendar" })) return;
    const salt = bumpSalt();
    const request = {
      occasion: "日常",
      mood: profile.styles[0] ? "优雅" : "简约",
      weather: dayForecast?.band ?? forecast.band,
      rain: dayForecast?.rain ?? false,
      salt,
      preferred: profile.styles,
      limit: 1,
    };
    setPlanning(true);
    try {
      let next;
      try {
        const result = await ask({ data: { garments: slimGarments(garments), request } });
        next = result.outfits[0];
      } catch {
        next = suggestOutfits(garments, request)[0];
      }
      if (!next) {
        toast("衣橱里还不够配一套");
        return;
      }
      const stamped = { ...next, createdAt: Date.now(), saved: true, score: 0 };
      rememberOutfit(stamped);
      wear(selected, stamped.id);
      toast(`已配好「${stamped.name}」`);
    } finally {
      setPlanning(false);
    }
  }

  const shown = outfit && pieces.length > 0 ? outfit : todayRecommendation;
  const shownPieces = outfit && pieces.length > 0 ? pieces : todayPieces;
  const planned = Boolean(outfit && pieces.length > 0);

  return (
    <>
      <section className="mt-8">
        {monthOpen ? (
          <MonthGrid
            cursor={cursor}
            selected={selected}
            today={now.key}
            worn={worn}
            onSelect={choose}
            onShift={(delta) =>
              setCursor((current) => {
                const date = new Date(current.year, current.month - 1 + delta, 1);
                return { year: date.getFullYear(), month: date.getMonth() + 1 };
              })
            }
          />
        ) : (
          <div className="grid grid-cols-7 text-center">
            {week.map((key) => {
              const day = Number(key.slice(-2));
              const active = key === selected;
              return (
                <button key={key} type="button" onClick={() => choose(key)} className="flex flex-col items-center py-1">
                  <span className="text-[11px] text-muted-foreground">{WEEK[weekdayIndex(key)]}</span>
                  <span className={cn("mt-1 text-sm", active && "underline underline-offset-4")}>{day}</span>
                  <span className={cn("mt-1 h-[3px] w-[3px] rounded-full", worn[key] ? "bg-accent" : "bg-transparent")} />
                </button>
              );
            })}
          </div>
        )}
        <button type="button" onClick={() => setMonthOpen((value) => !value)} className="mt-3 text-sm text-muted-foreground">
          {monthOpen ? "只看这周" : "展开整月"}
        </button>
      </section>

      <section className="mt-8">
        <p className="text-sm text-muted-foreground">
          {selected === now.key ? "今天" : selected}
          {forecastCaption ? ` · ${forecastCaption}` : ""}
        </p>
        {shown && shownPieces.length > 0 ? (
          <div className="mt-4">
            <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
              <div className={cn("aspect-look", planned ? "" : "opacity-60")}>
                <LookPhoto ids={shown.garmentIds} pieces={shownPieces} alt={shown.name} />
              </div>
              <h2 className="mt-4 text-[17px] font-medium">{planned ? shown.name : "今日推荐，还没安排"}</h2>
              {shown.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{shown.note}</p> : null}
            </button>
            <div className="mt-3 flex gap-5">
              {planned ? (
                <button
                  type="button"
                  onClick={() => {
                    clearDay(selected);
                    toast("已清除这天的安排");
                  }}
                  className="text-sm text-muted-foreground"
                >
                  清除
                </button>
              ) : (
                <button type="button" onClick={() => plan(shown.id)} className="text-sm underline underline-offset-4">
                  安排
                </button>
              )}
              <button
                type="button"
                onClick={() => plan(dailyOutfitId || saved[0]?.id || "")}
                disabled={!dailyOutfitId && saved.length === 0}
                className="text-sm text-muted-foreground disabled:opacity-40"
              >
                用今日穿搭
              </button>
              <button type="button" onClick={() => void planFresh()} disabled={planning} className="text-sm text-muted-foreground">
                {planning ? "正在搭配…" : "让造型师配一套"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[17px] font-medium">这一天还没有造型</p>
            <div className="mt-3 flex gap-5">
              <button
                type="button"
                onClick={() => plan(dailyOutfitId || saved[0]?.id || "")}
                disabled={!dailyOutfitId && saved.length === 0}
                className="text-sm text-muted-foreground disabled:opacity-40"
              >
                用今日穿搭
              </button>
              <button type="button" onClick={() => void planFresh()} disabled={planning} className="text-sm underline underline-offset-4">
                {planning ? "正在搭配…" : "让造型师配一套"}
              </button>
            </div>
          </div>
        )}
      </section>

      {open && shown ? (
        <OutfitDetail
          outfit={shown}
          weather={dayForecast?.band ?? forecast.band}
          rain={dayForecast?.rain ?? forecast.rain}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function MonthGrid({
  cursor,
  selected,
  today,
  worn,
  onSelect,
  onShift,
}: {
  cursor: { year: number; month: number };
  selected: string;
  today: string;
  worn: Record<string, string>;
  onSelect: (key: string) => void;
  onShift: (delta: number) => void;
}) {
  const count = daysInMonth(cursor.year, cursor.month);
  const offset = firstWeekday(cursor.year, cursor.month);
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onShift(-1)} className="text-sm text-muted-foreground">
          上个月
        </button>
        <p className="text-sm">
          {cursor.year}年{cursor.month}月
        </p>
        <button type="button" onClick={() => onShift(1)} className="text-sm text-muted-foreground">
          下个月
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {WEEK.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 text-center">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} />;
          const key = dateKey(cursor.year, cursor.month, day);
          return (
            <button key={key} type="button" onClick={() => onSelect(key)} className="flex flex-col items-center py-2">
              <span className={cn("text-sm", key === selected && "underline underline-offset-4", key === today && key !== selected && "text-muted-foreground")}>
                {day}
              </span>
              <span className={cn("mt-1 h-[3px] w-[3px] rounded-full", worn[key] ? "bg-accent" : "bg-transparent")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SavedPane() {
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const profile = useCloset((state) => state.profile);
  const forecast = useLiveWeather(profile.city, Route.useLoaderData());
  const saved = outfits.filter((item) => item.saved && piecesOf(item, garments).length > 0);
  const [open, setOpen] = useState<Outfit | null>(null);
  const live = open ? (outfits.find((item) => item.id === open.id) ?? open) : null;

  if (saved.length === 0) {
    return <p className="mt-8 text-sm text-muted-foreground">还没有收藏的造型。</p>;
  }

  return (
    <>
      <ul className="mt-8 grid grid-cols-2 gap-x-2.5 gap-y-7">
        {saved.map((item) => {
          const pieces = piecesOf(item, garments);
          return (
            <li key={item.id}>
              <button type="button" onClick={() => setOpen(item)} className="w-full text-left">
                <span className="block aspect-look overflow-hidden">
                  <LookPhoto ids={item.garmentIds} pieces={pieces} alt={item.name} />
                </span>
                <span className="mt-2 block truncate text-[13px]">{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {live ? (
        <OutfitDetail outfit={live} weather={forecast.band} rain={forecast.rain} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function weekKeys(selected: string) {
  const index = weekdayIndex(selected);
  const start = shiftChinaKey(selected, -index);
  return Array.from({ length: 7 }, (_, i) => shiftChinaKey(start, i));
}

function weekdayIndex(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(utc);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function slimGarments(garments: Garment[]) {
  return garments.map(({ id, name, brand, category, slot, color, styles, cut, owned, warmth, formality }) => ({
    id,
    name,
    brand,
    category,
    slot,
    color,
    styles,
    cut,
    owned,
    warmth,
    formality,
  }));
}
