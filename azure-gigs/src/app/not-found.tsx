import Link from "next/link";
export default function NotFound() {
  return <div className="grid min-h-[50vh] place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Page not found</h1><p className="mt-1 text-sm text-muted">The page or resource does not exist (or belongs to another learner).</p><Link className="mt-3 inline-block text-brand underline" href="/home">Back to Home</Link></div></div>;
}
