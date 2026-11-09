import { verifyCertificate } from "@/lib/labs/progress";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate verification" };

export default async function Verify({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = /^AG-[0-9A-F]{12}$/.test(id) ? await verifyCertificate(id) : null;
  return (
    <div className="grid min-h-screen place-items-center bg-page px-4 py-10">
      <div className="w-full max-w-xl rounded-sm border border-line bg-surface p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Azure Gigs certificate verification</p>
        {c ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-ok">Valid certificate</h1>
            <dl className="mt-4 grid gap-2 text-sm">
              <div><dt className="text-muted">Learner</dt><dd className="font-semibold text-ink">{c.learnerName}</dd></div>
              <div><dt className="text-muted">Learning path</dt><dd className="text-ink">{c.path.title}</dd></div>
              <div><dt className="text-muted">Completed labs</dt><dd className="text-ink">{c.completedLabs}</dd></div>
              <div><dt className="text-muted">Assessment score</dt><dd className="text-ink">{c.score}%</dd></div>
              <div><dt className="text-muted">Issued</dt><dd className="text-ink">{c.issuedAt.toDateString()}</dd></div>
              <div><dt className="text-muted">Certificate ID</dt><dd className="font-mono text-ink">{c.certificateId}</dd></div>
            </dl>
          </>
        ) : (
          <h1 className="mt-2 text-2xl font-semibold text-danger">No certificate found for “{id.slice(0, 40)}”</h1>
        )}
        <p className="mt-6 text-xs text-muted">This is a course-completion certificate issued by the Azure Gigs learning platform. It is not a Microsoft certification or credential.</p>
      </div>
    </div>
  );
}
