// MariaDB adapter for this application's parameterized database operations.
// PostgreSQL remains available for existing installations.
import mysql, { type PoolConnection } from "mysql2/promise";
import { createHash } from "node:crypto";

type Result = { rows: any[]; rowCount: number };
const jsonColumns = new Set([
  "definition",
  "questionnaire_snapshot",
  "contact",
  "address",
  "answers",
  "reasons",
  "changes",
]);
export function createMariaDatabase(connectionString: string) {
  const url = new URL(connectionString);
  if (!["mysql:", "mariadb:"].includes(url.protocol))
    throw Error("Expected a MariaDB URL");
  const database = decodeURIComponent(url.pathname.slice(1));
  const pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    connectionLimit: 10,
    connectTimeout: 5000,
    timezone: "Z",
    charset: "utf8mb4",
    supportBigNumbers: true,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
    multipleStatements: false,
  });
  class Client {
    private locks = new Set<string>();
    constructor(private connection: PoolConnection) {}
    async lock(key: string) {
      const name = createHash("sha256")
        .update(database + ":" + key)
        .digest("hex");
      if (this.locks.has(name)) return;
      const [rows] = await this.connection.query<any[]>(
        "SELECT GET_LOCK(?, 10) AS acquired",
        [name],
      );
      if (rows[0].acquired !== 1) throw Error("DATABASE_LOCK_TIMEOUT");
      this.locks.add(name);
    }
    private async unlock() {
      for (const name of this.locks)
        await this.connection.query("SELECT RELEASE_LOCK(?)", [name]);
      this.locks.clear();
    }
    async release() {
      // Never return a transaction or a named lock to the connection pool.
      try {
        await this.connection.rollback();
        await this.unlock();
      } catch (error) {
        this.connection.destroy();
        throw error;
      }
      this.connection.release();
    }
    async query(sql: string, values: any[] = []): Promise<Result> {
      if (/pg_advisory_xact_lock/i.test(sql)) {
        await this.lock("questionnaires");
        return { rows: [], rowCount: 0 };
      }
      if (/^\s*(COMMIT|ROLLBACK)\s*$/i.test(sql)) {
        await this.connection.query(sql);
        await this.unlock();
        return { rows: [], rowCount: 0 };
      }
      if (/select submit_application\(/i.test(sql)) return this.submit(values);
      if (/select save_questionnaire_draft\(/i.test(sql))
        return this.draft(values);
      if (/select publish_questionnaire\(/i.test(sql))
        return this.publish(values);
      if (/select update_application\(/i.test(sql)) return this.update(values);
      if (/select \* from claim_notifications\(\)/i.test(sql))
        return this.claim();
      // DML RETURNING is not portable; retain the affected-row contract.
      sql = sql.replace(/ returning id\s*$/i, "");
      sql = sql
        .replace(/\$([0-9]+)::timestamptz/g, "$$$1")
        .replace(/::int\b/g, "")
        .replace(
          /now\(\)\+interval '(\d+) (hours?|minutes?)'/gi,
          (_, n, unit) =>
            `DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${n} ${unit.toUpperCase().replace(/S$/, "")})`,
        )
        .replace(
          /now\(\)-\(\$1 \* interval '1 day'\)/gi,
          "DATE_SUB(UTC_TIMESTAMP(3), INTERVAL $1 DAY)",
        )
        .replace(/now\(\)/gi, "UTC_TIMESTAMP(3)")
        .replace(
          /search_text ilike '%'\|\|\$1\|\|'%'/gi,
          "search_text LIKE CONCAT('%', $1, '%')",
        )
        .replace(/select count\(\*\) from/gi, "select count(*) as count from");
      const parameters: any[] = [];
      sql = sql.replace(/\$(\d+)/g, (_, index) => {
        parameters.push(values[Number(index) - 1]);
        return "?";
      });
      const [result] = await this.connection.query(sql, parameters);
      if (!Array.isArray(result))
        return { rows: [], rowCount: (result as any).affectedRows ?? 0 };
      const rows = (result as any[]).map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            jsonColumns.has(key) && typeof value === "string"
              ? JSON.parse(value)
              : value,
          ]),
        ),
      );
      return { rows, rowCount: rows.length };
    }
    private async submit(a: any[]): Promise<Result> {
      await this.lock("submission:" + a[0]);
      const existing = await this.query(
        "select number,indication,payload_hash from applications where idempotency_key=$1",
        [a[0]],
      );
      if (existing.rowCount) {
        if (existing.rows[0].payload_hash !== a[1])
          throw Error("IDEMPOTENCY_CONFLICT");
        return {
          rows: [
            {
              result: {
                number: existing.rows[0].number,
                indication: existing.rows[0].indication,
              },
            },
          ],
          rowCount: 1,
        };
      }
      if (
        !(
          await this.query(
            "select id from questionnaire_versions where id=$1 and state in ('published','archived')",
            [a[2]],
          )
        ).rowCount
      )
        throw Error("INVALID_VERSION");
      await this.query(
        "insert into applications(idempotency_key,payload_hash,version_id,questionnaire_snapshot,contact,address,answers,indication,reasons,search_text) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        a,
      );
      const saved = await this.query(
        "select id,number,indication from applications where idempotency_key=$1",
        [a[0]],
      );
      await this.query(
        "insert into notification_outbox(application_id) values($1)",
        [saved.rows[0].id],
      );
      return {
        rows: [
          {
            result: {
              number: saved.rows[0].number,
              indication: saved.rows[0].indication,
            },
          },
        ],
        rowCount: 1,
      };
    }
    private async draft([id, definition]: any[]): Promise<Result> {
      await this.lock("questionnaires");
      const old = await this.query(
        "select state from questionnaire_versions where id=$1",
        [id],
      );
      if (old.rowCount) {
        if (old.rows[0].state !== "draft") throw Error("IMMUTABLE_VERSION");
        await this.query(
          "update questionnaire_versions set definition=$1 where id=$2",
          [definition, id],
        );
      } else {
        const min = await this.query(
          "select coalesce(min(version)-1,-1) as version from questionnaire_versions where state='draft'",
        );
        await this.query(
          "insert into questionnaire_versions(id,version,definition,state) values($1,$2,$3,'draft')",
          [id, min.rows[0].version, definition],
        );
      }
      return { rows: [], rowCount: 0 };
    }
    private async publish([id, definition]: any[]): Promise<Result> {
      await this.lock("questionnaires");
      if (
        !(
          await this.query(
            "select id from questionnaire_versions where id=$1 and state='draft' for update",
            [id],
          )
        ).rowCount
      )
        throw Error("NOT_DRAFT");
      const version = Number(
        (
          await this.query(
            "select coalesce(max(version),0)+1 as version from questionnaire_versions where state<>'draft'",
          )
        ).rows[0].version,
      );
      await this.query(
        "update questionnaire_versions set state='archived' where state='published'",
      );
      await this.query(
        "update questionnaire_versions set state='published',version=$1,definition=$2 where id=$3",
        [version, JSON.stringify({ ...JSON.parse(definition), version }), id],
      );
      return { rows: [{ result: { version } }], rowCount: 1 };
    }
    private async update([
      id,
      actor,
      status,
      review,
      note,
    ]: any[]): Promise<Result> {
      if (
        !(
          await this.query("select user_id from admins where user_id=$1", [
            actor,
          ])
        ).rowCount
      )
        throw Error("FORBIDDEN");
      const result = await this.query(
        "select * from applications where id=$1 for update",
        [id],
      );
      if (!result.rowCount) throw Error("NOT_FOUND");
      const old = result.rows[0];
      const changes = {
        status: [old.status, status],
        review_status: [old.review_status, review],
        note_changed: old.note !== note,
      };
      const reviewed = review === "Gecontroleerd";
      await this.query(
        "update applications set status=$1,review_status=$2,note=$3,reviewed_at=$4,reviewed_by=$5 where id=$6",
        [
          status,
          review,
          note,
          reviewed ? (old.reviewed_at ?? new Date()) : null,
          reviewed ? (old.reviewed_by ?? actor) : null,
          id,
        ],
      );
      await this.query(
        "insert into application_audit(application_id,actor,changes) values($1,$2,$3)",
        [id, actor, JSON.stringify(changes)],
      );
      return { rows: [], rowCount: 0 };
    }
    private async claim(): Promise<Result> {
      const rows = await this.query(
        "select id,application_id,attempts from notification_outbox where attempts<5 and status in ('pending','sending') and next_attempt_at<=UTC_TIMESTAMP(3) order by next_attempt_at limit 10 for update skip locked",
      );
      for (const item of rows.rows) {
        await this.query(
          "update notification_outbox set status='sending',attempts=attempts+1,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE) where id=$1",
          [item.id],
        );
        item.attempts++;
      }
      return rows;
    }
  }
  async function connect() {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
    } catch (e) {
      connection.release();
      throw e;
    }
    return new Client(connection);
  }
  return {
    connect,
    async query(sql: string, values: any[] = []) {
      const client = await connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(sql, values);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        await client.release();
      }
    },
    end: () => pool.end(),
  };
}
