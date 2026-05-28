"use client";

import { useEffect, useRef, useState } from "react";
import { useCollection } from "@/lib/store";

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function SettingsPanel() {
  const exportJSON = useCollection((s) => s.exportJSON);
  const importJSON = useCollection((s) => s.importJSON);
  const resetAll = useCollection((s) => s.resetAll);
  const ownedCount = useCollection((s) => Object.keys(s.owned).length);
  const wishlistCount = useCollection((s) => Object.keys(s.wishlist).length);
  const hiddenCount = useCollection((s) => Object.keys(s.hidden).length);

  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHydrated(true), []);

  const handleExport = () => {
    const data = exportJSON();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nora-fleming-collection-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback({ kind: "success", message: "Collection exported." });
  };

  const handleImportFile = async (file: File) => {
    if (file.size > 5_000_000) {
      setFeedback({ kind: "error", message: "File too large (max 5 MB)." });
      return;
    }
    const text = await file.text();
    const result = importJSON(text);
    if (result.ok) {
      setFeedback({
        kind: "success",
        message: `Imported ${result.counts.owned} owned and ${result.counts.wishlist} wishlist items.`,
      });
    } else {
      setFeedback({ kind: "error", message: result.error });
    }
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetAll();
    setConfirmReset(false);
    setFeedback({ kind: "success", message: "Collection cleared." });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your data
        </h2>
        {hydrated ? (
          <p className="mt-2 text-sm">
            <span className="font-medium">{ownedCount}</span> owned ·{" "}
            <span className="font-medium">{wishlistCount}</span> wishlist ·{" "}
            <span className="font-medium">{hiddenCount}</span> hidden
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Stored locally in your browser. No accounts, no servers. Export the JSON file
          below to back it up or sync to another device.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Export</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Download a JSON snapshot of your owned, wishlist, hidden, and note data.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="mt-3 inline-flex items-center rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Download backup
          </button>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Import</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Replaces your current data with the contents of a previously exported backup.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await handleImportFile(file);
                  e.target.value = "";
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Choose file...
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
        <h3 className="text-sm font-semibold text-danger">Reset all data</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Clears your owned, wishlist, hidden, and note lists. Your filter preferences are kept.
          This cannot be undone — export a backup first.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center rounded-md border border-danger bg-danger px-3 py-1.5 text-sm font-medium text-white hover:bg-danger/90"
          >
            {confirmReset ? "Click again to confirm" : "Reset everything"}
          </button>
          {confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="text-xs underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      {feedback.kind !== "idle" ? (
        <div
          role="status"
          className={
            feedback.kind === "success"
              ? "rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              : "rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          }
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
