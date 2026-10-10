import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { initial, prepareSubmission } from "../src/domain.ts";
test("database: transactionele opslag, idempotentie, versies, controle en cascades", async () => {
  const db = new PGlite();
  try {
    for (const name of (await readdir("database/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("database/migrations/" + name, "utf8"));
    await db.query(
      "insert into questionnaire_versions(id,version,definition,state) values($1,1,$2,'published')",
      [initial.id, JSON.stringify(initial)],
    );
    const admin = randomUUID();
    await db.query(
      "insert into admins(user_id,email,password_hash) values($1,$2,$3)",
      [admin, "admin@example.invalid", "test-only"],
    );
    const p = prepareSubmission(initial, {
      version_id: initial.id,
      idempotency_key: randomUUID(),
      answers: {
        postcode: "1234ab",
        house_number: "12",
        year: "o3",
        home: "o1",
        size: "o2",
        damage: "o4",
        previous: "o3",
      },
      contact: {
        name: "Test Aanvrager",
        email: "test@example.invalid",
        phone: "0612345678",
        street: "Teststraat",
        city: "Testplaats",
      },
      website: "",
    });
    const args = [
      p.idempotency_key,
      "hash",
      p.version_id,
      JSON.stringify(initial),
      JSON.stringify(p.contact),
      JSON.stringify({ postcode: "1234 AB" }),
      JSON.stringify(p.snapshots),
      p.indication,
      JSON.stringify(p.reasons),
      "test",
    ];
    const submit = () =>
      db.query<any>(
        "select submit_application($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
        args,
      );
    const first = await submit();
    const retry = await submit();
    assert.deepEqual(first.rows, retry.rows);
    assert.equal(first.rows[0].result.indication, "review_needed");
    assert.equal(
      (await db.query<any>("select count(*)::int as count from applications"))
        .rows[0].count,
      1,
    );
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int as count from notification_outbox",
        )
      ).rows[0].count,
      1,
    );
    await assert.rejects(
      db.query("select submit_application($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
        ...args.slice(0, 1),
        "different",
        ...args.slice(2),
      ]),
    );
    const id = (await db.query<any>("select id from applications")).rows[0].id;
    await assert.rejects(
      db.query("select update_application($1,$2,$3,$4,$5)", [
        id,
        randomUUID(),
        "Afgerond",
        "Gecontroleerd",
        "",
      ]),
    );
    await db.query("select update_application($1,$2,$3,$4,$5)", [
      id,
      admin,
      "Afgerond",
      "Nog te controleren",
      "testnote",
    ]);
    let row = (await db.query<any>("select * from applications")).rows[0];
    assert.equal(row.reviewed_at, null);
    await db.query("select update_application($1,$2,$3,$4,$5)", [
      id,
      admin,
      "Afgerond",
      "Gecontroleerd",
      "testnote",
    ]);
    row = (await db.query<any>("select * from applications")).rows[0];
    assert.equal(row.reviewed_by, admin);
    assert.ok(row.reviewed_at);
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int as count from application_audit",
        )
      ).rows[0].count,
      2,
    );
    const next = { ...structuredClone(initial), id: randomUUID(), version: 2 };
    next.questions[2].options[2].label = "Nieuwe versie";
    await db.query("select save_questionnaire_draft($1,$2)", [
      next.id,
      JSON.stringify(next),
    ]);
    await db.query("select publish_questionnaire($1,$2)", [
      next.id,
      JSON.stringify(next),
    ]);
    assert.equal(
      (
        await db.query<any>(
          "select state from questionnaire_versions where id=$1",
          [initial.id],
        )
      ).rows[0].state,
      "archived",
    );
    assert.equal(
      row.questionnaire_snapshot.questions[2].options[2].label,
      "1990 - heden",
    );
    await assert.rejects(
      db.query("select save_questionnaire_draft($1,$2)", [
        initial.id,
        JSON.stringify(next),
      ]),
    );
    const claimed = await db.query<any>("select * from claim_notifications()");
    assert.equal(claimed.rows.length, 1);
    assert.equal(claimed.rows[0].attempts, 1);
    assert.equal(
      (await db.query("select * from claim_notifications()")).rows.length,
      0,
    );
    await db.query(
      "update notification_outbox set status='pending',next_attempt_at=now() where application_id=$1",
      [id],
    );
    assert.equal(
      (await db.query<any>("select * from claim_notifications()")).rows[0]
        .attempts,
      2,
    );
    await db.query("delete from applications where id=$1", [id]);
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int as count from notification_outbox",
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int as count from application_audit",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});
