/** Where to send someone after they sign in, if they were in the middle of something. */
export type AccountIntent =
  | { kind: "add" }
  | { kind: "piece"; id: string }
  | { kind: "wear"; date: string; outfitId: string }
  | { kind: "save"; outfitId: string }
  | { kind: "shop"; ids: string[] }
  | { kind: "own"; id: string }
  | { kind: "profile" }
  | { kind: "calendar" };

const KEY = "stylemate-intent";

export function saveIntent(intent: AccountIntent) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* private mode */
  }
}

export function readIntent(): AccountIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountIntent;
    if (!parsed || typeof parsed !== "object" || typeof parsed.kind !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntent() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
