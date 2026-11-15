import type { Metadata } from "next";
import Link from "next/link";
import { listPosts, listTags } from "@/lib/server/platform";
import { SectionLabel } from "@/components/ui/ui";

export const metadata: Metadata = {
  title: "Journal",
  description: "How airfare really works, what we will and will not do, and where your money goes — from the team building Cleared.",
  alternates: { canonical: "/blog" },
};

export const revalidate = 60;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const [{ posts, total }, tags] = await Promise.all([listPosts({ limit: 24, tag }), listTags()]);
  const [lead, ...rest] = posts;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8">
      <header className="rise max-w-2xl">
        <SectionLabel>Journal</SectionLabel>
        <h1 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] font-bold leading-[1.03] tracking-[-0.04em]">
          How airfare actually works.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
          Fare rules, refunds, disruption and the parts of booking a flight that get buried. We publish the
          reasoning behind what this product does — including the parts that cost us money.
        </p>
      </header>

      {tags.length > 0 && (
        <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/blog"
            className={`flex min-h-11 items-center rounded-xs border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] md:min-h-0 md:py-1 ${!tag ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2 hover:border-ink"}`}
          >
            All
          </Link>
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={`/blog?tag=${encodeURIComponent(t.tag)}`}
              className={`flex min-h-11 items-center rounded-xs border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] md:min-h-0 md:py-1 ${tag === t.tag ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2 hover:border-ink"}`}
            >
              {t.tag} <span className="text-ink-3">{t.n}</span>
            </Link>
          ))}
        </nav>
      )}

      {posts.length === 0 && (
        <div className="mt-14 rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">Nothing published</p>
          <h2 className="mt-3 text-[20px] font-semibold">No articles here yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-3">
            {tag ? `Nothing is filed under “${tag}”.` : "The first pieces are being written."} Articles appear here as soon
            as they are published from the admin desk.
          </p>
        </div>
      )}

      {lead && (
        <article className="mt-12 grid gap-8 border-t border-line pt-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <Link href={`/blog/${lead.slug}`} className="group block">
            <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-line-2 bg-paper-2">
              {lead.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.coverUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div aria-hidden className="grid h-full place-items-center font-serif text-[15vw] leading-none text-line-2 lg:text-[7vw]">
                  ✈
                </div>
              )}
            </div>
          </Link>
          <div>
            <p className="eyebrow">
              Latest · {fmtDate(lead.publishedAt)} · {lead.readingMinutes} min read
            </p>
            <h2 className="mt-3 text-[clamp(1.5rem,2.4vw,2.1rem)] font-bold leading-[1.08] tracking-[-0.03em]">
              <Link href={`/blog/${lead.slug}`} className="underline-offset-4 hover:underline">
                {lead.title}
              </Link>
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lead.excerpt}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/blog/${lead.slug}`}
                className="inline-flex h-11 items-center rounded-sm border border-ink bg-signal px-4 text-[13.5px] font-semibold hover:bg-ink hover:text-signal"
              >
                Read the piece
              </Link>
              <span className="font-mono text-[11.5px] text-ink-3">{lead.authorName}</span>
            </div>
          </div>
        </article>
      )}

      {rest.length > 0 && (
        <div className="mt-4 grid gap-x-8 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <article key={p.id} className="group">
              <Link href={`/blog/${p.slug}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-line-2 bg-paper-2">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div aria-hidden className="grid h-full place-items-center font-serif text-[3.5rem] leading-none text-line-2">
                      ✈
                    </div>
                  )}
                </div>
                <p className="eyebrow mt-4">{fmtDate(p.publishedAt)} · {p.readingMinutes} min</p>
                <h2 className="mt-2 text-[19px] font-semibold leading-snug tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">
                  {p.title}
                </h2>
              </Link>
              <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-2">{p.excerpt}</p>
            </article>
          ))}
        </div>
      )}

      {total > posts.length && (
        <p className="mt-12 text-center font-mono text-[12px] text-ink-3">
          Showing {posts.length} of {total}
        </p>
      )}
    </div>
  );
}
