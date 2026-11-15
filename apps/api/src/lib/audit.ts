import type { Request } from "express";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import { clientIp } from "./http.js";

/**
 * Every state change an admin makes is recorded. This is not surveillance of staff;
 * it is how you answer "who unpublished the landing page on the day bookings stopped".
 */
export async function audit(
  req: Request,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLog).values({
      actorId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? null,
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      meta: meta ?? null,
      ip: clientIp(req),
    });
  } catch (err) {
    // Auditing must never break the operation it is recording.
    console.error("[audit] failed", err instanceof Error ? err.message : err);
  }
}
