import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "./database.ts";
import { hashPassword } from "./auth.ts";
import { initial } from "../src/domain.ts";
if (!db) throw Error("DATABASE_URL is required");
const command = process.argv[2];
try {
  if (command === "migrate") {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(752102)");
      await client.query(
        "create table if not exists schema_migrations(name text primary key,applied_at timestamptz default now())",
      );
      for (const name of (await readdir(resolve("database/migrations")))
        .filter((x) => x.endsWith(".sql"))
        .sort()) {
        if (
          !(
            await client.query(
              "select name from schema_migrations where name=$1",
              [name],
            )
          ).rowCount
        ) {
          await client.query(
            await readFile(resolve("database/migrations", name), "utf8"),
          );
          await client.query("insert into schema_migrations(name) values($1)", [
            name,
          ]);
        }
      }
      await client.query(
        "insert into questionnaire_versions(id,version,definition,state) select $1,1,$2,'published' where not exists(select 1 from questionnaire_versions)",
        [initial.id, JSON.stringify(initial)],
      );
      await client.query("COMMIT");
      console.log("Migrations and initial questionnaire applied.");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } else if (command === "admin") {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
      password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12)
      throw Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) securely in the process environment.",
      );
    if (
      process.env.ADMIN_TOTP_SECRET &&
      !/^[A-Z2-7]{16,128}$/i.test(process.env.ADMIN_TOTP_SECRET)
    )
      throw Error(
        "ADMIN_TOTP_SECRET must be valid base32 (16-128 characters).",
      );
    const existing = await db.query("select user_id from admins");
    if (existing.rowCount)
      throw Error("An administrator already exists. Use password recovery.");
    await db.query(
      "insert into admins(user_id,email,password_hash,totp_secret) values($1,$2,$3,$4)",
      [
        randomUUID(),
        email,
        hashPassword(password),
        process.env.ADMIN_TOTP_SECRET ?? null,
      ],
    );
    console.log("Administrator created.");
  } else if (command === "retention") {
    const days = Number(process.env.RETENTION_DAYS);
    if (
      !Number.isInteger(days) ||
      days < 1 ||
      process.env.PRIVACY_APPROVED !== "true"
    )
      throw Error(
        "Retention requires a positive RETENTION_DAYS and approved privacy policy.",
      );
    const r = await db.query(
      "delete from applications where created_at < now()-($1 * interval '1 day') returning id",
      [days],
    );
    console.log("Deleted applications:", r.rowCount);
  } else throw Error("Use migrate, admin or retention");
} finally {
  await db.end();
}
