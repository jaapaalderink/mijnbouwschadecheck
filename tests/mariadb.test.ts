import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMariaDatabase } from "../server/mariadb.ts";
import { migrateMariaDatabase } from "../server/migrate-mariadb.ts";
import { exerciseDatabase } from "./helpers/database-workflow.ts";

const url = process.env.MARIADB_TEST_URL;
test(
  "MariaDB: migraties, opslag, versies, controle, outbox en cascades",
  {
    skip:
      !url &&
      "MARIADB_TEST_URL not configured; requires a dedicated disposable *_test database",
  },
  async () => {
    const parsed = new URL(url!);
    if (!decodeURIComponent(parsed.pathname).endsWith("_test"))
      throw Error(
        "Use a dedicated database ending in _test; this suite deletes its contents.",
      );
    await migrateMariaDatabase(url!);
    await migrateMariaDatabase(url!);
    const db = createMariaDatabase(url!);
    try {
      for (const table of [
        "applications",
        "sessions",
        "password_resets",
        "admins",
        "questionnaire_versions",
      ])
        await db.query(`delete from ${table}`);
      await exerciseDatabase(db);
      // Unique database constraints enforce one admin and one active questionnaire.
      await assert.rejects(
        db.query(
          "insert into admins(user_id,email,password_hash) values($1,$2,$3)",
          [randomUUID(), "second@example.invalid", "test"],
        ),
      );
      const q = (
        await db.query(
          "select * from questionnaire_versions where state='published'",
        )
      ).rows[0];
      const args = [
        randomUUID(),
        "concurrency-hash",
        q.id,
        JSON.stringify(q.definition),
        "{}",
        "{}",
        "[]",
        "review_needed",
        "[]",
        "parallel test",
      ];
      const submitSql =
        "select submit_application($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result";
      const results = await Promise.all([
        db.query(submitSql, args),
        db.query(submitSql, args),
      ]);
      assert.deepEqual(results[0].rows, results[1].rows);
      await assert.rejects(
        db.query(submitSql, [args[0], "different-hash", ...args.slice(2)]),
        /IDEMPOTENCY_CONFLICT/,
      );
      const claims = await Promise.all([
        db.query("select * from claim_notifications()"),
        db.query("select * from claim_notifications()"),
      ]);
      assert.equal(claims[0].rows.length + claims[1].rows.length, 1);
      // A released connection must roll back unfinished transactions.
      const client = await db.connect();
      await client.query("BEGIN");
      const admin = (await db.query("select user_id from admins")).rows[0]
        .user_id;
      const token = "f".repeat(64);
      await client.query(
        "insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')",
        [token, admin],
      );
      await client.release();
      assert.equal(
        (
          await db.query(
            "select token_hash from sessions where token_hash=$1",
            [token],
          )
        ).rowCount,
        0,
      );
      await migrateMariaDatabase(url!);
      assert.deepEqual(
        (
          await db.query(
            "select definition from questionnaire_versions where state='published'",
          )
        ).rows[0].definition,
        q.definition,
      );
      await assert.rejects(
        db.query(
          "insert into questionnaire_versions(id,version,definition,state) values($1,100,$2,'published')",
          [randomUUID(), JSON.stringify(q.definition)],
        ),
      );
    } finally {
      await db.end();
    }
  },
);
