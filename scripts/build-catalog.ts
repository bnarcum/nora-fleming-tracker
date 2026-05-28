#!/usr/bin/env tsx
/**
 * Builds data/catalog.json by merging two trusted public sources:
 *   1. https://norafleming.com/products.json     (Shopify storefront)
 *   2. https://turnmeyers.com/blogs/news/...     (community checklist with retired items)
 *
 * Outputs:
 *   data/catalog.json   - canonical merged catalog consumed by the app
 *   data/conflicts.json - duplicate/ambiguous merges flagged for human review
 *
 * Re-running detects newly retired items by diffing against the previous catalog
 * snapshot already committed to the repo.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import type {
  Catalog,
  CatalogStats,
  Conflict,
  Item,
  ItemKind,
  ItemSource,
  ItemStatus,
} from "../src/lib/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = resolve(ROOT, "data/catalog.json");
const CONFLICTS_PATH = resolve(ROOT, "data/conflicts.json");
const SHOPIFY_URL = "https://norafleming.com/products.json?limit=250";
const STORE_BASE = "https://norafleming.com/products/";
const CHECKLIST_URL =
  "https://turnmeyers.com/blogs/news/nora-fleming-complete-mini-checklist";

// Allow-list of trusted image hosts to embed in the catalog. Anything else gets dropped.
const TRUSTED_IMAGE_HOSTS = new Set([
  "cdn.shopify.com",
  "norafleming.com",
  "www.norafleming.com",
]);

/* ------------------------------------------------------------------ utilities */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers = {
    "User-Agent":
      "nora-fleming-tracker/0.1 (+https://github.com/) personal collection catalog builder",
    Accept: "application/json, text/html;q=0.9, */*;q=0.5",
    ...(opts.headers ?? {}),
  };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers });
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
      } else {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
    } catch (err) {
      lastErr = err;
    }
    await sleep(500 * attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Build a stable, comparable key from a free-form mini name.
 * Normalizes case, strips brand boilerplate, parentheticals, and punctuation.
 */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/nora fleming/g, "")
    .replace(/\(([^)]*)\)/g, " $1 ") // keep parenthetical content as words
    .replace(/[\u2018\u2019\u201c\u201d`']/g, "")
    .replace(/\bmini(s)?\b/g, "")
    .replace(/\bbase\b/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    if (!TRUSTED_IMAGE_HOSTS.has(parsed.hostname)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/* ---------------------------------------------------------------- shopify src */

type ShopifyVariant = {
  id: number;
  sku: string | null;
  available: boolean;
  price: string;
};

type ShopifyImage = { src: string };

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  vendor: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
};

function classifyKind(product: ShopifyProduct, sku?: string): ItemKind {
  const lowerTitle = product.title.toLowerCase();
  const tags = product.tags.map((t) => t.toLowerCase());
  // A### SKUs are the canonical Nora Fleming mini identifier.
  if (sku && /^A\d{2,4}$/i.test(sku)) return "mini";
  if (tags.includes("minis") || /\bmini\b/.test(lowerTitle)) return "mini";
  if (tags.some((t) => t === "bases" || t.startsWith("base_")) || /\bbase\b/.test(lowerTitle))
    return "base";
  if (/(platter|bowl|board|tray|pitcher|server|dish|cake stand)/.test(lowerTitle)) return "base";
  return "other";
}

function pickSku(product: ShopifyProduct): string | undefined {
  for (const v of product.variants ?? []) {
    const raw = (v.sku ?? "").trim();
    if (!raw) continue;
    const match = raw.match(/^([A-Z]\d{2,4})/i);
    if (match) return match[1].toUpperCase();
  }
  return undefined;
}

function stripHtml(html: string): string {
  if (!html) return "";
  const root = parse(html);
  return root.text.replace(/\s+/g, " ").trim();
}

async function fetchShopifyItems(): Promise<Item[]> {
  const res = await fetchWithRetry(SHOPIFY_URL);
  const data = (await res.json()) as { products: ShopifyProduct[] };
  const items: Item[] = [];
  for (const product of data.products) {
    const sku = pickSku(product);
    const id = sku ?? slugify(product.handle);
    const anyAvailable = product.variants.some((v) => v.available);
    const status: ItemStatus = anyAvailable ? "current" : "sold_out";
    const priceStr = product.variants[0]?.price;
    const price = priceStr ? Number.parseFloat(priceStr) : undefined;
    const imageUrl = safeImageUrl(product.images[0]?.src);
    const tags = (product.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);

    items.push({
      id,
      sku,
      name: product.title.trim(),
      displayName: product.title.trim(),
      kind: classifyKind(product, sku),
      status,
      source: ["norafleming"],
      storeUrl: `${STORE_BASE}${product.handle}`,
      imageUrl,
      price: Number.isFinite(price) ? price : undefined,
      tags,
      description: stripHtml(product.body_html).slice(0, 600) || undefined,
    });
  }
  return items;
}

/* -------------------------------------------------------------- turnmeyers src */

type TurnmeyersRow = { sku?: string; name: string; kind: ItemKind; status: ItemStatus };

/**
 * Parse the four labeled tables on the Turnmeyers checklist page. The headings
 * are H2 with stable text; tables immediately follow each heading. We extract
 * SKU (when present) and the mini/base name from each row.
 */
async function fetchTurnmeyersItems(): Promise<Item[]> {
  const res = await fetchWithRetry(CHECKLIST_URL);
  const html = await res.text();
  const root = parse(html);

  const sections: Array<{ headingMatch: RegExp; kind: ItemKind; status: ItemStatus }> = [
    {
      headingMatch: /current\s+nora\s+fleming\s+minis/i,
      kind: "mini",
      status: "current",
    },
    {
      headingMatch: /current\s+nora\s+fleming\s+bases/i,
      kind: "base",
      status: "current",
    },
    {
      headingMatch: /retired\s+nora\s+fleming\s+minis/i,
      kind: "mini",
      status: "retired",
    },
    {
      headingMatch: /retired\s+nora\s+fleming\s+bases/i,
      kind: "base",
      status: "retired",
    },
  ];

  // Build an ordered list of section anchors (h2 elements) and the tables that follow.
  const headings = root.querySelectorAll("h2, h3");
  const rows: TurnmeyersRow[] = [];

  for (const section of sections) {
    const heading = headings.find((h) => section.headingMatch.test(h.text.trim()));
    if (!heading) continue;

    // Walk forward through siblings until the next H2/H3 to find tables in this section.
    let node = heading.nextElementSibling;
    while (node && !/^h[23]$/i.test(node.tagName ?? "")) {
      const tables = node.tagName?.toLowerCase() === "table"
        ? [node]
        : node.querySelectorAll("table");
      for (const table of tables) {
        const trs = table.querySelectorAll("tr");
        for (const tr of trs) {
          const cells = tr.querySelectorAll("td").map((td) => td.text.trim());
          if (cells.length === 0) continue;
          // Two formats observed:
          //   [SKU, Name]   (current sections)
          //   [Name]        (retired sections — no SKU column)
          let sku: string | undefined;
          let name: string;
          if (cells.length >= 2 && /^[A-Z]\d{2,4}$/i.test(cells[0])) {
            sku = cells[0].toUpperCase();
            name = cells[1];
          } else if (cells.length === 1) {
            name = cells[0];
          } else {
            // Header row or unrecognized — skip.
            name = cells[cells.length - 1];
            if (/^sku$/i.test(cells[0])) continue;
          }
          if (!name) continue;
          // Skip generic header-style values that occasionally bleed through.
          const trimmedLower = name.trim().toLowerCase();
          if (["name", "sku", "mini name", "base name", "base", "mini"].includes(trimmedLower)) {
            continue;
          }
          rows.push({ sku, name, kind: section.kind, status: section.status });
        }
      }
      node = node.nextElementSibling;
    }
  }

  const items: Item[] = rows.map((row) => {
    const idBase = row.sku ?? slugify(normalizeName(row.name));
    return {
      id: idBase,
      sku: row.sku,
      name: cleanShortName(row.name),
      displayName: row.name,
      kind: row.kind,
      status: row.status,
      source: ["turnmeyers"],
      tags: [],
    };
  });

  return items;
}

/** Convert "Nora Fleming Pumpkin Spice Mini" -> "Pumpkin Spice". */
function cleanShortName(raw: string): string {
  return raw
    .replace(/^nora fleming\s+/i, "")
    .replace(/\s+mini$/i, "")
    .replace(/\s+base$/i, "")
    .trim();
}

/* ------------------------------------------------------------------- merging */

function mergeItems(
  shopify: Item[],
  turnmeyers: Item[],
): { items: Item[]; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const bySku = new Map<string, Item>();
  const bySlug = new Map<string, Item>();

  function indexItem(item: Item) {
    if (item.sku) bySku.set(item.sku, item);
    bySlug.set(slugify(normalizeName(item.name)), item);
  }

  // Shopify wins: ingest it first so its data takes precedence.
  for (const item of shopify) {
    if (item.sku && bySku.has(item.sku)) {
      const existing = bySku.get(item.sku)!;
      conflicts.push({
        reason: "duplicate SKU within Shopify response",
        ids: [existing.id, item.id],
        names: [existing.name, item.name],
        resolution: "kept first",
      });
      continue;
    }
    indexItem(item);
  }

  for (const t of turnmeyers) {
    const slug = slugify(normalizeName(t.name));
    const existingBySku = t.sku ? bySku.get(t.sku) : undefined;
    const existingBySlug = bySlug.get(slug);
    const existing = existingBySku ?? existingBySlug;

    if (existing) {
      // Merge metadata; the live store status wins over the checklist's stale label.
      const sources = new Set<ItemSource>([...existing.source, ...t.source]);
      existing.source = Array.from(sources);
      if (!existing.sku && t.sku) existing.sku = t.sku;
      if (existingBySku && existingBySlug && existingBySku.id !== existingBySlug.id) {
        conflicts.push({
          reason: "SKU and slug matched different existing items",
          ids: [existingBySku.id, existingBySlug.id, t.id],
          names: [existingBySku.name, existingBySlug.name, t.name],
          resolution: "kept SKU-matched item; Turnmeyers entry merged into it",
        });
      }
      // Status precedence: Shopify "current"/"sold_out" overrides Turnmeyers "retired"
      // for cases where the checklist hasn't caught up. But if Shopify has no entry
      // for it at all (no overlap), we keep the Turnmeyers "retired" status.
      continue;
    }

    indexItem(t);
  }

  const items = Array.from(new Set([...bySlug.values()]));
  return { items, conflicts };
}

/* ------------------------------------------------------------ snapshot diff */

async function loadPreviousCatalog(): Promise<Catalog | null> {
  if (!existsSync(CATALOG_PATH)) return null;
  try {
    const raw = await readFile(CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Catalog;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applySnapshotDiff(prev: Catalog | null, current: Item[]): Item[] {
  const now = new Date().toISOString();
  const currentById = new Map(current.map((i) => [i.id, i]));
  const prevById = new Map((prev?.items ?? []).map((i) => [i.id, i]));

  // Items previously listed by Shopify that have vanished: mark as newly retired.
  if (prev) {
    for (const old of prev.items) {
      if (!currentById.has(old.id) && old.source.includes("norafleming")) {
        // Item disappeared from norafleming.com between runs -> retired.
        const ghost: Item = {
          ...old,
          status: "retired",
          source: Array.from(new Set([...old.source, "turnmeyers" as ItemSource])).filter(
            (s) => s !== "norafleming",
          ) as ItemSource[],
          retiredDetectedAt: old.retiredDetectedAt ?? now,
          lastSeen: old.lastSeen ?? prev.generatedAt,
        };
        if (ghost.source.length === 0) ghost.source = ["turnmeyers"];
        current.push(ghost);
        currentById.set(ghost.id, ghost);
      }
    }
  }

  for (const item of current) {
    const previous = prevById.get(item.id);
    if (!item.firstSeen) item.firstSeen = previous?.firstSeen ?? now;
    if (item.source.includes("norafleming")) item.lastSeen = now;
    else item.lastSeen = previous?.lastSeen ?? item.lastSeen;

    // Sold-out + previously sold-out for >0 prior runs => mark as "retiring".
    if (item.status === "sold_out" && previous?.status === "sold_out") {
      item.status = "retiring";
    }
  }

  return current;
}

/* --------------------------------------------------------------------- main */

function computeStats(items: Item[]): CatalogStats {
  const s: CatalogStats = { current: 0, soldOut: 0, retiring: 0, retired: 0, total: items.length };
  for (const item of items) {
    if (item.status === "current") s.current++;
    else if (item.status === "sold_out") s.soldOut++;
    else if (item.status === "retiring") s.retiring++;
    else if (item.status === "retired") s.retired++;
  }
  return s;
}

async function main() {
  console.log("[catalog] fetching Shopify catalog ...");
  const shopify = await fetchShopifyItems();
  console.log(`[catalog]   got ${shopify.length} items from norafleming.com`);

  console.log("[catalog] fetching Turnmeyers checklist ...");
  let turnmeyers: Item[] = [];
  try {
    turnmeyers = await fetchTurnmeyersItems();
    console.log(`[catalog]   got ${turnmeyers.length} items from turnmeyers.com`);
  } catch (err) {
    console.warn(
      `[catalog]   WARN: failed to fetch Turnmeyers checklist (${(err as Error).message}); proceeding with Shopify-only data`,
    );
  }

  console.log("[catalog] merging sources ...");
  const { items: merged, conflicts } = mergeItems(shopify, turnmeyers);

  console.log("[catalog] applying snapshot diff ...");
  const previous = await loadPreviousCatalog();
  const itemsWithDiff = applySnapshotDiff(previous, merged);

  itemsWithDiff.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.name.localeCompare(b.name);
  });

  const catalog: Catalog = {
    version: (previous?.version ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    items: itemsWithDiff,
    stats: computeStats(itemsWithDiff),
  };

  await mkdir(dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  await writeFile(CONFLICTS_PATH, JSON.stringify(conflicts, null, 2) + "\n");

  console.log(
    `[catalog] wrote ${itemsWithDiff.length} items (current=${catalog.stats.current} sold_out=${catalog.stats.soldOut} retiring=${catalog.stats.retiring} retired=${catalog.stats.retired}); conflicts=${conflicts.length}`,
  );
}

main().catch((err) => {
  console.error("[catalog] FAILED:", err);
  process.exitCode = 1;
});
