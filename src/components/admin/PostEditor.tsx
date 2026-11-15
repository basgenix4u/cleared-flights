"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { renderMarkdown } from "@/lib/markdown";
import type { MediaAsset, PostRow } from "@/lib/server/platform";

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  bodyMd: string;
  tags: string;
  coverUrl: string;
  coverPublicId: string;
  status: "draft" | "published" | "archived";
  seoTitle: string;
  seoDescription: string;
};

const toDraft = (p?: PostRow): Draft => ({
  title: p?.title ?? "",
  slug: p?.slug ?? "",
  excerpt: p?.excerpt ?? "",
  bodyMd: p?.bodyMd ?? "",
  tags: (p?.tags ?? []).join(", "),
  coverUrl: p?.coverUrl ?? "",
  coverPublicId: p?.coverPublicId ?? "",
  status: p?.status ?? "draft",
  seoTitle: p?.seoTitle ?? "",
  seoDescription: p?.seoDescription ?? "",
});

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function PostEditor({ post, media }: { post?: PostRow; media: MediaAsset[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(post));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "delete" | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const payload = useMemo(
    () => ({
      title: draft.title.trim(),
      slug: draft.slug.trim() || undefined,
      excerpt: draft.excerpt.trim(),
      bodyMd: draft.bodyMd,
      coverUrl: draft.coverUrl.trim() || null,
      coverPublicId: draft.coverPublicId.trim() || null,
      status: draft.status,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
      seoTitle: draft.seoTitle.trim() || null,
      seoDescription: draft.seoDescription.trim() || null,
    }),
    [draft],
  );

  const save = useCallback(
    async (status?: Draft["status"]) => {
      if (payload.title.length < 3) {
        setError("A title of at least 3 characters is required.");
        return;
      }
      setBusy(status === "published" ? "publish" : "save");
      setError(null);
      try {
        const body = JSON.stringify(status ? { ...payload, status } : payload);
        const res = await fetch(post ? `/api/platform/admin/posts/${post.id}` : "/api/platform/admin/posts", {
          method: post ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error?.message ?? "That did not save.");
          setBusy(null);
          return;
        }
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString("en-GB"));
        const id = json?.post?.id ?? post?.id;
        if (!post && id) {
          router.push(`/admin/posts/${id}`);
          router.refresh();
        } else {
          router.refresh();
        }
        setBusy(null);
      } catch {
        setError("Network error — nothing was saved.");
        setBusy(null);
      }
    },
    [payload, post, router],
  );

  const remove = async () => {
    if (!post) return;
    if (!window.confirm("Delete this post permanently? Published URLs will 404.")) return;
    setBusy("delete");
    const res = await fetch(`/api/platform/admin/posts/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Could not delete.");
      setBusy(null);
      return;
    }
    router.push("/admin/posts");
    router.refresh();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{post ? "Editing" : "New article"}</p>
          <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">{post ? post.title || "Untitled" : "Untitled article"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11.5px] text-ink-3">
            <span className={cn("uppercase tracking-[0.06em]", draft.status === "published" ? "text-go" : draft.status === "archived" ? "text-stop" : "text-warn")}>
              {draft.status}
            </span>
            <span>{words(draft.bodyMd)} words</span>
            <span>~{Math.max(1, Math.round(words(draft.bodyMd) / 220))} min read</span>
            {dirty && <span className="text-warn">unsaved changes</span>}
            {!dirty && savedAt && <span className="text-go">saved {savedAt}</span>}
          </p>
        </div>
        {/* On a phone the editor is a long scroll; the actions ride along under the desk bar. */}
        <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur-sm md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          {post?.status === "published" && (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-sm border border-line-2 px-3 text-[13px] font-semibold hover:border-ink md:h-10">
              View live
            </a>
          )}
          <button type="button" onClick={() => save()} disabled={busy !== null} className="inline-flex h-11 items-center rounded-sm border border-ink px-4 text-[13px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-50 md:h-10">
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => save("published")} disabled={busy !== null} className="inline-flex h-11 items-center rounded-sm border border-ink bg-signal px-4 text-[13px] font-semibold hover:bg-ink hover:text-signal disabled:opacity-50 md:h-10">
            {busy === "publish" ? "Publishing…" : draft.status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13px] text-[#7d1a14]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-md border border-line-2 bg-card p-4">
            <label htmlFor="p-title" className="block font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">Title</label>
            <input
              id="p-title"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Why we show you the whole price"
              className="mt-1.5 w-full border-0 border-b border-line bg-transparent pb-2 text-[22px] font-bold tracking-[-0.02em] outline-none placeholder:text-line-2 focus:border-ink"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[11px] text-ink-3">cleared.com/blog/</span>
              <input
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="auto from title"
                className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[12px] text-ink-2 outline-none placeholder:text-line-2"
              />
            </div>
          </div>

          <div className="rounded-md border border-line-2 bg-card">
            <div className="flex items-center justify-between border-b border-line px-3">
              <div role="tablist" aria-label="Editor mode" className="flex">
                {(["write", "preview"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn("-mb-px border-b-[3px] px-3 py-2.5 text-[13px] font-semibold capitalize", tab === t ? "border-signal text-ink" : "border-transparent text-ink-3 hover:text-ink")}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">markdown · ⌘S saves</span>
            </div>
            {tab === "write" ? (
              <textarea
                value={draft.bodyMd}
                onChange={(e) => set("bodyMd", e.target.value)}
                spellCheck
                placeholder={"## A heading\n\nWrite the piece. Plain markdown: headings, lists, links, bold, `code`."}
                className="h-[min(60vh,640px)] w-full resize-y border-0 bg-transparent p-4 font-mono text-[13.5px] leading-relaxed outline-none placeholder:text-line-2"
              />
            ) : (
              <div className="prose max-h-[min(60vh,640px)] overflow-y-auto p-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.bodyMd || "_Nothing written yet._") }} />
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-line-2 bg-card p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">Cover image</h2>
            <div className="mt-2 aspect-[16/10] overflow-hidden rounded-sm border border-line bg-paper-2">
              {draft.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center font-mono text-[11px] text-ink-3">no image</div>
              )}
            </div>
            <input
              value={draft.coverUrl}
              onChange={(e) => set("coverUrl", e.target.value)}
              placeholder="https://res.cloudinary.com/…"
              className="input mt-3 !h-11 md:!h-9 !text-[12px]"
            />
            {media.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">From the library</p>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {media.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.publicId}
                      onClick={() => {
                        set("coverUrl", m.url);
                        set("coverPublicId", m.publicId);
                      }}
                      className={cn("aspect-square overflow-hidden rounded-xs border", draft.coverUrl === m.url ? "border-signal ring-2 ring-signal" : "border-line hover:border-ink")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-md border border-line-2 bg-card p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">Standfirst</h2>
            <textarea
              value={draft.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="One sentence that earns the click."
              className="input mt-2 !h-auto py-2 !text-[13px]"
            />
            <h2 className="mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">Tags</h2>
            <input value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder="fares, refunds" className="input mt-2 !h-11 md:!h-9 !text-[12.5px]" />
            <p className="mt-1.5 font-mono text-[10.5px] text-ink-3">Comma separated · max 12</p>
          </section>

          <section className="rounded-md border border-line-2 bg-card p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">Search appearance</h2>
            <input value={draft.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="SEO title (optional)" maxLength={160} className="input mt-2 !h-11 md:!h-9 !text-[12.5px]" />
            <textarea value={draft.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} maxLength={300} placeholder="Meta description (optional)" className="input mt-2 !h-auto py-2 !text-[12.5px]" />
          </section>

          {post && (
            <section className="rounded-md border border-[#e0a49f] bg-stop-bg/40 p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-stop">Danger zone</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">Deleting removes the URL permanently. Archive instead if it was ever public.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => save("archived")} disabled={busy !== null} className="h-9 flex-1 rounded-sm border border-ink text-[12.5px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-50">
                  Archive
                </button>
                <button type="button" onClick={remove} disabled={busy !== null} className="h-9 flex-1 rounded-sm border border-stop bg-stop text-[12.5px] font-semibold text-white hover:brightness-95 disabled:opacity-50">
                  {busy === "delete" ? "Deleting…" : "Delete"}
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
