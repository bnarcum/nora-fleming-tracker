"use client";

import { useMemo } from "react";
import { groupedTagFacets, kindLabel, statusLabel } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/store";
import type { Item, ItemKind, ItemStatus } from "@/lib/types";

const KINDS: ItemKind[] = ["mini", "base", "other"];
const STATUSES: ItemStatus[] = ["current", "sold_out", "retiring", "retired"];

export function FacetSidebar({ items }: { items: Item[] }) {
  const filters = useCollection((s) => s.filters);
  const toggleKind = useCollection((s) => s.toggleKind);
  const toggleStatus = useCollection((s) => s.toggleStatus);
  const toggleTag = useCollection((s) => s.toggleTag);
  const setFilter = useCollection((s) => s.setFilter);
  const reset = useCollection((s) => s.resetFilters);

  const counts = useMemo(() => {
    const byKind = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const item of items) {
      byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
      byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
    }
    return { byKind, byStatus };
  }, [items]);

  const tagFacets = useMemo(() => groupedTagFacets(items), [items]);

  return (
    <aside className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Reset
        </button>
      </div>

      <FacetGroup label="Quick">
        <Toggle
          label="Only owned"
          active={filters.onlyOwned}
          onClick={() => setFilter("onlyOwned", !filters.onlyOwned)}
        />
        <Toggle
          label="Only wishlist"
          active={filters.onlyWishlist}
          onClick={() => setFilter("onlyWishlist", !filters.onlyWishlist)}
        />
        <Toggle
          label="Show hidden"
          active={!filters.hideHidden}
          onClick={() => setFilter("hideHidden", !filters.hideHidden)}
        />
      </FacetGroup>

      <FacetGroup label="Status">
        {STATUSES.map((s) => (
          <Toggle
            key={s}
            label={`${statusLabel(s)} (${counts.byStatus.get(s) ?? 0})`}
            active={filters.statuses.has(s)}
            onClick={() => toggleStatus(s)}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Type">
        {KINDS.map((k) => (
          <Toggle
            key={k}
            label={`${kindLabel(k)} (${counts.byKind.get(k) ?? 0})`}
            active={filters.kinds.has(k)}
            onClick={() => toggleKind(k)}
          />
        ))}
      </FacetGroup>

      {(["theme", "season", "color", "holiday"] as const).map((group) => {
        const entries = tagFacets[group];
        if (entries.length === 0) return null;
        return (
          <FacetGroup key={group} label={group.charAt(0).toUpperCase() + group.slice(1)}>
            <div className="max-h-44 overflow-y-auto pr-1 scrollbar-thin">
              <div className="flex flex-wrap gap-1.5">
                {entries.slice(0, 40).map((entry) => {
                  const fullTag = `${group}_${entry.value}`;
                  const active = filters.tags.has(fullTag);
                  return (
                    <button
                      key={fullTag}
                      type="button"
                      onClick={() => toggleTag(fullTag)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs ring-1 transition",
                        active
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-card text-foreground ring-border hover:bg-muted",
                      )}
                    >
                      {entry.value} <span className="opacity-60">{entry.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </FacetGroup>
        );
      })}
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs ring-1 transition",
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-card text-foreground ring-border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
