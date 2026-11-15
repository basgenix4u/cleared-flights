import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { posts } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { ApiError, notFound, wrap } from "../lib/http.js";
import { plainText, readingMinutes, slugify } from "../lib/text.js";

/** Admin-side content management. Every route requires a signed-in editor. */
export const adminPostsRouter = Router();

const postInput = z.object({
  title: z.string().min(3).max(160),
  slug: z.string().max(80).optional(),
  excerpt: z.string().max(400).optional(),
  bodyMd: z.string().max(200_000).default(""),
  coverUrl: z.string().url().max(600).nullable().optional(),
  coverPublicId: z.string().max(300).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tags: z.array(z.string().max(40)).max(12).default([]),
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
});

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 40; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const found = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, candidate)).limit(1);
    if (!found[0] || found[0].id === ignoreId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

adminPostsRouter.get(
  "/",
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = Math.min(50, Math.max(5, Number(req.query.perPage ?? 20)));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const where = and(
      q ? or(ilike(posts.title, `%${q}%`), ilike(posts.slug, `%${q}%`)) : undefined,
      status && status !== "all" ? eq(posts.status, status) : undefined,
    );

    const rows = await db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.updatedAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const countRows = await db.select({ n: sql<number>`count(*)::int` }).from(posts).where(where);

    res.json({ posts: rows, total: countRows[0]?.n ?? 0, page, perPage });
  }),
);

adminPostsRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const rows = await db.select().from(posts).where(eq(posts.id, req.params.id)).limit(1);
    if (!rows[0]) throw notFound("That post no longer exists.");
    res.json({ post: rows[0] });
  }),
);

adminPostsRouter.post(
  "/",
  wrap(async (req, res) => {
    const input = postInput.parse(req.body);
    const slug = await uniqueSlug(input.slug || input.title);

    const inserted = await db
      .insert(posts)
      .values({
        slug,
        title: input.title,
        excerpt: input.excerpt ?? plainText(input.bodyMd),
        bodyMd: input.bodyMd,
        coverUrl: input.coverUrl ?? null,
        coverPublicId: input.coverPublicId ?? null,
        status: input.status,
        tags: input.tags,
        authorId: req.user?.id ?? null,
        authorName: req.user?.name ?? "Cleared",
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        readingMinutes: readingMinutes(input.bodyMd),
        publishedAt: input.status === "published" ? new Date() : null,
      })
      .returning();

    await audit(req, "post.created", "post", inserted[0]?.id, { slug, status: input.status });
    res.status(201).json({ post: inserted[0] });
  }),
);

adminPostsRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const input = postInput.partial().parse(req.body);
    const existing = (await db.select().from(posts).where(eq(posts.id, req.params.id)).limit(1))[0];
    if (!existing) throw notFound("That post no longer exists.");

    const nextSlug = input.slug ? await uniqueSlug(input.slug, existing.id) : undefined;
    const publishing = input.status === "published" && existing.status !== "published";
    const body = input.bodyMd ?? existing.bodyMd;

    const updated = await db
      .update(posts)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.bodyMd !== undefined ? { bodyMd: input.bodyMd, readingMinutes: readingMinutes(body) } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
        ...(input.coverPublicId !== undefined ? { coverPublicId: input.coverPublicId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
        ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
        ...(publishing ? { publishedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, existing.id))
      .returning();

    await audit(req, publishing ? "post.published" : "post.updated", "post", existing.id, { status: updated[0]?.status });
    res.json({ post: updated[0] });
  }),
);

adminPostsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const role = req.user?.role;
    if (role !== "owner" && role !== "admin") throw new ApiError(403, "FORBIDDEN", "Only owners and admins can delete posts.");
    const deleted = await db.delete(posts).where(eq(posts.id, req.params.id)).returning({ id: posts.id, slug: posts.slug });
    if (!deleted[0]) throw notFound("That post no longer exists.");
    await audit(req, "post.deleted", "post", deleted[0].id, { slug: deleted[0].slug });
    res.json({ ok: true });
  }),
);
