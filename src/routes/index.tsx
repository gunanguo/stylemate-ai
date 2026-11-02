import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useRequireAccount } from "@/components/account-gate";
import { EmptyClosetCard, LookPhoto, PiecePhoto } from "@/components/closet-ui";
import { OutfitDetail } from "@/components/outfit-detail";
import { OutfitSwap } from "@/components/outfit-swap";
import { shanghaiNow } from "@/lib/closet/dates";
import { useCloset } from "@/lib/closet/store";
import { piecesOf } from "@/lib/closet/stylist";
import { loadWeather, useLiveWeather, type LiveWeather } from "@/lib/closet/weather";

export const Route = createFileRoute("/")({
  loader: () => loadWeather("上海"),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const requireAccount = useRequireAccount();
  const profile = useCloset((state) => state.profile);
  const garments = useCloset((state) => state.garments);
  const outfits = useCloset((state) => state.outfits);
  const worn = useCloset((state) => state.worn);
  const dailyDate = useCloset((state) => state.dailyDate);
  const dailyOutfitId = useCloset((state) => state.dailyOutfitId);
  const wear = useCloset((state) => state.wear);
  const [open, setOpen] = useState(false);
  const now = shanghaiNow();
  const forecast = useLiveWeather(profile.city, Route.useLoaderData());
  const featured =
    outfits.find((item) => item.id === (dailyDate === now.key ? dailyOutfitId : "look-commute")) ??
    outfits.find((item) => item.saved) ??
    outfits[0];
  const pieces = featured ? piecesOf(featured, garments) : [];
  const missing = pieces.filter((item) => !item.owned);
  const thumbs = garments.slice(0, 4);

  return (
    <div className="px-6 pt-12">
      <header className="flex items-center justify-between">
        <p className="text-[15px] tracking-tight">StyleMate</p>
        <Link
          to="/profile"
          aria-label="我的"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/80 text-[13px]"
        >
          {(profile.name || "客").slice(0, 1)}
        </Link>
      </header>

      <section className="mt-8">
        <p className="eyebrow">{homeEyebrow(now.month, now.day, forecast)}</p>
        <h1 className="display mt-3">{dayLine(forecast.band, forecast.label)}</h1>
      </section>

      {garments.length === 0 ? (
        <EmptyClosetCard
          onAdd={() => {
            if (!requireAccount({ kind: "add" })) return;
            void navigate({ to: "/wardrobe", search: { add: true } });
          }}
        />
      ) : featured ? (
        <section className="mt-8">
          <button type="button" onClick={() => setOpen(true)} className="block w-full text-left" aria-label="查看这套穿搭">
            <div className="aspect-look">
              <LookPhoto ids={featured.garmentIds} pieces={pieces} alt={featured.name} />
            </div>
          </button>
          <h2 className="mt-4 text-[17px] font-medium">{featured.name}</h2>
          {featured.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{featured.note}</p> : null}
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {pieces.length} 件 · 衣橱已有 {pieces.length - missing.length} 件
            </p>
            <div className="flex shrink-0 items-center gap-4">
              <OutfitSwap
                outfit={featured}
                pieces={pieces}
                weather={forecast.band}
                rain={forecast.rain}
                hidePieces
                shuffleClassName="text-sm text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  if (!requireAccount({ kind: "wear", date: now.key, outfitId: featured.id })) return;
                  wear(now.key, featured.id);
                  toast(worn[now.key] === featured.id ? "今天就穿这套" : "已记下，今天就穿");
                }}
                className="text-sm underline underline-offset-4"
              >
                就穿这套
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-medium">我的衣橱 · {garments.length}</h2>
          <Link to="/wardrobe" className="text-sm text-muted-foreground">
            全部 →
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-4 gap-2.5">
          {thumbs.map((item) => (
            <li key={item.id}>
              <Link to="/wardrobe" search={{ piece: item.id }} className="block">
                <span className="block aspect-look overflow-hidden">
                  <PiecePhoto garment={item} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {open && featured ? (
        <OutfitDetail outfit={featured} weather={forecast.band} rain={forecast.rain} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function homeEyebrow(month: number, day: number, forecast: LiveWeather) {
  const date = `${month}月${day}日`;
  const temp = forecast.label.match(/(-?\d+)\s*°/);
  const sky = forecast.label.match(/°C?\s*·\s*([^·]+)/);
  if (temp && sky) return `${date} · ${forecast.city} ${temp[1]}° ${sky[1].trim()}`;
  return `${date} · ${forecast.label}`;
}

function dayLine(band: string, label: string) {
  if (/有雨|雷雨/.test(label)) return "今天，出门带一件能挡雨的。";
  if (/有雪/.test(label)) return "今天，把最暖的那件穿上。";
  if (band === "炎热") return "今天，穿得薄一点。";
  if (band === "寒冷") return "今天，把外套穿上。";
  if (band === "温暖") return "今天，单穿就刚刚好。";
  return "今天，穿得轻松一点。";
}
