import { eq } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { adminUsers } from "../db/schema.js";
import { env } from "../env.js";
import { hashPassword, passwordProblems } from "../lib/crypto.js";
import { slugify, readingMinutes } from "../lib/text.js";
import { posts } from "../db/schema.js";

/**
 * Idempotent bootstrap: create the first owner account from env, and (optionally)
 * a welcome post so the blog surface is not empty on first deploy.
 *
 *   npm run seed
 */
async function main() {
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, then run again.");
    process.exit(1);
  }
  const problems = passwordProblems(password);
  if (problems.length) {
    console.error(`Seed password is too weak: ${problems.join(" ")}`);
    process.exit(1);
  }

  const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase())).limit(1);
  if (existing[0]) {
    console.log(`Owner ${email} already exists — leaving it untouched.`);
  } else {
    await db.insert(adminUsers).values({
      email: email.toLowerCase(),
      name: env.SEED_ADMIN_NAME,
      passwordHash: await hashPassword(password),
      role: "owner",
    });
    console.log(`Created owner ${email}.`);
  }

  const anyPost = await db.select({ id: posts.id }).from(posts).limit(1);
  if (!anyPost[0]) {
    const title = "Why we show you the whole price";
    const bodyMd = [
      "Every flight site is legally allowed to show you a fare that is not the fare.",
      "",
      "Taxes appear at the next step. A carrier surcharge appears after that. The bag you need is",
      "priced at the payment page, and the fee you pay us is a line item you discover last.",
      "",
      "## What we do instead",
      "",
      "- The number on the result card is the number you pay.",
      "- Our fee is its own line, at a percentage with a floor and a cap — never buried in the fare.",
      "- If the airline will not refund you, we say so in money, before you choose.",
      "",
      "## What we will not do",
      "",
      "We will not invent inventory, and we will not call a booking \"confirmed\" when the airline",
      "has issued nothing. If we cannot sell in an environment, we say that too.",
    ].join("\n");

    await db.insert(posts).values({
      slug: slugify(title),
      title,
      excerpt: "Taxes, surcharges, bag fees and our own fee — on the first screen, not the last.",
      bodyMd,
      status: "published",
      tags: ["product", "transparency"],
      authorName: env.SEED_ADMIN_NAME,
      readingMinutes: readingMinutes(bodyMd),
      publishedAt: new Date(),
    });
    console.log("Created the welcome post.");
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
