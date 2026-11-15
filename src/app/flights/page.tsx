import type { Metadata } from "next";
import { ResultsClient } from "@/components/results/ResultsClient";
import { SearchForm } from "@/components/search/SearchForm";
import { Banner } from "@/components/ui/ui";
import { parseQuery, queryInputSchema } from "@/lib/search-params";

export const metadata: Metadata = { title: "Flight results", robots: { index: false, follow: false } };

export default async function FlightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const flat = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") flat.set(k, v);
  const query = parseQuery(flat);
  const parsed = query ? queryInputSchema.safeParse(query) : null;

  if (!query || !parsed?.success) {
    const issues = parsed && !parsed.success ? [...new Set(parsed.error.issues.map((i) => i.message))] : [];
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">Let’s set up your search</h1>
        <p className="mt-2 text-ink-3">That link is missing some details{issues.length ? `: ${issues.join(", ").toLowerCase()}` : ""}. Fill them in below.</p>
        {issues.length > 0 && <Banner tone="warn" className="mt-5" title="We couldn’t use this search">{issues.join(" · ")}</Banner>}
        <div className="mt-8">
          <SearchForm initial={query ?? undefined} />
        </div>
      </div>
    );
  }
  return <ResultsClient query={parsed.data} />;
}
