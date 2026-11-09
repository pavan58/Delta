"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger-bg p-4 text-sm"><p className="font-semibold">Something went wrong loading this page.</p><p className="text-muted">{error.message}</p><button onClick={reset} className="mt-2 text-brand underline">Try again</button></div>;
}
