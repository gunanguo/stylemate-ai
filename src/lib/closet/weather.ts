import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { WEATHERS } from "@/lib/closet/types";

export type WeatherBand = (typeof WEATHERS)[number];

export type DayForecast = {
  date: string;
  band: WeatherBand;
  rain: boolean;
  label: string;
};

export type LiveWeather = {
  band: WeatherBand;
  label: string;
  advice: string;
  live: boolean;
  source: string;
  rain: boolean;
  city: string;
  days: DayForecast[];
};

export const CITIES = [
  { name: "元林", latitude: 23.96, longitude: 120.57 },
  { name: "台北", latitude: 25.03, longitude: 121.56 },
  { name: "新北", latitude: 25.01, longitude: 121.46 },
  { name: "桃园", latitude: 24.99, longitude: 121.31 },
  { name: "新竹", latitude: 24.81, longitude: 120.97 },
  { name: "台中", latitude: 24.15, longitude: 120.67 },
  { name: "台南", latitude: 22.99, longitude: 120.21 },
  { name: "高雄", latitude: 22.63, longitude: 120.3 },
  { name: "花莲", latitude: 23.99, longitude: 121.6 },
] as const;

const TTL = 30 * 60 * 1000;
const USER_AGENT = "StyleMateAI/1.0 (digital closet)";

const ADVICE: Record<WeatherBand, string> = {
  炎热: "热天把外套留在家里。",
  温暖: "薄薄一层就够，不必裹太严。",
  凉爽: "先看叠穿，再决定要不要风衣。",
  寒冷: "把最厚的那件穿在最外面。",
};

const HINT: Record<WeatherBand, string> = {
  炎热: "薄衣即可",
  温暖: "单穿就好",
  凉爽: "适合叠穿",
  寒冷: "记得外套",
};

export const FALLBACK_WEATHER: LiveWeather = {
  band: "凉爽",
  label: "暂时取不到当地天气，按凉爽搭配",
  advice: ADVICE.凉爽,
  live: false,
  source: "",
  rain: false,
  city: "元林",
  days: [],
};

type Place = { latitude: number; longitude: number; city: string };

const caches = new Map<string, { at: number; value: LiveWeather }>();

export function cityByName(name: string) {
  return CITIES.find((city) => city.name === name) ?? CITIES[0];
}

export function nearestCity(latitude: number, longitude: number) {
  let best: (typeof CITIES)[number] = CITIES[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const city of CITIES) {
    const distance = (city.latitude - latitude) ** 2 + (city.longitude - longitude) ** 2;
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  return best;
}

export function bandForTemperature(celsius: number): WeatherBand {
  if (celsius >= 30) return "炎热";
  if (celsius >= 23) return "温暖";
  if (celsius >= 15) return "凉爽";
  return "寒冷";
}

function skyFromCode(code: number) {
  if (code === 0) return "晴";
  if (code === 45 || code === 48) return "有雾";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "有雨";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "有雪";
  if (code >= 95) return "雷雨";
  return "多云";
}

function isRainCode(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function skyFromSymbol(symbol: string) {
  const name = symbol.split("_")[0] ?? "";
  if (name.includes("thunder")) return "雷雨";
  if (name.includes("snow") || name.includes("sleet")) return "有雪";
  if (name.includes("rain") || name.includes("drizzle")) return "有雨";
  if (name.includes("fog")) return "有雾";
  if (name === "clearsky" || name === "fair") return "晴";
  return "多云";
}

function skyFromText(value: string) {
  const text = value.toLowerCase();
  if (text.includes("thunder")) return "雷雨";
  if (text.includes("snow") || text.includes("sleet") || text.includes("blizzard")) return "有雪";
  if (text.includes("rain") || text.includes("drizzle") || text.includes("shower")) return "有雨";
  if (text.includes("fog") || text.includes("mist")) return "有雾";
  if (text.includes("clear") || text.includes("sunny")) return "晴";
  return "多云";
}

function describe(city: string, temperature: number, sky: string, source: string, rain: boolean): LiveWeather {
  const band = bandForTemperature(temperature);
  return {
    band,
    label: `${city} ${Math.round(temperature)}°C · ${rain ? "有雨" : sky} · ${HINT[band]}`,
    advice: rain ? "今天有雨，外套带着更稳。" : ADVICE[band],
    live: true,
    source,
    rain,
    city,
    days: [],
  };
}

async function readJson(url: string, headers?: HeadersInit) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<unknown>;
}

async function fromMetNorway(place: Place) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.latitude}&lon=${place.longitude}`;
  const body = (await readJson(url, { "User-Agent": USER_AGENT })) as {
    properties?: {
      timeseries?: Array<{
        time?: string;
        data?: {
          instant?: { details?: { air_temperature?: number } };
          next_1_hours?: { summary?: { symbol_code?: string } };
        };
      }>;
    };
  };
  const series = body.properties?.timeseries ?? [];
  const slot = series[0]?.data;
  const temperature = Number(slot?.instant?.details?.air_temperature);
  const symbol = slot?.next_1_hours?.summary?.symbol_code ?? "";
  const sky = symbol ? skyFromSymbol(symbol) : "多云";
  const rain = sky === "有雨" || sky === "雷雨";
  const current = Number.isFinite(temperature) ? describe(place.city, temperature, sky, "MET Norway", rain) : null;
  const grouped = new Map<string, { temps: number[]; rain: boolean; sky: string }>();
  for (const item of series) {
    if (!item.time) continue;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(item.time));
    const temp = Number(item.data?.instant?.details?.air_temperature);
    const itemSky = skyFromSymbol(item.data?.next_1_hours?.summary?.symbol_code ?? "");
    const bucket = grouped.get(date) ?? { temps: [], rain: false, sky: itemSky };
    if (Number.isFinite(temp)) bucket.temps.push(temp);
    if (itemSky === "有雨" || itemSky === "雷雨") bucket.rain = true;
    if (itemSky) bucket.sky = itemSky;
    grouped.set(date, bucket);
  }
  const days: DayForecast[] = [...grouped.entries()].slice(0, 7).map(([date, bucket]) => {
    const mid = bucket.temps.reduce((sum, value) => sum + value, 0) / Math.max(bucket.temps.length, 1);
    const band = bandForTemperature(mid);
    return {
      date,
      band,
      rain: bucket.rain,
      label: `${Math.round(mid)}°C · ${bucket.rain ? "有雨" : bucket.sky}`,
    };
  });
  return current ? { current, days } : null;
}

async function fromWttr(place: Place) {
  const url = `https://wttr.in/${place.latitude},${place.longitude}?format=j1`;
  const body = (await readJson(url, { "User-Agent": USER_AGENT })) as {
    current_condition?: Array<{ temp_C?: string; weatherDesc?: Array<{ value?: string }> }>;
    weather?: Array<{ date?: string; avgtempC?: string; hourly?: Array<{ weatherDesc?: Array<{ value?: string }> }> }>;
  };
  const currentCondition = body.current_condition?.[0];
  const temperature = Number(currentCondition?.temp_C);
  const desc = currentCondition?.weatherDesc?.[0]?.value ?? "";
  const sky = skyFromText(desc);
  const rain = sky === "有雨" || sky === "雷雨";
  const current = Number.isFinite(temperature) ? describe(place.city, temperature, sky, "wttr.in", rain) : null;
  const days: DayForecast[] = (body.weather ?? []).slice(0, 3).flatMap((day) => {
    if (!day.date) return [];
    const mid = Number(day.avgtempC);
    if (!Number.isFinite(mid)) return [];
    const text = day.hourly?.[4]?.weatherDesc?.[0]?.value ?? desc;
    const daySky = skyFromText(text);
    const dayRain = daySky === "有雨" || daySky === "雷雨";
    return [{ date: day.date, band: bandForTemperature(mid), rain: dayRain, label: `${Math.round(mid)}°C · ${dayRain ? "有雨" : daySky}` }];
  });
  return current ? { current, days } : null;
}

async function fromOpenMeteo(place: Place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "Asia/Taipei");
  url.searchParams.set("forecast_days", "14");
  const body = (await readJson(url.toString())) as {
    current?: { temperature_2m?: number; weather_code?: number };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
    };
  };
  const temperature = Number(body.current?.temperature_2m);
  const code = Number(body.current?.weather_code);
  const rain = isRainCode(code);
  const current = Number.isFinite(temperature)
    ? describe(place.city, temperature, skyFromCode(code), "Open-Meteo", rain)
    : null;
  const days: DayForecast[] = (body.daily?.time ?? []).flatMap((date, index) => {
    const max = Number(body.daily?.temperature_2m_max?.[index]);
    const min = Number(body.daily?.temperature_2m_min?.[index]);
    const mid = Number.isFinite(max) && Number.isFinite(min) ? (max + min) / 2 : max;
    if (!date || !Number.isFinite(mid)) return [];
    const dayCode = Number(body.daily?.weather_code?.[index]);
    const precip = Number(body.daily?.precipitation_sum?.[index]);
    const dayRain = (Number.isFinite(precip) && precip >= 1) || isRainCode(dayCode);
    return [
      {
        date,
        band: bandForTemperature(mid),
        rain: dayRain,
        label: `${Math.round(mid)}°C · ${dayRain ? "有雨" : skyFromCode(dayCode)}`,
      },
    ];
  });
  return current ? { current, days } : null;
}

export const fetchForecast = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("地点无效");
    const latitude = Number((input as { latitude?: unknown }).latitude);
    const longitude = Number((input as { longitude?: unknown }).longitude);
    const city = (input as { city?: unknown }).city;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || typeof city !== "string" || !city) {
      throw new Error("地点无效");
    }
    return { latitude, longitude, city };
  })
  .handler(async ({ data }): Promise<LiveWeather> => {
    const [met, open, wttr] = await Promise.allSettled([
      fromMetNorway(data),
      fromOpenMeteo(data),
      fromWttr(data),
    ]);
    const metValue = met.status === "fulfilled" ? met.value : null;
    const openValue = open.status === "fulfilled" ? open.value : null;
    const wttrValue = wttr.status === "fulfilled" ? wttr.value : null;
    const picked = metValue?.current ? metValue : wttrValue?.current ? wttrValue : openValue;
    if (!picked?.current) return { ...FALLBACK_WEATHER, city: data.city };
    const days = openValue?.days.length ? openValue.days : picked.days;
    const today = days.find((day) => day.date === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()));
    return { ...picked.current, days, rain: today?.rain ?? picked.current.rain };
  });

export async function loadWeather(cityName: string): Promise<LiveWeather> {
  const city = cityByName(cityName);
  const hit = caches.get(city.name);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const value = await fetchForecast({
      data: { latitude: city.latitude, longitude: city.longitude, city: city.name },
    });
    if (!value.live) return hit?.value ?? { ...FALLBACK_WEATHER, city: city.name };
    caches.set(city.name, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? { ...FALLBACK_WEATHER, city: city.name };
  }
}

export function useLiveWeather(cityName: string) {
  const city = cityByName(cityName).name;
  const [weather, setWeather] = useState<LiveWeather>(caches.get(city)?.value ?? { ...FALLBACK_WEATHER, city });

  useEffect(() => {
    let cancelled = false;
    void loadWeather(city).then((value) => {
      if (!cancelled) setWeather(value);
    });
    return () => {
      cancelled = true;
    };
  }, [city]);

  return weather;
}
