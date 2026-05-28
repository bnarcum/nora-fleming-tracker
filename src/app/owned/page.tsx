import { CatalogView } from "@/components/CatalogView";
import { getCatalog } from "@/lib/catalog";

export default function OwnedPage() {
  const { items } = getCatalog();
  return (
    <CatalogView
      items={items}
      forcedFilters={{ onlyOwned: true }}
      intro={
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owned</h1>
          <p className="text-sm text-muted-foreground">
            Everything you have marked as part of your collection. Data is stored locally
            in your browser.
          </p>
        </div>
      }
    />
  );
}
