import { cn } from "@/lib/cn";

type BadgeTone = "success" | "warning" | "danger" | "muted" | "accent";

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-success/15 text-success ring-success/30",
  warning: "bg-warning/15 text-warning ring-warning/30",
  danger: "bg-danger/15 text-danger ring-danger/30",
  muted: "bg-muted text-muted-foreground ring-border",
  accent: "bg-accent/15 text-accent ring-accent/30",
};

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
