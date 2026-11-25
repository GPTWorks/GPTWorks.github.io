import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  assertDraftOnlyPayload,
  etsyGet,
  etsyPost,
  etsyPostForm,
  requireShopId,
} from "./etsy.js";
import { withActiveListingGuard } from "./snapshot.js";

/** Exact public tool surface. Do not add publish/update tools. */
export const ALLOWED_TOOL_NAMES = [
  "create_draft_listing",
  "upload_listing_image",
  "read_listings",
] as const;

export type AllowedToolName = (typeof ALLOWED_TOOL_NAMES)[number];

const whoMade = z.enum(["i_did", "someone_else", "collective"]);
const whenMade = z.enum([
  "made_to_order",
  "2020_2026",
  "2010_2019",
  "2007_2009",
  "before_2007",
  "2000_2006",
  "1990s",
  "1980s",
  "1970s",
  "1960s",
  "1950s",
  "1940s",
  "1930s",
  "1920s",
  "1910s",
  "1900s",
  "1800s",
  "1700s",
  "before_1700",
]);

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

async function findClosestActivePriceNote(price: number): Promise<string> {
  const shopId = requireShopId();
  const data = (await etsyGet(`/application/shops/${shopId}/listings`, {
    state: "active",
    limit: 25,
  })) as {
    results?: Array<{
      listing_id: number;
      title?: string;
      price?: { amount?: number; divisor?: number } | number;
    }>;
  };

  let closest: {
    listing_id: number;
    title: string;
    price: number;
    delta: number;
  } | null = null;

  for (const item of data.results ?? []) {
    let p: number | null = null;
    if (typeof item.price === "number") p = item.price;
    else if (item.price?.amount != null && item.price.divisor) {
      p = item.price.amount / item.price.divisor;
    }
    if (p == null) continue;
    const delta = Math.abs(p - price);
    if (!closest || delta < closest.delta) {
      closest = {
        listing_id: item.listing_id,
        title: item.title ?? "",
        price: p,
        delta,
      };
    }
  }

  if (!closest) {
    return `Price note: draft price $${price.toFixed(2)}; no active listings to compare.`;
  }
  return `Price note: draft $${price.toFixed(2)} vs closest active #${closest.listing_id} "$${closest.price.toFixed(2)}" (${closest.title.slice(0, 60)}). Confirm against your price sheet before publishing.`;
}

export function registerTools(server: McpServer): void {
  server.tool(
    "read_listings",
    "Read listings from the GPT Workspace Etsy shop (https://gptworkspace.etsy.com). Use this to model drafts on best sellers and to snapshot prices. Filter by state: active, draft, inactive, expired, sold_out.",
    {
      state: z
        .enum(["active", "draft", "inactive", "expired", "sold_out"])
        .optional()
        .default("active")
        .describe("Listing state filter"),
      limit: z.number().int().min(1).max(100).optional().default(25),
      offset: z.number().int().min(0).optional().default(0),
      include_price_snapshot: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, also return a compact active-listing price snapshot for safety checks"
        ),
    },
    async (args) => {
      try {
        const state = args.state ?? "active";
        const limit = args.limit ?? 25;
        const offset = args.offset ?? 0;
        const shopId = requireShopId();
        const data = await etsyGet(`/application/shops/${shopId}/listings`, {
          state,
          limit,
          offset,
        });

        let price_snapshot:
          | Array<{
              listing_id: number;
              title?: string;
              price: string | number | null;
              state?: string;
            }>
          | undefined;

        if (args.include_price_snapshot) {
          const active = (await etsyGet(
            `/application/shops/${shopId}/listings`,
            {
              state: "active",
              limit: 100,
            }
          )) as {
            results?: Array<{
              listing_id: number;
              title?: string;
              price?: { amount?: number; divisor?: number } | number;
              state?: string;
            }>;
          };
          price_snapshot = (active.results ?? []).map((item) => {
            let price: string | number | null = null;
            if (typeof item.price === "number") price = item.price;
            else if (item.price?.amount != null && item.price.divisor) {
              price = (item.price.amount / item.price.divisor).toFixed(2);
            }
            return {
              listing_id: item.listing_id,
              title: item.title,
              price,
              state: item.state,
            };
          });
        }

        return jsonResult({
          shop: "https://gptworkspace.etsy.com",
          shop_id: shopId,
          filter: { state, limit, offset },
          data,
          price_snapshot,
          reminder:
            "This MCP cannot publish or change live prices. You publish from Etsy Drafts.",
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "create_draft_listing",
    "Create a DRAFT listing only in the GPT Workspace Etsy shop (https://gptworkspace.etsy.com). Never publishes. Runs an active-listing price/state guard before and after. Publish yourself from Drafts ($0.20 fee then).",
    {
      title: z.string().min(1).max(140).describe("Listing title (max 140 chars)"),
      description: z.string().min(1).describe("Full listing description"),
      price: z
        .number()
        .positive()
        .describe(
          "Price from YOUR price sheet (USD). Bot must not invent prices."
        ),
      quantity: z.number().int().positive().describe("Stock quantity"),
      taxonomy_id: z.number().int().positive().describe("Etsy taxonomy node ID"),
      who_made: whoMade.default("i_did"),
      when_made: whenMade.default("made_to_order"),
      is_supply: z.boolean().optional().default(false),
      type: z
        .enum(["physical", "download", "both"])
        .optional()
        .default("physical")
        .describe("physical | download | both"),
      tags: z.array(z.string()).max(13).optional().describe("Up to 13 SEO tags"),
      materials: z.array(z.string()).max(13).optional(),
      shipping_profile_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Optional for drafts; required before you publish physical items"
        ),
      shop_section_id: z.number().int().positive().optional(),
      processing_min: z.number().int().positive().optional(),
      processing_max: z.number().int().positive().optional(),
      price_sheet_note: z
        .string()
        .optional()
        .describe("Optional note citing the price-sheet row used"),
    },
    async (args) => {
      try {
        const shopId = requireShopId();
        const price = args.price;
        const payload: Record<string, unknown> = {
          title: args.title,
          description: args.description,
          price,
          quantity: args.quantity,
          taxonomy_id: args.taxonomy_id,
          who_made: args.who_made ?? "i_did",
          when_made: args.when_made ?? "made_to_order",
          is_supply: args.is_supply ?? false,
          type: args.type ?? "physical",
        };
        if (args.tags) payload.tags = args.tags;
        if (args.materials) payload.materials = args.materials;
        if (args.shipping_profile_id) {
          payload.shipping_profile_id = args.shipping_profile_id;
        }
        if (args.shop_section_id) payload.shop_section_id = args.shop_section_id;
        if (args.processing_min) payload.processing_min = args.processing_min;
        if (args.processing_max) payload.processing_max = args.processing_max;

        assertDraftOnlyPayload(payload);

        const { result, snapshot } = await withActiveListingGuard(async () => {
          return etsyPost(`/application/shops/${shopId}/listings`, payload);
        });

        const priceNote = await findClosestActivePriceNote(price);
        return jsonResult({
          shop: "https://gptworkspace.etsy.com",
          draft: result,
          price_note: priceNote,
          price_sheet_note: args.price_sheet_note ?? null,
          safety: {
            active_listings_unchanged: true,
            before_count: snapshot.before.listings.length,
            after_count: snapshot.after.listings.length,
          },
          next_steps: [
            "Upload at least one real product photo with upload_listing_image.",
            "Review the draft in Etsy Shop Manager → Drafts.",
            "You click Publish — this MCP will never do that.",
          ],
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "upload_listing_image",
    "Upload a product image to an existing DRAFT listing in https://gptworkspace.etsy.com. Prefer the seller's real photos. Pass image_url (https) or image_base64. Runs the active-listing price/state guard.",
    {
      listing_id: z.number().int().positive().describe("Draft listing ID"),
      image_url: z
        .string()
        .url()
        .optional()
        .describe("HTTPS URL of the image to download and upload"),
      image_base64: z
        .string()
        .optional()
        .describe("Raw base64 or data-URL image bytes"),
      filename: z.string().optional().default("listing.jpg"),
      rank: z.number().int().min(1).max(10).optional(),
      alt_text: z.string().max(250).optional(),
    },
    async (args) => {
      try {
        const shopId = requireShopId();
        const listingId = args.listing_id;
        const filename = args.filename || "listing.jpg";

        let buffer: Buffer;
        if (args.image_url) {
          const imgResp = await fetch(args.image_url);
          if (!imgResp.ok) {
            throw new Error(`Failed to download image_url (${imgResp.status})`);
          }
          buffer = Buffer.from(await imgResp.arrayBuffer());
        } else if (args.image_base64) {
          let b64 = args.image_base64;
          const dataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.exec(b64);
          if (dataUrl) b64 = b64.slice(dataUrl[0].length);
          buffer = Buffer.from(b64, "base64");
        } else {
          throw new Error("Provide image_url or image_base64");
        }

        if (buffer.length < 100) {
          throw new Error(
            "Image data too small — check the URL or base64 payload"
          );
        }

        const form = new FormData();
        const bytes = new Uint8Array(buffer);
        form.append("image", new Blob([bytes]), filename);
        if (args.rank != null) form.append("rank", String(args.rank));
        if (args.alt_text) form.append("alt_text", args.alt_text);

        const { result, snapshot } = await withActiveListingGuard(async () => {
          return etsyPostForm(
            `/application/shops/${shopId}/listings/${listingId}/images`,
            form
          );
        });

        return jsonResult({
          shop: "https://gptworkspace.etsy.com",
          listing_id: listingId,
          image: result,
          safety: {
            active_listings_unchanged: true,
            before_count: snapshot.before.listings.length,
            after_count: snapshot.after.listings.length,
          },
          reminder:
            "Use real product photos. Do not invent product images. Publish stays with you.",
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
