export type ShopLink = { label: string; href: string };

/** Search the same item on Taobao and JD. No affiliate ids, no Taiwan storefronts. */
export function shopLinks(item: { name: string; brand: string }): ShopLink[] {
  const query = [item.brand, item.name].filter(Boolean).join(" ").trim();
  const q = encodeURIComponent(query || item.name);
  return [
    { label: "淘宝", href: `https://s.taobao.com/search?q=${q}` },
    { label: "京东", href: `https://search.jd.com/Search?keyword=${q}` },
  ];
}
