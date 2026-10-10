// Development-only service startup for restored Codex cloud tasks.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { db } from "./database.ts";
if (process.env.NODE_ENV === "production")
  throw Error("Cloud development helper is disabled in production.");
if (!process.env.DATABASE_URL || !db)
  throw Error("Configure a local development DATABASE_URL in .env.");
const url = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  (url.port && url.port !== "5432") ||
  decodeURIComponent(url.username) !== "mijnbouw" ||
  url.pathname !== "/mijnbouw"
)
  throw Error(
    "Use your existing remote database directly. This helper supports only the documented local Compose database.",
  );
const env = {
  ...process.env,
  POSTGRES_PASSWORD: decodeURIComponent(url.password),
  DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/mijnbouw-docker",
};
function run(args: string[]) {
  const result = spawnSync("docker", args, { env, stdio: "inherit" });
  if (result.status !== 0) throw Error("Development service startup failed.");
}
try {
  try {
    await db.query("select 1");
    console.log("Existing PostgreSQL is reachable.");
  } catch {
    await mkdir(".local", { recursive: true });
    run(["compose", "up", "-d", "--wait", "database"]);
    await db.query("select 1");
  }
  if (
    process.env.SMTP_HOST === "127.0.0.1" &&
    process.env.SMTP_PORT === "1025"
  ) {
    try {
      const r = await fetch("http://127.0.0.1:8025/livez", {
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) throw Error("MAIL_NOT_READY");
      console.log("Existing local test mailserver is reachable.");
    } catch {
      run(["compose", "up", "-d", "mail"]);
    }
  }
  console.log("Local services ready. Run npm run db:migrate, then npm start.");
} finally {
  await db.end();
}
