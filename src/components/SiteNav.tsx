import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Catalog" },
  { href: "/owned/", label: "Owned" },
  { href: "/wishlist/", label: "Wishlist" },
  { href: "/stats/", label: "Stats" },
  { href: "/settings/", label: "Settings" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-full bg-primary"
          />
          <span>NF Tracker</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
