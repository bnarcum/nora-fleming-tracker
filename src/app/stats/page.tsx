import { StatsDashboard } from "@/components/StatsDashboard";
import { getCatalog } from "@/lib/catalog";

export default function StatsPage() {
  const { items, generatedAt } = getCatalog();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground">
          Your collection progress, sliced by type, status, season, holiday, and theme.
          Catalog last refreshed {new Date(generatedAt).toLocaleString()}.
        </p>
      </div>
      <StatsDashboard items={items} />
    </div>
  );
}
