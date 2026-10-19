import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createMariaDatabase } from "./mariadb.ts";
import { initial } from "../src/domain.ts";

export async function migrateMariaDatabase(url: string) {
  const db = createMariaDatabase(url);
  const client = await db.connect();
  try {
    await client.lock("migrations");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB",
    );
    for (const name of (await readdir(resolve("database/mariadb")))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      if (
        (
          await client.query(
            "select name from schema_migrations where name=$1",
            [name],
          )
        ).rowCount
      )
        continue;
      // MariaDB DDL commits implicitly. Each statement is rerunnable after interruption.
      const sql = await readFile(resolve("database/mariadb", name), "utf8");
      for (const statement of sql
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean))
        await client.query(statement);
      await client.query("insert into schema_migrations(name) values($1)", [
        name,
      ]);
    }
    await client.lock("questionnaires");
    await client.query(
      "insert into questionnaire_versions(id,version,definition,state) select $1,1,$2,'published' where not exists(select 1 from questionnaire_versions)",
      [initial.id, JSON.stringify(initial)],
    );
    console.log("MariaDB migrations and initial questionnaire applied.");
  } finally {
    await client.release();
    await db.end();
  }
}
