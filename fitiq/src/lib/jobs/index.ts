import "server-only";
import { loadCatalog, PROVIDERS } from "../providers/registry";
import { getCatalog, recordPrice } from "../server/catalog";
import { track } from "../server/analytics";

// Background jobs. In production, schedule these with your platform's cron
// (e.g. Vercel Cron → POST /api/admin/jobs) or a queue worker (BullMQ, etc.).
export type JobName = "sync-products" | "sync-prices" | "compute-trends" | "generate-recommendations";

export interface JobRun {
  job: JobName;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  detail: string;
}

const g = globalThis as unknown as { __fitiqJobs?: JobRun[] };
g.__fitiqJobs ??= [];
export const jobRuns = g.__fitiqJobs;

export async function runJob(job: JobName): Promise<JobRun> {
  const startedAt = new Date().toISOString();
  let ok = true;
  let detail = "";
  try {
    switch (job) {
      case "sync-products": {
        const c = await loadCatalog(true);
        detail = `Loaded ${c.length} products from ${PROVIDERS.filter((p) => p.isConfigured()).map((p) => p.id).join(", ")}`;
        break;
      }
      case "sync-prices": {
        let updated = 0;
        for (const p of PROVIDERS.filter((x) => x.isConfigured() && x.fetchPrices && x.kind !== "demo")) {
          const cat = (await getCatalog()).filter((x) => x.source.providerId === p.id);
          const res = await p.fetchPrices!(cat.map((x) => x.id));
          if (!res.ok) {
            track({ type: "integration-error", provider: p.id, error: res.error, at: res.fetchedAt });
            ok = false;
            continue;
          }
          for (const u of res.data) {
            const prod = cat.find((x) => x.id === u.id);
            if (!prod) continue;
            Object.assign(prod, { price: u.price, mrp: u.mrp, availability: u.availability, lastCheckedAt: u.checkedAt });
            recordPrice(prod);
            updated++;
          }
        }
        detail = updated ? `Updated ${updated} prices` : "No live price providers configured (demo prices are static simulations)";
        break;
      }
      case "compute-trends":
        detail = "No licensed trend source configured — showing FITIQ editorial trends only";
        break;
      case "generate-recommendations":
        detail = "Recommendations are computed on request from the user's profile (no precompute needed in demo mode)";
        break;
    }
  } catch (e) {
    ok = false;
    detail = e instanceof Error ? e.message : "Job failed";
  }
  const run = { job, startedAt, finishedAt: new Date().toISOString(), ok, detail };
  jobRuns.unshift(run);
  return run;
}
