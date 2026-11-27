import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { etsyGet, requireShopId } from "./etsy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = path.join(ROOT, ".snapshot-cache.json");

export type ListingSnapshot = {
  listing_id: number;
  title: string;
  price: string | number | null;
  state: string;
};

export type ShopSnapshot = {
  taken_at: string;
  shop_id: string;
  listings: ListingSnapshot[];
};

type ListingsResponse = {
  count?: number;
  results?: Array<{
    listing_id: number;
    title?: string;
    price?: { amount?: number; divisor?: number; currency_code?: string } | number;
    state?: string;
  }>;
};

function normalizePrice(
  price:
    | number
    | { amount?: number; divisor?: number; currency_code?: string }
    | undefined
): string | number | null {
  if (price == null) return null;
  if (typeof price === "number") return price;
  if (typeof price === "object" && price.amount != null && price.divisor) {
    return (price.amount / price.divisor).toFixed(2);
  }
  return null;
}

export async function captureActiveListingsSnapshot(): Promise<ShopSnapshot> {
  const shopId = requireShopId();
  const listings: ListingSnapshot[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const data = (await etsyGet(`/application/shops/${shopId}/listings`, {
      state: "active",
      limit,
      offset,
      includes: "Images",
    })) as ListingsResponse;

    const page = data.results ?? [];
    for (const item of page) {
      listings.push({
        listing_id: item.listing_id,
        title: item.title ?? "",
        price: normalizePrice(item.price),
        state: item.state ?? "active",
      });
    }

    if (page.length < limit) break;
    offset += limit;
    if (offset > 5000) break; // safety cap
  }

  const snapshot: ShopSnapshot = {
    taken_at: new Date().toISOString(),
    shop_id: shopId,
    listings,
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

export function loadLastSnapshot(): ShopSnapshot | null {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as ShopSnapshot;
  } catch {
    return null;
  }
}

export type SnapshotDiff = {
  changed: Array<{
    listing_id: number;
    title: string;
    before: { price: string | number | null; state: string };
    after: { price: string | number | null; state: string };
  }>;
  missing: ListingSnapshot[];
  added: ListingSnapshot[];
};

export function diffSnapshots(
  before: ShopSnapshot,
  after: ShopSnapshot
): SnapshotDiff {
  const beforeMap = new Map(before.listings.map((l) => [l.listing_id, l]));
  const afterMap = new Map(after.listings.map((l) => [l.listing_id, l]));
  const changed: SnapshotDiff["changed"] = [];
  const missing: ListingSnapshot[] = [];
  const added: ListingSnapshot[] = [];

  for (const [id, prev] of beforeMap) {
    const next = afterMap.get(id);
    if (!next) {
      missing.push(prev);
      continue;
    }
    if (String(prev.price) !== String(next.price) || prev.state !== next.state) {
      changed.push({
        listing_id: id,
        title: next.title || prev.title,
        before: { price: prev.price, state: prev.state },
        after: { price: next.price, state: next.state },
      });
    }
  }

  for (const [id, next] of afterMap) {
    if (!beforeMap.has(id)) added.push(next);
  }

  return { changed, missing, added };
}

/**
 * Run before a write, then after. Throws if any active listing price/state changed.
 * New active listings appearing mid-run are reported but not treated as a failure
 * (this MCP cannot publish).
 */
export async function withActiveListingGuard<T>(
  action: () => Promise<T>
): Promise<{ result: T; snapshot: { before: ShopSnapshot; after: ShopSnapshot; diff: SnapshotDiff } }> {
  const before = await captureActiveListingsSnapshot();
  const result = await action();
  const after = await captureActiveListingsSnapshot();
  const diff = diffSnapshots(before, after);

  if (diff.changed.length > 0 || diff.missing.length > 0) {
    const detail = JSON.stringify({ changed: diff.changed, missing: diff.missing }, null, 2);
    throw new Error(
      `SAFETY STOP: active listing price/state changed during this run. Revoke the Etsy app token if unexpected.\n${detail}`
    );
  }

  return { result, snapshot: { before, after, diff } };
}
