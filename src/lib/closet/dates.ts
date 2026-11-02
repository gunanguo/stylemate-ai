const WEEKDAY: Record<string, string> = {
  Sun: "星期日",
  Mon: "星期一",
  Tue: "星期二",
  Wed: "星期三",
  Thu: "星期四",
  Fri: "星期五",
  Sat: "星期六",
};

/** Mainland China civil time. Shanghai and Beijing share this zone. */
export const CHINA_TIME_ZONE = "Asia/Shanghai";

export type ChinaNow = {
  key: string;
  label: string;
  hello: string;
  year: number;
  month: number;
  day: number;
  hour: number;
};

export function shanghaiNow(date = new Date()): ChinaNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const hello =
    hour < 5 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  return {
    key: `${get("year")}-${get("month")}-${get("day")}`,
    label: `${month}月${day}日 ${WEEKDAY[get("weekday")] ?? ""}`,
    hello,
    year: Number(get("year")),
    month,
    day,
    hour,
  };
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

/** Sunday-first offset for a calendar month in China (UTC+8, no daylight saving). */
export function firstWeekday(year: number, month: number) {
  const utc = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CHINA_TIME_ZONE,
    weekday: "short",
  }).format(utc);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function cny(amount: number) {
  return `¥${Math.round(amount).toLocaleString("zh-CN")}`;
}
