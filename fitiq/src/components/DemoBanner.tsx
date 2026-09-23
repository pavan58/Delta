"use client";
import { useEffect, useState } from "react";

export function DemoBanner() {
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((j: { demo: boolean }) => setDemo(j.demo)).catch(() => setDemo(true));
  }, []);
  if (demo === false) return null;
  return (
    <div className="bg-ink text-bone">
      <p className="container-x py-1.5 text-center text-[11px] font-medium tracking-wide">
        <span className="mr-2 rounded bg-saffron px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">Demo data</span>
        Prices, stock and history are illustrative simulations — not live retailer data.
      </p>
    </div>
  );
}
