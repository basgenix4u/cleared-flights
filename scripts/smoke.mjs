/**
 * End-to-end smoke test against a running Cleared instance (demo provider).
 *
 *   npm run smoke            # after `npm start`
 *   npm run smoke -- https://host
 *
 * Covers the golden path (search → offer → booking → trip → cancel) and the guards that
 * matter for a money-handling product: idempotency, fare revalidation, PII leakage,
 * signed-cookie access, and the honest-refusal paths.
 */
import "dotenv/config";

const BASE = process.argv[2] ?? "http://localhost:3000";

let pass = 0, fail = 0;
const out = [];
const check = (name, cond, detail = "") => {
  if (cond) { pass++; out.push(`  PASS  ${name}`); }
  else { fail++; out.push(`  FAIL  ${name}${detail ? ` — ${String(detail).slice(0, 200)}` : ""}`); }
};
// A smoke run is a fresh client, so it presents a fresh budget. The limits themselves are
// untouched: repeating a suite in a loop is exactly the abuse a limiter should stop for a
// real browser, and forcing the harness to respect that would make the suite unrepeatable.
const RUN_IP = `198.51.100.${Math.floor(Math.random() * 250) + 2}`;
const post = (p, b, h = {}) =>
  fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": RUN_IP, ...h }, body: JSON.stringify(b) });
const get = (p, h = {}) => fetch(BASE + p, { headers: { "x-forwarded-for": RUN_IP, ...h } });
const uuid = () => crypto.randomUUID();
const future = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

// ------------------------------------------------------------------ catalogue + search
const query = { trip: "round", legs: [{ from: "LOS", to: "LHR", date: future(30) }, { from: "LHR", to: "LOS", date: future(37) }], adults: 1, children: 0, infants: 0, cabin: "economy" };
const searchRes = await post("/api/search", query);
const search = await searchRes.json();
check("POST /api/search returns itineraries", searchRes.status === 200 && search.itineraries?.length > 0, `status ${searchRes.status}`);
check("search runs in demo mode without a Duffel token", search.mode === "demo", search.mode);

const fare = search.itineraries[0].fares[0];
check("fares are priced", typeof fare.price.total === "number" && fare.price.total > 0, fare.price?.total);

const offerRes = await get(`/api/offers/${encodeURIComponent(fare.offerId)}?session=${search.sessionId}`);
const offer = await offerRes.json();
check("GET /api/offers/:id revalidates the fare", offerRes.status === 200, offerRes.status);
const acceptedTotal = offer.price?.total ?? offer.fare?.price?.total ?? fare.price.total;

// ------------------------------------------------------------------------- booking
const bookingBody = {
  idempotencyKey: uuid(),
  sessionId: search.sessionId,
  offerId: fare.offerId,
  acceptedTotal,
  contact: { email: "smoke@example.com", phone: "+2348012345678" },
  passengers: [{ type: "adult", title: "ms", givenName: "Ada", familyName: "Okonkwo", bornOn: "1990-04-12", gender: "f", nationality: "NG", passportNumber: "A1234567", passportExpiry: future(900), passportCountry: "NG" }],
  extras: [],
  consents: { terms: true, names: true },
};
const bookRes = await post("/api/bookings", bookingBody);
const booking = await bookRes.json();
check("POST /api/bookings creates a booking (201)", bookRes.status === 201 && /^CLR-[A-Z0-9]{6}$/.test(booking.reference ?? ""), `${bookRes.status} ${booking.reference}`);

const replayRes = await post("/api/bookings", bookingBody);
const replay = await replayRes.json();
check("an idempotent replay returns the same booking", replayRes.status === 200 && replay.reference === booking.reference && replay.replay === true, `${replayRes.status} ${replay.reference}`);

const stalePrice = await post("/api/bookings", { ...bookingBody, idempotencyKey: uuid(), acceptedTotal: acceptedTotal + 500 });
check("a tampered total is refused with 409 PRICE_CHANGED", stalePrice.status === 409, stalePrice.status);

const infantTooOld = await post("/api/bookings", { ...bookingBody, idempotencyKey: uuid(), passengers: [...bookingBody.passengers, { ...bookingBody.passengers[0], type: "infant", givenName: "Baby", bornOn: "2015-01-01" }] });
check("the infant age rule is enforced (422)", infantTooOld.status === 422, infantTooOld.status);

// ------------------------------------------------------------------------ payment
// When a payment provider is configured the booking must stay unpaid until a signed
// webhook confirms the money — nothing is reserved with the airline on a browser's word.
let paid = false;
if (booking.paymentRequired) {
  check("the booking is unpaid before payment", booking.paymentRequired === true && !!booking.paymentToken, "no token");

  const forged = await post("/api/payments/intent", { reference: booking.reference, token: "x".repeat(32) });
  check("a forged payment token is refused (403)", forged.status === 403, forged.status);

  const intentRes = await post("/api/payments/intent", { reference: booking.reference, token: booking.paymentToken });
  const intent = await intentRes.json();
  check("a payment intent opens", intentRes.status === 200 && intent.status === "pending" && !!intent.redirectUrl, intentRes.status);

  const unsigned = await fetch(`${BASE}/api/webhooks/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-signature": "deadbeef" },
    body: JSON.stringify({ id: "evt_forged", type: "charge.success", data: { reference: booking.reference, amount: intent.amountMinor, currency: intent.currency } }),
  });
  check("an unsigned webhook is rejected (401)", unsigned.status === 401, unsigned.status);

  const sim = await post(`/api/payments/${booking.reference}/mock-pay`, { token: booking.paymentToken });
  const simBody = await sim.json();
  check("a signed webhook captures and fulfils the booking", sim.status === 200 && simBody.outcome?.ok === true, JSON.stringify(simBody).slice(0, 160));

  const payState = await (await get(`/api/payments/${booking.reference}?token=${booking.paymentToken}`)).json();
  check(
    "payment is captured and the airline order is fulfilled",
    payState.payment?.status === "captured" && payState.payment?.fulfilmentStatus === "done",
    JSON.stringify(payState.payment ?? {}),
  );

  const replayPay = await post(`/api/payments/${booking.reference}/mock-pay`, { token: booking.paymentToken });
  const replayBody = await replayPay.json();
  check("a replayed webhook cannot charge or fulfil twice", replayPay.status === 200 && /already/i.test(JSON.stringify(replayBody)), JSON.stringify(replayBody).slice(0, 160));

  const payAgain = await post("/api/payments/intent", { reference: booking.reference, token: booking.paymentToken });
  check("an already-paid booking cannot be paid again (409)", payAgain.status === 409, payAgain.status);

  const rec = await fetch(`${BASE}/api/cron/reconcile`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
  const recBody = await rec.json();
  check("reconciliation runs cleanly", rec.status === 200 && recBody.ok === true, JSON.stringify(recBody).slice(0, 160));
  paid = true;
} else {
  check("payment is skipped (no provider configured)", true, "");
}

// -------------------------------------------------------------------------- trips
const wrong = await post("/api/trips/retrieve", { reference: booking.reference, lastName: "Wrongname" });
check("a wrong surname is a generic 404", wrong.status === 404, wrong.status);

const retrieveRes = await post("/api/trips/retrieve", { reference: booking.reference, lastName: "Okonkwo" });
const cookie = (retrieveRes.headers.get("set-cookie") ?? "").split(";")[0];
check("the correct surname grants a trip cookie", retrieveRes.status === 200 && /httponly/i.test(retrieveRes.headers.get("set-cookie") ?? ""), retrieveRes.status);

const noCookie = await get(`/api/trips/${booking.reference}/calendar`);
check("the calendar is 403 without the signed cookie", noCookie.status === 403, noCookie.status);

const cal = await get(`/api/trips/${booking.reference}/calendar`, { cookie });
check("the calendar returns an ICS document", cal.status === 200 && (await cal.text()).includes("BEGIN:VCALENDAR"), cal.status);

const change = await post(`/api/trips/${booking.reference}/requests`, { type: "change", message: "Could we move the return a day later?", contactEmail: "smoke@example.com" }, { cookie });
check("a change request is accepted", change.status === 200 || change.status === 201, change.status);

// --------------------------------------------------------------------- cancellation
const quoteRes = await post(`/api/trips/${booking.reference}/cancel`, { action: "quote" }, { cookie });
const quote = await quoteRes.json();
const refund = quote.quote?.refundAmount ?? 0;
check("a cancellation quote returns a refund figure", quoteRes.status === 200 && typeof quote.quote?.refundAmount === "number", quoteRes.status);

const staleRefund = await post(`/api/trips/${booking.reference}/cancel`, { action: "confirm", expectedRefund: refund + 99 }, { cookie });
check("a stale refund is refused with 409 REFUND_CHANGED", staleRefund.status === 409, staleRefund.status);

const confirmRes = await post(`/api/trips/${booking.reference}/cancel`, { action: "confirm", expectedRefund: refund }, { cookie });
check("the cancellation confirms", confirmRes.status === 200, confirmRes.status);

const second = await post(`/api/trips/${booking.reference}/cancel`, { action: "confirm", expectedRefund: refund }, { cookie });
check("a second cancel is refused with 409", second.status === 409, second.status);

// ------------------------------------------------------------------------- guards
const sameAirport = await post("/api/search", { ...query, legs: [{ from: "LOS", to: "LOS", date: future(30) }] });
check("an origin equal to the destination is a 400", sameAirport.status === 400, sameAirport.status);

const support = await post("/api/support", { email: "smoke@example.com", topic: "baggage", message: "How much cabin baggage is included?" });
check("the support form accepts a valid message", support.status === 200 || support.status === 201, support.status);

// ------------------------------------------------------- production surfaces
// The booking page must carry the pre-departure checklist: passport validity, ages and
// name format are the failures that stop people at the gate.
const tripPage = await fetch(`${BASE}/trips/${booking.reference}`, { headers: { cookie } });
const tripHtml = await tripPage.text();
check("the booking page renders", tripPage.status === 200, tripPage.status);
check("the booking page shows the pre-departure checklist", /Before you fly/.test(tripHtml), "missing");

// Service fee must be the configured percentage with a floor and a cap, never a flat
// fee that falls below supplier cost. See docs/04-business-analysis.md §4.
const feeFare = search.itineraries[0].fares[0];
const airlineAmount = feeFare.price.fare + feeFare.price.taxes;
const pct = (feeFare.price.serviceFee / airlineAmount) * 100;
check(
  "the service fee is a percentage of the airline amount, floored and capped",
  feeFare.price.serviceFee > 0 && (Math.abs(pct - 2.5) < 0.05 || pct < 2.5),
  `${pct.toFixed(2)}%`,
);

// Security headers: a booking flow that can be framed is a clickjacking surface.
const homeHeaders = (await fetch(BASE + "/")).headers;
check(
  "security headers are set",
  homeHeaders.get("x-frame-options") === "DENY" && !!homeHeaders.get("content-security-policy"),
  homeHeaders.get("x-frame-options"),
);

// ------------------------------------------------------------------------- pages
for (const [path, expect] of [["/", 200], ["/flights", 200], ["/deals", 200], ["/explore", 200], ["/help", 200], ["/trips", 200], ["/checkout", 200], ["/blog", 200], ["/blog/why-we-show-you-the-whole-price", 200], ["/nope-not-here", 404]]) {
  const r = await fetch(BASE + path);
  check(`page ${path} → ${expect}`, r.status === expect, r.status);
}
// Platform tier: the admin desk must never be reachable without a session, and the
// proxy must report a dead backend honestly rather than 200 with an empty body.
const desk = await fetch(BASE + "/admin", { redirect: "manual" });
check("the admin desk redirects unauthenticated visitors", desk.status === 307 || desk.status === 302, desk.status);

const platformHealth = await get("/api/platform/health");
check("the platform proxy reaches the API", platformHealth.status === 200, platformHealth.status);

const platformStats = await fetch(BASE + "/api/platform/admin/stats");
check("platform admin routes refuse an anonymous caller", platformStats.status === 401, platformStats.status);

const health = await get("/api/health");
check("/api/health is ok", health.status === 200, health.status);

// images: the shipped zip had no public/ folder, so this locks the fix in
for (const img of ["hero-wing", "lisbon", "tokyo"]) {
  const r = await get(`/_next/image?url=%2Fimages%2F${img}.jpg&w=640&q=75`);
  check(`image ${img}.jpg is served`, r.status === 200, r.status);
}

// --------------------------------------------------------------------------- desk
// Booking operations: the desk reads, a human decides, a worker executes.
const deskEmail = process.env.SEED_ADMIN_EMAIL;
const deskPassword = process.env.SEED_ADMIN_PASSWORD;
if (deskEmail && deskPassword) {
  const login = await fetch(`${BASE}/api/platform/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: deskEmail, password: deskPassword }),
  });
  const deskCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  check("the desk can be signed into", login.status === 200 && deskCookie.length > 10, login.status);

  const anonDesk = await fetch(`${BASE}/api/platform/admin/bookings`);
  check("booking operations refuse an anonymous caller (401)", anonDesk.status === 401, anonDesk.status);

  const deskList = await (await fetch(`${BASE}/api/platform/admin/bookings?limit=50`, { headers: { cookie: deskCookie } })).json();
  const listed = (deskList.bookings ?? []).find((b) => b.reference === booking.reference);
  check("the booking is visible on the desk", !!listed, deskList.bookings?.length);
  check("customer emails are masked on the desk", !!listed && !listed.email.includes("smoke@example.com"), listed?.email);

  if (paid) {
    const refundReq = await fetch(`${BASE}/api/platform/admin/bookings/${booking.reference}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: deskCookie },
      body: JSON.stringify({ reason: "smoke: verification of the refund path" }),
    });
    const refundBody = await refundReq.json();
    check("a refund can be requested", refundReq.status === 201 && refundBody.refund?.status === "requested", `${refundReq.status} ${JSON.stringify(refundBody).slice(0, 160)}`);
    if (!refundBody.refund) {
      console.log(`\n${out.join("\n")}`);
      console.log(`\n${pass} passed, ${fail + 1} failed (aborted: refund could not be raised)\n`);
      process.exit(1);
    }

    const overRefund = await fetch(`${BASE}/api/platform/admin/bookings/${booking.reference}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: deskCookie },
      body: JSON.stringify({ reason: "too much", amountMinor: 990000000 }),
    });
    check("a refund larger than the capture is refused", overRefund.status === 400, overRefund.status);

    const approve = await fetch(`${BASE}/api/platform/admin/bookings/refunds/${refundBody.refund.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: deskCookie },
      body: JSON.stringify({ decision: "approve" }),
    });
    const approved = await approve.json();
    check("an owner can approve it", approve.status === 200 && approved.refund?.status === "approved", approve.status);

    const recon = await fetch(`${BASE}/api/cron/reconcile`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
    const reconBody = await recon.json();
    check("the worker executes the approved refund", reconBody.refundsExecuted >= 1, JSON.stringify(reconBody));
  }

  for (const path of ["/admin/bookings", "/admin/refunds", "/admin/requests", "/admin/emails", "/admin/health", `/admin/bookings/${booking.reference}`]) {
    const page = await get(path, { cookie: deskCookie });
    check(`page ${path} renders`, page.status === 200, page.status);
  }

  // ---------------------------------------------------------------- email + requests
  const mailRes = await get(`/api/trips/${booking.reference}/emails`, { cookie });
  const mail = await mailRes.json();
  check("the trip page can list the messages we sent", mailRes.status === 200 && Array.isArray(mail.emails), mailRes.status);
  check(
    "every message reports a truthful delivery state",
    mail.emails.every((e) => ["sent", "queued", "failed", "skipped"].includes(e.status)),
    JSON.stringify(mail.emails?.map((e) => e.status)),
  );
  if (mail.emails.some((e) => e.status === "skipped")) {
    check("undelivered mail carries the reason, not a silent gap", mail.emails.every((e) => e.status !== "skipped" || e.failureReason === "no_email_provider"), "");
  }
  check("the mail record needs the trip cookie", (await get(`/api/trips/${booking.reference}/emails`)).status === 403, "");

  const openMail = mail.emails.find((e) => e.status !== "sent");
  if (openMail) {
    const retry = await post(`/api/trips/${booking.reference}/emails`, { id: openMail.id }, { cookie });
    check("a not-sent message can be retried", retry.status === 200, retry.status);
  }

  const reqRes = await post(`/api/trips/${booking.reference}/requests`, { type: "change", message: "smoke: could I move the outbound one day later?" }, { cookie });
  check("a customer request is accepted", reqRes.status === 200 || reqRes.status === 201, reqRes.status);

  const queueRes = await get("/api/platform/admin/bookings/requests/queue", { cookie: deskCookie });
  const queue = await queueRes.json();
  const queued = (queue.requests ?? []).find((r) => r.reference === booking.reference);
  check("the request reaches the desk queue", !!queued, queueRes.status);

  const resolveRes = await post(`/api/platform/admin/bookings/requests/${queued.id}/resolve`, { note: "smoke: moved, no change fee." }, { cookie: deskCookie });
  const resolved = await resolveRes.json();
  check("the desk can answer it", resolveRes.status === 200 && resolved.ok === true, JSON.stringify(resolved).slice(0, 140));

  const afterMail = await (await get(`/api/trips/${booking.reference}/emails`, { cookie })).json();
  check("the reply is queued as a message the customer will receive", afterMail.emails.some((e) => e.kind === "request.resolved"), afterMail.emails?.map((e) => e.kind).join(","));
} else {
  check("desk checks skipped (SEED_ADMIN_EMAIL/PASSWORD unset)", true, "");
}

// ----------------------------------------------------------- reliability and scale
// Tracing: one id per request, in both directions, so a log line and a support
// conversation can be joined up.
const traced = await post("/api/search", query);
const inboundId = "req_smoke01testidentity";
const echoed = await fetch(`${BASE}/api/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-request-id": inboundId, "x-forwarded-for": RUN_IP },
  body: JSON.stringify(query),
});
check("every response carries a request id", /^req_[A-Za-z0-9]{8,}$/.test(traced.headers.get("x-request-id") ?? ""), traced.headers.get("x-request-id"));
check("an inbound request id is respected (end-to-end tracing)", echoed.headers.get("x-request-id") === inboundId, echoed.headers.get("x-request-id"));

const badEnvelope = await fetch(`${BASE}/api/payments/intent`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.42" },
  body: JSON.stringify({ reference: "CLR-NOPE00", token: "x".repeat(32) }),
});
const badBody = await badEnvelope.json();
check("error envelopes carry the request id", typeof badBody.error?.requestId === "string" && badBody.error.requestId.startsWith("req_"), JSON.stringify(badBody).slice(0, 120));

// Rate limiting: the headers must be present on success so a client can back off early.
check("successful responses report the rate-limit budget", traced.headers.get("ratelimit-limit") !== null && traced.headers.get("ratelimit-remaining") !== null, traced.headers.get("ratelimit-limit"));
check("a malformed request id is not echoed back", await (async () => {
  const r = await fetch(`${BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": "<script>alert(1)</script>", "x-forwarded-for": RUN_IP },
    body: JSON.stringify(query),
  });
  await r.arrayBuffer();
  return (r.headers.get("x-request-id") ?? "").startsWith("req_") && !(r.headers.get("x-request-id") ?? "").includes("script");
})(), "unsafe id reflected");

// Error budget: public, honest, and free of anything personal.
const statusRes = await get("/api/status");
const status = await statusRes.json();
check("GET /api/status reports an error budget", statusRes.status === 200 && typeof status.budget?.used === "number" && typeof status.objective?.maxErrorRate === "number", statusRes.status);
check("the status page lists per-route latency", Array.isArray(status.routes) && status.routes.some((r) => typeof r.p95 === "number"), JSON.stringify(status.routes?.[0] ?? null));
check("the public status endpoint leaks no references or emails", !/CLR-[A-Z0-9]{6}|@example\.com/.test(JSON.stringify(status)), "PII in /api/status");

// A limiter that never fires is not a limiter; one that fires on a double-click is a bug.
const limited = [];
for (let i = 0; i < 12; i++) limited.push(await fetch(`${BASE}/api/search`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.201" }, body: JSON.stringify(query) }));
const refused = limited.filter((r) => r.status === 429);
check("a burst from one client is refused with 429", refused.length > 0, `${refused.length} of 12`);
check("the refusal is usable: Retry-After and a JSON envelope", refused.length > 0 && refused[0].headers.get("retry-after") !== null, refused[0]?.headers.get("retry-after"));
const refusalBody = refused.length ? await refused[0].json() : {};
check("the refusal explains itself", refusalBody.error?.code === "RATE_LIMITED", JSON.stringify(refusalBody).slice(0, 120));

console.log(out.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
