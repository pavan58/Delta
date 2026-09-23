export const metadata = { title: "Privacy & your data" };

const S = ({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="font-display text-2xl">{title}</h2>
    <div className="mt-2 space-y-2 text-ink-soft">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="container-x max-w-3xl space-y-8 py-12">
      <div>
        <p className="eyebrow">Privacy policy</p>
        <h1 className="h-display mt-2 text-5xl">Your body data is yours.</h1>
        <p className="mt-3 text-ink-soft">Body measurements and wardrobe photos are sensitive. FITIQ collects only what improves fit and outfit recommendations, and you can delete it at any time.</p>
      </div>
      <S title="What we collect">
        <p>Measurements you enter (height, weight, chest, waist, optional shoulder/inseam/shoe size), your self-selected build, fit and style preferences, budget, optional city, wardrobe items (with optional photos), fit feedback and saved products.</p>
        <p>We do <b>not</b> infer sensitive personal attributes (such as religion, caste, ethnicity, health or sexuality), and we don&apos;t analyse faces or bodies in photos.</p>
      </S>
      <S title="Where it lives">
        <p><b>Demo mode:</b> all personal data is stored only in your browser (localStorage). It&apos;s sent to FITIQ with each request to compute scores and is not written to our servers or logs.</p>
        <p><b>Production:</b> data is stored in PostgreSQL with body measurements and size maps encrypted at field level (AES-256-GCM); wardrobe photos go to private object storage with signed, expiring URLs; access requires authentication.</p>
      </S>
      <S title="Photos">
        <p>Photo processing requires explicit consent each time it&apos;s first used. Images are downscaled on your device before upload, used once to identify the garment, and never sold, shared or used to train third-party models.</p>
      </S>
      <S title="Deletion">
        <p>Profile → &ldquo;Delete all my data&rdquo; removes everything immediately. In production this also deletes server records and stored photos.</p>
      </S>
      <S id="sponsored" title="Sponsored placements">
        <p>Brands may pay for placement. Sponsored items are always labelled &ldquo;Sponsored&rdquo; and are <b>excluded</b> from fit scoring, outfit optimisation and personalised ranking — sponsorship can never change your fit recommendations.</p>
      </S>
      <S title="Affiliate links">
        <p>Some outbound links may earn FITIQ a commission from retailers, where their programmes allow it. This never affects prices you pay or scores we show.</p>
      </S>
      <S title="Data sources">
        <p>Product data comes only from official APIs, affiliate feeds, merchant feeds or licensed sources. FITIQ does not bypass CAPTCHAs, logins, anti-bot systems or paywalls, and does not scrape sites whose terms prohibit it.</p>
      </S>
    </div>
  );
}
