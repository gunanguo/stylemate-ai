export type ClosetNotice = { id: string; title: string; body: string };

export function buildNotices(input: {
  today: string;
  wornToday: boolean;
  forecastLive: boolean;
  forecastLabel: string;
  forecastAdvice: string;
  missingNames: string[];
  idle: Array<{ name: string; days: number }>;
  shoppingCount: number;
}) {
  const notices: ClosetNotice[] = [];
  if (input.forecastLive) {
    notices.push({
      id: `weather-${input.today}`,
      title: "今天的天气",
      body: `${input.forecastLabel}。${input.forecastAdvice}`,
    });
  }
  if (!input.wornToday) {
    notices.push({
      id: `today-${input.today}`,
      title: "今天还没决定",
      body: "先从今日穿搭里选一套，日历上也会记下。",
    });
  }
  if (input.missingNames.length > 0) {
    notices.push({
      id: `missing-${input.today}`,
      title: "这套还有新品",
      body: `${input.missingNames.join("、")} 还没放进衣橱。`,
    });
  }
  for (const item of input.idle.slice(0, 2)) {
    notices.push({
      id: `idle-${item.name}`,
      title: "有衣服闲着",
      body: `「${item.name}」已经 ${item.days} 天没穿。`,
    });
  }
  if (input.shoppingCount > 0) {
    notices.push({
      id: "shopping",
      title: "购买清单",
      body: `还有 ${input.shoppingCount} 件在清单里，可以去搜索或标成已买。`,
    });
  }
  return notices;
}

const READ_KEY = "stylemate-notices-read";

export function readNoticeIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function markNoticesRead(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return readNoticeIds();
  const next = [...new Set([...readNoticeIds(), ...ids])].slice(-80);
  localStorage.setItem(READ_KEY, JSON.stringify(next));
  return next;
}
