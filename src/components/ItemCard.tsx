"use client";

import { kindLabel, statusLabel, statusTone } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/store";
import type { Item } from "@/lib/types";
import { Badge } from "./Badge";

const PLACEHOLDER_BG = [
  "bg-gradient-to-br from-rose-200 to-amber-200",
  "bg-gradient-to-br from-sky-200 to-emerald-200",
  "bg-gradient-to-br from-violet-200 to-indigo-200",
  "bg-gradient-to-br from-amber-200 to-lime-200",
  "bg-gradient-to-br from-pink-200 to-orange-200",
];

function placeholderClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_BG[h % PLACEHOLDER_BG.length];
}

export function ItemCard({ item }: { item: Item }) {
  const owned = useCollection((s) => Boolean(s.owned[item.id]));
  const wishlisted = useCollection((s) => Boolean(s.wishlist[item.id]));
  const hidden = useCollection((s) => Boolean(s.hidden[item.id]));
  const toggleOwned = useCollection((s) => s.toggleOwned);
  const toggleWishlist = useCollection((s) => s.toggleWishlist);
  const toggleHidden = useCollection((s) => s.toggleHidden);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition hover:shadow-md",
        hidden && "opacity-60",
      )}
    >
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden",
          !item.imageUrl && placeholderClass(item.id),
        )}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.displayName}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-medium text-foreground/70">
            {item.name}
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
          {item.sku ? <Badge tone="accent">{item.sku}</Badge> : null}
        </div>
        {owned ? (
          <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-success text-base text-white shadow ring-2 ring-white">
            <span aria-hidden>✓</span>
            <span className="sr-only">Owned</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight" title={item.displayName}>
          {item.name}
        </h3>
        <p className="text-xs text-muted-foreground">
          {kindLabel(item.kind)}
          {item.price !== undefined ? ` · $${item.price.toFixed(0)}` : null}
        </p>
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => toggleOwned(item.id)}
            aria-pressed={owned}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition",
              owned
                ? "border-success bg-success text-white hover:bg-success/90"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {owned ? "Owned" : "Mark owned"}
          </button>
          <button
            type="button"
            onClick={() => toggleWishlist(item.id)}
            aria-pressed={wishlisted}
            disabled={owned}
            title={owned ? "Already owned" : "Toggle wishlist"}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition",
              wishlisted
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-card hover:bg-muted",
              owned && "cursor-not-allowed opacity-40",
            )}
          >
            {wishlisted ? "Wishlisted" : "Wishlist"}
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {item.storeUrl ? (
            <a
              href={item.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              View on store
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => toggleHidden(item.id)}
            className="hover:text-foreground"
          >
            {hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}
