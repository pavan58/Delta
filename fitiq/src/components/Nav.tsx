"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { useStore } from "@/lib/client/store";

const LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/discover", label: "Discover", icon: "search" },
  { href: "/stylist", label: "AI Stylist", icon: "spark" },
  { href: "/wardrobe", label: "Wardrobe", icon: "hanger" },
  { href: "/deals", label: "Deals", icon: "tag" },
  { href: "/profile", label: "Profile", icon: "user" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  const { profile, ready } = useStore();
  return (
    <header className="sticky top-0 z-40 border-b border-bone-line/80 bg-bone/90 backdrop-blur">
      <div className="container-x flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="FITIQ home">
          <span className="font-display text-2xl font-semibold tracking-tight">FIT</span>
          <span className="font-display text-2xl font-semibold italic tracking-tight text-saffron">IQ</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active(path, l.href) ? "bg-ink text-bone" : "text-ink-soft hover:bg-bone-deep"}`}>
              {l.label}
            </Link>
          ))}
          <Link href="/trends" className={`rounded-full px-3.5 py-2 text-sm font-medium ${active(path, "/trends") ? "bg-ink text-bone" : "text-ink-soft hover:bg-bone-deep"}`}>
            Trends
          </Link>
        </nav>
        {ready && !profile ? (
          <Link href="/onboarding" className="btn-accent btn-sm">Build profile</Link>
        ) : (
          <Link href="/visual-search" className="btn-ghost btn-sm" aria-label="Visual search"><Icon name="camera" className="h-4 w-4" /> <span className="hidden sm:inline">Visual search</span></Link>
        )}
      </div>
    </header>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bone-line bg-bone/95 backdrop-blur md:hidden" aria-label="Mobile">
      <ul className="grid grid-cols-6">
        {LINKS.map((l) => {
          const on = active(path, l.href);
          return (
            <li key={l.href}>
              <Link href={l.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${on ? "text-ink" : "text-ink-mute"}`} aria-current={on ? "page" : undefined}>
                <Icon name={l.icon} className={`h-5 w-5 ${on ? "text-saffron" : ""}`} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
