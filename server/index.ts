import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { pages } from "../src/seo.ts";
import { publicOrigin, seoHtml, sitemap } from "./seo.ts";
import { z } from "zod";
import {
  initial,
  prepareSubmission,
  validateQuestionnaire,
  ValidationError,
} from "../src/domain.ts";
import { outboxTick } from "./notifications.ts";
import { db } from "./database.ts";
import { digest, hashPassword, verifyPassword, verifyTotp } from "./auth.ts";
import { sendMail, mailConfigured } from "./mail.ts";
const app = express();
const production = process.env.NODE_ENV === "production";
if (production) {
  for (const name of [
    "DATABASE_URL",
    "SITE_URL",
    "SMTP_HOST",
    "EMAIL_FROM",
    "NOTIFICATION_EMAIL",
  ])
    if (!process.env[name])
      throw Error("Missing production configuration: " + name);
  if (!process.env.SITE_URL!.startsWith("https://"))
    throw Error("Production SITE_URL must use HTTPS");
  if (
    process.env.SMTP_SECURE !== "true" &&
    process.env.SMTP_REQUIRE_TLS === "false"
  )
    throw Error("Production SMTP must verify TLS");
}
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString("base64");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "connect-src": ["'self'"],
        "script-src": [
          "'self'",
          (_req, res: any) => `'nonce-${res.locals.cspNonce}'`,
        ],
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:"],
      },
    },
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
const configured = !!db;
const route = (handler: any) => (req: any, res: any, next: any) =>
  Promise.resolve(handler(req, res, next)).catch(next);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = process.env.SITE_URL;
    if (!origin || !expected || origin !== new URL(expected).origin)
      return res.status(403).json({
        error: "Ongeldige herkomst. Configureer SITE_URL voor deze website.",
      });
    if (!req.is("application/json"))
      return res
        .status(415)
        .json({ error: "Alleen JSON-aanvragen zijn toegestaan." });
  }
  next();
});
app.get("/api/config", (_req, res) =>
  res.json({
    configured,
    company: process.env.COMPANY_NAME ?? "Mijnbouwschadecheck",
    email: process.env.CONTACT_EMAIL ?? "",
    phone: process.env.CONTACT_PHONE ?? "",
    privacyContact: process.env.PRIVACY_CONTACT ?? "",
    retention: process.env.RETENTION_DAYS ?? "",
    privacyApproved: process.env.PRIVACY_APPROVED === "true",
    companyDetails: process.env.COMPANY_DETAILS ?? "",
    legalBasis: process.env.PRIVACY_LEGAL_BASIS ?? "",
    processors: process.env.PRIVACY_PROCESSORS ?? "",
  }),
);
app.get(
  "/api/health",
  route(async (_req: any, res: any) => {
    if (!db) return res.json({ server: "ok", databaseConfigured: false });
    await db.query("select 1");
    res.json({ server: "ok", databaseConfigured: true });
  }),
);
app.get(
  "/api/questionnaire",
  route(async (_req: any, res: any) => {
    if (!db) return res.json(initial);
    const r = await db.query(
      "select definition from questionnaire_versions where state='published'",
    );
    if (!r.rowCount) throw Error("QUESTIONNAIRE_UNAVAILABLE");
    res.json(validateQuestionnaire(r.rows[0].definition));
  }),
);
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Te veel pogingen. Probeer het later opnieuw." },
});
const recoverLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Te veel herstelpogingen. Probeer het later opnieuw." },
});
const resetLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Te veel herstelpogingen. Probeer het later opnieuw." },
});
const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "strict" as const,
  path: "/api",
  maxAge: 8 * 60 * 60 * 1000,
};
async function session(req: any) {
  const token = req.cookies.session;
  if (!db || typeof token !== "string") return null;
  const r = await db.query(
    "select a.user_id,a.email,a.totp_secret from sessions s join admins a using(user_id) where s.token_hash=$1 and s.expires_at>now()",
    [digest(token)],
  );
  return r.rows[0] ?? null;
}
app.post(
  "/api/auth/login",
  loginLimit,
  route(async (req: any, res: any) => {
    if (!db)
      return res.status(503).json({ error: "Beheer is nog niet aangesloten." });
    const p = z
      .object({
        email: z.email().max(254),
        password: z.string().max(200),
        code: z.string().max(6).optional(),
      })
      .strict()
      .parse(req.body);
    const r = await db.query("select * from admins where email=$1", [
      p.email.toLowerCase(),
    ]);
    const admin = r.rows[0];
    const valid = verifyPassword(
      p.password,
      admin?.password_hash ??
        "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (
      !admin ||
      !valid ||
      (admin.totp_secret && !verifyTotp(admin.totp_secret, p.code ?? ""))
    )
      return res
        .status(401)
        .json({ error: "Onjuiste inloggegevens of verificatiecode." });
    const token = randomBytes(32).toString("hex");
    await db.query("delete from sessions where expires_at<now()");
    await db.query(
      "insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')",
      [digest(token), admin.user_id],
    );
    res.cookie("session", token, cookieOptions);
    res.json({ authenticated: true });
  }),
);
app.get(
  "/api/auth/session",
  route(async (req: any, res: any) =>
    res.json({ authenticated: !!(await session(req)) }),
  ),
);
app.post(
  "/api/auth/logout",
  route(async (req: any, res: any) => {
    if (db && typeof req.cookies.session === "string")
      await db.query("delete from sessions where token_hash=$1", [
        digest(req.cookies.session),
      ]);
    res.clearCookie("session", { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/recover",
  recoverLimit,
  route(async (req: any, res: any) => {
    const p = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(req.body);
    if (!db || !mailConfigured())
      return res.status(503).json({
        error: "Wachtwoordherstel via e-mail is nog niet aangesloten.",
      });
    const r = await db.query(
      "select user_id,email from admins where email=$1",
      [p.email.toLowerCase()],
    );
    if (r.rowCount) {
      const token = randomBytes(32).toString("hex");
      await db.query(
        "delete from password_resets where user_id=$1 or expires_at<now()",
        [r.rows[0].user_id],
      );
      await db.query(
        "insert into password_resets(token_hash,user_id,expires_at) values($1,$2,now()+interval '30 minutes')",
        [digest(token), r.rows[0].user_id],
      );
      try {
        await sendMail(
          r.rows[0].email,
          "Wachtwoord herstellen",
          `Herstel je wachtwoord via ${process.env.SITE_URL}/admin_sander#reset=${token}. Deze link is 30 minuten geldig.`,
        );
      } catch {
        await db.query("delete from password_resets where token_hash=$1", [
          digest(token),
        ]);
      }
    }
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/reset",
  resetLimit,
  route(async (req: any, res: any) => {
    if (!db) return res.status(503).json({ error: "Beheer niet aangesloten." });
    const p = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(12).max(200),
        code: z.string().max(6).optional(),
      })
      .strict()
      .parse(req.body);
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "select a.user_id,a.totp_secret from password_resets r join admins a using(user_id) where r.token_hash=$1 and r.expires_at>now() for update",
        [digest(p.token)],
      );
      if (
        !r.rowCount ||
        (r.rows[0].totp_secret &&
          !verifyTotp(r.rows[0].totp_secret, p.code ?? ""))
      ) {
        await c.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Herstellink of verificatiecode is ongeldig." });
      }
      await c.query("update admins set password_hash=$1 where user_id=$2", [
        hashPassword(p.password),
        r.rows[0].user_id,
      ]);
      await c.query("delete from password_resets where user_id=$1", [
        r.rows[0].user_id,
      ]);
      await c.query("delete from sessions where user_id=$1", [
        r.rows[0].user_id,
      ]);
      await c.query("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      await c.release();
    }
  }),
);
app.post(
  "/api/applications",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Te veel aanvragen. Probeer het later opnieuw." },
  }),
  route(async (req: any, res: any) => {
    if (!db)
      return res.status(503).json({
        error:
          "Opslag is nog niet aangesloten. Je gegevens zijn niet verzonden.",
      });
    if (
      production &&
      (process.env.PRIVACY_APPROVED !== "true" ||
        !process.env.PRIVACY_LEGAL_BASIS ||
        !process.env.PRIVACY_CONTACT ||
        !process.env.COMPANY_DETAILS ||
        !process.env.PRIVACY_PROCESSORS ||
        !process.env.RETENTION_DAYS)
    )
      return res
        .status(503)
        .json({ error: "Aanvragen zijn nog niet opengesteld." });
    const id = z.uuid().parse(req.body.version_id);
    const r = await db.query(
      "select definition from questionnaire_versions where id=$1 and state in ('published','archived')",
      [id],
    );
    if (!r.rowCount)
      return res.status(400).json({ error: "Onbekende vragenlijstversie." });
    const q = validateQuestionnaire(r.rows[0].definition);
    const p = prepareSubmission(q, req.body);
    const address = {
      postcode: p.answers.postcode,
      house_number: p.answers.house_number,
      street: p.contact.street,
      city: p.contact.city,
    };
    const canonical = {
      version_id: p.version_id,
      answers: Object.fromEntries(
        Object.entries(p.answers).sort(([a], [b]) => a.localeCompare(b)),
      ),
      contact: p.contact,
    };
    try {
      const saved = await db.query(
        "select submit_application($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
        [
          p.idempotency_key,
          digest(JSON.stringify(canonical)),
          p.version_id,
          JSON.stringify(q),
          JSON.stringify(p.contact),
          JSON.stringify(address),
          JSON.stringify(p.snapshots),
          p.indication,
          JSON.stringify(p.reasons),
          [p.contact.name, ...Object.values(address)].join(" ").toLowerCase(),
        ],
      );
      res.status(201).json(saved.rows[0].result);
    } catch (e: any) {
      if (e.message.includes("IDEMPOTENCY_CONFLICT"))
        return res.status(409).json({
          error:
            "Deze verzendcode is al gebruikt voor andere gegevens. Herlaad voor een nieuwe aanvraag.",
        });
      throw e;
    }
  }),
);
app.use(
  "/api/admin",
  route(async (req: any, res: any, next: any) => {
    const admin = await session(req);
    if (!admin)
      return res.status(401).json({ error: "Log in om verder te gaan." });
    req.actor = admin.user_id;
    next();
  }),
);
app.get(
  "/api/admin/applications",
  route(async (req: any, res: any) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .catch(1)
      .parse(req.query.page);
    const search = String(req.query.search ?? "")
      .slice(0, 100)
      .replace(/[%_\\]/g, "");
    const status = String(req.query.status ?? "");
    const indication = String(req.query.indication ?? "");
    const where =
      "where ($1='' or search_text ilike '%'||$1||'%') and ($2='' or status=$2) and ($3='' or indication=$3)";
    const values = [search, status, indication];
    const r = await db!.query(
      "select id,number,created_at,contact,address,indication,status,review_status from applications " +
        where +
        " order by created_at desc limit 20 offset $4",
      [...values, (page - 1) * 20],
    );
    const count = await db!.query(
      "select count(*) from applications " + where,
      values,
    );
    res.json({ items: r.rows, count: Number(count.rows[0].count) });
  }),
);
app.get(
  "/api/admin/applications/:id",
  route(async (req: any, res: any) => {
    const id = z.uuid().parse(req.params.id);
    const r = await db!.query("select * from applications where id=$1", [id]);
    if (!r.rowCount)
      return res.status(404).json({ error: "Aanvraag niet gevonden." });
    const outbox = await db!.query(
      "select status,attempts,delivered_at from notification_outbox where application_id=$1",
      [id],
    );
    res.json({ ...r.rows[0], notification: outbox.rows[0] ?? null });
  }),
);
app.patch(
  "/api/admin/applications/:id",
  route(async (req: any, res: any) => {
    const id = z.uuid().parse(req.params.id);
    const p = z
      .object({
        status: z.enum(["Nieuw", "In behandeling", "Afgerond"]),
        review_status: z.enum(["Nog te controleren", "Gecontroleerd"]),
        note: z.string().max(10000),
      })
      .strict()
      .parse(req.body);
    await db!.query("select update_application($1,$2,$3,$4,$5)", [
      id,
      req.actor,
      p.status,
      p.review_status,
      p.note,
    ]);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/admin/applications/:id",
  route(async (req: any, res: any) => {
    const id = z.uuid().parse(req.params.id);
    z.object({ confirm: z.literal("VERWIJDER") })
      .strict()
      .parse(req.body);
    const r = await db!.query("delete from applications where id=$1", [id]);
    res.json({ deleted: r.rowCount === 1 });
  }),
);
app.get(
  "/api/admin/questionnaires",
  route(async (_req: any, res: any) =>
    res.json(
      (
        await db!.query(
          "select * from questionnaire_versions order by created_at desc",
        )
      ).rows,
    ),
  ),
);
app.put(
  "/api/admin/questionnaires/:id",
  route(async (req: any, res: any) => {
    const id = z.uuid().parse(req.params.id);
    const q = validateQuestionnaire(req.body);
    if (q.id !== id)
      return res.status(400).json({ error: "Versie-ID komt niet overeen." });
    try {
      await db!.query("select save_questionnaire_draft($1,$2)", [
        id,
        JSON.stringify(q),
      ]);
    } catch (e: any) {
      if (e.message.includes("IMMUTABLE_VERSION"))
        return res
          .status(409)
          .json({ error: "Een gepubliceerde versie is onveranderlijk." });
      throw e;
    }
    res.json({ ok: true });
  }),
);
app.post(
  "/api/admin/questionnaires/:id/publish",
  route(async (req: any, res: any) => {
    const id = z.uuid().parse(req.params.id);
    const c = await db!.connect();
    try {
      await c.query("BEGIN");
      await c.query("select pg_advisory_xact_lock(752103)");
      const r = await c.query(
        "select definition from questionnaire_versions where id=$1 and state='draft' for update",
        [id],
      );
      if (!r.rowCount) {
        await c.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "Alleen een concept kan worden gepubliceerd." });
      }
      const q = validateQuestionnaire(r.rows[0].definition);
      const pub = await c.query(
        "select publish_questionnaire($1,$2) as result",
        [id, JSON.stringify(q)],
      );
      await c.query("COMMIT");
      res.json(pub.rows[0].result);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      await c.release();
    }
  }),
);

setInterval(() => {
  outboxTick().catch(() => console.error("notification_worker_failed"));
}, 30000).unref();
app.get("/robots.txt", (_req, res) => {
  const origin = publicOrigin(process.env.SITE_URL);
  res
    .type("text/plain")
    .send(
      origin
        ? `User-agent: *\nAllow: /\nDisallow: /admin_sander\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`
        : "User-agent: *\nDisallow: /\n",
    );
});
app.get("/sitemap.xml", (_req, res) =>
  res.type("application/xml").send(sitemap(process.env.SITE_URL)),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint niet gevonden." }),
);
app.use(express.static(resolve("dist"), { index: false }));
app.get(
  "/{*path}",
  route(async (req: any, res: any) => {
    if (!pages[req.path])
      return res
        .status(404)
        .type("text/html")
        .send(
          '<!doctype html><html lang="nl"><head><meta name="robots" content="noindex"><title>Pagina niet gevonden</title></head><body><h1>Pagina niet gevonden</h1><a href="/">Terug naar de mijnbouwschadecheck</a></body></html>',
        );
    if (req.path === "/admin_sander")
      res
        .set("X-Robots-Tag", "noindex, nofollow")
        .set("Cache-Control", "no-store");
    const html = await readFile(resolve("dist/index.html"), "utf8");
    res
      .type("text/html")
      .send(seoHtml(html, req.path, process.env.SITE_URL, res.locals.cspNonce));
  }),
);
app.use((error: any, _req: any, res: any, _next: any) => {
  if (error instanceof ValidationError)
    return res.status(400).json({ error: error.message, fields: error.fields });
  if (error instanceof z.ZodError)
    return res.status(400).json({
      error: "Controleer de ingevulde gegevens.",
      fields: Object.fromEntries(
        error.issues.map((x) => [x.path.join("."), x.message]),
      ),
    });
  if (error.type === "entity.too.large")
    return res.status(413).json({ error: "De aanvraag is te groot." });
  if (error instanceof SyntaxError)
    return res.status(400).json({ error: "Ongeldige aanvraag." });
  if (
    error.message?.match(
      /zichtbaarheid|vraag|optie|basisveld|Basisvraag|Optie|Vraag|Keuze|Tekst|Cyclische/,
    )
  )
    return res.status(400).json({ error: error.message });
  console.error("request_failed");
  res.status(503).json({
    error: "Deze actie kon niet worden voltooid. Probeer het later opnieuw.",
  });
});
const server = app.listen(
  Number(process.env.PORT ?? 3001),
  "0.0.0.0",
  (error?: Error) => {
    if (error) {
      console.error("Server failed to start.");
      process.exitCode = 1;
      db?.end();
      return;
    }
    console.log("Server listening on port " + (process.env.PORT ?? 3001));
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(() => {
      db?.end().finally(() => process.exit(0));
      if (!db) process.exit(0);
    });
  });
