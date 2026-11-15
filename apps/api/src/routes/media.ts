import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { media } from "../db/schema.js";
import { cloudinaryConfigured, env } from "../env.js";
import { audit } from "../lib/audit.js";
import { ApiError, notFound, wrap } from "../lib/http.js";
import { requireRole } from "../lib/session.js";

/**
 * Cloudinary direct upload.
 *
 * The browser uploads straight to Cloudinary (so large images never touch Render),
 * using a short-lived signature minted here. The API secret never leaves the server,
 * and the signed parameters pin the folder and the timestamp window.
 */
export const mediaRouter = Router();

export function cloudinarySignature(params: Record<string, string | number>, secret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${secret}`).digest("hex");
}

mediaRouter.post(
  "/sign",
  requireRole("owner", "admin", "editor"),
  wrap(async (req, res) => {
    if (!cloudinaryConfigured) {
      throw new ApiError(503, "MEDIA_NOT_CONFIGURED", "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
    }
    const body = z.object({ folder: z.string().max(80).optional() }).parse(req.body ?? {});
    const folder = body.folder ? `${env.CLOUDINARY_FOLDER}/${body.folder}` : env.CLOUDINARY_FOLDER;
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder, timestamp };
    const signature = cloudinarySignature(params, env.CLOUDINARY_API_SECRET as string);

    res.json({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
      // A signature is valid for one hour; the client should not cache it.
      expiresIn: 3600,
    });
  }),
);

mediaRouter.post(
  "/record",
  requireRole("owner", "admin", "editor"),
  wrap(async (req, res) => {
    const body = z
      .object({
        publicId: z.string().min(1).max(300),
        url: z.string().url().max(600),
        format: z.string().max(20).optional(),
        bytes: z.number().int().nonnegative().optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        folder: z.string().max(120).optional(),
        alt: z.string().max(300).optional(),
      })
      .parse(req.body);

    const inserted = await db
      .insert(media)
      .values({
        publicId: body.publicId,
        url: body.url,
        format: body.format ?? null,
        bytes: body.bytes ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        folder: body.folder ?? env.CLOUDINARY_FOLDER,
        alt: body.alt ?? "",
        uploadedBy: req.user?.id ?? null,
      })
      .onConflictDoUpdate({
        target: media.publicId,
        set: { url: body.url, alt: body.alt ?? "" },
      })
      .returning();

    await audit(req, "media.uploaded", "media", inserted[0]?.id, { publicId: body.publicId });
    res.status(201).json({ media: inserted[0] });
  }),
);

mediaRouter.get(
  "/",
  requireRole("owner", "admin", "editor"),
  wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 40)));
    const rows = await db.select().from(media).orderBy(desc(media.createdAt)).limit(limit);
    res.json({ media: rows });
  }),
);

mediaRouter.delete(
  "/:id",
  requireRole("owner", "admin"),
  wrap(async (req, res) => {
    const deleted = await db.delete(media).where(eq(media.id, req.params.id)).returning({ id: media.id, publicId: media.publicId });
    if (!deleted[0]) throw notFound("That asset is not in the library.");
    await audit(req, "media.deleted", "media", deleted[0].id, { publicId: deleted[0].publicId });
    // The Cloudinary asset itself is retained deliberately: a post may still reference it.
    res.json({ ok: true, note: "Removed from the library. The Cloudinary asset is retained." });
  }),
);
