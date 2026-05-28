"use client";

import { useEffect, useMemo, useState } from "react";
import { filterItems, sortItems } from "@/lib/catalog";
import { useCollection, type SortKey } from "@/lib/store";
import type { Item } from "@/lib/types";
import { FacetSidebar } from "./FacetSidebar";
import { ItemCard } from "./ItemCard";

export type PrefilterOverrides = {
  onlyOwned?: boolean;
  onlyWishlist?: boolean;
};

export function CatalogView({
  items,
  intro,
  forcedFilters,
  defaultSort = "default",
}: {
  items: Item[];
  intro?: React.ReactNode;
  forcedFilters?: PrefilterOverrides;
  defaultSort?: SortKey;
}) {
  const filters = useCollection((s) => s.filters);
  const sort = useCollection((s) => s.sort);
  const owned = useCollection((s) => s.owned);
  const wishlist = useCollection((s) => s.wishlist);
  const hidden = useCollection((s) => s.hidden);
  const setQuery = useCollection((s) => s.setQuery);
  const setSort = useCollection((s) => s.setSort);

  // Hydration gate so server-rendered initial paint matches client.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (defaultSort !== "default") setSort(defaultSort);
  }, [defaultSort, setSort]);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      onlyOwned: forcedFilters?.onlyOwned ?? filters.onlyOwned,
      onlyWishlist: forcedFilters?.onlyWishlist ?? filters.onlyWishlist,
    }),
    [filters, forcedFilters],
  );

  const filtered = useMemo(() => {
    if (!hydrated && (forcedFilters?.onlyOwned || forcedFilters?.onlyWishlist)) {
      // Avoid a flash of "all items" on owned/wishlist pages before localStorage hydrates.
      return [] as Item[];
    }
    return sortItems(filterItems(items, effectiveFilters, owned, wishlist, hidden), sort);
  }, [items, effectiveFilters, owned, wishlist, hidden, sort, hydrated, forcedFilters]);

  return (
    <div className="space-y-4">
      {intro}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 scrollbar-thin">
          <FacetSidebar items={items} />
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or SKU..."
              maxLength={200}
              className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-primary sm:max-w-xs"
            />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{filtered.length} items</span>
              <label className="flex items-center gap-2">
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-md border bg-card px-2 py-1.5 text-sm"
                >
                  <option value="default">Sort: Status</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                  <option value="newest-retired">Recently retired</option>
                </select>
              </label>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState owned={effectiveFilters.onlyOwned} wishlist={effectiveFilters.onlyWishlist} />
          ) : (
            <ul
              role="list"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              {filtered.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ owned, wishlist }: { owned?: boolean; wishlist?: boolean }) {
  if (owned) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
        <p className="text-base font-medium text-foreground">No items marked as owned yet.</p>
        <p className="mt-1">
          Browse the catalog and tap <b>Mark owned</b> on a card to start tracking.
        </p>
      </div>
    );
  }
  if (wishlist) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
        <p className="text-base font-medium text-foreground">Your wishlist is empty.</p>
        <p className="mt-1">Tap <b>Wishlist</b> on items you want next.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
      <p className="text-base font-medium text-foreground">No items match these filters.</p>
      <p className="mt-1">Loosen a facet or clear the search.</p>
    </div>
  );
}
