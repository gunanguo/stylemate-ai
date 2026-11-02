import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LookCollage } from "@/components/closet-ui";
import { PageHeader } from "@/components/shell";
import { dateKey, daysInMonth, firstWeekday, shanghaiNow } from "@/lib/closet/dates";
import { suggestLooks } from "@/lib/closet/suggest";
import { useCloset } from "@/lib/closet/store";
import { piecesOf, suggestOutfits } from "@/lib/closet/stylist";
import type { Garment } from "@/lib/closet/types";
import { dayForecastCaption, loadWeather, useLiveWeather } from "@/lib/closet/weather";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

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

export const Route = createFileRoute("/calendar")({
  loader: () => loadWeather("上海"),
  component: CalendarPage,
});

function CalendarPage() {
  const now = shanghaiNow();
  const [cursor, setCursor] = useState({ year: now.year, month: now.month });
  const [selected, setSelected] = useState(now.key);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const profile = useCloset((state) => state.profile);
  const wear = useCloset((state) => state.wear);
  const clearDay = useCloset((state) => state.clearDay);
  const bumpSalt = useCloset((state) => state.bumpSalt);
  const rememberOutfit = useCloset((state) => state.rememberOutfit);
  const dailyDate = useCloset((state) => state.dailyDate);
  const dailyOutfitId = useCloset((state) => state.dailyOutfitId);
  const ask = useServerFn(suggestLooks);
  const [planning, setPlanning] = useState(false);
  const forecast = useLiveWeather(profile.city, Route.useLoaderData());
  const dayForecast = forecast.days.find((day) => day.date === selected);
  const forecastCaption = dayForecastCaption(selected, forecast.days);

  const count = daysInMonth(cursor.year, cursor.month);
  const offset = firstWeekday(cursor.year, cursor.month);
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
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

  function shift(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  }

  function plan(id: string) {
    if (!id) return;
    wear(selected, id);
    toast("这天的穿搭已安排");
  }

  async function planFresh() {
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

  return (
    <div>
      <PageHeader eyebrow="提前规划" title="日历" />
      <p className="px-5 pt-2 text-sm text-muted-foreground">为晚餐、会议和周末出行提前安排穿搭。</p>

      <section className="mx-5 mt-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="上个月" onClick={() => shift(-1)} className="flex h-11 w-11 items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold">
            {cursor.year}年{cursor.month}月
          </p>
          <button type="button" aria-label="下个月" onClick={() => shift(1)} className="flex h-11 w-11 items-center justify-center">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted-foreground">
          {WEEK.map((day) => (
            <span key={day} className="py-2">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            if (!day) return <span key={`e-${index}`} />;
            const key = dateKey(cursor.year, cursor.month, day);
            const marked = Boolean(worn[key]);
            const active = key === selected;
            const isToday = key === now.key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-sm ${
                  active ? "bg-primary font-semibold text-primary-foreground" : isToday ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                {day}
                <span className={`h-1 w-1 rounded-full ${marked ? (active ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-6">
        <h2 className="text-sm font-semibold">{selected === now.key ? "今天" : selected}</h2>
        {forecastCaption ? <p className="mt-1 text-xs text-muted-foreground">{forecastCaption}</p> : null}
        {outfit && pieces.length > 0 ? (
          <article className="mt-3 overflow-hidden rounded-3xl border border-border bg-card p-3">
            <LookCollage pieces={pieces} />
            <div className="px-1 pt-3">
              <h3 className="text-lg font-semibold">{outfit.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{pieces.map((item) => item.name).join(" · ")}</p>
              <button
                type="button"
                onClick={() => {
                  clearDay(selected);
                  toast("已清除这天的安排");
                }}
                className="mt-3 min-h-11 text-sm font-semibold text-primary"
              >
                清除
              </button>
            </div>
          </article>
        ) : selected === now.key && todayRecommendation && todayPieces.length > 0 ? (
          <article className="mt-3 overflow-hidden rounded-3xl border border-dashed border-border bg-card">
            <div className="opacity-60">
              <LookCollage pieces={todayPieces} />
              <div className="px-1 pt-3">
                <h3 className="text-lg font-semibold">今日推荐（未安排）</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {todayRecommendation.name} · {todayPieces.map((item) => item.name).join(" · ")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => plan(todayRecommendation.id)}
              className="mt-3 min-h-11 px-1 text-sm font-semibold text-primary"
            >
              安排
            </button>
          </article>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">这一天还没有造型。</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => plan(dailyOutfitId || saved[0]?.id || "")}
            disabled={!dailyOutfitId && saved.length === 0}
            className="min-h-12 rounded-xl bg-secondary text-sm font-medium disabled:opacity-50"
          >
            用今日穿搭
          </button>
          <button
            type="button"
            onClick={() => void planFresh()}
            disabled={planning}
            className="min-h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {planning ? "正在搭配…" : "让造型师配一套"}
          </button>
        </div>

        {saved.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {saved.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => plan(item.id)}
                  className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-card px-4 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.tags.join(" · ")}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary">安排</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
