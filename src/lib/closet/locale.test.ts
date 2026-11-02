import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEED_GARMENTS, SEED_OUTFITS, SEED_WORN } from "./catalog.ts";
import { CHINA_TIME_ZONE, cny, shanghaiNow, shiftChinaKey } from "./dates.ts";
import { shopLinks } from "./shop.ts";
import { wearStats } from "./stats.ts";

describe("mainland locale", () => {
  it("formats yuan without a Taiwan dollar prefix", () => {
    assert.equal(cny(1680), "¥1,680");
    assert.equal(cny(0), "¥0");
  });

  it("reads the calendar day in Asia/Shanghai", () => {
    const instant = new Date("2026-11-02T16:30:00.000Z");
    const now = shanghaiNow(instant);
    assert.equal(CHINA_TIME_ZONE, "Asia/Shanghai");
    assert.equal(now.key, "2026-11-03");
    assert.equal(now.hour, 0);
  });

  it("keeps the sample closet's idle days near today", () => {
    const today = shanghaiNow().key;
    assert.equal(shiftChinaKey("2026-11-02", -1), "2026-11-01");
    assert.equal(shiftChinaKey("2026-11-02", -4), "2026-10-29");
    const wornItems: Record<string, string[]> = {};
    for (const [date, id] of Object.entries(SEED_WORN)) {
      assert.ok(date < today, date);
      const outfit = SEED_OUTFITS.find((item) => item.id === id);
      wornItems[date] = outfit?.garmentIds ?? [];
    }
    for (const garment of SEED_GARMENTS) {
      const idle = wearStats(garment.id, garment.addedAt, wornItems, today).idle;
      assert.ok(idle < 45, `${garment.name} shows ${idle} days idle`);
    }
  });

  it("searches Taobao and JD instead of a Taiwan storefront", () => {
    const links = shopLinks({ brand: "优衣库", name: "白色衬衫" });
    assert.deepEqual(
      links.map((link) => link.label),
      ["淘宝", "京东"],
    );
    assert.match(links[0]?.href ?? "", /^https:\/\/s\.taobao\.com\/search\?q=/);
    assert.match(links[1]?.href ?? "", /^https:\/\/search\.jd\.com\/Search\?keyword=/);
    assert.equal(links.some((link) => link.href.includes("shopee")), false);
  });
});
