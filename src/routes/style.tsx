import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip, LookCollage } from "@/components/closet-ui";
import { PageHeader } from "@/components/shell";
import { cny, shanghaiNow } from "@/lib/closet/dates";
import { suggestLooks, type SuggestResult } from "@/lib/closet/suggest";
import { useCloset } from "@/lib/closet/store";
import { missingPrice, piecesOf, suggestOutfits } from "@/lib/closet/stylist";
import { MOODS, OCCASIONS, WEATHERS, type Garment, type Outfit } from "@/lib/closet/types";
import { useLiveWeather } from "@/lib/closet/weather";

export const Route = createFileRoute("/style")({ component: StylePage });

function StylePage() {
  const garments = useCloset((state) => state.garments);
  const profile = useCloset((state) => state.profile);
  const bumpSalt = useCloset((state) => state.bumpSalt);
  const rememberOutfit = useCloset((state) => state.rememberOutfit);
  const toggleSave = useCloset((state) => state.toggleSave);
  const wear = useCloset((state) => state.wear);
  const setDaily = useCloset((state) => state.setDaily);
  const outfits = useCloset((state) => state.outfits);
  const [occasion, setOccasion] = useState<string>("上班");
  const [mood, setMood] = useState<string>("优雅");
  const forecast = useLiveWeather(profile.city);
  const [weather, setWeather] = useState<string>(forecast.band);
  const [weatherTouched, setWeatherTouched] = useState(false);
  const [results, setResults] = useState<Outfit[]>([]);
  const [source, setSource] = useState<SuggestResult["source"] | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(suggestLooks);

  useEffect(() => {
    if (!weatherTouched && forecast.live) setWeather(forecast.band);
  }, [forecast.band, forecast.live, weatherTouched]);

  async function generate() {
    const nextSalt = bumpSalt();
    const request = {
      occasion,
      mood,
      weather,
      rain: weatherTouched ? false : forecast.rain,
      salt: nextSalt,
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
      for (const outfit of next) rememberOutfit(outfit);
      setResults(next);
      setSource(result.source);
    } finally {
      setBusy(false);
    }
  }

  const selected = [occasion, mood, weather].filter(Boolean);

  return (
    <div>
      <PageHeader eyebrow="AI 造型师" title="今天想怎么穿？" />
      <p className="px-5 pt-2 text-sm leading-relaxed text-muted-foreground">
        选择场合、心情与天气，为你定制专属搭配。
      </p>

      <Group index="01" label="场合">
        {OCCASIONS.map((item) => (
          <Chip key={item} active={occasion === item} onClick={() => setOccasion(item)}>
            {item}
          </Chip>
        ))}
      </Group>
      <Group index="02" label="心情">
        {MOODS.map((item) => (
          <Chip key={item} active={mood === item} onClick={() => setMood(item)}>
            {item}
          </Chip>
        ))}
      </Group>
      <Group
        index="03"
        label="天气"
        note={
          forecast.live
            ? `当地现在 ${forecast.label}${forecast.source ? ` · ${forecast.source}` : ""}`
            : forecast.label
        }
      >
        {WEATHERS.map((item) => (
          <Chip
            key={item}
            active={weather === item}
            onClick={() => {
              setWeatherTouched(true);
              setWeather(item);
            }}
          >
            {item}
          </Chip>
        ))}
      </Group>

      <section className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">已选条件</h2>
          <button
            type="button"
            onClick={() => {
              setOccasion("日常");
              setMood("简约");
              setWeather(forecast.band);
              setWeatherTouched(false);
            }}
            className="min-h-11 text-sm font-semibold text-primary"
          >
            清空
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((item) => (
            <span key={item} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {item}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-float disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {busy ? "正在看你的衣橱…" : "生成我的穿搭"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {source === "model"
            ? "造型师根据你的衣橱、天气和场合写了这几套"
            : source === "rules"
              ? "没有连上造型师，这几套是按天气和场合从衣橱里排的"
              : `会优先使用你已经拥有的 ${garments.filter((item) => item.owned).length} 件`}
        </p>
      </section>

      <div className="mt-6 space-y-4 px-5">
        {results.map((outfit) => {
          const live = outfits.find((item) => item.id === outfit.id) ?? outfit;
          const pieces = piecesOf(live, garments);
          const missing = pieces.filter((item) => !item.owned);
          return (
            <article key={live.id} className="overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-soft">
              <LookCollage pieces={pieces} />
              <div className="px-1 pt-3">
                <div>
                  <h3 className="text-lg font-semibold">{live.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{live.note}</p>
                </div>
                <ul className="mt-3 space-y-1">
                  {pieces.map((piece) => (
                    <li key={piece.id} className="flex items-center justify-between text-sm">
                      <span>
                        {piece.name}
                        <span className="text-muted-foreground"> · {piece.brand || piece.color}</span>
                      </span>
                      <span className={piece.owned ? "text-xs text-success" : "text-xs font-semibold text-primary"}>
                        {piece.owned ? "已有" : "新品"}
                      </span>
                    </li>
                  ))}
                </ul>
                {missing.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">补齐新品 {cny(missingPrice(pieces))}</p>
                ) : (
                  <p className="mt-2 text-xs text-success">全部来自你的衣橱</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toggleSave(live.id);
                      toast(live.saved ? "已取消收藏" : "已收藏造型");
                    }}
                    className="min-h-11 rounded-xl bg-secondary text-sm font-medium"
                  >
                    {live.saved ? "已收藏" : "收藏造型"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = shanghaiNow().key;
                      setDaily(live);
                      wear(today, live.id);
                      toast("已设为今日穿搭");
                    }}
                    className="min-h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    今天就穿
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
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

function Group({
  index,
  label,
  note,
  children,
}: {
  index: string;
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <p className="px-5 text-xs font-medium text-muted-foreground">
        {index} {label}
      </p>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-5">{children}</div>
      {note ? <p className="px-5 pt-2 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}
