import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, type ShopSnapshot } from "./snapshot.js";
import { assertDraftOnlyPayload } from "./etsy.js";
import { ALLOWED_TOOL_NAMES } from "./tools.js";

describe("diffSnapshots", () => {
  it("detects price changes on active listings", () => {
    const before: ShopSnapshot = {
      taken_at: "t0",
      shop_id: "1",
      listings: [{ listing_id: 10, title: "Mug", price: "12.00", state: "active" }],
    };
    const after: ShopSnapshot = {
      taken_at: "t1",
      shop_id: "1",
      listings: [{ listing_id: 10, title: "Mug", price: "9.00", state: "active" }],
    };
    const diff = diffSnapshots(before, after);
    assert.equal(diff.changed.length, 1);
    assert.equal(diff.changed[0].before.price, "12.00");
    assert.equal(diff.changed[0].after.price, "9.00");
  });

  it("passes when nothing changed", () => {
    const snap: ShopSnapshot = {
      taken_at: "t0",
      shop_id: "1",
      listings: [{ listing_id: 10, title: "Mug", price: "12.00", state: "active" }],
    };
    const diff = diffSnapshots(snap, snap);
    assert.equal(diff.changed.length, 0);
    assert.equal(diff.missing.length, 0);
  });
});

describe("assertDraftOnlyPayload", () => {
  it("blocks non-draft state", () => {
    assert.throws(() => assertDraftOnlyPayload({ state: "active" }), /Blocked/);
  });

  it("strips draft state", () => {
    const p: Record<string, unknown> = { state: "draft", title: "x" };
    assertDraftOnlyPayload(p);
    assert.equal("state" in p, false);
  });
});

describe("tool surface", () => {
  it("exposes exactly three tools", () => {
    assert.deepEqual([...ALLOWED_TOOL_NAMES].sort(), [
      "create_draft_listing",
      "read_listings",
      "upload_listing_image",
    ]);
  });
});
