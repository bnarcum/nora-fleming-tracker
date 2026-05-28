"use client";

import { useEffect, useMemo, useState } from "react";
import { kindLabel, parseTag, statusLabel, statusTone } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/store";
import type { Item, ItemKind, ItemStatus } from "@/lib/types";
import { Badge } from "./Badge";

export function StatsDashboard({ items }: { items: Item[] }) {
  const owned = useCollection((s) => s.owned);
  const wishlist = useCollection((s) => s.wishlist);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const stats = useMemo(() => computeStats(items, owned, wishlist), [items, owned, wishlist]);

  if (!hydrated) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading your collection...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Owned" value={stats.ownedCount} sub={`${pct(stats.ownedCount, stats.total)} of catalog`} />
        <Stat label="Wishlist" value={stats.wishlistCount} sub="Pieces wanted next" />
        <Stat label="Current avail." value={stats.currentOwnedPct} sub={`${stats.currentOwned}/${stats.currentTotal} pieces`} />
        <Stat label="Retired" value={stats.retiredOwnedPct} sub={`${stats.retiredOwned}/${stats.retiredTotal} pieces`} />
      </section>

      {stats.urgentWishlist.length > 0 ? (
        <section className="rounded-xl border border-danger/40 bg-danger/5 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-danger">Wishlist urgency</h2>
            <Badge tone="danger">{stats.urgentWishlist.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Items on your wishlist that are retiring, sold out, or recently retired — act on these first.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {stats.urgentWishlist.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate" title={item.displayName}>
                  {item.sku ? <span className="mr-1.5 text-xs text-muted-foreground">{item.sku}</span> : null}
                  {item.name}
                </span>
                <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Completion by type">
          <ProgressList rows={stats.byKind} />
        </Card>
        <Card title="Completion by status">
          <ProgressList rows={stats.byStatus} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Completion by season">
          <ProgressList rows={stats.bySeason} />
        </Card>
        <Card title="Completion by holiday">
          <ProgressList rows={stats.byHoliday} />
        </Card>
      </section>

      <section>
        <Card title="Completion by theme">
          <ProgressList rows={stats.byTheme} />
        </Card>
      </section>

      {stats.recentRetired.length > 0 ? (
        <section>
          <Card title="Recently retired">
            <ul className="space-y-1.5 text-sm">
              {stats.recentRetired.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {it.sku ? <span className="mr-1.5 text-xs text-muted-foreground">{it.sku}</span> : null}
                    {it.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {it.retiredDetectedAt
                      ? new Date(it.retiredDetectedAt).toLocaleDateString()
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

type Row = { label: string; owned: number; total: number };

function ProgressList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const ratio = row.total === 0 ? 0 : row.owned / row.total;
        return (
          <li key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.owned}/{row.total} · {Math.round(ratio * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  ratio >= 1 ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function pct(n: number, d: number): string {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

function computeStats(
  items: Item[],
  owned: Record<string, string>,
  wishlist: Record<string, string>,
) {
  const ownedSet = new Set(Object.keys(owned));
  const wishlistSet = new Set(Object.keys(wishlist));

  const kinds: ItemKind[] = ["mini", "base", "other"];
  const statuses: ItemStatus[] = ["current", "sold_out", "retiring", "retired"];

  const byKind: Row[] = kinds.map((k) => ({
    label: kindLabel(k),
    owned: items.filter((i) => i.kind === k && ownedSet.has(i.id)).length,
    total: items.filter((i) => i.kind === k).length,
  }));

  const byStatus: Row[] = statuses.map((s) => ({
    label: statusLabel(s),
    owned: items.filter((i) => i.status === s && ownedSet.has(i.id)).length,
    total: items.filter((i) => i.status === s).length,
  }));

  const byTagGroup = (group: "season" | "holiday" | "theme"): Row[] => {
    const totals = new Map<string, number>();
    const ownedCounts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) {
        const parsed = parseTag(tag);
        if (parsed.group !== group) continue;
        totals.set(parsed.value, (totals.get(parsed.value) ?? 0) + 1);
        if (ownedSet.has(item.id)) {
          ownedCounts.set(parsed.value, (ownedCounts.get(parsed.value) ?? 0) + 1);
        }
      }
    }
    return Array.from(totals.entries())
      .map(([label, total]) => ({ label, total, owned: ownedCounts.get(label) ?? 0 }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  };

  const bySeason = byTagGroup("season");
  const byHoliday = byTagGroup("holiday");
  const byTheme = byTagGroup("theme").slice(0, 12);

  const currentItems = items.filter((i) => i.status === "current");
  const retiredItems = items.filter((i) => i.status === "retired");

  const urgentWishlist = items
    .filter((i) => wishlistSet.has(i.id))
    .filter((i) => i.status === "retiring" || i.status === "sold_out" || i.status === "retired")
    .sort((a, b) => {
      const order: Record<ItemStatus, number> = {
        retiring: 0,
        sold_out: 1,
        retired: 2,
        current: 3,
      };
      return order[a.status] - order[b.status];
    });

  const recentRetired = [...items]
    .filter((i) => i.status === "retired" && i.retiredDetectedAt)
    .sort((a, b) => (b.retiredDetectedAt ?? "").localeCompare(a.retiredDetectedAt ?? ""))
    .slice(0, 10);

  const currentOwned = currentItems.filter((i) => ownedSet.has(i.id)).length;
  const retiredOwned = retiredItems.filter((i) => ownedSet.has(i.id)).length;

  return {
    total: items.length,
    ownedCount: ownedSet.size,
    wishlistCount: wishlistSet.size,
    currentTotal: currentItems.length,
    currentOwned,
    currentOwnedPct: pct(currentOwned, currentItems.length),
    retiredTotal: retiredItems.length,
    retiredOwned,
    retiredOwnedPct: pct(retiredOwned, retiredItems.length),
    byKind,
    byStatus,
    bySeason,
    byHoliday,
    byTheme,
    urgentWishlist,
    recentRetired,
  };
}
