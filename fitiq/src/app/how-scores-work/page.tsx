export const metadata = { title: "How our scores work" };

const ROWS: [string, string, string][] = [
  ["Fit Compatibility", "30% body compatibility + 30% silhouette compatibility + 20% size confidence + 20% style compatibility", "Recommended silhouettes per build, your preferred fit, garment size charts, brand sizing, your fit feedback and size map"],
  ["Fit Risk", "🟢 Low ≥ 80 · 🟡 Medium 66–79 · 🔴 High < 66 on body + silhouette + size", "Plain-language reasons; bumped to at least Medium if your likely size isn't listed in stock"],
  ["Purchase Confidence", "Weighted fit, size confidence and rating evidence, minus identified issues", "Checklist of supporting evidence and potential issues"],
  ["Deal Score", "Discount (25%), price vs detected history (30%), rating quality (20%), popularity (10%), availability (5%), your preferences (10%)", "Components with no data are dropped and weights re-normalised — never guessed"],
  ["Outfit scores", "Fit, style/occasion match, colour harmony and budget use across all pieces", "Budget is a hard cap unless you allow going over"],
  ["Wardrobe Utility", "New valid outfit combinations created by adding one item to what you own", "Cost per new outfit = price ÷ new combinations"],
];

export default function HowScoresWork() {
  return (
    <div className="container-x max-w-4xl py-12">
      <p className="eyebrow">Methodology</p>
      <h1 className="h-display mt-2 text-5xl">How our scores work</h1>
      <p className="mt-3 text-ink-soft">Every FITIQ score is a <b>shopping recommendation metric</b>. None are medical or scientific measurements, and none are judgements about your appearance.</p>
      <div className="card mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-bone-line text-left text-[11px] uppercase tracking-wider text-ink-mute"><th className="p-3">Score</th><th className="p-3">How it&apos;s built</th><th className="p-3">Inputs &amp; safeguards</th></tr></thead>
          <tbody>{ROWS.map(([a, b, c]) => <tr key={a} className="border-b border-bone-line align-top last:border-0"><td className="p-3 font-semibold">{a}</td><td className="p-3">{b}</td><td className="p-3 text-ink-soft">{c}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-8 space-y-3 text-sm text-ink-soft">
        <p><b className="text-ink">Exact match vs similar alternative.</b> &ldquo;Exact match&rdquo; requires the same brand, model identifier and colour (or identical brand, title and colour when a feed has no identifier). Everything else is labelled &ldquo;Similar alternative&rdquo;.</p>
        <p><b className="text-ink">Price history.</b> &ldquo;Lowest/highest detected&rdquo; covers only prices FITIQ recorded. With fewer than two records, no historical claim is shown.</p>
        <p><b className="text-ink">Freshness.</b> Every price shows when it was checked. After 48 hours it&apos;s flagged &ldquo;Price may have changed&rdquo;. Nothing is described as real-time unless the provider contractually supplies real-time data.</p>
        <p><b className="text-ink">Trends.</b> Trends need a cited source; otherwise they are labelled &ldquo;FITIQ editorial recommendation&rdquo; with no statistics. A trend is only recommended when its silhouette suits your recorded proportions.</p>
      </div>
    </div>
  );
}
