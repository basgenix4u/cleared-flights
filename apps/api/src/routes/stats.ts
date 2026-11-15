import { desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { db, pool } from "../db/index.js";
import { auditLog, media, posts } from "../db/schema.js";
import { wrap } from "../lib/http.js";

/** Dashboard numbers. Deliberately few and truthful — vanity metrics age badly. */
export const statsRouter = Router();

statsRouter.get(
  "/",
  wrap(async (_req, res) => {
    const [postCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${posts.status} = 'published')::int`,
        drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')::int`,
        scheduled: sql<number>`count(*) filter (where ${posts.publishedAt} > now())::int`,
      })
      .from(posts);

    const [mediaCount] = await db.select({ total: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${media.bytes}),0)::bigint` }).from(media);

    // Travel tables live in the same Neon database but belong to the web app. Count
    // them if present, and degrade honestly if they are not.
    let bookings: { total: number; last7: number; revenue: number } | null = null;
    try {
      const r = await pool.query<{ total: string; last7: string; revenue: string }>(
        `select count(*)::text as total,
                count(*) filter (where created_at > now() - interval '7 days')::text as last7,
                coalesce(sum(total_amount) filter (where status <> 'cancelled'), 0)::text as revenue
         from bookings`,
      );
      const row = r.rows[0];
      if (row) bookings = { total: Number(row.total), last7: Number(row.last7), revenue: Number(row.revenue) };
    } catch {
      bookings = null;
    }

    const recent = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(8);
    const drafts = await db.select({ id: posts.id, title: posts.title, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.status, "draft")).orderBy(desc(posts.updatedAt)).limit(5);

    res.json({
      posts: postCounts ?? { total: 0, published: 0, drafts: 0, scheduled: 0 },
      media: { total: mediaCount?.total ?? 0, bytes: Number(mediaCount?.bytes ?? 0) },
      bookings,
      recentActivity: recent,
      drafts,
    });
  }),
);
