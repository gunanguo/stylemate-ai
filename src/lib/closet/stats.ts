export function wearStats(
  id: string,
  addedAt: number,
  wornItems: Record<string, string[]> | undefined,
  today: string,
) {
  const dates = Object.entries(wornItems ?? {})
    .filter(([, ids]) => ids.includes(id))
    .map(([date]) => date)
    .sort();
  const last = dates[dates.length - 1] ?? null;
  const from = last ?? chinaDay(addedAt);
  return { count: dates.length, last, idle: daySpan(from, today) };
}

export function costPerWear(price: number, owned: boolean, count: number) {
  if (!owned || price <= 0) return null;
  return Math.round(price / Math.max(count, 1));
}

function chinaDay(time: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

function daySpan(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00+08:00`);
  const end = Date.parse(`${to}T00:00:00+08:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
