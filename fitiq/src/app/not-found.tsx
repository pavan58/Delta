import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="h-display mt-3 text-5xl">That page doesn&apos;t fit.</h1>
      <Link href="/" className="btn-primary mt-8">Back home</Link>
    </div>
  );
}
