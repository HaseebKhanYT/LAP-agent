"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/platforms", label: "Platforms" },
];

/** Top navigation header shared across all pages. */
export function NavBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/20 text-sm font-bold text-accent">
            L
          </span>
          <span className="text-sm font-semibold tracking-tight">
            LAP <span className="text-muted">Console</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(link.href)
                  ? "bg-panel-2 text-slate-100"
                  : "text-muted hover:bg-panel hover:text-slate-200",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto text-xs text-muted">
          Learn-A-Platform operator console
        </div>
      </div>
    </header>
  );
}
