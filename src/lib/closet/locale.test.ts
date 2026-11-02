import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHINA_TIME_ZONE, cny, shanghaiNow } from "./dates.ts";
import { shopLinks } from "./shop.ts";

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
