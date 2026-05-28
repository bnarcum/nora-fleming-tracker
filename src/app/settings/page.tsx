import { SettingsPanel } from "@/components/SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Back up your collection or reset it. Nothing here leaves your browser.
        </p>
      </div>
      <SettingsPanel />
    </div>
  );
}
