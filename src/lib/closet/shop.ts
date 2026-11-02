export function shopSearchUrl(item: { name: string; brand: string }) {
  const query = [item.brand, item.name, "购买"].filter(Boolean).join(" ");
  return `https://shopee.tw/search?keyword=${encodeURIComponent(query)}`;
}
