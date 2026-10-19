import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { exerciseDatabase } from "./helpers/database-workflow.ts";

test("PostgreSQL: transactionele opslag, idempotentie, versies, controle en cascades", async () => {
  const db = new PGlite();
  try {
    for (const name of (await readdir("database/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("database/migrations/" + name, "utf8"));
    await exerciseDatabase(db);
  } finally {
    await db.close();
  }
});
