"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-x py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="h-display mt-3 text-4xl">We couldn&apos;t load this page.</h1>
      <button className="btn-primary mt-8" onClick={reset}>Try again</button>
    </div>
  );
}
