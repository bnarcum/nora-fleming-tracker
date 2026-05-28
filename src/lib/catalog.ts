import catalogData from "../../data/catalog.json";
import type { Catalog, Item, ItemKind, ItemStatus } from "./types";

const catalog = catalogData as Catalog;

export function getCatalog(): Catalog {
  return catalog;
}

export function getItems(): Item[] {
  return catalog.items;
}

export function getItemById(id: string): Item | undefined {
  return catalog.items.find((i) => i.id === id);
}

const TAG_GROUPS = ["theme", "color", "season", "holiday"] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

export function parseTag(tag: string): { group: TagGroup | "other"; value: string } {
  for (const group of TAG_GROUPS) {
    const prefix = `${group}_`;
    if (tag.toLowerCase().startsWith(prefix)) {
      return { group, value: tag.slice(prefix.length).toLowerCase() };
    }
  }
  return { group: "other", value: tag };
}

export function groupedTagFacets(items: Item[]): Record<TagGroup, { value: string; count: number }[]> {
  const counts: Record<TagGroup, Map<string, number>> = {
    theme: new Map(),
    color: new Map(),
    season: new Map(),
    holiday: new Map(),
  };
  for (const item of items) {
    for (const tag of item.tags) {
      const { group, value } = parseTag(tag);
      if (group === "other") continue;
      counts[group].set(value, (counts[group].get(value) ?? 0) + 1);
    }
  }
  const out: Record<TagGroup, { value: string; count: number }[]> = {
    theme: [],
    color: [],
    season: [],
    holiday: [],
  };
  for (const group of TAG_GROUPS) {
    out[group] = Array.from(counts[group].entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return out;
}

export function statusLabel(status: ItemStatus): string {
  switch (status) {
    case "current":
      return "Available";
    case "sold_out":
      return "Sold out";
    case "retiring":
      return "Retiring";
    case "retired":
      return "Retired";
  }
}

export function statusTone(status: ItemStatus): "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "current":
      return "success";
    case "sold_out":
      return "warning";
    case "retiring":
      return "danger";
    case "retired":
      return "muted";
  }
}

export function kindLabel(kind: ItemKind): string {
  if (kind === "mini") return "Mini";
  if (kind === "base") return "Base";
  return "Other";
}

type Filters = {
  query: string;
  kinds: Set<string>;
  statuses: Set<string>;
  tags: Set<string>;
  onlyOwned: boolean;
  onlyWishlist: boolean;
  hideHidden: boolean;
};

export function filterItems(
  items: Item[],
  filters: Filters,
  owned: Record<string, string>,
  wishlist: Record<string, string>,
  hidden: Record<string, true>,
): Item[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.hideHidden && hidden[item.id]) return false;
    if (filters.onlyOwned && !owned[item.id]) return false;
    if (filters.onlyWishlist && !wishlist[item.id]) return false;
    if (filters.kinds.size > 0 && !filters.kinds.has(item.kind)) return false;
    if (filters.statuses.size > 0 && !filters.statuses.has(item.status)) return false;
    if (filters.tags.size > 0) {
      const itemTagSet = new Set(item.tags);
      let match = true;
      for (const t of filters.tags) {
        if (!itemTagSet.has(t)) {
          match = false;
          break;
        }
      }
      if (!match) return false;
    }
    if (q.length > 0) {
      const haystack = [item.name, item.displayName, item.sku ?? "", item.description ?? ""]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

const STATUS_ORDER: Record<ItemStatus, number> = {
  retiring: 0,
  sold_out: 1,
  current: 2,
  retired: 3,
};

export function sortItems(items: Item[], sort: string): Item[] {
  const copy = [...items];
  switch (sort) {
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "newest-retired":
      return copy.sort((a, b) => {
        const aT = a.retiredDetectedAt ?? "0";
        const bT = b.retiredDetectedAt ?? "0";
        return bT.localeCompare(aT);
      });
    default:
      return copy.sort((a, b) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (s !== 0) return s;
        return a.name.localeCompare(b.name);
      });
  }
}
