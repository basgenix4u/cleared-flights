import { z } from "zod";
import { readJson } from "@/lib/api";
import { inventoryAvailable, providerMode } from "@/lib/config";
import { getProvider } from "@/lib/providers";
import { route } from "@/lib/route";
import { queryInputSchema } from "@/lib/search-params";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: queryInputSchema,
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(45),
});

export const POST = route("search.dates", "searchDates", async (req) => {
  const { query, dates } = bodySchema.parse(await readJson(req));
  if (!inventoryAvailable()) return json({ supported: false, mode: providerMode(), currency: "USD", prices: {} });
  const provider = getProvider();
  if (!provider.supportsCalendar) return json({ supported: false, mode: providerMode(), prices: {} });
  const prices = await provider.lowestFares(query, dates);
  return json({ supported: true, mode: providerMode(), currency: "USD", prices });
});
