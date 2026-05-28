import { CatalogView } from "@/components/CatalogView";
import { getCatalog } from "@/lib/catalog";

export default function CatalogPage() {
  const { items, stats, generatedAt } = getCatalog();
  return (
    <CatalogView
      items={items}
      intro={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} pieces ({stats.current} current, {stats.retiring} retiring,{" "}
              {stats.retired} retired)
              {" · "}
              updated {new Date(generatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      }
    />
  );
}
