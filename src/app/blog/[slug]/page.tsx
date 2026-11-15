import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { excerptFrom, renderMarkdown } from "@/lib/markdown";
import { getPost, listPosts } from "@/lib/server/platform";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Article not found" };
  const description = post.seoDescription ?? excerptFrom(post.bodyMd);
  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      images: post.coverUrl ? [{ url: post.coverUrl }] : undefined,
    },
  };
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const more = (await listPosts({ limit: 4 })).posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? excerptFrom(post.bodyMd),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.authorName },
    image: post.coverUrl ? [post.coverUrl] : undefined,
    mainEntityOfPage: `${site}/blog/${post.slug}`,
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-8 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-3">
        <Link href="/blog" className="hover:text-ink">Journal</Link>
        <span className="mx-2">/</span>
        <span className="text-ink-2">{post.tags[0] ?? "Article"}</span>
      </nav>

      <article className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <header className="max-w-[68ch]">
            <h1 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">{post.title}</h1>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-ink-3">
              <span>{post.authorName}</span>
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt ?? undefined}>{fmtDate(post.publishedAt)}</time>
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min read</span>
            </p>
            {post.excerpt && <p className="mt-5 border-l-2 border-signal pl-4 text-[17px] leading-relaxed text-ink-2">{post.excerpt}</p>}
          </header>

          {post.coverUrl && (
            <div className="mt-8 overflow-hidden rounded-md border border-line-2 bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverUrl} alt="" className="w-full object-cover" />
            </div>
          )}

          <div className="prose mt-10 max-w-[68ch]" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.bodyMd) }} />

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="inline-flex min-h-11 items-center rounded-xs border border-line-2 px-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2 hover:border-ink md:min-h-0 md:py-1">
                  {t}
                </Link>
              ))}
            </div>
            <Link href="/blog" className="inline-flex min-h-11 items-center text-[13.5px] font-semibold underline underline-offset-4">All articles</Link>
          </footer>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-md border border-ink bg-card p-5">
              <p className="eyebrow">Ready to fly?</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                Prices include taxes, surcharges and our fee from the first result — and a booking status that tells you
                what is actually true.
              </p>
              <Link href="/#search" className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-sm border border-ink bg-signal text-[13.5px] font-semibold hover:bg-ink hover:text-signal">
                Search flights
              </Link>
            </div>
            {more.length > 0 && (
              <div>
                <p className="eyebrow">More from the journal</p>
                <ul className="mt-3 space-y-3">
                  {more.map((p) => (
                    <li key={p.id}>
                      <Link href={`/blog/${p.slug}`} className="group block border-b border-line pb-3">
                        <span className="block text-[14px] font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{p.title}</span>
                        <span className="mt-1 block font-mono text-[11px] text-ink-3">{p.readingMinutes} min read</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </article>
    </div>
  );
}
