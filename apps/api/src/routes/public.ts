import { and, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/index.js";
import { posts } from "../db/schema.js";
import { notFound, wrap } from "../lib/http.js";

/**
 * Public, unauthenticated content. Only `published` rows are ever visible, and the
 * body is selected explicitly so drafts, author ids and SEO scratch fields cannot
 * leak through an over-broad select.
 */
export const publicRouter = Router();

const PUBLIC_COLUMNS = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  excerpt: posts.excerpt,
  coverUrl: posts.coverUrl,
  tags: posts.tags,
  readingMinutes: posts.readingMinutes,
  authorName: posts.authorName,
  publishedAt: posts.publishedAt,
};

publicRouter.get(
  "/posts",
  wrap(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 12)));
    const page = Math.max(1, Number(req.query.page ?? 1));
    const tag = typeof req.query.tag === "string" ? req.query.tag : "";

    const where = and(
      eq(posts.status, "published"),
      tag ? sql`${posts.tags} @> ${JSON.stringify([tag])}::jsonb` : undefined,
    );

    const rows = await db
      .select(PUBLIC_COLUMNS)
      .from(posts)
      .where(where)
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const countRows = await db.select({ n: sql<number>`count(*)::int` }).from(posts).where(where);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ posts: rows, total: countRows[0]?.n ?? 0, page, limit });
  }),
);

publicRouter.get(
  "/posts/:slug",
  wrap(async (req, res) => {
    const rows = await db
      .select({ ...PUBLIC_COLUMNS, bodyMd: posts.bodyMd, seoTitle: posts.seoTitle, seoDescription: posts.seoDescription, updatedAt: posts.updatedAt })
      .from(posts)
      .where(and(eq(posts.slug, req.params.slug), eq(posts.status, "published")))
      .limit(1);
    if (!rows[0]) throw notFound("That article does not exist.");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ post: rows[0] });
  }),
);

publicRouter.get(
  "/posts/meta/tags",
  wrap(async (_req, res) => {
    const rows = await db
      .select({ tag: sql<string>`jsonb_array_elements_text(${posts.tags})`, n: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.status, "published"))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(24);
    res.json({ tags: rows });
  }),
);
