import { CatalogView } from "@/components/CatalogView";
import { getCatalog } from "@/lib/catalog";

export default function WishlistPage() {
  const { items } = getCatalog();
  return (
    <CatalogView
      items={items}
      forcedFilters={{ onlyWishlist: true }}
      intro={
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="text-sm text-muted-foreground">
            Pieces you want next, sorted with retiring and sold-out items first so you can
            act on the urgent ones.
          </p>
        </div>
      }
    />
  );
}
