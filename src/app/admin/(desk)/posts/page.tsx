import Link from "next/link";
import { adminListPosts } from "@/lib/server/platform";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const STATUS_TONE: Record<string, string> = {
  published: "border-[#9cc9b0] bg-go-bg text-go",
  draft: "border-[#d6b24a] bg-warn-bg text-warn",
  archived: "border-line-2 bg-paper-2 text-ink-3",
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const res = await adminListPosts({ q: sp.q, status: sp.status, page: Number(sp.page ?? 1) || 1, perPage: 20 });

  if (!res.ok) {
    return (
      <div className="rounded-md border border-[#e0a49f] bg-stop-bg p-6 text-[#7d1a14]">
        <h1 className="text-[18px] font-semibold">Could not load articles</h1>
        <p className="mt-1 text-[14px]">{res.message}</p>
      </div>
    );
  }

  const { posts, total, page, perPage } = res.data;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const filterHref = (status: string) => `/admin/posts${status === "all" ? "" : `?status=${status}`}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Journal</p>
          <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">{total} article{total === 1 ? "" : "s"}</h1>
        </div>
        <Link href="/admin/posts/new" className="inline-flex h-11 items-center rounded-sm border border-ink bg-signal px-4 text-[13px] font-semibold hover:bg-ink hover:text-signal">
          New article
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {["all", "published", "draft", "archived"].map((s) => (
            <Link
              key={s}
              href={filterHref(s)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-xs border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] md:min-h-0 md:py-1",
                (sp.status ?? "all") === s ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2 hover:border-ink",
              )}
            >
              {s}
            </Link>
          ))}
        </div>
        <form action="/admin/posts" className="flex gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title or slug" className="input !h-11 md:!h-9 w-56 !text-[12.5px]" />
          <button type="submit" className="h-11 rounded-sm border md:h-9 border-ink px-3 text-[12.5px] font-semibold hover:bg-ink hover:text-paper">Search</button>
        </form>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-16 text-center">
          <h2 className="text-[19px] font-semibold">Nothing here</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-3">
            {sp.q ? "No article matches that search." : "Write the first piece — the journal is the cheapest trust you will ever buy."}
          </p>
        </div>
      ) : (
        <>
        {/* Phone: status and freshness are the two things a writer checks, so they come with the title. */}
        <ul className="space-y-2 sm:hidden">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/posts/${p.id}`} className="block rounded-md border border-line-2 bg-card p-3 active:bg-paper-2">
                <p className="text-[14px] font-semibold leading-snug">{p.title}</p>
                <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-3">/{p.slug}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]", STATUS_TONE[p.status])}>{p.status}</span>
                  <span className="font-mono text-[10.5px] text-ink-3">{when(p.updatedAt)}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3">{p.readingMinutes} min</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-md border border-line-2 bg-card sm:block">
          <table className="w-full text-left">
            <caption className="sr-only">Articles</caption>
            <thead>
              <tr className="border-b border-line bg-paper-2/40">
                <th className="px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Title</th>
                <th className="hidden px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3 sm:table-cell">Status</th>
                <th className="hidden px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3 md:table-cell">Updated</th>
                <th className="hidden px-4 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3 lg:table-cell">Read</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/posts/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-ink-3">/{p.slug}</p>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em]", STATUS_TONE[p.status])}>{p.status}</span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-[11.5px] text-ink-3 md:table-cell">{when(p.updatedAt)}</td>
                  <td className="hidden px-4 py-3 text-right font-mono text-[11.5px] text-ink-3 lg:table-cell">{p.readingMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
          {Array.from({ length: pages }).map((_, i) => {
            const n = i + 1;
            const qs = new URLSearchParams();
            if (sp.q) qs.set("q", sp.q);
            if (sp.status) qs.set("status", sp.status);
            if (n > 1) qs.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/posts${qs.toString() ? `?${qs}` : ""}`}
                aria-current={page === n ? "page" : undefined}
                className={cn("grid h-8 w-8 place-items-center rounded-xs border font-mono text-[12px]", page === n ? "border-ink bg-ink text-paper" : "border-line-2 hover:border-ink")}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
