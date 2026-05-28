export type ItemStatus = "current" | "sold_out" | "retiring" | "retired";
export type ItemKind = "mini" | "base" | "other";
export type ItemSource = "norafleming" | "turnmeyers";

export type Item = {
  id: string;
  sku?: string;
  name: string;
  displayName: string;
  kind: ItemKind;
  status: ItemStatus;
  source: ItemSource[];
  storeUrl?: string;
  imageUrl?: string;
  price?: number;
  tags: string[];
  description?: string;
  firstSeen?: string;
  lastSeen?: string;
  retiredDetectedAt?: string;
};

export type CatalogStats = {
  current: number;
  soldOut: number;
  retiring: number;
  retired: number;
  total: number;
};

export type Catalog = {
  version: number;
  generatedAt: string;
  items: Item[];
  stats: CatalogStats;
};

export type Conflict = {
  reason: string;
  ids: string[];
  names: string[];
  resolution: string;
};
