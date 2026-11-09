import { withUser } from "@/lib/api";
import { estimateStorageMonthly } from "@/lib/azure/real";

export const GET = withUser(async (req) => estimateStorageMonthly(req.nextUrl.searchParams.get("location") ?? "eastus", req.nextUrl.searchParams.get("sku") ?? "Standard_LRS"));
