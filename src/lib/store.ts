"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ItemId = string;

export type SortKey = "default" | "name-asc" | "name-desc" | "newest-retired";

export type CollectionState = {
  owned: Record<ItemId, string>;
  wishlist: Record<ItemId, string>;
  hidden: Record<ItemId, true>;
  notes: Record<ItemId, string>;
  filters: {
    query: string;
    kinds: Set<string>;
    statuses: Set<string>;
    tags: Set<string>;
    onlyOwned: boolean;
    onlyWishlist: boolean;
    hideHidden: boolean;
  };
  sort: SortKey;

  isOwned: (id: ItemId) => boolean;
  isWishlisted: (id: ItemId) => boolean;
  isHidden: (id: ItemId) => boolean;
  toggleOwned: (id: ItemId) => void;
  toggleWishlist: (id: ItemId) => void;
  toggleHidden: (id: ItemId) => void;
  setNote: (id: ItemId, note: string) => void;

  setQuery: (q: string) => void;
  toggleKind: (k: string) => void;
  toggleStatus: (s: string) => void;
  toggleTag: (t: string) => void;
  setFilter: <K extends keyof CollectionState["filters"]>(
    key: K,
    value: CollectionState["filters"][K],
  ) => void;
  resetFilters: () => void;
  setSort: (s: SortKey) => void;

  exportJSON: () => string;
  importJSON: (raw: string) => { ok: true; counts: { owned: number; wishlist: number } } | { ok: false; error: string };
  resetAll: () => void;
};

const defaultFilters: CollectionState["filters"] = {
  query: "",
  kinds: new Set<string>(),
  statuses: new Set<string>(),
  tags: new Set<string>(),
  onlyOwned: false,
  onlyWishlist: false,
  hideHidden: true,
};

/** Detects ID strings of acceptable shape so we never copy a malicious key into our store. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function sanitizeIdMap(
  raw: unknown,
  valueValidator: (v: unknown) => string | null,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ID_PATTERN.test(k)) continue;
    const validated = valueValidator(v);
    if (validated !== null) out[k] = validated;
  }
  return out;
}

function sanitizeBoolMap(raw: unknown): Record<string, true> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, true> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ID_PATTERN.test(k)) continue;
    if (v === true) out[k] = true;
  }
  return out;
}

const isoOrNow = (v: unknown): string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : new Date().toISOString();

const shortText = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.length <= max ? v : null;

const toggle = <T extends string>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

type PersistedShape = {
  owned: Record<string, string>;
  wishlist: Record<string, string>;
  hidden: Record<string, true>;
  notes: Record<string, string>;
};

export const useCollection = create<CollectionState>()(
  persist(
    (set, get) => ({
      owned: {},
      wishlist: {},
      hidden: {},
      notes: {},
      filters: defaultFilters,
      sort: "default",

      isOwned: (id) => Boolean(get().owned[id]),
      isWishlisted: (id) => Boolean(get().wishlist[id]),
      isHidden: (id) => Boolean(get().hidden[id]),

      toggleOwned: (id) =>
        set((s) => {
          if (!ID_PATTERN.test(id)) return s;
          const owned = { ...s.owned };
          const wishlist = { ...s.wishlist };
          if (owned[id]) {
            delete owned[id];
          } else {
            owned[id] = new Date().toISOString();
            delete wishlist[id];
          }
          return { owned, wishlist };
        }),

      toggleWishlist: (id) =>
        set((s) => {
          if (!ID_PATTERN.test(id)) return s;
          const wishlist = { ...s.wishlist };
          if (wishlist[id]) {
            delete wishlist[id];
          } else if (!s.owned[id]) {
            wishlist[id] = new Date().toISOString();
          }
          return { wishlist };
        }),

      toggleHidden: (id) =>
        set((s) => {
          if (!ID_PATTERN.test(id)) return s;
          const hidden = { ...s.hidden };
          if (hidden[id]) delete hidden[id];
          else hidden[id] = true;
          return { hidden };
        }),

      setNote: (id, note) =>
        set((s) => {
          if (!ID_PATTERN.test(id)) return s;
          const validated = shortText(note);
          const notes = { ...s.notes };
          if (validated && validated.trim().length > 0) notes[id] = validated;
          else delete notes[id];
          return { notes };
        }),

      setQuery: (q) =>
        set((s) => ({ filters: { ...s.filters, query: typeof q === "string" ? q.slice(0, 200) : "" } })),

      toggleKind: (k) => set((s) => ({ filters: { ...s.filters, kinds: toggle(s.filters.kinds, k) } })),
      toggleStatus: (st) =>
        set((s) => ({ filters: { ...s.filters, statuses: toggle(s.filters.statuses, st) } })),
      toggleTag: (t) => set((s) => ({ filters: { ...s.filters, tags: toggle(s.filters.tags, t) } })),

      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: defaultFilters }),
      setSort: (s) => set({ sort: s }),

      exportJSON: () => {
        const { owned, wishlist, hidden, notes } = get();
        const payload = { v: 1, owned, wishlist, hidden, notes, exportedAt: new Date().toISOString() };
        return JSON.stringify(payload, null, 2);
      },

      importJSON: (raw) => {
        if (typeof raw !== "string" || raw.length > 5_000_000) {
          return { ok: false, error: "Input too large or not a string" };
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
        }
        if (!parsed || typeof parsed !== "object") {
          return { ok: false, error: "Expected a JSON object" };
        }
        const obj = parsed as Record<string, unknown>;
        const owned = sanitizeIdMap(obj.owned, (v) => isoOrNow(v));
        const wishlist = sanitizeIdMap(obj.wishlist, (v) => isoOrNow(v));
        const hidden = sanitizeBoolMap(obj.hidden);
        const notes = sanitizeIdMap(obj.notes, (v) => shortText(v));
        set({ owned, wishlist, hidden, notes });
        return {
          ok: true,
          counts: { owned: Object.keys(owned).length, wishlist: Object.keys(wishlist).length },
        };
      },

      resetAll: () => set({ owned: {}, wishlist: {}, hidden: {}, notes: {} }),
    }),
    {
      name: "nf-collection",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedShape => ({
        owned: s.owned,
        wishlist: s.wishlist,
        hidden: s.hidden,
        notes: s.notes,
      }),
    },
  ),
);

/**
 * Tracks store hydration so server-rendered pages can avoid flashing
 * the wrong empty state before localStorage rehydrates on the client.
 */
export function useHydrated(): boolean {
  if (typeof window === "undefined") return false;
  return useCollection.persist.hasHydrated();
}
