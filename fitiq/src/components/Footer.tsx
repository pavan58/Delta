import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-bone-line bg-bone-deep/40">
      <div className="container-x grid gap-8 py-10 text-sm text-ink-soft md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl font-semibold text-ink">FIT<span className="italic text-saffron">IQ</span></p>
          <p className="mt-2 max-w-sm">AI men&apos;s fit &amp; shopping intelligence for India. Scores are shopping recommendations — not medical or scientific measurements, and never judgements about you.</p>
        </div>
        <ul className="space-y-2">
          <li><Link href="/how-scores-work" className="hover:text-ink">How our scores work</Link></li>
          <li><Link href="/trends" className="hover:text-ink">Trends</Link></li>
          <li><Link href="/recipes" className="hover:text-ink">Outfit recipes</Link></li>
          <li><Link href="/visual-search" className="hover:text-ink">Visual search</Link></li>
        </ul>
        <ul className="space-y-2">
          <li><Link href="/privacy" className="hover:text-ink">Privacy &amp; your data</Link></li>
          <li><Link href="/privacy#sponsored" className="hover:text-ink">Sponsored placements</Link></li>
          <li><Link href="/admin" prefetch={false} className="hover:text-ink">Admin</Link></li>
        </ul>
      </div>
    </footer>
  );
}
